// src/utils/responseCache.ts
import logger from './logger';
import { createHash } from 'crypto';

// Cache entry type definition
interface CacheEntry {
  value: string;
  timestamp: number;
  model: string;
  hash: string;
}

// Maximum number of entries in the LRU cache
const MAX_CACHE_SIZE = 100;

// Default TTL (Time-To-Live) in milliseconds (24 hours)
const DEFAULT_TTL = 24 * 60 * 60 * 1000;

// Cache statistics
interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}

/**
 * LRU (Least Recently Used) Cache for AI responses
 */
export class ResponseCache {
  private static instance: ResponseCache;
  private cache: Map<string, CacheEntry> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    oldestEntry: null,
    newestEntry: null
  };
  
  // Make constructor private for singleton pattern
  private constructor() {}
  
  /**
   * Get singleton instance of the cache
   */
  public static getInstance(): ResponseCache {
    if (!ResponseCache.instance) {
      ResponseCache.instance = new ResponseCache();
    }
    return ResponseCache.instance;
  }
  
  /**
   * Generate a unique cache key from query parameters
   */
  private generateKey(query: string, model: string, options: any = {}): string {
    // Normalize the query by trimming and converting to lowercase
    const normalizedQuery = query.trim().toLowerCase();
    
    // Extract relevant options that would affect the response
    const relevantOptions = {
      temperature: options.temperature || 0,
      systemPrompt: options.systemPrompt || '',
      maxTokens: options.maxTokens || 0
    };
    
    // Create a string to hash
    const stringToHash = `${normalizedQuery}|${model}|${JSON.stringify(relevantOptions)}`;
    
    // Generate hash using SHA-256
    return createHash('sha256').update(stringToHash).digest('hex');
  }
  
  /**
   * Store a response in the cache
   */
  public set(query: string, response: string, model: string, options: any = {}): void {
    try {
      // Don't cache empty responses
      if (!response || response.trim() === '') {
        return;
      }
      
      // Generate the cache key
      const hash = this.generateKey(query, model, options);
      
      // Create cache entry
      const entry: CacheEntry = {
        value: response,
        timestamp: Date.now(),
        model,
        hash
      };
      
      // Update cache
      this.cache.set(hash, entry);
      this.stats.size = this.cache.size;
      this.stats.newestEntry = entry.timestamp;
      
      // If oldest entry is not set, this is the oldest too
      if (this.stats.oldestEntry === null) {
        this.stats.oldestEntry = entry.timestamp;
      }
      
      // Enforce cache size limit (LRU eviction)
      if (this.cache.size > MAX_CACHE_SIZE) {
        this.evictOldest();
      }
      
      logger.debug(`Cache: Stored response for query hash ${hash.substring(0, 8)}...`);
    } catch (error) {
      logger.warn(`Failed to store in cache: ${error instanceof Error ? error.message : 'Unknown error'}`, 
                  error, 
                  logger.ErrorCategory.CACHE);
    }
  }
  
  /**
   * Retrieve a response from the cache if available and not expired
   */
  public get(query: string, model: string, options: any = {}, ttl: number = DEFAULT_TTL): string | null {
    try {
      // Generate the cache key
      const hash = this.generateKey(query, model, options);
      
      // Check if the key exists in cache
      if (this.cache.has(hash)) {
        const entry = this.cache.get(hash)!;
        const now = Date.now();
        
        // Check if the entry is still valid (not expired)
        if (now - entry.timestamp <= ttl) {
          // Touch the entry (update timestamp for LRU)
          entry.timestamp = now;
          this.stats.hits++;
          this.stats.newestEntry = now;
          
          logger.debug(`Cache HIT: Retrieved response for query hash ${hash.substring(0, 8)}...`);
          return entry.value;
        } else {
          // Entry expired, remove it
          this.cache.delete(hash);
          this.stats.size = this.cache.size;
          this.stats.misses++;
          
          logger.debug(`Cache MISS (expired): Query hash ${hash.substring(0, 8)}...`);
          return null;
        }
      }
      
      // Cache miss
      this.stats.misses++;
      logger.debug(`Cache MISS: Query hash ${hash.substring(0, 8)}...`);
      return null;
    } catch (error) {
      logger.warn(`Failed to retrieve from cache: ${error instanceof Error ? error.message : 'Unknown error'}`, 
                  error, 
                  logger.ErrorCategory.CACHE);
      return null;
    }
  }
  
  /**
   * Evict the least recently used entry from the cache
   */
  private evictOldest(): void {
    if (this.cache.size === 0) {return;}
    
    // Find the oldest entry
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    // Remove the oldest entry
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.size = this.cache.size;
      
      // Find new oldest entry
      let newOldestTime = Infinity;
      for (const entry of this.cache.values()) {
        if (entry.timestamp < newOldestTime) {
          newOldestTime = entry.timestamp;
        }
      }
      
      this.stats.oldestEntry = this.cache.size > 0 ? newOldestTime : null;
      
      logger.debug(`Cache: Evicted oldest entry with hash ${oldestKey.substring(0, 8)}...`);
    }
  }
  
  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    return { ...this.stats };
  }
  
  /**
   * Clear the entire cache
   */
  public clear(): void {
    this.cache.clear();
    this.stats.size = 0;
    this.stats.oldestEntry = null;
    this.stats.newestEntry = null;
    logger.debug('Cache: Cleared all entries');
  }
  
  /**
   * Clear cached entries for a specific model
   */
  public clearForModel(model: string): void {
    // Collect keys to delete (can't modify Map during iteration)
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.model === model) {
        keysToDelete.push(key);
      }
    }
    
    // Delete collected keys
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
    
    this.stats.size = this.cache.size;
    
    // Update oldest/newest time if needed
    if (this.cache.size === 0) {
      this.stats.oldestEntry = null;
      this.stats.newestEntry = null;
    } else {
      let oldestTime = Infinity;
      let newestTime = 0;
      
      for (const entry of this.cache.values()) {
        if (entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp;
        }
        if (entry.timestamp > newestTime) {
          newestTime = entry.timestamp;
        }
      }
      
      this.stats.oldestEntry = oldestTime;
      this.stats.newestEntry = newestTime;
    }
    
    logger.debug(`Cache: Cleared entries for model ${model}`);
  }
}

// Export singleton instance
export default ResponseCache.getInstance();