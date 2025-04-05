// src/context/ContextManager.ts
import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import * as fs from 'fs';
import StorageManager from './storage/StorageManager';
import { IndexingService } from './indexing/IndexingService';
import { ContextProvider, ContextType, ContextSource, ContextRequestOptions, ContextResult } from './ContextProvider';
import { PromptBuilder, PromptTemplate, PromptTarget } from './PromptBuilder';
import { EmbeddingService } from './embeddings/EmbeddingService';
import logger from '../utils/logger';

/**
* Memory management options
*/
export interface MemoryOptions {
  conversationMemoryLength: number;
  maxTokensPerItem: number;
  importanceThreshold: number;
  pruningStrategy: 'lru' | 'importance' | 'hybrid';
}

/**
* High-level context management interface that coordinates the various
* context subsystems (provider, storage, indexing, etc.)
*/
export class ContextManager implements vscode.Disposable {
  private static instance: ContextManager;
  private contextProvider: ContextProvider;
  private storageManager: StorageManager;
  private indexingService: IndexingService;
  private embeddingService: EmbeddingService;
  private promptBuilder: PromptBuilder;
  private disposables: vscode.Disposable[] = [];
  private memoryOptions: MemoryOptions;
  private isInitialized: boolean = false;

  // Event emitters
  private _onContextUpdated = new vscode.EventEmitter<ContextResult>();
  public readonly onContextUpdated = this._onContextUpdated.event;

  // Make constructor private for singleton
  private constructor() {
    this.contextProvider = ContextProvider.getInstance();
    this.storageManager = StorageManager.getInstance();
    this.indexingService = IndexingService.getInstance();
    this.embeddingService = new EmbeddingService();
    this.promptBuilder = new PromptBuilder();

    // Default memory options
    this.memoryOptions = {
      conversationMemoryLength: 10,
      maxTokensPerItem: 2000,
      importanceThreshold: 0.3,
      pruningStrategy: 'hybrid'
    };

    // Setup event listeners
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('logcai.context')) {
          this.loadConfiguration();
        }
      }),
      this._onContextUpdated
    );

    // Load initial configuration
    this.loadConfiguration();
  }

  public static getInstance(): ContextManager {
    if (!ContextManager.instance) {
      ContextManager.instance = new ContextManager();
    }
    return ContextManager.instance;
  }

  /**
  * Initialize the context management system
  */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {return;}
    try {
      // Initialize embedding service first
      await this.embeddingService.initialize();
      
      // Initialize storage
      // Storage manager should be initialized before other services
      
      // Initialize indexing service
      await this.indexingService.initialize();
      
      // Initialize context provider
      await this.contextProvider.initialize();
      
      // Register workspace folder monitoring
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        // Force re-index on workspace change
        this.reindexWorkspace();
      });
      
      // If there's an active editor, track it
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        this.contextProvider.handleActiveEditorChange(activeEditor);
      }
      
      this.isInitialized = true;
      logger.info('Context manager initialized');
    } catch (error: unknown) {
      logger.error('Failed to initialize context manager', error);
    }
  }

  /**
  * Load configuration from VSCode settings
  */
  private loadConfiguration(): void {
    const config = vscode.workspace.getConfiguration('logcai.context');
    
    // Update memory options
    this.memoryOptions = {
      conversationMemoryLength: config.get('conversationMemoryLength', 10),
      maxTokensPerItem: config.get('maxTokensPerItem', 2000),
      importanceThreshold: config.get('importanceThreshold', 0.3),
      pruningStrategy: config.get('pruningStrategy', 'hybrid') as 'lru' | 'importance' | 'hybrid'
    };
    
    logger.debug('Context manager configuration loaded', this.memoryOptions);
  }

  /**
  * Build a prompt with appropriate context for the given query
  */
  public async buildContextualPrompt(
    userQuery: string,
    templateType: PromptTemplate = PromptTemplate.CHAT,
    targetModel: PromptTarget = PromptTarget.OLLAMA,
    maxTokens: number = 4000
  ): Promise<string> {
    try {
      // Use the prompt builder
      const options = {
        template: templateType,
        target: targetModel,
        maxTokens,
        userPrompt: userQuery,
        includeProjectInfo: true
      };
      
      const result = await this.promptBuilder.buildPrompt(options);
      return result.prompt;
    } catch (error: unknown) {
      logger.error('Error building contextual prompt', error);
      // Return fallback prompt without context
      return `You are an AI assistant. Answer this question: ${userQuery}`;
    }
  }

  /**
  * Get context for the current state based on the query
  */
  public async getContext(query: string, contextType: ContextType): Promise<ContextResult> {
    try {
      const options: ContextRequestOptions = {
        query,
        contextType,
        sources: this.getSourcesForContextType(contextType),
        maxTokens: this.getMaxTokensForContextType(contextType),
        includeProjectInfo: true
      };
      
      return await this.contextProvider.getContext(options);
    } catch (error: unknown) {
      logger.error('Error getting context', error);
      // Return empty context
      return {
        items: [],
        tokenCount: 0,
        truncated: false,
        availableSources: []
      };
    }
  }

  /**
  * Get the appropriate context sources based on context type
  */
  private getSourcesForContextType(contextType: ContextType): ContextSource[] {
    switch (contextType) {
      case ContextType.CODE_COMPLETION:
        // For code completion, focus on code context
        return [
          ContextSource.ACTIVE_FILE,
          ContextSource.WORKSPACE
        ];
      case ContextType.AGENT:
        // For agents, include all context
        return [
          ContextSource.ACTIVE_FILE,
          ContextSource.OPEN_FILES,
          ContextSource.WORKSPACE,
          ContextSource.CONVERSATION_HISTORY
        ];
      case ContextType.CHAT:
      default:
        // For chat, include conversation history
        return [
          ContextSource.ACTIVE_FILE,
          ContextSource.WORKSPACE,
          ContextSource.CONVERSATION_HISTORY
        ];
    }
  }

  /**
  * Get max tokens based on context type
  */
  private getMaxTokensForContextType(contextType: ContextType): number {
    switch (contextType) {
      case ContextType.CODE_COMPLETION:
        return 2000;
      case ContextType.AGENT:
        return 4000;
      case ContextType.CHAT:
      default:
        return 6000;
    }
  }

  /**
  * Save a conversation message to the history
  */
  public saveConversationMessage(
    conversationId: string,
    messageId: string,
    role: 'user' | 'assistant',
    content: string
  ): void {
    try {
      // Check if we need to prune based on memory options
      const conversations = this.storageManager.loadConversations();
      const conversation = conversations.find((c: ConversationData) => c.id === conversationId);
      
      if (conversation) {
        // Add new message
        conversation.messages.push({
          id: messageId,
          role,
          content,
          timestamp: new Date()
        });
        
        // Apply memory management if needed
        if (this.shouldPruneConversation(conversation)) {
          this.pruneConversationHistory(conversation);
        }
        
        // Save conversation
        this.storageManager.saveConversation(conversation);
      }
    } catch (error: unknown) {
      logger.error('Error saving conversation message', error);
    }
  }

  /**
  * Check if we should prune the conversation based on memory options
  */
  private shouldPruneConversation(conversation: any): boolean {
    // Apply length-based pruning
    if (conversation.messages.length > this.memoryOptions.conversationMemoryLength * 2) {
      return true;
    }
    
    // Check token count estimate
    let totalTokens = 0;
    for (const msg of conversation.messages) {
      // Estimate tokens (rough approximation)
      totalTokens += Math.ceil(msg.content.length / 4);
    }
    
    return totalTokens > this.memoryOptions.conversationMemoryLength * this.memoryOptions.maxTokensPerItem;
  }

  /**
  * Prune conversation history based on memory options
  */
  private pruneConversationHistory(conversation: any): void {
    const strategy = this.memoryOptions.pruningStrategy;
    const messages = conversation.messages;
    
    if (strategy === 'lru') {
      // Keep latest N pairs (user + assistant)
      const keepCount = this.memoryOptions.conversationMemoryLength * 2;
      conversation.messages = messages.slice(-keepCount);
    }
    else if (strategy === 'importance') {
      // Compute importance scores for message pairs and keep most important ones
      const scoredMessages = this.scoreConversationMessages(messages);
      
      // Sort by importance and keep top N pairs
      const keepCount = this.memoryOptions.conversationMemoryLength * 2;
      const threshold = this.memoryOptions.importanceThreshold;
      
      // Keep messages above threshold or in the top keepCount, whichever is more
      conversation.messages = scoredMessages
        .filter((msg: any, idx: number) => msg.importance >= threshold || idx >= (scoredMessages.length - keepCount))
        .map((msg: any) => {
          // Remove importance field before saving
          const { importance, ...message } = msg;
          return message;
        });
    }
    else { // hybrid
      // Keep system message plus a mix of recent and important messages
      const systemMessages = messages.filter((m: any) => m.role === 'system');
      const nonSystemMessages = messages.filter((m: any) => m.role !== 'system');
      
      // Score non-system messages
      const scoredMessages = this.scoreConversationMessages(nonSystemMessages);
      
      // Keep half recent, half important
      const keepCount = this.memoryOptions.conversationMemoryLength * 2;
      const halfKeep = Math.floor(keepCount / 2);
      
      // Sort by timestamp (recent)
      const recentMessages = [...scoredMessages]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, halfKeep);
      
      // Sort by importance
      const importantMessages = [...scoredMessages]
        .sort((a, b) => b.importance - a.importance)
        .slice(0, halfKeep);
      
      // Combine, remove duplicates, and restore original order
      const dedupedMessages = [...new Map([
        ...recentMessages,
        ...importantMessages
      ].map(msg => [msg.id, msg])).values()];
      
      // Restore original order
      dedupedMessages.sort((a, b) => {
        const aIndex = messages.findIndex((m: any) => m.id === a.id);
        const bIndex = messages.findIndex((m: any) => m.id === b.id);
        return aIndex - bIndex;
      });
      
      // Combine with system messages
      conversation.messages = [
        ...systemMessages,
        ...dedupedMessages.map(msg => {
          // Remove importance field before saving
          const { importance, ...message } = msg;
          return message;
        })
      ];
    }
  }

  /**
  * Score conversation messages based on importance
  */
  private scoreConversationMessages(messages: any[]): any[] {
    try {
      return messages.map(msg => {
        // Assign importance score based on:
        // 1. Age (newer messages get higher score)
        // 2. Content length (longer, more detailed messages get higher score)
        // 3. Code blocks (messages with code get higher score)
        
        // Base importance
        let importance = 0.5;
        
        // Age factor
        const ageInDays = (Date.now() - new Date(msg.timestamp).getTime()) / (1000 * 60 * 60 * 24);
        if (ageInDays < 1) {
          importance += 0.3; // Recent messages are more important
        } else if (ageInDays < 7) {
          importance += 0.1;
        }
        
        // Length factor (longer messages might be more valuable)
        if (msg.content.length > 1000) {
          importance += 0.2;
        } else if (msg.content.length > 300) {
          importance += 0.1;
        }
        
        // Code blocks factor
        if (msg.content.includes('```')) {
          importance += 0.2; // Messages with code blocks are often important
        }
        
        // Limit to 0-1 range
        importance = Math.min(1.0, importance);
        
        return {
          ...msg,
          importance
        };
      });
    } catch (error: unknown) {
      logger.error('Error scoring conversation messages', error);
      // Return original messages with default importance
      return messages.map(msg => ({ ...msg, importance: 0.5 }));
    }
  }

  /**
  * Force reindexing of the workspace
  */
  public reindexWorkspace(): void {
    this.indexingService.indexWorkspaceInBackground();
  }

  /**
  * Get project-specific information for context
  */
  public async getProjectInfo(): Promise<any> {
    try {
      // Get workspace folder
      if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return null;
      }
      
      const folder = vscode.workspace.workspaceFolders[0];
      
      // Get project metadata from common project files
      const packageJsonUri = vscode.Uri.joinPath(folder.uri, 'package.json');
      let projectInfo: any = {
        name: folder.name,
        path: folder.uri.fsPath,
        type: 'unknown'
      };
      
      try {
        // Try to read package.json
        const content = await vscode.workspace.fs.readFile(packageJsonUri);
        const packageJson = JSON.parse(content.toString());
        
        projectInfo = {
          ...projectInfo,
          type: 'nodejs',
          description: packageJson.description || '',
          version: packageJson.version || '',
          dependencies: Object.keys(packageJson.dependencies || {}),
          devDependencies: Object.keys(packageJson.devDependencies || {})
        };
      } catch (err) {
        // No package.json or error reading it
        // Try other project files based on what's found
        // This can be expanded for different project types
        
        // Check file extensions to guess project type
        const codeFiles = await vscode.workspace.findFiles('**/*.{js,ts,py,java,cs,go,rb,php}', '**/node_modules/**', 100);
        
        // Count extensions to determine dominant language
        const extCounts: Record<string, number> = {};
        for (const file of codeFiles) {
          const ext = path.extname(file.fsPath).toLowerCase();
          extCounts[ext] = (extCounts[ext] || 0) + 1;
        }
        
        // Find most common extension
        let maxCount = 0;
        let dominant = '';
        for (const [ext, count] of Object.entries(extCounts)) {
          if (count > maxCount) {
            maxCount = count;
            dominant = ext;
          }
        }
        
        // Map extension to project type
        const typeMap: Record<string, string> = {
          '.js': 'javascript',
          '.ts': 'typescript',
          '.py': 'python',
          '.java': 'java',
          '.cs': 'csharp',
          '.go': 'go',
          '.rb': 'ruby',
          '.php': 'php'
        };
        
        if (dominant && typeMap[dominant]) {
          projectInfo.type = typeMap[dominant];
        }
      }
      
      return projectInfo;
    } catch (error: unknown) {
      logger.error('Error getting project info', error);
      return null;
    }
  }

  /**
  * Track usage pattern to improve future context
  */
  public trackUsagePattern(pattern: string, examples: string[]): void {
    const patternId = crypto.createHash('md5').update(pattern).digest('hex');
    
    // Save pattern to storage
    try {
      // Construct user pattern object
      const userPattern = {
        id: patternId,
        type: 'usage_pattern',
        pattern,
        examples: examples || [],
        frequency: 1,
        first_seen: Date.now(),
        last_seen: Date.now()
      };
      
      // Store in database with upsert logic handled by StorageManager
      // We're assuming StorageManager has appropriate methods for this
      // this.storageManager.saveUserPattern(userPattern);
      
      logger.debug('Tracked usage pattern', { pattern });
    } catch (error: unknown) {
      logger.error('Error tracking usage pattern', error);
    }
  }

  /**
  * Dispose resources
  */
  public dispose(): void {
    // Dispose all disposables
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
    
    // Close persistent storage
    this.storageManager.close();
    
    // Dispose indexing service
    this.indexingService.dispose();
    
    this.isInitialized = false;
    logger.info('Context manager disposed');
  }
}

// Export singleton instance
export default ContextManager.getInstance();