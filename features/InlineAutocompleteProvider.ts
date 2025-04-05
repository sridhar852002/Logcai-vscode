// src/features/InlineAutocompleteProvider.ts
import * as vscode from 'vscode';
import { generateLocalResponse } from '../ai/localAI';
import logger from '../utils/logger';
import { isPlanAtLeast as globalIsPlanAtLeast, UserPlan } from '../monetization/planManager';

/**
* Helper function to extract a larger context from the document.
* Gets surrounding code to improve AI autocomplete quality.
*/
function getFullContext(document: vscode.TextDocument, position: vscode.Position, maxLines: number = 15):
string {
  // Start line: Go back several lines to get more context
  let startLine = Math.max(0, position.line - maxLines);
  // Try to find a logical starting point like function declaration
  while (startLine > 0 && startLine > position.line - maxLines) {
    const lineText = document.lineAt(startLine).text;
    if (lineText.trim() === '' ||
      /\b(function|def|class|if|for|while|switch)\b/.test(lineText) ||
      /{|}/.test(lineText)) {
      break;
    }
    startLine--;
  }
  // Get the text range for context
  const range = new vscode.Range(startLine, 0, position.line, position.character);
  return document.getText(range);
}

/**
* Gets the document language for the prompt
*/
function getLanguageInfo(document: vscode.TextDocument): string {
  const languageMap: Record<string, string> = {
    'typescript': 'TypeScript',
    'javascript': 'JavaScript',
    'python': 'Python',
    'java': 'Java',
    'csharp': 'C#',
    'cpp': 'C++',
    'c': 'C',
    'go': 'Go',
    'rust': 'Rust',
    'php': 'PHP',
    'ruby': 'Ruby',
    'html': 'HTML',
    'css': 'CSS',
    'json': 'JSON',
  };
  return languageMap[document.languageId] || document.languageId;
}

export class InlineAutocompleteProvider implements vscode.InlineCompletionItemProvider {
  private _isEnabled: boolean = true;
  private _modelId: string = 'mistral';
  private _userPlan: UserPlan = 'Free'; // Add property to track user plan
  private _debounceTimeout: NodeJS.Timeout | null = null;
  private _lastRequestTime: number = 0;
  private _minimumDelay: number = 500; // Minimum time between requests (ms)

  get isEnabled(): boolean {
    return this._isEnabled;
  }

  // New method to set user plan
  public setUserPlan(plan: UserPlan): void {
    this._userPlan = plan;
    logger.info(`Inline completion provider user plan set to: ${plan}`);
  }

  public async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | undefined> {
    // Check if user has the right plan - Use the tracked userPlan property instead
    if (!checkPlanRequirement('LocalPro', this._userPlan)) {
      logger.debug(`Inline completion skipped - current plan: ${this._userPlan}, requires: LocalPro`);
      return;
    }

    // Check if the feature is enabled
    if (!this._isEnabled) {
      return;
    }

    // Debounce requests to avoid overwhelming the AI service
    const now = Date.now();
    if (now - this._lastRequestTime < this._minimumDelay) {
      return;
    }
    this._lastRequestTime = now;

    // Don't provide completions if this is a fast typing session
    if (this._debounceTimeout) {
      clearTimeout(this._debounceTimeout);
    }

    return new Promise((resolve) => {
      this._debounceTimeout = setTimeout(async () => {
        try {
          // Don't continue if the token has been cancelled
          if (token.isCancellationRequested) {
            resolve(undefined);
            return;
          }

          // Get context from around the cursor
          const contextSnippet = getFullContext(document, position);
          const language = getLanguageInfo(document);

          // Don't try to provide completions for very short snippets
          if (contextSnippet.length < 10) {
            resolve(undefined);
            return;
          }

          // Construct a refined prompt
          const prompt = `You are a coding assistant. Complete the following ${language} code with a relevant,
contextual, and helpful continuation. Focus on providing only the next logical steps that would complete or
extend the current code.
Current code context:
\`\`\`${language}
${contextSnippet}
\`\`\`
Provide ONLY the code continuation (no explanations or backticks). Start exactly where the context ends:`;

          // Request a completion from the AI
          logger.debug(`Generating inline completion at line ${position.line}, col ${position.character}`);
          const aiResponse = await generateLocalResponse(prompt, this._modelId, { stream: false });

          // Check for cancellation
          if (token.isCancellationRequested) {
            logger.debug('Inline completion request was cancelled');
            resolve(undefined);
            return;
          }

          // Debug log of the response
          logger.debug(`Inline completion generated: ${aiResponse.slice(0, 100)}${aiResponse.length > 100 ?
'...' : ''}`);

          // Create the inline completion item
          const inlineItem = new vscode.InlineCompletionItem(
            aiResponse.trim(),
            new vscode.Range(position, position)
          );

          resolve([inlineItem]);
        } catch (error) {
          logger.error("Error generating inline completion:", error);
          resolve(undefined);
        }
      }, 500); // Debounce for 500ms
    });
  }

  public setModel(modelId: string): void {
    this._modelId = modelId;
    logger.info(`Inline completion model set to: ${modelId}`);
  }

  public setEnabled(enabled: boolean): void {
    this._isEnabled = enabled;
    logger.info(`Inline completions ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// Add this helper function with a different name to avoid conflict
function checkPlanRequirement(required: UserPlan, currentPlan: UserPlan): boolean {
  const result = globalIsPlanAtLeast(required);
  logger.debug(`Plan check: ${currentPlan} >= ${required} = ${result}`);
  return result;
}