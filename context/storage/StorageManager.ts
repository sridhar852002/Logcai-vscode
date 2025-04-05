// src/context/storage/StorageManager.ts
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import { HierarchicalNSW } from 'hnswlib-node';
import logger from '../../utils/logger';

// Extended type definitions for HierarchicalNSW
declare module 'hnswlib-node' {
  export interface HierarchicalNSW {
    loadIndex(path: string): void;
    saveIndex(path: string): void;
    replacePoint(vector: Float32Array | number[], id: number): void;
    getIdsList(): number[];
  }
}

export interface VectorEntry {
  id: string;
  vector: Float32Array;
  metadata: any;
}

export interface ConversationData {
  id: string;
  title: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  modelId: string;
  systemPrompt?: string;
  temperature?: number;
  messages: MessageData[];
}

export interface MessageData {
  id: string;
  role: string;
  content: string;
  timestamp: Date | string | number;
}

export interface CodeEntity {
  id: string;
  name: string;
  type: string;
  filePath: string;
  code: string;
  firstSeen?: Date | number;
  lastSeen?: Date | number;
  frequency?: number;
  vectorId?: string;
}

export interface ContextItem {
  id: string;
  type: string;
  name: string;
  path?: string;
  language?: string;
  content?: string;
  lineStart?: number;
  lineEnd?: number;
  size?: number;
  lastAccessed?: Date | number;
  importanceScore?: number;
  vectorId?: string;
  metadata?: any;
}

/**
* Manages all persistent storage for the context system
* - SQLite for structured data and conversation history
* - HNSW for vector embeddings storage
*/
export class StorageManager {
  private static instance: StorageManager;
  private storagePath: string;
  private db: Database.Database | null = null;
  private vectorIndex: HierarchicalNSW | null = null;
  private ready: boolean = false;
  private vectorDimension: number = 384; // Default for most models

  // Make constructor private for singleton
  private constructor() {
    this.storagePath = this.getStoragePath();
    this.initialize();
  }

  public static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  /**
  * Determine the storage path for persistent data
  */
  private getStoragePath(): string {
    // Get the extension's global storage path
    const extension = vscode.extensions.getExtension('your.publisher.logcai');
    if (!extension) {
      throw new Error('Extension not found. Cannot determine storage path.');
    }
    const storagePath = path.join(extension.extensionPath, 'storage');
    // Create the directory if it doesn't exist
    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath, { recursive: true });
    }
    return storagePath;
  }

  /**
  * Initialize the storage systems
  */
  private async initialize(): Promise<void> {
    try {
      // Initialize SQLite database
      await this.initSQLite();
      // Initialize Vector database
      await this.initVectorDB();
      this.ready = true;
      logger.info('Storage system initialized successfully');
    } catch (error: unknown) {
      logger.error('Failed to initialize storage systems', error);
      this.ready = false;
    }
  }

  /**
  * Initialize SQLite database with required tables
  */
  private async initSQLite(): Promise<void> {
    try {
      const dbPath = path.join(this.storagePath, 'context.db');
      this.db = new Database(dbPath);
      // Enable WAL mode for better performance
      this.db.pragma('journal_mode = WAL');
      // Create tables if they don't exist
      this.db.exec(`
      -- Conversation history table
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        model_id TEXT NOT NULL,
        system_prompt TEXT,
        temperature REAL
      );
      
      -- Messages table
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );
      
      -- Context items table (files, code snippets, etc.)
      CREATE TABLE IF NOT EXISTS context_items (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        path TEXT,
        language TEXT,
        content TEXT,
        line_start INTEGER,
        line_end INTEGER,
        size INTEGER,
        last_accessed INTEGER,
        importance_score REAL DEFAULT 0,
        vector_id TEXT,
        metadata TEXT
      );
      
      -- Code entities table (functions, classes, variables)
      CREATE TABLE IF NOT EXISTS code_entities (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        file_path TEXT,
        code TEXT,
        first_seen INTEGER,
        last_seen INTEGER,
        frequency INTEGER DEFAULT 1,
        vector_id TEXT
      );
      
      -- User preferences and patterns
      CREATE TABLE IF NOT EXISTS user_patterns (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        pattern TEXT NOT NULL,
        examples TEXT,
        frequency INTEGER DEFAULT 1,
        first_seen INTEGER,
        last_seen INTEGER
      );
      
      -- Create indices for performance
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_code_entities_name ON code_entities(name);
      CREATE INDEX IF NOT EXISTS idx_context_items_path ON context_items(path);
      `);
      
      logger.debug('SQLite database initialized successfully');
    } catch (error: unknown) {
      logger.error('Failed to initialize SQLite database', error);
      throw error;
    }
  }

  /**
  * Initialize vector database for semantic search
  */
  private async initVectorDB(): Promise<void> {
    try {
      const vectorPath = path.join(this.storagePath, 'vectors.hnsw');
      const vectorMetaPath = path.join(this.storagePath, 'vectors.meta.json');
      // Check if we need to create a new index or load an existing one
      if (fs.existsSync(vectorPath) && fs.existsSync(vectorMetaPath)) {
        // Load vector metadata
        const metadataContent = fs.readFileSync(vectorMetaPath, 'utf8');
        const metadata = JSON.parse(metadataContent);
        this.vectorDimension = metadata.dimension;
        // Load existing index
        this.vectorIndex = new HierarchicalNSW('cosine', this.vectorDimension);
        this.vectorIndex.loadIndex(vectorPath);
        logger.debug(`Loaded existing vector index with ${this.vectorIndex.getCurrentCount()} vectors`);
      } else {
        // Create new index
        this.vectorIndex = new HierarchicalNSW('cosine', this.vectorDimension);
        // Initialize with space for 10,000 vectors, can grow if needed
        this.vectorIndex.initIndex(10000);
        // Save metadata
        fs.writeFileSync(
          vectorMetaPath,
          JSON.stringify({
            dimension: this.vectorDimension,
            created: Date.now(),
            type: 'hnsw',
            metric: 'cosine'
          })
        );
        logger.debug('Created new vector index');
      }
    } catch (error: unknown) {
      logger.error('Failed to initialize vector database', error);
      throw error;
    }
  }

  /**
  * Save vector embeddings with metadata
  */
  public saveVector(id: string, vector: Float32Array | number[], metadata: any): boolean {
    try {
      if (!this.vectorIndex || !this.ready) {
        logger.warn('Vector database not ready');
        return false;
      }
      // Add or update vector
      const idsList = this.vectorIndex.getIdsList();
      const numericId = parseInt(id, 10); // Convert string ID to number
      const exists = idsList.includes(numericId);
      if (exists) {
        // Update existing vector
        this.vectorIndex.replacePoint(vector, numericId);
      } else {
        // Add new vector
        // Convert Float32Array to number[] if needed
        const vectorArray = Array.isArray(vector) ? vector : Array.from(vector);
        this.vectorIndex.addPoint(vectorArray, numericId);
      }
      // Save vector metadata to SQLite
      if (this.db) {
        const metadataStr = JSON.stringify(metadata);
        // Store in context_items or code_entities based on type
        if (metadata && metadata.type === 'entity') {
          this.db.prepare(`
          UPDATE code_entities
          SET vector_id = ?
          WHERE id = ?
          `).run(id, metadata.entityId);
        } else if (metadata && metadata.itemId) {
          this.db.prepare(`
          UPDATE context_items
          SET vector_id = ?, metadata = ?
          WHERE id = ?
          `).run(id, metadataStr, metadata.itemId);
        }
      }
      // Periodically save the index to disk (could be optimized with debouncing)
      this.saveVectorIndex();
      return true;
    } catch (error: unknown) {
      logger.error('Failed to save vector', error);
      return false;
    }
  }

  /**
  * Find similar vectors by similarity search
  */
  public findSimilarVectors(queryVector: Float32Array | number[], limit: number = 5): VectorEntry[] {
    try {
      if (!this.vectorIndex || !this.ready) {
        logger.warn('Vector database not ready');
        return [];
      }
      // Convert Float32Array to number[] if needed
      const queryVectorArray = Array.isArray(queryVector) ? queryVector : Array.from(queryVector);
      // Search for similar vectors
      const result = this.vectorIndex.searchKnn(queryVectorArray, limit);
      // Format and return results
      const entries: VectorEntry[] = [];
      for (let i = 0; i < result.neighbors.length; i++) {
        const id = result.neighbors[i];
        // Skip if id is -1 (not found)
        if (id === -1) {
          continue;
        }
        // Get the vector
        const vector = this.vectorIndex.getPoint(id);
        // Get metadata from SQLite
        let metadata = {};
        if (this.db) {
          // Try both tables since we don't know where the vector is stored
          const contextItem = this.db.prepare(`
          SELECT * FROM context_items WHERE vector_id = ?
          `).get(id.toString());
          const codeEntity = this.db.prepare(`
          SELECT * FROM code_entities WHERE vector_id = ?
          `).get(id.toString());
          metadata = contextItem || codeEntity || {};
          // If metadata is stored as JSON string, parse it
          const metadataObj = metadata as Record<string, any>;
          if (metadataObj && metadataObj.metadata && typeof metadataObj.metadata === 'string') {
            try {
              const parsedMetadata = JSON.parse(metadataObj.metadata);
              metadata = { ...metadataObj, metadata: parsedMetadata };
            } catch (e) {
              // Ignore parsing errors
            }
          }
        }
        entries.push({
          id: id.toString(),
          vector: new Float32Array(vector),
          metadata
        });
      }
      return entries;
    } catch (error: unknown) {
      logger.error('Failed to find similar vectors', error);
      return [];
    }
  }

  /**
  * Save the vector index to disk
  */
  private saveVectorIndex(): void {
    try {
      if (!this.vectorIndex || !this.ready) {
        return;
      }
      const vectorPath = path.join(this.storagePath, 'vectors.hnsw');
      this.vectorIndex.saveIndex(vectorPath);
    } catch (error: unknown) {
      logger.error('Failed to save vector index', error);
    }
  }

  /**
  * Save a conversation to SQLite
  */
  public saveConversation(conversation: ConversationData): boolean {
    try {
      if (!this.db || !this.ready) {
        logger.warn('SQLite database not ready');
        return false;
      }
      // Begin transaction
      const transaction = this.db.transaction(() => {
        if (!this.db) {
          return;
        }
        // Insert or update conversation
        this.db.prepare(`
        INSERT OR REPLACE INTO conversations
        (id, title, created_at, updated_at, model_id, system_prompt, temperature)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          conversation.id,
          conversation.title,
          new Date(conversation.createdAt).getTime(),
          new Date(conversation.updatedAt).getTime(),
          conversation.modelId,
          conversation.systemPrompt || null,
          conversation.temperature || 0.7
        );
        // Handle messages - first delete existing messages for this conversation
        this.db.prepare(`
        DELETE FROM messages WHERE conversation_id = ?
        `).run(conversation.id);
        // Then insert all messages
        const insertMessage = this.db.prepare(`
        INSERT INTO messages (id, conversation_id, role, content, timestamp)
        VALUES (?, ?, ?, ?, ?)
        `);
        for (const message of conversation.messages) {
          insertMessage.run(
            message.id,
            conversation.id,
            message.role,
            message.content,
            new Date(message.timestamp).getTime()
          );
        }
      });
      // Execute transaction
      transaction();
      return true;
    } catch (error: unknown) {
      logger.error('Failed to save conversation', error);
      return false;
    }
  }

  /**
  * Load all conversations from SQLite
  */
  public loadConversations(): ConversationData[] {
    try {
      if (!this.db || !this.ready) {
        logger.warn('SQLite database not ready');
        return [];
      }
      // Get all conversations
      const conversationsData = this.db.prepare(`
      SELECT * FROM conversations ORDER BY updated_at DESC
      `).all();
      // Format conversations with their messages
      const conversations: ConversationData[] = [];
      for (const conv of conversationsData) {
        if (!this.db) {
          continue;
        }
        // Type assertion for conv
        const typedConv = conv as Record<string, any>;
        // Get messages for this conversation
        const messages = this.db.prepare(`
        SELECT * FROM messages
        WHERE conversation_id = ?
        ORDER BY timestamp ASC
        `).all(typedConv.id);
        // Format messages
        const formattedMessages: MessageData[] = messages.map((msg: any) => {
          const typedMsg = msg as Record<string, any>;
          return {
            id: typedMsg.id,
            role: typedMsg.role,
            content: typedMsg.content,
            timestamp: new Date(typedMsg.timestamp)
          };
        });
        // Format conversation
        conversations.push({
          id: typedConv.id,
          title: typedConv.title,
          messages: formattedMessages,
          modelId: typedConv.model_id,
          createdAt: new Date(typedConv.created_at),
          updatedAt: new Date(typedConv.updated_at),
          systemPrompt: typedConv.system_prompt,
          temperature: typedConv.temperature
        });
      }
      return conversations;
    } catch (error: unknown) {
      logger.error('Failed to load conversations', error);
      return [];
    }
  }

  /**
  * Find code entities by name pattern
  */
  public findCodeEntities(namePattern: string, limit: number = 10): CodeEntity[] {
    try {
      if (!this.db || !this.ready) {
        logger.warn('SQLite database not ready');
        return [];
      }
      // Search for code entities with matching name
      const entities = this.db.prepare(`
      SELECT * FROM code_entities
      WHERE name LIKE ?
      ORDER BY frequency DESC, last_seen DESC
      LIMIT ?
      `).all(`%${namePattern}%`, limit);
      
      return entities.map((entity: any) => {
        const typedEntity = entity as Record<string, any>;
        return {
          id: typedEntity.id,
          name: typedEntity.name,
          type: typedEntity.type,
          filePath: typedEntity.file_path,
          code: typedEntity.code,
          firstSeen: new Date(typedEntity.first_seen),
          lastSeen: new Date(typedEntity.last_seen),
          frequency: typedEntity.frequency,
          vectorId: typedEntity.vector_id
        };
      });
    } catch (error: unknown) {
      logger.error('Failed to find code entities', error);
      return [];
    }
  }

  /**
  * Find context items by path pattern
  */
  public findContextItems(pathPattern: string, limit: number = 10): ContextItem[] {
    try {
      if (!this.db || !this.ready) {
        logger.warn('SQLite database not ready');
        return [];
      }
      // Search for context items with matching path
      const items = this.db.prepare(`
      SELECT * FROM context_items
      WHERE path LIKE ?
      ORDER BY last_accessed DESC
      LIMIT ?
      `).all(`%${pathPattern}%`, limit);
      
      return items.map((item: any) => {
        const typedItem = item as Record<string, any>;
        let metadata = null;
        if (typedItem.metadata) {
          try {
            metadata = JSON.parse(typedItem.metadata);
          } catch (e) {
            // Ignore parsing errors
          }
        }
        return {
          id: typedItem.id,
          type: typedItem.type,
          name: typedItem.name,
          path: typedItem.path,
          language: typedItem.language,
          content: typedItem.content,
          lineStart: typedItem.line_start,
          lineEnd: typedItem.line_end,
          size: typedItem.size,
          lastAccessed: new Date(typedItem.last_accessed),
          importanceScore: typedItem.importance_score,
          vectorId: typedItem.vector_id,
          metadata
        };
      });
    } catch (error: unknown) {
      logger.error('Failed to find context items', error);
      return [];
    }
  }

  /**
  * Save a code entity to the database
  */
  public saveCodeEntity(entity: CodeEntity): boolean {
    try {
      if (!this.db || !this.ready) {
        logger.warn('SQLite database not ready');
        return false;
      }
      const now = Date.now();
      const typedEntity = entity as Record<string, any>;
      // Check if entity already exists
      const existing = this.db.prepare(`
      SELECT * FROM code_entities WHERE id = ?
      `).get(typedEntity.id);
      
      if (existing) {
        // Update existing entity
        this.db.prepare(`
        UPDATE code_entities
        SET
          name = ?,
          type = ?,
          file_path = ?,
          code = ?,
          last_seen = ?,
          frequency = frequency + 1
        WHERE id = ?
        `).run(
          typedEntity.name,
          typedEntity.type,
          typedEntity.filePath,
          typedEntity.code,
          now,
          typedEntity.id
        );
      } else {
        // Insert new entity
        this.db.prepare(`
        INSERT INTO code_entities
        (id, name, type, file_path, code, first_seen, last_seen, frequency)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          typedEntity.id,
          typedEntity.name,
          typedEntity.type,
          typedEntity.filePath,
          typedEntity.code,
          now,
          now,
          1
        );
      }
      return true;
    } catch (error: unknown) {
      logger.error('Failed to save code entity', error);
      return false;
    }
  }

  /**
  * Save a context item (file, code snippet, etc.)
  */
  public saveContextItem(item: ContextItem): boolean {
    try {
      if (!this.db || !this.ready) {
        logger.warn('SQLite database not ready');
        return false;
      }
      const now = Date.now();
      const typedItem = item as Record<string, any>;
      const metadata = typedItem.metadata ? JSON.stringify(typedItem.metadata) : null;
      // Check if item already exists
      const existing = this.db.prepare(`
      SELECT * FROM context_items WHERE id = ?
      `).get(typedItem.id);
      
      if (existing) {
        // Update existing item
        this.db.prepare(`
        UPDATE context_items
        SET
          type = ?,
          name = ?,
          path = ?,
          language = ?,
          content = ?,
          line_start = ?,
          line_end = ?,
          size = ?,
          last_accessed = ?,
          metadata = ?
        WHERE id = ?
        `).run(
          typedItem.type,
          typedItem.name,
          typedItem.path || null,
          typedItem.language || null,
          typedItem.content || null,
          typedItem.lineStart || null,
          typedItem.lineEnd || null,
          typedItem.size || null,
          now,
          metadata,
          typedItem.id
        );
      } else {
        // Insert new item
        this.db.prepare(`
        INSERT INTO context_items
        (id, type, name, path, language, content, line_start, line_end, size, last_accessed, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          typedItem.id,
          typedItem.type,
          typedItem.name,
          typedItem.path || null,
          typedItem.language || null,
          typedItem.content || null,
          typedItem.lineStart || null,
          typedItem.lineEnd || null,
          typedItem.size || null,
          now,
          metadata
        );
      }
      return true;
    } catch (error: unknown) {
      logger.error('Failed to save context item', error);
      return false;
    }
  }

  /**
  * Close databases and release resources
  */
  public close(): void {
    try {
      // Save vector index
      if (this.vectorIndex) {
        this.saveVectorIndex();
      }
      
      // Close SQLite database
      if (this.db) {
        this.db.close();
        this.db = null;
      }
      
      this.ready = false;
      logger.info('Storage manager closed');
    } catch (error: unknown) {
      logger.error('Error closing storage manager', error);
    }
  }
}
export const storageManagerInstance = StorageManager.getInstance();
