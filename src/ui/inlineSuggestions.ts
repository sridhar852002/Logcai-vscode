import * as vscode from 'vscode';
import axios from 'axios';
import { ModelManager } from '../models/modelManager';
import { ContextManager } from '../context/contextManager';
import { ConfigurationManager } from '../config/configuration';
import { PROMPTS } from '../config/constants';
import { handleError } from '../utils/errorHandler';
import { log } from '../utils/logging';

export class InlineSuggestionProvider implements vscode.InlineCompletionItemProvider {
  // Configuration properties
  private enabled!: boolean;
  private previewDelay!: number;
  private maxTokens!: number;
  private temperature!: number;
  private promptWindowSize!: number;
  private completionTriggerChars!: string[];
  private showPreview!: boolean;
  private continueInline!: boolean;

  constructor(
    private modelManager: ModelManager,
    private contextManager: ContextManager,
    private configManager: ConfigurationManager
  ) {
    this.refreshConfiguration();
  }

  refreshConfiguration(): void {
    const config = this.configManager.getConfiguration();
    this.enabled = config.enableInlineSuggestions;
    this.previewDelay = config.inlinePreviewDelay;
    this.maxTokens = config.maxTokens;
    this.temperature = config.temperature;
    this.promptWindowSize = config.maxContextLength;
    this.completionTriggerChars = this.configManager.getCompletionTriggerCharacters();
    // Additional settings similar to the provided code
    this.showPreview = true; // Default to true, you can make this configurable
    this.continueInline = true; // Default to true, you can make this configurable
    log.info('Inline Suggestion Provider configuration refreshed');
  }

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | null> {
    if (!this.enabled) {
      log.debug('Inline suggestions are disabled');
      return null;
    }

    try {
      // Apply configurable delay to reduce unnecessary requests while typing
      if (this.previewDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, this.previewDelay * 1000));
      }

      if (token.isCancellationRequested) {
        return null;
      }

      // Get current code until cursor position
      const prefix = document.getText(new vscode.Range(0, 0, position.line, position.character));
      
      // Skip if the prefix is too short or doesn't make sense to complete
      if (prefix.trim().length < 3) {
        return null;
      }

      // Create a completion item
      const item = new vscode.InlineCompletionItem(
        '', // Empty by default, will be filled with response
        new vscode.Range(position, position)
      );

      // If showing preview, get a short completion to display
      if (this.showPreview) {
        // Get current code context
        const context = await this.contextManager.getFullContext(document, position);
        
        // Format the prompt for code completion
        const prompt = PROMPTS.CODE_COMPLETION
          .replace('{FILE_NAME}', document.fileName)
          .replace('{LANGUAGE}', document.languageId)
          .replace('{PROJECT_NAME}', vscode.workspace.name || 'Untitled')
          .replace('{CONTEXT}', context)
          .replace('{CODE}', prefix);

        // Get a short completion for preview
        const completion = await this.modelManager.getCompletion(prompt, {
          maxTokens: 100,
          temperature: this.temperature,
          stopSequences: ['```'] // Stop at code block boundaries
        });

        if (!completion || token.isCancellationRequested) {
          return null;
        }

        // Update the item with the preview
        item.insertText = completion;

        // Set a command to execute when the completion is accepted
        if (this.continueInline) {
          item.command = {
            command: 'logcai.getInlineCompletion',
            title: 'Continue Completion',
            arguments: [document, position, token]
          };
        }
      }

      return [item];
    } catch (error) {
      handleError(error as Error, 'Failed to provide inline completion');
      return null;
    }
  }

  /**
   * Manually trigger inline completion (for the command)
   */
  async provideInlineCompletion(textEditor: vscode.TextEditor): Promise<void> {
    try {
      const document = textEditor.document;
      const position = textEditor.selection.active;
      
      // Create status bar item for progress indicator
      const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
      statusItem.text = "$(sync~spin) LogCAI: Generating code...";
      statusItem.show();
      
      // Start with a progress indicator
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'LogCAI: Generating Completion',
          cancellable: true
        },
        async (progress, token) => {
          try {
            progress.report({ message: 'Analyzing context...' });
            // Get current code context
            const context = await this.contextManager.getFullContext(document, position);
            
            // Get current code until cursor position
            const prefix = document.getText(new vscode.Range(0, 0, position.line, position.character));
            
            // Format the prompt for code completion
            const prompt = PROMPTS.CODE_COMPLETION
              .replace('{FILE_NAME}', document.fileName)
              .replace('{LANGUAGE}', document.languageId)
              .replace('{PROJECT_NAME}', vscode.workspace.name || 'Untitled')
              .replace('{CONTEXT}', context)
              .replace('{CODE}', prefix);
            
            progress.report({ message: 'Generating code...' });
            
            // Track current position for streaming
            let currentPosition = position;
            
            // Stream the completion
            await this.modelManager.streamCompletion(
              prompt,
              async (text, final) => {
                if (token.isCancellationRequested) {
                  return;
                }
                
                // Apply the edit for this chunk
                const edit = new vscode.WorkspaceEdit();
                edit.insert(document.uri, currentPosition, text);
                await vscode.workspace.applyEdit(edit);
                
                // Update cursor position
                const lines = text.split('\n');
                if (lines.length > 1) {
                  currentPosition = new vscode.Position(
                    currentPosition.line + lines.length - 1,
                    lines[lines.length - 1].length
                  );
                } else {
                  currentPosition = new vscode.Position(
                    currentPosition.line,
                    currentPosition.character + text.length
                  );
                }
                
                // Update selection to show the completion
                textEditor.selection = new vscode.Selection(position, currentPosition);
              },
              token
            );
            
            // Update status to show completion
            statusItem.text = "$(check) LogCAI: Code generated";
            setTimeout(() => statusItem.dispose(), 2000);
            
            progress.report({ message: 'Completion finished', increment: 100 });
          } catch (error) {
            // Update status to show error
            statusItem.text = "$(error) LogCAI: Generation failed";
            setTimeout(() => statusItem.dispose(), 2000);
            
            if (token.isCancellationRequested) {
              log.info('Inline completion canceled by user');
            } else {
              handleError(error as Error, 'Failed to generate inline completion');
            }
          }
        }
      );
    } catch (error) {
      handleError(error as Error, 'Failed to provide inline completion');
    }
  }
}