// src/context/ContextProvider.ts
import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import { IndexingService } from './indexing/IndexingService';
import { StorageManager } from './storage/StorageManager';
import { ContextAssembler } from './ContextAssembler';
import { EmbeddingService } from './embeddings/EmbeddingService';
import logger from '../utils/logger';

/**
* Context types that can be requested
*/
export enum ContextType {
  CODE_COMPLETION = 'code_completion',
  CHAT = 'chat',
  AGENT = 'agent'
}

/**
* Context source types
*/
export enum ContextSource {
  ACTIVE_FILE = 'active_file',
  OPEN_FILES = 'open_files',
  WORKSPACE = 'workspace',
  CONVERSATION_HISTORY = 'conversation_history'
}

/**
* Context request options
*/
export interface ContextRequestOptions {
  query?: string;
  contextType: ContextType;
  sources: ContextSource[];
  maxTokens?: number;
  includeProjectInfo?: boolean;
  conversationId?: string;
  activeFileOnly?: boolean;
  selectionOnly?: boolean;
  limitFiles?: number;
}

/**
* Context item interface
*/
export interface ContextItem {
  id: string;
  type: string;
  name: string;
  path?: string;
  content?: string;
  language?: string;
  lineStart?: number;
  lineEnd?: number;
  relevance?: number;
}

/**
* Context result interface
*/
export interface ContextResult {
  items: ContextItem[];
  tokenCount: number;
  truncated: boolean;
  availableSources: ContextSource[];
}

/**
* Main provider for context-aware features
* Central interface for accessing context information
*/
export class ContextProvider implements vscode.Disposable {
  private static instance: ContextProvider;
  private storage: StorageManager;
  private indexingService: IndexingService;
  private embeddingService: EmbeddingService;
  private contextAssembler: ContextAssembler;
  private disposables: vscode.Disposable[] = [];
  private isInitialized: boolean = false;

  // Make constructor private for singleton
  private constructor() {
    this.storage = StorageManager.getInstance();
    this.indexingService = IndexingService.getInstance();
    this.embeddingService = new EmbeddingService();
    this.contextAssembler = new ContextAssembler(this.storage, this.embeddingService);

    // Register for active editor changes to track file context
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
          this.handleActiveEditorChange(editor);
        }
      })
    );

    // Register for selection changes to update context
    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection(event => {
        this.handleSelectionChange(event.textEditor);
      })
    );
  }

  public static getInstance(): ContextProvider {
    if (!ContextProvider.instance) {
      ContextProvider.instance = new ContextProvider();
    }
    return ContextProvider.instance;
  }

  /**
  * Initialize the context provider
  */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    try {
      // Initialize embedding service
      await this.embeddingService.initialize();
      
      // Initialize indexing service
      await this.indexingService.initialize();
      
      // Initialize with current editor if any
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        this.handleActiveEditorChange(activeEditor);
      }
      
      this.isInitialized = true;
      logger.info('Context provider initialized');
    } catch (error: unknown) {
      logger.error('Failed to initialize context provider', error);
    }
  }

  /**
  * Handle active editor change
  */
  public handleActiveEditorChange(editor: vscode.TextEditor): void {
    try {
      const document = editor.document;
      if (document.uri.scheme !== 'file') {
        return;
      }
      
      // Capture the file the user is working on
      const filePath = document.uri.fsPath;
      logger.debug(`Active editor changed to ${filePath}`);
      
      // Queue the file for indexing/update
      this.indexingService.queueFileForIndexing(filePath, true);
    } catch (error: unknown) {
      logger.error('Error handling active editor change', error);
    }
  }

  /**
  * Handle selection change
  */
  private handleSelectionChange(editor: vscode.TextEditor): void {
    try {
      const document = editor.document;
      if (document.uri.scheme !== 'file') {
        return;
      }
      // We don't need to do anything with this right now,
      // but in a more advanced implementation we could
      // track user's selections to improve context
    } catch (error: unknown) {
      logger.error('Error handling selection change', error);
    }
  }

  /**
  * Get context for a query
  */
  public async getContext(options: ContextRequestOptions): Promise<ContextResult> {
    try {
      // Ensure provider is initialized
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      logger.debug(`Getting context for type: ${options.contextType}`);
      
      // Use the context assembler to build context
      const context = await this.contextAssembler.assembleContext(options);
      return context;
    } catch (error: unknown) {
      logger.error('Error getting context', error);
      // Return empty context on error
      return {
        items: [],
        tokenCount: 0,
        truncated: false,
        availableSources: []
      };
    }
  }

  /**
  * Get context for active file
  */
  public async getActiveFileContext(selectionOnly: boolean = false): Promise<ContextItem | null> {
    try {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return null;
      }
      
      const document = editor.document;
      if (document.uri.scheme !== 'file') {
        return null;
      }
      
      const filePath = document.uri.fsPath;
      const fileName = path.basename(filePath);
      const fileId = crypto.createHash('md5').update(filePath).digest('hex');
      
      // Get content based on selection or full file
      let content: string;
      let lineStart = 0;
      let lineEnd = document.lineCount - 1;
      
      if (selectionOnly && !editor.selection.isEmpty) {
        lineStart = editor.selection.start.line;
        lineEnd = editor.selection.end.line;
        content = document.getText(new vscode.Range(
          lineStart, 0,
          lineEnd, document.lineAt(lineEnd).text.length
        ));
      } else {
        content = document.getText();
      }
      
      // Return file context
      return {
        id: fileId,
        type: 'file',
        name: fileName,
        path: filePath,
        content,
        language: document.languageId,
        lineStart,
        lineEnd
      };
    } catch (error: unknown) {
      logger.error('Error getting active file context', error);
      return null;
    }
  }

  /**
  * Build a prompt with appropriate context
  */
  public async buildContextualPrompt(
    userQuery: string,
    template: string,
    contextType: ContextType,
    maxTokens: number = 4000
  ): Promise<string> {
    try {
      // Get context for the query
      const context = await this.getContext({
        query: userQuery,
        contextType,
        sources: [
          ContextSource.ACTIVE_FILE,
          ContextSource.WORKSPACE,
          ContextSource.CONVERSATION_HISTORY
        ],
        maxTokens,
        includeProjectInfo: true
      });
      
      // Convert context to text
      let contextText = '';
      
      // Add project info if available
      if (context.items.find(item => item.type === 'project_info')) {
        const projectInfo = context.items.find(item => item.type === 'project_info');
        contextText += `Project Information:\n${projectInfo?.content || ''}\n\n`;
      }
      
      // Add active file context if available
      const activeFile = context.items.find(item => 
        item.type === 'file' && 
        item.path === vscode.window.activeTextEditor?.document.uri.fsPath
      );
      
      if (activeFile) {
        contextText += `Active File: ${activeFile.path}\n`;
        contextText += `Language: ${activeFile.language}\n`;
        contextText += "```\n";
        contextText += activeFile.content || '';
        contextText += "\n```\n\n";
      }
      
      // Add other relevant files
      const otherFiles = context.items.filter(item => 
        item.type === 'file' && 
        item.path !== vscode.window.activeTextEditor?.document.uri.fsPath
      );
      
      if (otherFiles.length > 0) {
        contextText += "Related Files:\n";
        for (const file of otherFiles) {
          contextText += `File: ${file.path}\n`;
          contextText += "```\n";
          contextText += file.content || '';
          contextText += "\n```\n\n";
        }
      }
      
      // Add code entities if available
      const codeEntities = context.items.filter(item => 
        item.type === 'function' || item.type === 'class'
      );
      
      if (codeEntities.length > 0) {
        contextText += "Related Code:\n";
        for (const entity of codeEntities) {
          contextText += `${entity.type.charAt(0).toUpperCase() + entity.type.slice(1)}: ${entity.name}\n`;
          contextText += "```\n";
          contextText += entity.content || '';
          contextText += "\n```\n\n";
        }
      }
      
      // Replace placeholder in template
      const prompt = template
        .replace('{{CONTEXT}}', contextText)
        .replace('{{QUERY}}', userQuery);
      
      return prompt;
    } catch (error: unknown) {
      logger.error('Error building contextual prompt', error);
      // Fallback to basic prompt without context
      return template
        .replace('{{CONTEXT}}', '')
        .replace('{{QUERY}}', userQuery);
    }
  }

  /**
  * Force refresh of context
  */
  public async refreshContext(): Promise<void> {
    try {
      // Force index the active file
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor && activeEditor.document.uri.scheme === 'file') {
        await this.indexingService.forceIndexFile(activeEditor.document.uri.fsPath);
      }
      logger.info('Context refreshed');
    } catch (error: unknown) {
      logger.error('Error refreshing context', error);
    }
  }

  /**
  * Visualize the context provided for the current query
  */
  public async visualizeContext(query: string): Promise<void> {
    try {
      // Get full context for the query
      const context = await this.getContext({
        query,
        contextType: ContextType.CHAT,
        sources: [
          ContextSource.ACTIVE_FILE,
          ContextSource.WORKSPACE,
          ContextSource.CONVERSATION_HISTORY
        ],
        maxTokens: 8000,
        includeProjectInfo: true
      });
      
      // Create a markdown document showing context
      let markdown = `# Context for Query: "${query}"\n\n`;
      markdown += `Total context items: ${context.items.length}\n`;
      markdown += `Estimated token count: ${context.tokenCount}\n`;
      markdown += `Truncated: ${context.truncated}\n\n`;
      
      // Group items by type
      const groupedItems: Record<string, ContextItem[]> = {};
      for (const item of context.items) {
        const type = item.type;
        if (!groupedItems[type]) {
          groupedItems[type] = [];
        }
        groupedItems[type].push(item);
      }
      
      // Add each group to markdown
      for (const type in groupedItems) {
        markdown += `## ${type.charAt(0).toUpperCase() + type.slice(1)}s (${groupedItems[type].length})\n\n`;
        for (const item of groupedItems[type]) {
          markdown += `### ${item.name}\n`;
          if (item.path) {
            markdown += `Path: ${item.path}\n`;
          }
          if (item.language) {
            markdown += `Language: ${item.language}\n`;
          }
          if (item.lineStart !== undefined && item.lineEnd !== undefined) {
            markdown += `Lines: ${item.lineStart + 1}-${item.lineEnd + 1}\n`;
          }
          if (item.relevance !== undefined) {
            markdown += `Relevance: ${(item.relevance * 100).toFixed(1)}%\n`;
          }
          if (item.content) {
            markdown += '\n```\n';
            // Truncate very long content for display
            let content = item.content;
            if (content.length > 2000) {
              content = content.substring(0, 2000) + '\n\n... [content truncated] ...\n';
            }
            markdown += content;
            markdown += '\n```\n\n';
          }
          markdown += '\n';
        }
      }
      
      // Create and show document
      const doc = await vscode.workspace.openTextDocument({
        content: markdown,
        language: 'markdown'
      });
      await vscode.window.showTextDocument(doc);
    } catch (error: unknown) {
      logger.error('Error visualizing context', error);
      vscode.window.showErrorMessage('Failed to visualize context');
    }
  }

  /**
  * Dispose resources
  */
  public dispose(): void {
    // Clean up disposables
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
    this.isInitialized = false;
    logger.info('Context provider disposed');
  }
}

// Export singleton instance
export default ContextProvider.getInstance();