// src/context/ContextAssembler.ts
import * as vscode from 'vscode';
import * as path from 'path';
import { StorageManager } from './storage/StorageManager';import { EmbeddingService } from './embeddings/EmbeddingService';
import { ContextType, ContextSource, ContextRequestOptions, ContextResult, ContextItem } from './ContextProvider';
import logger from '../utils/logger';

/**
* Handles assembling context from various sources
* and prioritizing the most relevant information
*/
export class ContextAssembler {
  private storage: StorageManager;
  private embeddingService: EmbeddingService;
  
  // Token estimation settings
  private tokensPerChar: number = 0.25; // Approximately 4 chars per token
  private tokensPerCodeLine: number = 5; // Average tokens per line of code
  
  constructor(storage: StorageManager, embeddingService: EmbeddingService) {
    this.storage = storage;
    this.embeddingService = embeddingService;
  }

  /**
  * Assemble context based on request options
  */
  public async assembleContext(options: ContextRequestOptions): Promise<ContextResult> {
    try {
      // Determine max tokens if not provided
      const maxTokens = options.maxTokens || this.getDefaultMaxTokens(options.contextType);
      
      // Hold all context items with potential duplication
      const candidateItems: ContextItem[] = [];
      
      // Collect context from each requested source
      const availableSources: ContextSource[] = [];
      
      // Get active editor and document
      const editor = vscode.window.activeTextEditor;
      const document = editor?.document;
      
      // Track project info
      let projectInfo: ContextItem | null = null;
      
      // Process each requested source
      for (const source of options.sources) {
        switch (source) {
          case ContextSource.ACTIVE_FILE:
            if (document && editor) {
              const items = await this.getActiveFileContext(editor, options.selectionOnly || false);
              candidateItems.push(...items);
              if (items.length > 0) {
                availableSources.push(source);
              }
            }
            break;
            
          case ContextSource.OPEN_FILES:
            const openItems = await this.getOpenFilesContext(options.limitFiles || 5);
            candidateItems.push(...openItems);
            if (openItems.length > 0) {
              availableSources.push(source);
            }
            break;
            
          case ContextSource.WORKSPACE:
            if (options.query) {
              // For workspace, use query to find relevant content
              const relevantItems = await this.getRelevantWorkspaceContext(
                options.query,
                options.limitFiles || 10
              );
              candidateItems.push(...relevantItems);
              if (relevantItems.length > 0) {
                availableSources.push(source);
              }
            }
            break;
            
          case ContextSource.CONVERSATION_HISTORY:
            const historyItems = await this.getConversationHistoryContext(
              options.query || '',
              options.conversationId
            );
            candidateItems.push(...historyItems);
            if (historyItems.length > 0) {
              availableSources.push(source);
            }
            break;
        }
      }
      
      // Include project info if requested
      if (options.includeProjectInfo) {
        projectInfo = await this.getProjectInfo();
        if (projectInfo) {
          candidateItems.push(projectInfo);
        }
      }
      
      // Score and prioritize items
      const scoredItems = await this.scoreContextItems(candidateItems, options.query || '');
      
      // Optimize to fit within token budget
      const result = this.optimizeContextToTokenBudget(scoredItems, maxTokens);
      
      // Set available sources
      result.availableSources = availableSources;
      
      return result;
    } catch (error: unknown) {
      logger.error('Error assembling context', error);
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
  * Get default maximum tokens based on context type
  */
  private getDefaultMaxTokens(contextType: ContextType): number {
    switch (contextType) {
      case ContextType.CODE_COMPLETION:
        return 2000; // Smaller context for completion
      case ContextType.CHAT:
        return 6000; // Larger context for chat
      case ContextType.AGENT:
        return 4000; // Medium context for agents
      default:
        return 4000;
    }
  }

  /**
  * Get context from active file
  */
  private async getActiveFileContext(editor: vscode.TextEditor, selectionOnly: boolean): Promise<ContextItem[]> {
    try {
      const document = editor.document;
      
      // Skip non-file documents
      if (document.uri.scheme !== 'file') {
        return [];
      }
      
      const filePath = document.uri.fsPath;
      const fileName = path.basename(filePath);
      
      // Get content based on selection or full document
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
      
      // Return as a context item
      const items: ContextItem[] = [{
        id: filePath,
        type: 'file',
        name: fileName,
        path: filePath,
        content,
        language: document.languageId,
        lineStart,
        lineEnd,
        relevance: 1.0 // Active file has maximum relevance
      }];
      
      return items;
    } catch (error: unknown) {
      logger.error('Error getting active file context', error);
      return [];
    }
  }

  /**
  * Get context from open files
  */
  private async getOpenFilesContext(limit: number): Promise<ContextItem[]> {
    try {
      const items: ContextItem[] = [];
      
      // Get all non-untitled text documents
      const documents = vscode.workspace.textDocuments.filter(
        doc => !doc.isUntitled && doc.uri.scheme === 'file'
      );
      
      // Sort by most recently focused (approximation)
      const activeDoc = vscode.window.activeTextEditor?.document;
      const sortedDocs = documents.sort((a, b) => {
        if (a === activeDoc) {
          return -1;
        }
        if (b === activeDoc) {
          return 1;
        }
        return 0;
      });
      
      // Take the top N documents
      const limitedDocs = sortedDocs.slice(0, limit);
      
      // Convert to context items
      for (const doc of limitedDocs) {
        const filePath = doc.uri.fsPath;
        const fileName = path.basename(filePath);
        const content = doc.getText();
        
        items.push({
          id: filePath,
          type: 'file',
          name: fileName,
          path: filePath,
          content,
          language: doc.languageId,
          lineStart: 0,
          lineEnd: doc.lineCount - 1,
          relevance: 0.8 // Open files are highly relevant but not as much as active file
        });
      }
      
      return items;
    } catch (error: unknown) {
      logger.error('Error getting open files context', error);
      return [];
    }
  }

  /**
  * Get relevant context from workspace based on query
  */
  private async getRelevantWorkspaceContext(query: string, limit: number): Promise<ContextItem[]> {
    try {
      // Generate embedding for query
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);
      
      // Find similar vectors
      const similarVectors = this.storage.findSimilarVectors(queryEmbedding, limit * 2);
      
      // Convert to context items
      const items: ContextItem[] = [];
      const seenPaths = new Set<string>();
      
      for (const vector of similarVectors) {
        const metadata = vector.metadata;
        if (!metadata) {
          continue;
        }
        
        // For files
        if (metadata.type === 'file') {
          // Get full file context
          const contextItems = this.storage.findContextItems(metadata.path, 1);
          if (contextItems.length > 0) {
            const item = contextItems[0];
            
            // Skip if already seen
            if (seenPaths.has(item.path || '')) {
              continue;
            }
            if (item.path) {
              seenPaths.add(item.path);
            }
            
            // Calculate relevance score based on vector similarity
            // (assuming the vectors were returned sorted by similarity)
            const relevance = 0.9 - (items.length * 0.05); // Decay relevance as we go down the list
            
            items.push({
              id: item.id,
              type: 'file',
              name: item.name,
              path: item.path,
              content: item.content,
              language: item.language,
              lineStart: item.lineStart,
              lineEnd: item.lineEnd,
              relevance: Math.max(0.1, relevance) // Ensure minimum relevance of 0.1
            });
          }
        }
        // For code entities
        else if (metadata.type === 'entity') {
          // Get code entity
          const entityItems = this.storage.findCodeEntities(metadata.name, 1);
          if (entityItems.length > 0) {
            const entity = entityItems[0];
            
            // Calculate relevance
            const relevance = 0.85 - (items.length * 0.05);
            
            items.push({
              id: entity.id,
              type: entity.type,
              name: entity.name,
              path: entity.filePath,
              content: entity.code,
              relevance: Math.max(0.1, relevance)
            });
          }
        }
        
        // Limit total items
        if (items.length >= limit) {
          break;
        }
      }
      
      return items;
    } catch (error: unknown) {
      logger.error('Error getting relevant workspace context', error);
      return [];
    }
  }

  /**
  * Get context from conversation history
  */
  private async getConversationHistoryContext(query: string, conversationId?: string): Promise<ContextItem[]> {
    try {
      // Get all conversations
      const conversations = this.storage.loadConversations();
      
      // If specific conversation ID is provided, filter to just that one
      const targetConversations = conversationId
        ? conversations.filter((c) => c.id === conversationId)
        : conversations;
      
      // If no conversations, return empty
      if (targetConversations.length === 0) {
        return [];
      }
      
      // Get the latest (or specified) conversation
      const conversation = targetConversations[0];
      
      // Format conversation messages
      const messages = conversation.messages;
      
      // Format conversation history as a context item
      const formattedHistory = messages.map((msg) =>
        `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
      ).join('\n\n');
      
      return [{
        id: `history-${conversation.id}`,
        type: 'conversation_history',
        name: `Conversation: ${conversation.title}`,
        content: formattedHistory,
        relevance: 0.7 // Conversation history is moderately relevant
      }];
    } catch (error: unknown) {
      logger.error('Error getting conversation history context', error);
      return [];
    }
  }

  /**
  * Get information about the current project
  */
  private async getProjectInfo(): Promise<ContextItem | null> {
    try {
      // Get workspace folder
      if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return null;
      }
      
      const workspaceFolder = vscode.workspace.workspaceFolders[0];
      const workspaceName = workspaceFolder.name;
      const workspacePath = workspaceFolder.uri.fsPath;
      
      // Try to detect project type
      let projectType = 'unknown';
      let projectDetails = '';
      
      // Check for common project files
      const files = await vscode.workspace.findFiles(
        '{package.json,*.csproj,*.fsproj,pom.xml,build.gradle,*.sln,setup.py,requirements.txt,Cargo.toml,go.mod}',
        '{**/node_modules/**,**/bin/**,**/obj/**,**/dist/**}',
        1
      );
      
      if (files.length > 0) {
        const projectFile = files[0];
        const fileName = path.basename(projectFile.fsPath);
        
        // Determine project type based on file
        switch (fileName) {
          case 'package.json':
            projectType = 'Node.js';
            try {
              const content = await vscode.workspace.fs.readFile(projectFile);
              const packageJson = JSON.parse(content.toString());
              projectDetails = `
Name: ${packageJson.name || 'N/A'}
Version: ${packageJson.version || 'N/A'}
Description: ${packageJson.description || 'N/A'}
Dependencies: ${Object.keys(packageJson.dependencies || {}).join(', ')}
`;
            } catch (e) {
              projectDetails = 'Failed to parse package.json';
            }
            break;
            
          case 'requirements.txt':
            projectType = 'Python';
            break;
            
          case 'go.mod':
            projectType = 'Go';
            break;
            
          case 'Cargo.toml':
            projectType = 'Rust';
            break;
            
          default:
            if (fileName.endsWith('.csproj') || fileName.endsWith('.fsproj') || fileName.endsWith('.sln')) {
              projectType = '.NET';
            } else if (fileName === 'pom.xml' || fileName === 'build.gradle') {
              projectType = 'Java';
            }
        }
      }
      
      // Format project info
      const info = `
Workspace: ${workspaceName}
Path: ${workspacePath}
Project Type: ${projectType}
${projectDetails}
`;
      
      return {
        id: 'project-info',
        type: 'project_info',
        name: 'Project Information',
        content: info.trim(),
        relevance: 0.5 // Project info has moderate relevance
      };
    } catch (error: unknown) {
      logger.error('Error getting project info', error);
      return null;
    }
  }

  /**
  * Score context items based on relevance to query
  */
  private async scoreContextItems(items: ContextItem[], query: string): Promise<ContextItem[]> {
    try {
      // If no query or only one item, return items with default relevance
      if (!query || items.length <= 1) {
        return items.map(item => ({
          ...item,
          relevance: item.relevance || 0.5
        }));
      }
      
      // If items already have relevance scores, sort by them
      const allHaveRelevance = items.every(item => item.relevance !== undefined);
      if (allHaveRelevance) {
        return [...items].sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
      }
      
      // Generate embedding for query
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);
      
      // Generate embeddings for items without relevance scores
      const scoredItems: ContextItem[] = [];
      
      for (const item of items) {
        // If item already has a relevance score, use it
        if (item.relevance !== undefined) {
          scoredItems.push(item);
          continue;
        }
        
        // Generate embedding for item
        try {
          const itemText = this.getItemText(item);
          const itemEmbedding = await this.embeddingService.generateEmbedding(itemText);
          
          // Calculate cosine similarity
          const similarity = this.calculateCosineSimilarity(queryEmbedding, itemEmbedding);
          
          // Add item with similarity as relevance
          scoredItems.push({
            ...item,
            relevance: similarity
          });
        } catch (error) {
          // If embedding fails, add item with default relevance
          scoredItems.push({
            ...item,
            relevance: 0.3
          });
        }
      }
      
      // Sort by relevance
      return scoredItems.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
    } catch (error: unknown) {
      logger.error('Error scoring context items', error);
      return items;
    }
  }

  /**
  * Extract text from a context item for embedding
  */
  private getItemText(item: ContextItem): string {
    // Combine name and content for best representation
    let text = item.name || '';
    if (item.content) {
      text += '\n' + item.content;
    }
    return text;
  }

  /**
  * Calculate cosine similarity between two embeddings
  */
  private calculateCosineSimilarity(a: Float32Array, b: Float32Array): number {
    // Ensure vectors are same length
    if (a.length !== b.length) {
      throw new Error('Vector dimensions do not match');
    }
    
    // Calculate dot product
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    // Calculate magnitudes
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    // Calculate similarity
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    return dotProduct / (normA * normB);
  }

  /**
  * Optimize context to fit within token budget
  */
  private optimizeContextToTokenBudget(items: ContextItem[], maxTokens: number): ContextResult {
    try {
      // Start with empty result
      const result: ContextResult = {
        items: [],
        tokenCount: 0,
        truncated: false,
        availableSources: []
      };
      
      // Initialize token counter
      let totalTokens = 0;
      
      // Process items in order of relevance
      for (const item of items) {
        const itemTokens = this.estimateTokenCount(item);
        
        // If this item would exceed the budget, try to truncate it
        if (totalTokens + itemTokens > maxTokens) {
          // If we already have items, mark as truncated
          if (result.items.length > 0) {
            result.truncated = true;
            break;
          }
          
          // Try to truncate content to fit in budget
          const truncatedItem = this.truncateItemToFit(item, maxTokens);
          result.items.push(truncatedItem);
          result.tokenCount = this.estimateTokenCount(truncatedItem);
          result.truncated = true;
          break;
        }
        
        // Add item to result
        result.items.push(item);
        totalTokens += itemTokens;
      }
      
      result.tokenCount = totalTokens;
      return result;
    } catch (error: unknown) {
      logger.error('Error optimizing context to token budget', error);
      // Return empty result on error
      return {
        items: [],
        tokenCount: 0,
        truncated: false,
        availableSources: []
      };
    }
  }

  /**
  * Estimate token count for a context item
  */
  private estimateTokenCount(item: ContextItem): number {
    // Start with fixed overhead for metadata
    let count = 20; // Overhead for item metadata
    
    // Add tokens for content
    if (item.content) {
      // If it's code, estimate based on line count
      if (item.lineStart !== undefined && item.lineEnd !== undefined) {
        const lineCount = (item.lineEnd - item.lineStart) + 1;
        count += lineCount * this.tokensPerCodeLine;
      } else {
        // Otherwise estimate based on character count
        count += Math.ceil(item.content.length * this.tokensPerChar);
      }
    }
    
    return count;
  }

  /**
  * Truncate item content to fit within token budget
  */
  private truncateItemToFit(item: ContextItem, maxTokens: number): ContextItem {
    try {
      // If no content, return as is
      if (!item.content) {
        return item;
      }
      
      const overhead = 20; // Overhead for item metadata
      const contentTokenBudget = maxTokens - overhead;
      
      // If content is within budget, return as is
      if (item.content.length * this.tokensPerChar <= contentTokenBudget) {
        return item;
      }
      
      // Truncate content to fit in budget
      const maxChars = Math.floor(contentTokenBudget / this.tokensPerChar);
      let truncatedContent: string;
      
      // For code, try to keep complete functions/blocks
      if (item.type === 'file' || item.type === 'function' || item.type === 'class') {
        // Split into lines
        const lines = item.content.split('\n');
        
        // Determine how many lines we can keep
        const maxLines = Math.floor(contentTokenBudget / this.tokensPerCodeLine);
        
        if (maxLines < lines.length) {
          // Keep first lines as they're usually more important
          truncatedContent = lines.slice(0, maxLines).join('\n') + '\n// ... content truncated ...';
        } else {
          truncatedContent = item.content;
        }
      } else {
        // For normal text, just truncate by character count
        truncatedContent = item.content.substring(0, maxChars) + '... [content truncated] ...';
      }
      
      return {
        ...item,
        content: truncatedContent
      };
    } catch (error: unknown) {
      logger.error('Error truncating item to fit', error);
      // Return item with truncated content on error
      return {
        ...item,
        content: item.content?.substring(0, 1000) + '... [truncated due to error] ...'
      };
    }
  }
}