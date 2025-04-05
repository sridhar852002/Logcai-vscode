// src/features/AutocompleteProvider.ts
import * as vscode from 'vscode';
import { generateLocalResponse } from '../ai/localAI';
import logger from '../utils/logger';
import { isPlanAtLeast as globalIsPlanAtLeast, UserPlan } from '../monetization/planManager';

// Define the AutocompleteProvider class
export class AutocompleteProvider implements vscode.CompletionItemProvider {
  private _isEnabled: boolean = true;
  private _modelId: string = 'mistral';
  private _userPlan: UserPlan = 'Free'; // Add property to track user plan
  private _lastRequestTime: number = 0;
  private _minimumDelay: number = 1000; // 1 second between requests

  get isEnabled(): boolean {
    return this._isEnabled;
  }

  // New method to set user plan
  public setUserPlan(plan: UserPlan): void {
    this._userPlan = plan;
    logger.info(`Autocomplete provider user plan set to: ${plan}`);
  }

  // Provide completion items when VS Code calls this method
  public async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[] | undefined> {
    // Check if user has the right plan - Use the tracked userPlan property
    if (!checkPlanRequirement('LocalPro', this._userPlan)) {
      logger.debug(`Autocomplete skipped - current plan: ${this._userPlan}, requires: LocalPro`);
      return undefined;
    }

    // Check if the feature is enabled
    if (!this._isEnabled) {
      return undefined;
    }

    // Throttle requests to prevent overloading the model
    const now = Date.now();
    if (now - this._lastRequestTime < this._minimumDelay) {
      return undefined;
    }
    this._lastRequestTime = now;

    try {
      // Determine the current line and prefix
      const linePrefix = document.lineAt(position).text.substring(0, position.character);
      if (linePrefix.trim().length < 3) {
        // Don't suggest for very short inputs
        return undefined;
      }

      // Capture a snippet of the code as context (e.g., current line and previous 4 lines)
      const startLine = Math.max(0, position.line - 4);
      const range = new vscode.Range(startLine, 0, position.line, position.character);
      const snippet = document.getText(range);

      // Get the language for better prompting
      const language = document.languageId;

      // Build a prompt for the AI engine
      const prompt = `As a coding assistant, provide completion suggestions for the following ${language} code
snippet.
Focus on completing the current line or statement. Provide 3-5 different possible completions that would make
sense.
Each completion should be on a new line and start with "- ".
Code snippet:
\`\`\`${language}
${snippet}
\`\`\`
Suggestions:`;

      // Call your local AI engine to generate suggestions
      const aiResponse = await generateLocalResponse(prompt, this._modelId, { stream: false });

      // Check if cancellation was requested before proceeding
      if (token.isCancellationRequested) {
        return undefined;
      }

      // Parse the AI response to get different suggestions
      // The response format should be:
      // - suggestion1
      // - suggestion2
      // - suggestion3
      const suggestions = aiResponse
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.trim().substring(1).trim())
        .filter(suggestion => suggestion.length > 0);

      // If no valid suggestions, return empty
      if (suggestions.length === 0) {
        return undefined;
      }

      // Create completion items for each suggestion
      return suggestions.map((suggestion, index) => {
        const completionItem = new vscode.CompletionItem(
          suggestion,
          vscode.CompletionItemKind.Text
        );
        
        // Add details to the completion item
        completionItem.detail = "AI suggestion";
        completionItem.documentation = new vscode.MarkdownString(
          `Suggestion ${index + 1} of ${suggestions.length} from Logcai AI`
        );
        
        // Sort order (lower = higher priority)
        completionItem.sortText = `0${index}`.padStart(3, '0');
        
        // If the suggestion is longer, make it a snippet
        if (suggestion.includes('\n') || suggestion.length > 50) {
          completionItem.insertText = new vscode.SnippetString(suggestion);
        }
        
        return completionItem;
      });
    } catch (error) {
      logger.error("Error generating autocomplete suggestion:", error);
      return undefined;
    }
  }

  public setModel(modelId: string): void {
    this._modelId = modelId;
    logger.info(`Autocomplete model set to: ${modelId}`);
  }

  public setEnabled(enabled: boolean): void {
    this._isEnabled = enabled;
    logger.info(`Autocomplete ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// Add this helper function with a different name to avoid conflict
function checkPlanRequirement(required: UserPlan, currentPlan: UserPlan): boolean {
  const result = globalIsPlanAtLeast(required);
  logger.debug(`Plan check: ${currentPlan} >= ${required} = ${result}`);
  return result;
}