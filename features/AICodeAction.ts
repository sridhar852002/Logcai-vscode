// src/features/AICodeAction.ts
import * as vscode from 'vscode';
import { generateLocalResponse } from '../ai/localAI';
import logger from '../utils/logger';
import responseCache from '../utils/responseCache';
import networkAwareness from '../utils/networkAwareness';
import { isPlanAtLeast } from '../monetization/planManager';

/**
 * Types of code actions that can be provided
 */
export enum AICodeActionKind {
  FIX_ERROR = 'fix-error',
  OPTIMIZE = 'optimize',
  EXPLAIN = 'explain',
  REFACTOR = 'refactor',
  DOCUMENT = 'document',
  TEST = 'test'
}

/**
 * Extends VS Code's CodeActionProvider to offer AI-powered code actions
 */
export class AICodeActionProvider implements vscode.CodeActionProvider {
  
  // Store the most recently provided code actions
  private lastActions: Map<string, vscode.CodeAction> = new Map();
  
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
    vscode.CodeActionKind.Refactor
  ];
  
  /**
   * Provide code actions for the given document and range
   */
  public async provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeAction[]> {
    // Clear previous actions
    this.lastActions.clear();
    
    // Skip if user doesn't have required plan
    if (!isPlanAtLeast('LocalPro')) {
      return [];
    }
    
    const actions: vscode.CodeAction[] = [];
    const hasError = context.diagnostics.length > 0;
    
    // Add "Fix with AI" action if we have diagnostics
    if (hasError) {
      actions.push(this.createFixErrorAction(document, range, context.diagnostics));
    }
    
    // Only offer other actions if we have a meaningful selection
    if (!range.isEmpty) {
      // Get the selected text
      const selectedText = document.getText(range);
      
      // Skip tiny selections
      if (selectedText.length < 5) {
        return actions;
      }
      
      // Add standard actions
      actions.push(this.createOptimizeAction(document, range));
      actions.push(this.createRefactorAction(document, range));
      actions.push(this.createDocumentAction(document, range));
      
      // Add test generation action only for function-like selections
      if (this.looksLikeFunction(selectedText, document.languageId)) {
        actions.push(this.createTestAction(document, range));
      }
      
      // Add explain action
      actions.push(this.createExplainAction(document, range));
    }
    
    return actions;
  }
  
  /**
   * Create an action to fix an error
   */
  private createFixErrorAction(
    document: vscode.TextDocument,
    range: vscode.Range,
    diagnostics: readonly vscode.Diagnostic[]
  ): vscode.CodeAction {
    const fixAction = new vscode.CodeAction(
      'Fix with AI',
      vscode.CodeActionKind.QuickFix
    );
    
    // Use the first diagnostic message for context
    const diagnostic = diagnostics[0];
    const diagnosticMessage = diagnostic.message;
    const diagnosticRange = diagnostic.range;
    
    // Get the code around the diagnostic
    const fixRange = diagnosticRange.isEmpty ? 
      this.expandRangeToLines(document, diagnosticRange, 2) : 
      diagnosticRange;
    
    const codeToFix = document.getText(fixRange);
    
    // Create command to execute when the action is selected
    fixAction.command = {
      title: 'Fix with AI',
      command: 'logcai.executeCodeAction',
      arguments: [
        document.uri,
        fixRange,
        AICodeActionKind.FIX_ERROR,
        diagnosticMessage,
        codeToFix
      ]
    };
    
    fixAction.diagnostics = [diagnostic];
    fixAction.isPreferred = true;
    
    // Store the action for later execution
    const actionKey = `fix:${document.uri.toString()}:${fixRange.start.line}:${fixRange.end.line}`;
    this.lastActions.set(actionKey, fixAction);
    
    return fixAction;
  }
  
  /**
   * Create an action to optimize code
   */
  private createOptimizeAction(
    document: vscode.TextDocument,
    range: vscode.Range
  ): vscode.CodeAction {
    const optimizeAction = new vscode.CodeAction(
      'Optimize with AI',
      vscode.CodeActionKind.RefactorRewrite
    );
    
    // Get the selected code
    const codeToOptimize = document.getText(range);
    
    // Create command to execute when the action is selected
    optimizeAction.command = {
      title: 'Optimize with AI',
      command: 'logcai.executeCodeAction',
      arguments: [
        document.uri,
        range,
        AICodeActionKind.OPTIMIZE,
        'Optimize this code for better performance and readability',
        codeToOptimize
      ]
    };
    
    // Store the action for later execution
    const actionKey = `optimize:${document.uri.toString()}:${range.start.line}:${range.end.line}`;
    this.lastActions.set(actionKey, optimizeAction);
    
    return optimizeAction;
  }
  
  /**
   * Create an action to refactor code
   */
  private createRefactorAction(
    document: vscode.TextDocument,
    range: vscode.Range
  ): vscode.CodeAction {
    const refactorAction = new vscode.CodeAction(
      'Refactor with AI',
      vscode.CodeActionKind.Refactor
    );
    
    // Get the selected code
    const codeToRefactor = document.getText(range);
    
    // Create command to execute when the action is selected
    refactorAction.command = {
      title: 'Refactor with AI',
      command: 'logcai.executeCodeAction',
      arguments: [
        document.uri,
        range,
        AICodeActionKind.REFACTOR,
        'Refactor this code to improve structure and maintainability',
        codeToRefactor
      ]
    };
    
    // Store the action for later execution
    const actionKey = `refactor:${document.uri.toString()}:${range.start.line}:${range.end.line}`;
    this.lastActions.set(actionKey, refactorAction);
    
    return refactorAction;
  }
  
  /**
   * Create an action to add documentation
   */
  private createDocumentAction(
    document: vscode.TextDocument,
    range: vscode.Range
  ): vscode.CodeAction {
    const documentAction = new vscode.CodeAction(
      'Add Documentation',
      vscode.CodeActionKind.RefactorRewrite
    );
    
    // Get the selected code
    const codeToDocument = document.getText(range);
    
    // Create command to execute when the action is selected
    documentAction.command = {
      title: 'Add Documentation',
      command: 'logcai.executeCodeAction',
      arguments: [
        document.uri,
        range,
        AICodeActionKind.DOCUMENT,
        'Add comprehensive documentation to this code',
        codeToDocument
      ]
    };
    
    // Store the action for later execution
    const actionKey = `document:${document.uri.toString()}:${range.start.line}:${range.end.line}`;
    this.lastActions.set(actionKey, documentAction);
    
    return documentAction;
  }
  
  /**
   * Create an action to generate tests
   */
  private createTestAction(
    document: vscode.TextDocument,
    range: vscode.Range
  ): vscode.CodeAction {
    const testAction = new vscode.CodeAction(
      'Generate Tests',
      vscode.CodeActionKind.RefactorRewrite
    );
    
    // Get the selected code
    const codeToTest = document.getText(range);
    
    // Create command to execute when the action is selected
    testAction.command = {
      title: 'Generate Tests',
      command: 'logcai.executeCodeAction',
      arguments: [
        document.uri,
        range,
        AICodeActionKind.TEST,
        'Generate comprehensive tests for this code',
        codeToTest
      ]
    };
    
    // Store the action for later execution
    const actionKey = `test:${document.uri.toString()}:${range.start.line}:${range.end.line}`;
    this.lastActions.set(actionKey, testAction);
    
    return testAction;
  }
  
  /**
   * Create an action to explain code
   */
  private createExplainAction(
    document: vscode.TextDocument,
    range: vscode.Range
  ): vscode.CodeAction {
    const explainAction = new vscode.CodeAction(
      'Explain Code',
      vscode.CodeActionKind.QuickFix
    );
    
    // Get the selected code
    const codeToExplain = document.getText(range);
    
    // Create command to execute when the action is selected
    explainAction.command = {
      title: 'Explain Code',
      command: 'logcai.executeCodeAction',
      arguments: [
        document.uri,
        range,
        AICodeActionKind.EXPLAIN,
        'Explain what this code does in detail',
        codeToExplain
      ]
    };
    
    // Store the action for later execution
    const actionKey = `explain:${document.uri.toString()}:${range.start.line}:${range.end.line}`;
    this.lastActions.set(actionKey, explainAction);
    
    return explainAction;
  }
  
  /**
   * Execute a code action
   */
  public async executeCodeAction(
    uri: vscode.Uri,
    range: vscode.Range,
    kind: AICodeActionKind,
    instruction: string,
    code: string
  ): Promise<void> {
    try {
      // Show progress notification
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `AI generating ${kind.replace('-', ' ')}...`,
        cancellable: true
      }, async (progress, token) => {
        progress.report({ increment: 0 });
        
        // Generate the output
        const output = await this.generateOutput(kind, instruction, code, token);
        
        // If generation was cancelled, stop here
        if (token.isCancellationRequested || !output) {
          return;
        }
        
        progress.report({ increment: 50, message: 'Applying changes...' });
        
        // Apply the output based on the kind of action
        if (kind === AICodeActionKind.EXPLAIN) {
          // For explanation, show in a new editor
          await this.showExplanation(code, output);
        } else {
          // For code changes, apply to the document
          await this.applyCodeChange(uri, range, output);
        }
        
        progress.report({ increment: 100 });
      });
    } catch (error) {
      logger.error(`Error executing ${kind} code action`, error);
      vscode.window.showErrorMessage(`Failed to generate ${kind}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Generate output for a code action
   */
  private async generateOutput(
    kind: AICodeActionKind,
    instruction: string,
    code: string,
    token: vscode.CancellationToken
  ): Promise<string | null> {
    // Check cache first
    const cacheKey = `${kind}:${instruction}:${code}`;
    const cachedResponse = responseCache.get(cacheKey, 'ai-code-action', {});
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Build prompt based on the action kind
    let prompt = `${instruction}:\n\n\`\`\`\n${code}\n\`\`\`\n\n`;
    
    switch (kind) {
      case AICodeActionKind.FIX_ERROR:
        prompt += 'Fix any errors in this code and return the corrected version. Only return the fixed code without any explanations.';
        break;
        
      case AICodeActionKind.OPTIMIZE:
        prompt += 'Optimize this code for better performance and readability. Return only the optimized code without explanations.';
        break;
        
      case AICodeActionKind.REFACTOR:
        prompt += 'Refactor this code to improve its structure and maintainability. Return only the refactored code without explanations.';
        break;
        
      case AICodeActionKind.DOCUMENT:
        prompt += 'Add comprehensive documentation to this code using the appropriate comment style for the language. Return the code with added documentation.';
        break;
        
      case AICodeActionKind.TEST:
        prompt += 'Generate comprehensive tests for this code. Consider edge cases and error conditions. Return only the test code.';
        break;
        
      case AICodeActionKind.EXPLAIN:
        prompt += `
          Provide a detailed explanation of what this code does, including:
          1. Overall purpose
          2. How it works step by step
          3. Any important patterns or techniques used
          4. Potential issues or edge cases
          
          Be thorough but concise, and focus on explaining the core logic.
        `;
        break;
    }
    
    try {
      // Use local model for better reliability and privacy
      const result = await generateLocalResponse(
        prompt,
        'mistral', // Default to mistral for code actions
        { stream: false }
      );
      
      // Check if cancelled
      if (token.isCancellationRequested) {
        return null;
      }
      
      // Extract code blocks for non-explain actions
      if (kind !== AICodeActionKind.EXPLAIN) {
        const codeBlockRegex = /```(?:\w+)?\s*([\s\S]+?)```/;
        const match = result.match(codeBlockRegex);
        
        if (match && match[1]) {
          const extractedCode = match[1].trim();
          
          // Cache the result
          responseCache.set(cacheKey, extractedCode, 'ai-code-action', {});
          
          return extractedCode;
        }
        
        // If no code block found, return the whole result
        responseCache.set(cacheKey, result, 'ai-code-action', {});
        return result;
      }
      
      // For explanations, return the whole result
      responseCache.set(cacheKey, result, 'ai-code-action', {});
      return result;
    } catch (error) {
      logger.error(`Error generating ${kind} output`, error);
      throw error;
    }
  }
  
  /**
   * Apply a code change to a document
   */
  private async applyCodeChange(
    uri: vscode.Uri, 
    range: vscode.Range,
    newCode: string
  ): Promise<void> {
    const document = await vscode.workspace.openTextDocument(uri);
    const edit = new vscode.WorkspaceEdit();
    
    edit.replace(uri, range, newCode);
    
    await vscode.workspace.applyEdit(edit);
  }
  
  /**
   * Show an explanation in a new editor
   */
  private async showExplanation(
    originalCode: string,
    explanation: string
  ): Promise<void> {
    // Create a new untitled document
    const document = await vscode.workspace.openTextDocument({
      content: `# Code Explanation\n\n## Original Code\n\`\`\`\n${originalCode}\n\`\`\`\n\n## Explanation\n${explanation}`,
      language: 'markdown'
    });
    
    // Show the document
    await vscode.window.showTextDocument(document);
  }
  
  /**
   * Expand a range to include complete lines
   */
  private expandRangeToLines(
    document: vscode.TextDocument,
    range: vscode.Range,
    additionalLines: number = 0
  ): vscode.Range {
    const startLine = Math.max(0, range.start.line - additionalLines);
    const endLine = Math.min(document.lineCount - 1, range.end.line + additionalLines);
    
    return new vscode.Range(
      new vscode.Position(startLine, 0),
      new vscode.Position(endLine, document.lineAt(endLine).text.length)
    );
  }
  
  /**
   * Check if text looks like a function
   * This is a heuristic and might need language-specific enhancements
   */
  private looksLikeFunction(text: string, languageId: string): boolean {
    // Common patterns for functions across languages
    const functionPatterns: Record<string, RegExp> = {
      'javascript': /\b(function\s+\w+\s*\(|const\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|class\s+\w+)/,
      'typescript': /\b(function\s+\w+\s*\(|const\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|class\s+\w+|interface\s+\w+)/,
      'python': /\bdef\s+\w+\s*\(|\bclass\s+\w+/,
      'java': /\b(?:public|private|protected|static)?\s*(?:class|interface|enum)\s+\w+|\b(?:public|private|protected|static)?\s*\w+\s+\w+\s*\(/,
      'csharp': /\b(?:public|private|protected|internal|static)?\s*(?:class|interface|enum|struct)\s+\w+|\b(?:public|private|protected|internal|static)?\s*\w+\s+\w+\s*\(/,
      'php': /\bfunction\s+\w+\s*\(|\bclass\s+\w+/,
      'ruby': /\bdef\s+\w+|\bclass\s+\w+/,
      'go': /\bfunc\s+\w+\s*\(|\btype\s+\w+\s+struct/
    };
    
    // Get the pattern for the current language or use a generic one
    const pattern = functionPatterns[languageId] || /\b(function|def|class|method|interface|func)\b/;
    
    // Check if the text matches the pattern
    return pattern.test(text);
  }
}

// Command to execute a code action
export function registerAICodeActionCommand(context: vscode.ExtensionContext) {
  const provider = new AICodeActionProvider();
  
  // Register the command to execute code actions
  const disposable = vscode.commands.registerCommand(
    'logcai.executeCodeAction',
    async (uri: vscode.Uri, range: vscode.Range, kind: AICodeActionKind, instruction: string, code: string) => {
      await provider.executeCodeAction(uri, range, kind, instruction, code);
    }
  );
  
  context.subscriptions.push(disposable);
  
  // Return the provider so it can be registered in extension.ts
  return provider;
}