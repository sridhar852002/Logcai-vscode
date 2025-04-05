// src/context/indexing/IndexingService.ts
import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { debounce } from 'lodash';
import { StorageManager } from '../storage/StorageManager';
import { EmbeddingService } from '../embeddings/EmbeddingService';
import logger from '../../utils/logger';
import { parseTsCode, extractFunctionsAndClasses } from '../../ai/ast/TypeScriptAstUtils';
import { parseGenericCode } from '../../ai/ast/GenericAstUtils';
import { parsePhpCode } from '../../ai/ast/PhpAstUtils';
import networkAwareness from '../../utils/networkAwareness';

/**
* Manages background indexing of workspace files for context-aware features
*/
export class IndexingService {
  private static instance: IndexingService;
  private fileWatcher: vscode.FileSystemWatcher | null = null;
  private storage: StorageManager;
  private embeddings: EmbeddingService;
  private indexingQueue: Set<string> = new Set();
  private processingQueue: boolean = false;
  private maxQueueSize: number = 100;
  private indexedFiles: Set<string> = new Set();
  private excludePatterns: RegExp[] = [
    /node_modules/,
    /\.git/,
    /dist/,
    /build/,
    /\.vscode/,
    /\.idea/,
    /\.DS_Store/,
  ];
  private isInitialized: boolean = false;
  private projectRoot: string = '';

  // Config and limits
  private maxFileSize: number = 500 * 1024; // 500KB
  private priorityExtensions: string[] = [
    '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.c', '.cpp', '.cs', '.go', '.rb', '.php'
  ];
  private maxParallelProcessing: number = 3;

  // Make constructor private for singleton
  private constructor() {
    this.storage = StorageManager.getInstance();
    this.embeddings = new EmbeddingService();

    // Get the workspace folder
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      this.projectRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    }
  }

  public static getInstance(): IndexingService {
    if (!IndexingService.instance) {
      IndexingService.instance = new IndexingService();
    }
    return IndexingService.instance;
  }

  /**
  * Initialize the indexing service
  */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    try {
      // Set up file watcher
      this.setupFileWatcher();
      
      // Initialize embedding service
      await this.embeddings.initialize();
      
      // Load already indexed files from storage to avoid re-indexing
      this.loadIndexedFiles();
      
      // Schedule a background full workspace indexing
      this.scheduleFullIndexing();
      
      this.isInitialized = true;
      logger.info('Indexing service initialized');
    } catch (error: unknown) {
      logger.error('Failed to initialize indexing service', error);
    }
  }

  /**
  * Set up file system watcher to track file changes
  */
  private setupFileWatcher(): void {
    try {
      // Watch all files in the workspace
      this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');
      
      // When a file is created or modified, add it to the indexing queue
      this.fileWatcher.onDidCreate(uri => this.queueFileForIndexing(uri.fsPath));
      this.fileWatcher.onDidChange(uri => this.queueFileForIndexing(uri.fsPath));
      
      // When a file is deleted, remove it from indexed files
      this.fileWatcher.onDidDelete(uri => {
        const filePath = uri.fsPath;
        this.indexedFiles.delete(filePath);
        // Remove from queue if present
        this.indexingQueue.delete(filePath);
      });
      
      logger.debug('File watcher set up successfully');
    } catch (error: unknown) {
      logger.error('Failed to set up file watcher', error);
    }
  }

  /**
  * Load the list of already indexed files from storage
  */
  private loadIndexedFiles(): void {
    try {
      // Query the context_items table for file paths
      const items = this.storage.findContextItems('', 1000);
      for (const item of items) {
        if (item.type === 'file' && item.path) {
          this.indexedFiles.add(item.path);
        }
      }
      logger.debug(`Loaded ${this.indexedFiles.size} indexed files`);
    } catch (error: unknown) {
      logger.error('Failed to load indexed files', error);
    }
  }

  /**
  * Schedule a full workspace indexing with low priority
  */
  private scheduleFullIndexing(): void {
    // Wait a bit after startup to allow the editor to initialize
    setTimeout(() => {
      // Don't block the main thread
      this.indexWorkspaceInBackground();
    }, 10000); // 10 seconds delay
  }

  /**
  * Index workspace files in the background
  */
  public async indexWorkspaceInBackground(): Promise<void> {
    try {
      // Only proceed if we have a workspace folder
      if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        logger.warn('No workspace folder found, skipping indexing');
        return;
      }
      const workspaceFolder = vscode.workspace.workspaceFolders[0];
      
      // Find files to index
      const includePattern =
        '{**/*.ts,**/*.js,**/*.tsx,**/*.jsx,**/*.py,**/*.java,**/*.cs,**/*.php,**/*.go,**/*.rb,**/*.c,**/*.cpp}';
      const excludePattern = '{**/node_modules/**,**/dist/**,**/build/**,**/.git/**,**/.vscode/**}';
      const files = await vscode.workspace.findFiles(includePattern, excludePattern, 1000);
      
      logger.info(`Found ${files.length} files to index in the workspace`);
      
      // Queue files for indexing
      // Only queue files that aren't already indexed or in the queue
      let queuedCount = 0;
      for (const file of files) {
        const filePath = file.fsPath;
        if (!this.indexedFiles.has(filePath) && !this.indexingQueue.has(filePath)) {
          this.queueFileForIndexing(filePath);
          queuedCount++;
          
          // If queue gets too large, start processing
          if (queuedCount % this.maxQueueSize === 0) {
            // Wait for queue to process
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
      
      logger.info(`Queued ${queuedCount} files for indexing`);
    } catch (error: unknown) {
      logger.error('Error during workspace indexing', error);
    }
  }

  /**
  * Queue a file for indexing
  */
  public queueFileForIndexing(filePath: string, priority: boolean = false): void {
    // Skip files that match exclude patterns
    if (this.shouldExcludeFile(filePath)) {
      return;
    }
    
    // Add to queue
    this.indexingQueue.add(filePath);
    
    // Start processing the queue if not already processing
    if (!this.processingQueue) {
      this.processIndexingQueue();
    }
    
    // If priority, ensure queue processing starts right away
    if (priority) {
      this.debouncedProcessQueue.cancel();
      this.processIndexingQueue();
    } else {
      // Otherwise, use debounced version to batch process
      this.debouncedProcessQueue();
    }
  }

  /**
  * Create a debounced version of the queue processor
  * to batch process files and avoid too frequent processing
  */
  private debouncedProcessQueue = debounce(() => {
    this.processIndexingQueue();
  }, 1000);

  /**
  * Process the indexing queue
  */
  private async processIndexingQueue(): Promise<void> {
    // If already processing or queue is empty, do nothing
    if (this.processingQueue || this.indexingQueue.size === 0) {
      return;
    }
    
    this.processingQueue = true;
    
    try {
      // Process in chunks to avoid blocking the main thread
      const batch = Array.from(this.indexingQueue).slice(0, this.maxParallelProcessing);
      
      // Remove from queue
      for (const filePath of batch) {
        this.indexingQueue.delete(filePath);
      }
      
      // Process batch in parallel
      await Promise.all(batch.map(filePath => this.indexFile(filePath)));
      
      // Continue processing if there are more files in the queue
      if (this.indexingQueue.size > 0) {
        // Schedule next batch with a small delay
        setTimeout(() => this.processIndexingQueue(), 100);
      } else {
        this.processingQueue = false;
      }
    } catch (error: unknown) {
      logger.error('Error processing indexing queue', error);
      this.processingQueue = false;
    }
  }

  /**
  * Determine if a file should be excluded from indexing
  */
  private shouldExcludeFile(filePath: string): boolean {
    // Check against exclude patterns
    for (const pattern of this.excludePatterns) {
      if (pattern.test(filePath)) {
        return true;
      }
    }
    
    // Skip binary and non-text files
    const ext = path.extname(filePath).toLowerCase();
    const binaryExtensions = [
      // Binary files
      '.exe', '.dll', '.obj', '.bin', '.dat', '.db', '.sqlite', '.mdb',
      // Image files
      '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.svg',
      // Media files
      '.mp3', '.mp4', '.avi', '.mov', '.wav', '.flac',
      // Archive files
      '.zip', '.rar', '.7z', '.tar', '.gz',
      // Other non-text files
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'
    ];
    
    if (binaryExtensions.includes(ext)) {
      return true;
    }
    
    return false;
  }

  /**
  * Index a single file
  */
  private async indexFile(filePath: string): Promise<void> {
    try {
      // Skip if file doesn't exist or is too large
      const stats = await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
      if (stats.size > this.maxFileSize) {
        logger.debug(`Skipping large file: ${filePath} (${stats.size} bytes)`);
        return;
      }
      
      // Read file content
      const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
      const content = Buffer.from(fileContent).toString('utf8');
      
      // Get language ID from file extension
      const ext = path.extname(filePath).toLowerCase();
      const languageMap: { [key: string]: string } = {
        '.ts': 'typescript',
        '.tsx': 'typescriptreact',
        '.js': 'javascript',
        '.jsx': 'javascriptreact',
        '.py': 'python',
        '.java': 'java',
        '.c': 'c',
        '.cpp': 'cpp',
        '.cs': 'csharp',
        '.go': 'go',
        '.rb': 'ruby',
        '.php': 'php',
        '.html': 'html',
        '.css': 'css',
        '.json': 'json',
        '.md': 'markdown',
      };
      const language = languageMap[ext] || 'plaintext';
      
      // Create file ID and store basic file context
      const fileId = this.generateFileId(filePath);
      const fileName = path.basename(filePath);
      
      // Save file context
      this.storage.saveContextItem({
        id: fileId,
        type: 'file',
        name: fileName,
        path: filePath,
        language,
        content,
        size: content.length,
        lineStart: 0,
        lineEnd: content.split('\n').length - 1,
        lastAccessed: Date.now(),
        importanceScore: this.calculateInitialImportance(filePath, language)
      });
      
      // Mark file as indexed
      this.indexedFiles.add(filePath);
      
      // Extract code entities and index them
      await this.extractAndIndexEntities(filePath, content, language);
      
      // Generate embeddings only if we have network connectivity or local embeddings
      if (networkAwareness.isOnline() || !this.embeddings.requiresNetwork()) {
        await this.generateEmbeddings(fileId, content, language);
      }
    } catch (error: unknown) {
      logger.error(`Error indexing file: ${filePath}`, error);
    }
  }

  /**
  * Generate unique ID for a file
  */
  private generateFileId(filePath: string): string {
    // Create deterministic ID based on file path
    return crypto.createHash('md5').update(filePath).digest('hex');
  }

  /**
  * Extract and index code entities from file
  */
  private async extractAndIndexEntities(filePath: string, content: string, language: string): Promise<void> {
    try {
      let entities: { functions: any[], classes: Record<string, any> } = { functions: [], classes: {} };
      
      // Use the appropriate parser based on language
      switch (language) {
        case 'typescript':
        case 'typescriptreact':
        case 'javascript':
        case 'javascriptreact':
          const ast = parseTsCode(content, filePath);
          entities = extractFunctionsAndClasses(ast, content);
          break;
        case 'php':
          entities = parsePhpCode(content);
          break;
        default:
          // Use generic parser for other languages
          entities = parseGenericCode(content);
          break;
      }
      
      // Index functions
      for (const func of entities.functions) {
        const entityId = crypto.createHash('md5').update(`${filePath}:func:${func.name}`).digest('hex');
        this.storage.saveCodeEntity({
          id: entityId,
          name: func.name,
          type: 'function',
          filePath,
          code: func.code,
          firstSeen: func.startLine,
          lastSeen: func.endLine,
          frequency: 1
        });
        
        // Generate embeddings for functions
        if (networkAwareness.isOnline() || !this.embeddings.requiresNetwork()) {
          await this.generateEntityEmbeddings(entityId, func.name, func.code, language);
        }
      }
      
      // Index classes
      for (const className in entities.classes) {
        const cls = entities.classes[className];
        const entityId = crypto.createHash('md5').update(`${filePath}:class:${className}`).digest('hex');
        this.storage.saveCodeEntity({
          id: entityId,
          name: className,
          type: 'class',
          filePath,
          code: cls.code,
          firstSeen: cls.startLine,
          lastSeen: cls.endLine,
          frequency: 1
        });
        
        // Generate embeddings for classes
        if (networkAwareness.isOnline() || !this.embeddings.requiresNetwork()) {
          await this.generateEntityEmbeddings(entityId, className, cls.code, language);
        }
      }
    } catch (error: unknown) {
      logger.error(`Error extracting entities from ${filePath}`, error);
    }
  }

  /**
  * Generate embeddings for a file
  */
  private async generateEmbeddings(fileId: string, content: string, language: string): Promise<void> {
    try {
      // Generate embedding for file content
      const embedding = await this.embeddings.generateEmbedding(content);
      
      // Save vector in vector database
      this.storage.saveVector(fileId, embedding, {
        type: 'file',
        itemId: fileId,
        language
      });
    } catch (error: unknown) {
      logger.error(`Error generating embeddings for file ${fileId}`, error);
    }
  }

  /**
  * Generate embeddings for a code entity
  */
  private async generateEntityEmbeddings(entityId: string, name: string, code: string, language: string): Promise<void> {
    try {
      // Create a prompt that captures the essence of the entity
      const prompt = `${name} - ${code}`;
      
      // Generate embedding
      const embedding = await this.embeddings.generateEmbedding(prompt);
      
      // Save vector in vector database
      this.storage.saveVector(entityId, embedding, {
        type: 'entity',
        entityId,
        language
      });
    } catch (error: unknown) {
      logger.error(`Error generating embeddings for entity ${entityId}`, error);
    }
  }

  /**
  * Calculate initial importance score for a file
  * Higher scores mean higher priority for context
  */
  private calculateInitialImportance(filePath: string, language: string): number {
    let score = 0.5; // Default score
    
    // Higher score for source code files
    const isPriorityExt = this.priorityExtensions.includes(path.extname(filePath).toLowerCase());
    if (isPriorityExt) {
      score += 0.2;
    }
    
    // Higher score for recently modified files
    try {
      const stats = fs.statSync(filePath);
      const ageInDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
      if (ageInDays < 1) {
        score += 0.3; // Modified within last day
      } else if (ageInDays < 7) {
        score += 0.1; // Modified within last week
      }
    } catch (error) {
      // Ignore file access errors
    }
    
    // Higher score for files in src directory or similar
    if (filePath.includes('/src/') || filePath.includes('\\src\\')) {
      score += 0.1;
    }
    
    // Higher score for files closer to project root
    const relPath = path.relative(this.projectRoot, filePath);
    const depth = relPath.split(/[/\\]/).length;
    if (depth <= 2) {
      score += 0.1;
    }
    
    return Math.min(1.0, score); // Cap at 1.0
  }

  /**
  * Force immediate indexing of a file
  */
  public async forceIndexFile(filePath: string): Promise<void> {
    // Remove from indexed files to ensure re-indexing
    this.indexedFiles.delete(filePath);
    
    // Queue with priority
    this.queueFileForIndexing(filePath, true);
  }

  /**
  * Force immediate indexing of active editor file
  */
  public async indexActiveFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    
    const filePath = editor.document.uri.fsPath;
    await this.forceIndexFile(filePath);
  }

  /**
  * Get the most relevant context files for query
  */
  public async getRelevantContext(query: string, maxFiles: number = 5): Promise<any[]> {
    try {
      // Get embedding for query
      const queryEmbedding = await this.embeddings.generateEmbedding(query);
      
      // Find similar vectors
      const similarVectors = this.storage.findSimilarVectors(queryEmbedding, maxFiles);
      
      // Return context items
      const contextItems = [];
      for (const vector of similarVectors) {
        const metadata = vector.metadata;
        if (!metadata) {
          continue;
        }
        
        if (metadata.type === 'file') {
          // Get full file context
          const file = this.storage.findContextItems(metadata.path, 1)[0];
          if (file) {
            contextItems.push(file);
          }
        } else if (metadata.type === 'entity') {
          // Get code entity
          const entity = this.storage.findCodeEntities(metadata.name, 1)[0];
          if (entity) {
            contextItems.push(entity);
          }
        }
      }
      
      return contextItems;
    } catch (error: unknown) {
      logger.error('Error getting relevant context', error);
      return [];
    }
  }

  /**
  * Dispose resources
  */
  public dispose(): void {
    try {
      // Cancel any debounced calls
      this.debouncedProcessQueue.cancel();
      
      // Clean up file watcher
      if (this.fileWatcher) {
        this.fileWatcher.dispose();
        this.fileWatcher = null;
      }
      
      this.isInitialized = false;
      logger.info('Indexing service disposed');
    } catch (error: unknown) {
      logger.error('Error disposing indexing service', error);
    }
  }
}