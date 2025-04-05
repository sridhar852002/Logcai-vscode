// src/context/memory/MemoryManager.ts
import * as crypto from 'crypto';
import { StorageManager } from '../storage/StorageManager';
import { EmbeddingService } from '../embeddings/EmbeddingService';
import logger from '../../utils/logger';

/**
 * Memory pruning strategies
 */
export enum PruningStrategy {
  LRU = 'lru',              // Least Recently Used
  IMPORTANCE = 'importance', // Based on importance scoring
  HYBRID = 'hybrid'         // Combination of recency and importance
}

/**
 * Memory options configuration
 */
export interface MemoryOptions {
  maxMessages: number;        // Maximum messages to retain
  maxTokensPerConversation: number; // Max tokens to keep per conversation
  importanceThreshold: number; // Minimum importance score to retain
  pruningStrategy: PruningStrategy; // Strategy to use for memory pruning
}

/**
 * Interface for conversation message
 */
export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  importance?: number;
  relevance?: number;
  combinedScore?: number;
}

/**
 * Interface for conversation metadata
 */
export interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  modelId: string;
  systemPrompt?: string;
  messages: ConversationMessage[];
}

/**
 * Manages conversation memory and provides context-aware memory pruning
 */
export class MemoryManager {
  private static instance: MemoryManager;
  private storage: StorageManager;
  private embeddings: EmbeddingService;
  private options: MemoryOptions = {
    maxMessages: 20,
    maxTokensPerConversation: 6000,
    importanceThreshold: 0.5,
    pruningStrategy: PruningStrategy.HYBRID
  };

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    this.storage = StorageManager.getInstance();
    this.embeddings = new EmbeddingService();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  /**
   * Update memory options
   */
  public setOptions(options: Partial<MemoryOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Add a message to conversation memory
   */
  public async addMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string
  ): Promise<string> {
    try {
      // Create message ID
      const messageId = crypto.randomUUID();
      
      // Create message object
      const message: ConversationMessage = {
        id: messageId,
        conversationId,
        role,
        content,
        timestamp: new Date()
      };
      
      // Calculate message importance if content is not empty
      if (content.trim().length > 0) {
        message.importance = await this.calculateMessageImportance(content);
      }
      
      // Get conversation
      let conversation = await this.getConversation(conversationId);
      
      // Create new conversation if it doesn't exist
      if (!conversation) {
        conversation = {
          id: conversationId,
          title: this.generateTitle(content),
          createdAt: new Date(),
          updatedAt: new Date(),
          modelId: 'unknown', // Will be updated by caller if needed
          messages: []
        };
      } else {
        // Update timestamp
        conversation.updatedAt = new Date();
      }
      
      // Add message to conversation
      conversation.messages.push(message);
      
      // Prune if needed
      if (this.shouldPruneConversation(conversation)) {
        this.pruneConversation(conversation);
      }
      
      // Save conversation
      await this.storage.saveConversation(conversation);
      
      return messageId;
    } catch (error) {
      logger.error('Error adding message to memory', error);
      throw error;
    }
  }

  /**
   * Update message importance
   */
  public async updateMessageImportance(
    conversationId: string,
    messageId: string, 
    importance: number
  ): Promise<void> {
    try {
      const conversation = await this.getConversation(conversationId);
      if (!conversation) {return;}
      
      const message = conversation.messages.find(m => m.id === messageId);
      if (!message) {return;}
      
      message.importance = importance;
      
      await this.storage.saveConversation(conversation);
    } catch (error) {
      logger.error('Error updating message importance', error);
    }
  }

  /**
   * Get conversation by ID
   */
  public async getConversation(id: string): Promise<Conversation | null> {
    try {
      const allConversations = this.storage.loadConversations();
      return allConversations.find((c: Conversation) => c.id === id) || null;
    } catch (error) {
      logger.error('Error getting conversation', error);
      return null;
    }
  }

  /**
   * Get recent conversations
   */
  public async getRecentConversations(limit: number = 10): Promise<Conversation[]> {
    try {
      const allConversations = this.storage.loadConversations();
      
      // Sort by updatedAt (descending)
      return allConversations
        .sort((a: Conversation, b: Conversation) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, limit);
    } catch (error) {
      logger.error('Error getting recent conversations', error);
      return [];
    }
  }

  /**
   * Get conversation context for a query
   */
  public async getConversationContext(
    conversationId: string,
    query: string,
    maxTokens: number = 2000
  ): Promise<string> {
    try {
      const conversation = await this.getConversation(conversationId);
      if (!conversation) {return '';}
      
      // If query is provided, prioritize relevant messages
      let messages = [...conversation.messages];
      if (query && query.trim().length > 0) {
        // Get embedding for query
        const queryEmbedding = await this.embeddings.generateEmbedding(query);
        
        // Calculate relevance scores for messages
        const scoredMessages = await Promise.all(
          messages.map(async message => {
            const embedding = await this.embeddings.generateEmbedding(message.content);
            const similarity = this.calculateCosineSimilarity(queryEmbedding, embedding);
            return {
              ...message,
              relevance: similarity
            };
          })
        );
        
        // Sort by relevance
        messages = scoredMessages.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
      }
      
      // Format messages for context
      let contextText = '';
      let tokenCount = 0;
      const tokensPerMessage = 4; // Tokens per character estimation
      
      for (const message of messages) {
        const formattedMessage = `${message.role}: ${message.content}\n\n`;
        const messageTokens = formattedMessage.length * tokensPerMessage;
        
        // Check if adding this message would exceed token limit
        if (tokenCount + messageTokens > maxTokens) {
          contextText += '[...conversation truncated for brevity...]\n\n';
          break;
        }
        
        contextText += formattedMessage;
        tokenCount += messageTokens;
      }
      
      return contextText;
    } catch (error) {
      logger.error('Error getting conversation context', error);
      return '';
    }
  }

  /**
   * Check if conversation should be pruned
   */
  private shouldPruneConversation(conversation: Conversation): boolean {
    // Check message count
    if (conversation.messages.length > this.options.maxMessages) {
      return true;
    }
    
    // Estimate token count (roughly 4 chars per token)
    const tokensPerChar = 0.25;
    let totalTokens = 0;
    
    for (const message of conversation.messages) {
      totalTokens += message.content.length * tokensPerChar;
    }
    
    return totalTokens > this.options.maxTokensPerConversation;
  }

  /**
   * Prune conversation based on strategy
   */
  private pruneConversation(conversation: Conversation): void {
    const strategy = this.options.pruningStrategy;
    
    switch (strategy) {
      case PruningStrategy.LRU:
        this.pruneLRU(conversation);
        break;
      case PruningStrategy.IMPORTANCE:
        this.pruneImportance(conversation);
        break;
      case PruningStrategy.HYBRID:
      default:
        this.pruneHybrid(conversation);
        break;
    }
  }

  /**
   * Prune using Least Recently Used strategy
   */
  private pruneLRU(conversation: Conversation): void {
    // Always keep the first system message if present
    const systemMessages = conversation.messages.filter(m => m.role === 'system');
    
    // Sort remaining messages by timestamp (oldest first)
    const nonSystemMessages = conversation.messages
      .filter(m => m.role !== 'system')
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Calculate how many messages to keep
    const keepCount = Math.max(1, this.options.maxMessages - systemMessages.length);
    
    // Keep most recent messages
    const messagesToKeep = nonSystemMessages.slice(-keepCount);
    
    // Update conversation with pruned messages
    conversation.messages = [...systemMessages, ...messagesToKeep];
  }

  /**
   * Prune based on importance scores
   */
  private pruneImportance(conversation: Conversation): void {
    // Always keep system messages
    const systemMessages = conversation.messages.filter(m => m.role === 'system');
    
    // Sort non-system messages by importance (highest first)
    const nonSystemMessages = conversation.messages
      .filter(m => m.role !== 'system')
      .sort((a, b) => (b.importance || 0) - (a.importance || 0));
    
    // Keep messages above threshold or up to max count, whichever yields more messages
    const aboveThreshold = nonSystemMessages.filter(m => 
      (m.importance || 0) >= this.options.importanceThreshold
    );
    
    const remainingSlots = Math.max(0, this.options.maxMessages - systemMessages.length - aboveThreshold.length);
    const belowThreshold = nonSystemMessages
      .filter(m => (m.importance || 0) < this.options.importanceThreshold)
      .slice(0, remainingSlots);
    
    // Update conversation with pruned messages
    conversation.messages = [...systemMessages, ...aboveThreshold, ...belowThreshold];
  }

  /**
   * Prune using hybrid approach (importance + recency)
   */
  private pruneHybrid(conversation: Conversation): void {
    // Always keep system messages
    const systemMessages = conversation.messages.filter(m => m.role === 'system');
    
    // Get non-system messages
    const nonSystemMessages = conversation.messages.filter(m => m.role !== 'system');
    
    // Calculate how many messages to keep
    const keepCount = Math.max(1, this.options.maxMessages - systemMessages.length);
    const halfKeep = Math.ceil(keepCount / 2);
    
    // Sort by recency for half the slots
    const recentMessages = [...nonSystemMessages]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, halfKeep);
    
    // Sort by importance for other half
    const importantMessages = [...nonSystemMessages]
      .sort((a, b) => (b.importance || 0) - (a.importance || 0))
      .slice(0, halfKeep);
    
    // Combine and deduplicate
    const combinedMessages = [...recentMessages, ...importantMessages];
    const uniqueMessages = Array.from(
      new Map(combinedMessages.map(m => [m.id, m])).values()
    );
    
    // If we have too many messages, sort by combined score and take top messages
    if (uniqueMessages.length > keepCount) {
      // Calculate a combined score (50% recency, 50% importance)
      const scoredMessages = uniqueMessages.map(message => {
        // Calculate recency score (0-1, where 1 is most recent)
        const latestTime = Math.max(...nonSystemMessages.map(m => m.timestamp.getTime()));
        const oldestTime = Math.min(...nonSystemMessages.map(m => m.timestamp.getTime()));
        const timeRange = latestTime - oldestTime || 1; // Avoid division by zero
        const recencyScore = (message.timestamp.getTime() - oldestTime) / timeRange;
        
        // Combined score (importance may be undefined, default to 0.5)
        const combinedScore = (recencyScore + (message.importance || 0.5)) / 2;
        
        return {
          ...message,
          combinedScore
        };
      });
      
      // Sort by combined score and take top messages
      const topMessages = scoredMessages
        .sort((a, b) => b.combinedScore - a.combinedScore)
        .slice(0, keepCount);
      
      // Update conversation
      conversation.messages = [...systemMessages, ...topMessages];
    } else {
      // We're under the limit, keep all unique messages
      conversation.messages = [...systemMessages, ...uniqueMessages];
    }
  }

  /**
   * Calculate message importance
   */
  private async calculateMessageImportance(content: string): Promise<number> {
    try {
      // Basic heuristics for importance
      let score = 0.5; // Default score
      
      // Messages with code blocks are generally more important
      if (content.includes('```')) {
        score += 0.2;
      }
      
      // Messages with specifics like URLs, file paths, or technical terms often matter
      if (content.match(/https?:\/\/[^\s]+/) || 
          content.match(/[\w\/\.-]+\.(ts|js|py|java|html|css|json)/) ||
          content.match(/function|class|interface|import|export|const|let|var/)) {
        score += 0.1;
      }
      
      // Longer messages often contain more info
      if (content.length > 500) {
        score += 0.1;
      } else if (content.length < 50) {
        score -= 0.1; // Shorter messages may be less important
      }
      
      // Questions are often pivotal
      if (content.includes('?')) {
        score += 0.1;
      }
      
      // Cap between 0 and 1
      return Math.max(0, Math.min(1, score));
    } catch (error) {
      logger.error('Error calculating message importance', error);
      return 0.5; // Default to medium importance
    }
  }

  /**
   * Generate title from content
   */
  private generateTitle(content: string): string {
    // Extract first line or use first few words
    const firstLine = content.split('\n')[0].trim();
    if (firstLine.length <= 50) {
      return firstLine;
    }
    
    // Truncate to reasonable length
    return firstLine.substring(0, 47) + '...';
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  private calculateCosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same dimensions');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

export default MemoryManager.getInstance();