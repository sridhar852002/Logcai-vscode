// src/context/embeddings/EmbeddingService.ts
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import logger from '../../utils/logger';
import networkAwareness from '../../utils/networkAwareness';
import { LocalEmbeddingModel } from './LocalEmbeddingModel';

/**
 * Service to generate embeddings for context items
 * Supports both local embedding models and cloud API
 */
export class EmbeddingService {
  private localModel: LocalEmbeddingModel | null = null;
  private useLocalModel: boolean = false;
  private apiKey: string = '';
  private endpoint: string = 'https://api.openai.com/v1/embeddings';
  private model: string = 'text-embedding-ada-002';
  private embeddingDimension: number = 384;
  private cacheEnabled: boolean = true;
  private embeddingCache: Map<string, Float32Array> = new Map();
  private cacheSize: number = 1000;
  
  /**
   * Initialize the embedding service
   */
  public async initialize(): Promise<void> {
    try {
      // Try to load local model
      await this.initializeLocalModel();
      
      // If local model loaded successfully, prefer it
      if (this.localModel && this.localModel.isReady()) {
        this.useLocalModel = true;
        logger.info('Using local embedding model');
      } else {
        // Otherwise use cloud API
        this.useLocalModel = false;
        // Try to get API key from extension settings
        const config = vscode.workspace.getConfiguration('logcai');
        this.apiKey = config.get<string>('openaiApiKey', '');
        
        if (!this.apiKey) {
          logger.warn('No OpenAI API key found for embeddings. Context matching will be limited.');
        }
      }
    } catch (error) {
      logger.error('Failed to initialize embedding service', error);
    }
  }

  /**
   * Initialize local embedding model if available
   */
  private async initializeLocalModel(): Promise<void> {
    try {
      // Create local model
      this.localModel = new LocalEmbeddingModel();
      
      // Try to initialize it
      await this.localModel.initialize();
      
      if (!this.localModel.isReady()) {
        logger.warn('Local embedding model not available');
        this.localModel = null;
      }
    } catch (error) {
      logger.error('Failed to initialize local embedding model', error);
      this.localModel = null;
    }
  }

  /**
   * Generate an embedding for text
   */
  public async generateEmbedding(text: string): Promise<Float32Array> {
    // Normalize and truncate text
    const normalizedText = this.normalizeText(text);
    
    // Check cache first if enabled
    if (this.cacheEnabled) {
      const cacheKey = this.getCacheKey(normalizedText);
      const cachedEmbedding = this.embeddingCache.get(cacheKey);
      
      if (cachedEmbedding) {
        return cachedEmbedding;
      }
    }
    
    try {
      let embedding: Float32Array;
      
      // Use local model if available and ready
      if (this.useLocalModel && this.localModel && this.localModel.isReady()) {
        embedding = await this.localModel.generateEmbedding(normalizedText);
      } 
      // Otherwise use cloud API if online and API key available
      else if (networkAwareness.isOnline() && this.apiKey) {
        embedding = await this.generateEmbeddingViaAPI(normalizedText);
      } 
      // If no options available, generate a deterministic pseudo-embedding based on text
      else {
        embedding = this.generatePseudoEmbedding(normalizedText);
        logger.debug('Using pseudo-embedding as fallback');
      }
      
      // Cache the embedding if enabled
      if (this.cacheEnabled) {
        this.cacheEmbedding(normalizedText, embedding);
      }
      
      return embedding;
    } catch (error) {
      logger.error('Error generating embedding', error);
      // Return fallback embedding
      return this.generatePseudoEmbedding(normalizedText);
    }
  }

  /**
   * Generate embedding via OpenAI API
   */
  private async generateEmbeddingViaAPI(text: string): Promise<Float32Array> {
    if (!this.apiKey) {
      throw new Error('No API key provided for embedding generation');
    }
    
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        input: text,
        model: this.model
      });
      
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        }
      };
      
      const req = http.request(this.endpoint, options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              reject(new Error(`API returned status code ${res.statusCode}: ${responseData}`));
              return;
            }
            
            const response = JSON.parse(responseData);
            
            if (!response.data || !response.data[0] || !response.data[0].embedding) {
              reject(new Error('Invalid response format from API'));
              return;
            }
            
            const embeddingArray = response.data[0].embedding;
            const typedArray = new Float32Array(embeddingArray.length);
            
            for (let i = 0; i < embeddingArray.length; i++) {
              typedArray[i] = embeddingArray[i];
            }
            
            resolve(typedArray);
          } catch (error) {
            reject(error);
          }
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.write(data);
      req.end();
    });
  }

  /**
   * Generate a deterministic pseudo-embedding based on the text
   * This is used as a fallback when no embedding model or API is available
   */
  private generatePseudoEmbedding(text: string): Float32Array {
    // Create a deterministic embedding based on the text
    // This is not a real embedding but can be used for cosine similarity
    const embedding = new Float32Array(this.embeddingDimension);
    
    // Seed the embedding with values derived from the text
    let seed = 0;
    for (let i = 0; i < text.length; i++) {
      seed = (seed * 31 + text.charCodeAt(i)) & 0xFFFFFFFF;
    }
    
    // Fill the embedding with deterministic values
    for (let i = 0; i < this.embeddingDimension; i++) {
      // Generate a value between -1 and 1 using a simple PRNG
      const x = Math.sin(seed + i) * 10000;
      embedding[i] = x - Math.floor(x);
    }
    
    // Normalize to unit length for cosine similarity
    let length = 0;
    for (let i = 0; i < this.embeddingDimension; i++) {
      length += embedding[i] * embedding[i];
    }
    length = Math.sqrt(length);
    
    for (let i = 0; i < this.embeddingDimension; i++) {
      embedding[i] /= length;
    }
    
    return embedding;
  }

  /**
   * Normalize and truncate text for embedding
   */
  private normalizeText(text: string): string {
    // Remove extra whitespace
    let normalized = text.replace(/\s+/g, ' ').trim();
    
    // Truncate to maximum length (~8K tokens / ~32K chars)
    const maxLength = 32000;
    if (normalized.length > maxLength) {
      normalized = normalized.substring(0, maxLength);
    }
    
    return normalized;
  }

  /**
   * Get cache key for a text
   */
  private getCacheKey(text: string): string {
    // Use first 100 chars and text length as key
    return `${text.substring(0, 100)}:${text.length}`;
  }

  /**
   * Cache an embedding
   */
  private cacheEmbedding(text: string, embedding: Float32Array): void {
    // Enforce cache size limit with LRU policy
    if (this.embeddingCache.size >= this.cacheSize) {
      // Remove oldest entry (first key)
      const firstKey = this.embeddingCache.keys().next().value;
      this.embeddingCache.delete(firstKey);
    }
    
    const cacheKey = this.getCacheKey(text);
    this.embeddingCache.set(cacheKey, embedding);
  }

  /**
   * Check if API or local model requires network
   */
  public requiresNetwork(): boolean {
    // If using local model and it's ready, no network needed
    if (this.useLocalModel && this.localModel && this.localModel.isReady()) {
      return false;
    }
    
    // Otherwise we need network for API
    return true;
  }

  /**
   * Clear the embedding cache
   */
  public clearCache(): void {
    this.embeddingCache.clear();
  }
}