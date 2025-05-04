import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { log } from '../utils/logging';

/**
 * Interface for a code chunk that will be stored in the vector database
 */
export interface CodeChunk {
  id: string;
  content: string;
  filePath: string;
  language: string;
  chunkType: 'function' | 'class' | 'method' | 'import' | 'other';
  metadata?: Record<string, any>;
  embedding?: number[];
  lastUpdated: number;
}

/**
 * Interface for search options
 */
export interface SearchOptions {
  limit?: number;
  threshold?: number;
  filter?: (chunk: CodeChunk) => boolean;
}

/**
 * Search result from the vector store
 */
export interface SearchResult {
  chunk: CodeChunk;
  score: number;
}

/**
 * Simple in-memory vector storage implementation
 * This is a placeholder that will be replaced with a proper SQLite implementation
 */
export class VectorStorage {
  private storageDir: string;
  private inMemoryIndex: Map<string, CodeChunk> = new Map();
  private initialized: boolean = false;

  constructor(private context: vscode.ExtensionContext) {
    this.storageDir = path.join(context.globalStorageUri.fsPath, 'vectors');
  }

  /**
   * Initialize the vector storage
   */
  async initialize(): Promise<void> {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
      
      // Load any existing data
      await this.loadFromDisk();
      
      this.initialized = true;
      log.info('Vector storage initialized');
    } catch (error) {
      log.error(`Failed to initialize vector storage: ${error}`);
      throw error;
    }
  }

  /**
   * Load stored vectors from disk
   */
  private async loadFromDisk(): Promise<void> {
    try {
      const indexPath = path.join(this.storageDir, 'index.json');
      
      if (fs.existsSync(indexPath)) {
        const data = fs.readFileSync(indexPath, 'utf8');
        const chunks = JSON.parse(data) as CodeChunk[];
        
        chunks.forEach(chunk => {
          this.inMemoryIndex.set(chunk.id, chunk);
        });
        
        log.info(`Loaded ${chunks.length} code chunks from disk`);
      }
    } catch (error) {
      log.error(`Failed to load vectors from disk: ${error}`);
    }
  }
  
  /**
   * Save vectors to disk
   */
  private async saveToDisk(): Promise<void> {
    try {
      const indexPath = path.join(this.storageDir, 'index.json');
      const chunks = Array.from(this.inMemoryIndex.values());
      
      fs.writeFileSync(indexPath, JSON.stringify(chunks, null, 2), 'utf8');
      log.info(`Saved ${chunks.length} code chunks to disk`);
    } catch (error) {
      log.error(`Failed to save vectors to disk: ${error}`);
    }
  }

  /**
   * Add a code chunk to the vector storage
   */
  async addChunk(chunk: CodeChunk): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Ensure the chunk has an ID
    if (!chunk.id) {
      chunk.id = this.generateChunkId(chunk);
    }
    
    // Update last updated timestamp
    chunk.lastUpdated = Date.now();
    
    // Store the chunk
    this.inMemoryIndex.set(chunk.id, chunk);
    
    // Periodically save to disk
    if (this.inMemoryIndex.size % 10 === 0) {
      await this.saveToDisk();
    }
  }

  /**
   * Generate a unique ID for a chunk based on its content and path
   */
  private generateChunkId(chunk: CodeChunk): string {
    const hash = crypto.createHash('sha256');
    hash.update(chunk.filePath + chunk.content);
    return hash.digest('hex').substring(0, 16);
  }

  /**
   * Delete a code chunk by ID
   */
  async deleteChunk(id: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const result = this.inMemoryIndex.delete(id);
    
    if (result) {
      await this.saveToDisk();
    }
    
    return result;
  }

  /**
   * Get a code chunk by ID
   */
  async getChunk(id: string): Promise<CodeChunk | undefined> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    return this.inMemoryIndex.get(id);
  }

  /**
   * Update an existing code chunk
   */
  async updateChunk(id: string, updates: Partial<CodeChunk>): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const chunk = this.inMemoryIndex.get(id);
    
    if (!chunk) {
      return false;
    }
    
    // Apply updates
    Object.assign(chunk, updates);
    
    // Update timestamp
    chunk.lastUpdated = Date.now();
    
    // Save changes
    this.inMemoryIndex.set(id, chunk);
    await this.saveToDisk();
    
    return true;
  }

  /**
   * Search for code chunks (simple keyword search for now)
   * This will be replaced with actual vector similarity search later
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const limit = options.limit || 5;
    const threshold = options.threshold || 0.5;
    
    // Split query into keywords
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
    
    if (keywords.length === 0) {
      return [];
    }
    
    // Simple keyword scoring for now
    const results: SearchResult[] = [];
    
    for (const chunk of this.inMemoryIndex.values()) {
      // Skip if filter is provided and chunk doesn't match
      if (options.filter && !options.filter(chunk)) {
        continue;
      }
      
      // Calculate a simple relevance score
      const lowerContent = chunk.content.toLowerCase();
      let score = 0;
      
      for (const keyword of keywords) {
        const count = (lowerContent.match(new RegExp(keyword, 'g')) || []).length;
        score += count * (keyword.length / 10); // Weight longer keywords more heavily
      }
      
      // Normalize score
      score = Math.min(score / (lowerContent.length / 100), 1);
      
      if (score >= threshold) {
        results.push({ chunk, score });
      }
    }
    
    // Sort by score and limit results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  
  /**
   * Get all chunks for a specific file
   */
  async getChunksForFile(filePath: string): Promise<CodeChunk[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const normalizedPath = vscode.workspace.asRelativePath(filePath);
    
    return Array.from(this.inMemoryIndex.values())
      .filter(chunk => chunk.filePath === normalizedPath);
  }
  
  /**
   * Delete all chunks for a specific file
   */
  async deleteChunksForFile(filePath: string): Promise<number> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const normalizedPath = vscode.workspace.asRelativePath(filePath);
    let count = 0;
    
    for (const [id, chunk] of this.inMemoryIndex.entries()) {
      if (chunk.filePath === normalizedPath) {
        this.inMemoryIndex.delete(id);
        count++;
      }
    }
    
    if (count > 0) {
      await this.saveToDisk();
    }
    
    return count;
  }
  
  /**
   * Count total chunks
   */
  async count(): Promise<number> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    return this.inMemoryIndex.size;
  }
  
  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    this.inMemoryIndex.clear();
    await this.saveToDisk();
    log.info('Vector storage cleared');
  }
}