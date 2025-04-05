// src/services/FileContextManager.ts
import * as vscode from 'vscode';
import * as path from 'path';
import logger from '../utils/logger';

/**
 * Types of context items that can be included
 */
export type ContextItemType = 'file' | 'directory' | 'symbol' | 'comment';

/**
 * Represents a single context item from the workspace
 */
export interface ContextItem {
  id: string;
  type: ContextItemType;
  name: string;
  path?: string;
  content?: string;
  language?: string;
  lineStart?: number;
  lineEnd?: number;
  size?: number;
  children?: ContextItem[];
  metadata?: Record<string, any>;
}

/**
 * Context collection to be sent to AI
 */
export interface Context {
  items: ContextItem[];
  workspaceName?: string;
  maxTokens?: number;
}

/**
 * Options for context gathering
 */
export interface ContextOptions {
  includeOpenFiles?: boolean;
  includeActiveFile?: boolean;
  includeSelection?: boolean;
  includeImports?: boolean;
  includeDependencies?: boolean;
  maxFiles?: number;
  maxDepth?: number;
  maxFileSize?: number; // in KB
  exclude?: string[];
  fileTypes?: string[]; // file extensions to include
}

/**
 * Manages project context collection for AI interactions
 */
export class FileContextManager {
  private static instance: FileContextManager;
  private cachedWorkspaceContext: Map<string, ContextItem> = new Map();
  private lastIndexTime: number = 0;
  private indexingInProgress: boolean = false;
  private workspaceWatcher: vscode.FileSystemWatcher | null = null;
  
  private constructor() {
    this.setupFileWatcher();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): FileContextManager {
    if (!FileContextManager.instance) {
      FileContextManager.instance = new FileContextManager();
    }
    return FileContextManager.instance;
  }

  /**
   * Set up a file system watcher to track workspace changes
   */
  private setupFileWatcher(): void {
    try {
      if (this.workspaceWatcher) {
        this.workspaceWatcher.dispose();
      }
      
      // Watch for file changes in the workspace
      this.workspaceWatcher = vscode.workspace.createFileSystemWatcher('**/*');
      
      // When files are created, updated, or deleted, invalidate cache
      this.workspaceWatcher.onDidCreate(() => this.invalidateCache());
      this.workspaceWatcher.onDidChange(() => this.invalidateCache());
      this.workspaceWatcher.onDidDelete(() => this.invalidateCache());
      
      logger.debug('FileContextManager: File watcher initialized');
    } catch (error) {
      logger.error('Error setting up file watcher:', error);
    }
  }

  /**
   * Invalidate the cache when workspace changes
   */
  private invalidateCache(): void {
    // Mark cache as outdated without clearing it immediately
    this.lastIndexTime = 0;
    logger.debug('FileContextManager: Cache invalidated due to workspace changes');
  }

  /**
   * Index the workspace to build context cache
   */
  public async indexWorkspace(forceReindex: boolean = false): Promise<boolean> {
    // Skip if indexing is already in progress
    if (this.indexingInProgress) {
      return false;
    }
    
    // Skip if recently indexed and not forced
    const now = Date.now();
    if (!forceReindex && now - this.lastIndexTime < 5 * 60 * 1000) { // 5 minutes cache
      return true;
    }
    
    this.indexingInProgress = true;
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return false;
      }
      
      logger.info('Indexing workspace for context...');
      
      // Clear existing cache
      this.cachedWorkspaceContext.clear();
      
      // Index each workspace folder
      for (const folder of workspaceFolders) {
        await this.indexFolder(folder.uri, 0, 3); // Index to depth 3 by default
      }
      
      this.lastIndexTime = now;
      logger.info(`Workspace indexed: ${this.cachedWorkspaceContext.size} items`);
      return true;
    } catch (error) {
      logger.error('Error indexing workspace:', error);
      return false;
    } finally {
      this.indexingInProgress = false;
    }
  }

  /**
   * Recursively index a folder
   */
  private async indexFolder(folderUri: vscode.Uri, currentDepth: number, maxDepth: number): Promise<void> {
    if (currentDepth > maxDepth) {
      return;
    }
    
    try {
      const entries = await vscode.workspace.fs.readDirectory(folderUri);
      
      for (const [name, fileType] of entries) {
        // Skip node_modules, .git, and other common excludes
        if (['node_modules', '.git', 'dist', 'build', 'out', '.vscode', '.idea'].includes(name)) {
          continue;
        }
        
        const fullPath = path.join(folderUri.fsPath, name);
        const uri = vscode.Uri.file(fullPath);
        
        if (fileType === vscode.FileType.Directory) {
          // Create directory item
          const dirItem: ContextItem = {
            id: fullPath,
            type: 'directory',
            name: name,
            path: fullPath,
          };
          
          this.cachedWorkspaceContext.set(fullPath, dirItem);
          
          // Recurse into subdirectory
          await this.indexFolder(uri, currentDepth + 1, maxDepth);
        } else if (fileType === vscode.FileType.File) {
          // Skip binary and very large files
          if (this.shouldSkipFile(name)) {
            continue;
          }
          
          // Index the file
          await this.indexFile(uri);
        }
      }
    } catch (error) {
      logger.error(`Error indexing folder ${folderUri.fsPath}:`, error);
    }
  }

  /**
   * Index a single file
   */
  private async indexFile(fileUri: vscode.Uri): Promise<void> {
    try {
      const filePath = fileUri.fsPath;
      const fileName = path.basename(filePath);
      
      // Read file content (with size limit)
      const document = await this.getTextDocument(fileUri);
      if (!document) {
        return;
      }
      
      // Create file item
      const fileItem: ContextItem = {
        id: filePath,
        type: 'file',
        name: fileName,
        path: filePath,
        language: document.languageId,
        size: document.getText().length,
      };
      
      // For source code files, extract imports (simplified implementation)
      if (this.isSourceCodeFile(document.languageId)) {
        const imports = this.extractImports(document);
        if (imports.length > 0) {
          fileItem.metadata = {
            imports: imports
          };
        }
      }
      
      this.cachedWorkspaceContext.set(filePath, fileItem);
    } catch (error) {
      logger.error(`Error indexing file ${fileUri.fsPath}:`, error);
    }
  }

  /**
   * Extract import statements from a document (simplified)
   */
  private extractImports(document: vscode.TextDocument): string[] {
    const text = document.getText();
    const imports: string[] = [];
    
    // Pattern for ES6 imports/requires (simplified)
    const importPattern = /import\s+.*?['"](.+?)['"]|require\s*\(\s*['"](.+?)['"]\s*\)/g;
    
    let match;
    while ((match = importPattern.exec(text)) !== null) {
      const importPath = match[1] || match[2];
      if (importPath) {
        imports.push(importPath);
      }
    }
    
    return imports;
  }

  /**
   * Get active document context
   */
  public async getActiveDocumentContext(): Promise<ContextItem | null> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return null;
    }
    
    const document = editor.document;
    const filePath = document.uri.fsPath;
    const selection = editor.selection;
    let content: string;
    let lineStart = 0;
    let lineEnd = document.lineCount - 1;
    
    // If there's a selection, use only that
    if (!selection.isEmpty) {
      lineStart = selection.start.line;
      lineEnd = selection.end.line;
      content = document.getText(new vscode.Range(lineStart, 0, lineEnd, document.lineAt(lineEnd).text.length));
    } else {
      // Otherwise use the whole file content (with reasonable size limit)
      content = document.getText();
    }
    
    return {
      id: filePath,
      type: 'file',
      name: path.basename(filePath),
      path: filePath,
      content: content,
      language: document.languageId,
      lineStart,
      lineEnd,
      size: content.length
    };
  }

  /**
   * Get open text documents
   */
  public async getOpenDocuments(maxFiles: number = 5): Promise<ContextItem[]> {
    const openDocuments = vscode.workspace.textDocuments.filter(doc => 
      !doc.isClosed && 
      !doc.isUntitled && 
      doc.uri.scheme === 'file' &&
      !this.shouldSkipFile(path.basename(doc.uri.fsPath))
    );
    
    // Sort by most recently accessed and take only maxFiles
    const sortedDocs = openDocuments.slice(0, maxFiles);
    
    const contextItems: ContextItem[] = [];
    for (const doc of sortedDocs) {
      const content = doc.getText();
      contextItems.push({
        id: doc.uri.fsPath,
        type: 'file',
        name: path.basename(doc.uri.fsPath),
        path: doc.uri.fsPath,
        content: content,
        language: doc.languageId,
        lineStart: 0,
        lineEnd: doc.lineCount - 1,
        size: content.length
      });
    }
    
    return contextItems;
  }

  /**
   * Get files related to the active document through imports/references
   */
  public async getRelatedFiles(mainFilePath: string, maxFiles: number = 5): Promise<ContextItem[]> {
    // Ensure workspace is indexed
    await this.indexWorkspace();
    
    // Get related files based on:
    // 1. Files with similar names
    // 2. Files that import the main file
    // 3. Files imported by the main file
    const relatedFiles: ContextItem[] = [];
    const relatedFilePaths = new Set<string>();
    const mainFileName = path.basename(mainFilePath, path.extname(mainFilePath));
    
    // Get the main file from cache
    const mainCachedItem = this.cachedWorkspaceContext.get(mainFilePath);
    const mainFileImports = mainCachedItem?.metadata?.imports || [];
    
    // 1. First check for files with similar names
    for (const [filePath, item] of this.cachedWorkspaceContext.entries()) {
      if (item.type !== 'file' || filePath === mainFilePath) {
        continue;
      }
      
      const fileName = path.basename(filePath);
      // Check if file names are related (e.g., User.ts, User.test.ts, UserService.ts)
      if (fileName.includes(mainFileName) || 
          mainFileName.includes(path.basename(fileName, path.extname(fileName)))) {
        relatedFilePaths.add(filePath);
      }
    }
    
    // 2 & 3. Check imports/references
    for (const [filePath, item] of this.cachedWorkspaceContext.entries()) {
      if (item.type !== 'file') {
        continue;
      }
      
      // Check if this file imports the main file
      const imports = item.metadata?.imports as string[] || [];
      
      // Check for relative imports that might match our main file
      if (imports.some(imp => {
        // Handle relative paths
        if (imp.startsWith('.')) {
          const resolvedPath = path.resolve(path.dirname(filePath), imp);
          const normalizedMainPath = mainFilePath.replace(/\.[^/.]+$/, ""); // Remove extension
          return resolvedPath.includes(normalizedMainPath);
        }
        return false;
      })) {
        relatedFilePaths.add(filePath);
      }
      
      // Check if the main file imports this file
      for (const imp of mainFileImports) {
        if (imp.startsWith('.')) {
          const resolvedPath = path.resolve(path.dirname(mainFilePath), imp);
          const normalizedFilePath = filePath.replace(/\.[^/.]+$/, ""); // Remove extension
          if (resolvedPath.includes(normalizedFilePath)) {
            relatedFilePaths.add(filePath);
            break;
          }
        }
      }
    }
    
    // Load content for the related files
    for (const filePath of relatedFilePaths) {
      if (relatedFiles.length >= maxFiles) {
        break;
      }
      
      const document = await this.getTextDocument(vscode.Uri.file(filePath));
      if (document) {
        const content = document.getText();
        relatedFiles.push({
          id: filePath,
          type: 'file',
          name: path.basename(filePath),
          path: filePath,
          content: content,
          language: document.languageId,
          size: content.length
        });
      }
    }
    
    return relatedFiles;
  }

  /**
   * Get context to be used for AI interactions based on options
   */
  public async getContext(options: ContextOptions = {}): Promise<Context> {
    // Make sure workspace is indexed
    await this.indexWorkspace();
    
    const context: Context = {
      items: [],
      workspaceName: vscode.workspace.name,
    };
    
    // Track paths to avoid duplicates
    const includedPaths = new Set<string>();
    
    // Add active document/selection if requested
    if (options.includeActiveFile || options.includeSelection) {
      const activeDocumentContext = await this.getActiveDocumentContext();
      if (activeDocumentContext) {
        context.items.push(activeDocumentContext);
        includedPaths.add(activeDocumentContext.path || '');
        
        // Add related files if requested
        if (options.includeImports && activeDocumentContext.path) {
          const relatedFiles = await this.getRelatedFiles(
            activeDocumentContext.path, 
            options.maxFiles || 5
          );
          
          for (const file of relatedFiles) {
            if (!includedPaths.has(file.path || '')) {
              context.items.push(file);
              includedPaths.add(file.path || '');
            }
          }
        }
      }
    }
    
    // Add open files if requested
    if (options.includeOpenFiles) {
      const openDocs = await this.getOpenDocuments(options.maxFiles || 5);
      for (const doc of openDocs) {
        if (!includedPaths.has(doc.path || '')) {
          context.items.push(doc);
          includedPaths.add(doc.path || '');
        }
      }
    }
    
    // TODO: Implement options.includeDependencies for package.json, etc.
    
    // Add token count estimation
    context.maxTokens = this.estimateTokens(context);
    
    return context;
  }

  /**
   * Estimate token count for a context
   */
  private estimateTokens(context: Context): number {
    let totalTokens = 0;
    for (const item of context.items) {
      if (item.content) {
        // Approximate tokens based on whitespace-split words and a token-to-word ratio
        const words = item.content.split(/\s+/).length;
        // Typical token-to-word ratio is around 1.3
        totalTokens += Math.ceil(words * 1.3);
        
        // Add overhead for context formatting (wrapping with file info, etc.)
        totalTokens += 20; // Rough estimate for metadata overhead
      }
    }
    return totalTokens;
  }

  /**
   * Format context for AI prompt
   * Includes intelligence to avoid exceeding token limits
   */
  public formatContextForPrompt(context: Context, maxTokens: number = 4000): string {
    // Start with workspace info
    let result = '';
    if (context.workspaceName) {
      result += `Workspace: ${context.workspaceName}\n\n`;
    }
    
    // Track estimated token usage
    let estimatedTokens = result.split(/\s+/).length;
    const maxTokensPerFile = Math.floor(maxTokens / Math.max(1, context.items.length));
    
    // Sort items by type (active file or selection first, then related files)
    const sortedItems = [...context.items].sort((a, b) => {
      // Prioritize items with lineStart/lineEnd (selections)
      const aHasSelection = a.lineStart !== undefined && a.lineEnd !== undefined;
      const bHasSelection = b.lineStart !== undefined && b.lineEnd !== undefined;
      
      if (aHasSelection && !bHasSelection) {return -1;}
      if (!aHasSelection && bHasSelection) {return 1;}
      
      // Then sort by file size
      return (a.size || 0) - (b.size || 0);
    });
    
    for (const item of sortedItems) {
      if (item.type === 'file' && item.content) {
        // Prepare file header
        let fileHeader = `File: ${item.path || item.name}\n`;
        if (item.language) {
          fileHeader += `Language: ${item.language}\n`;
        }
        if (item.lineStart !== undefined && item.lineEnd !== undefined) {
          fileHeader += `Lines: ${item.lineStart + 1}-${item.lineEnd + 1}\n`;
        }
        
        // Calculate available tokens for this file's content
        const headerTokens = fileHeader.split(/\s+/).length;
        const availableTokens = maxTokensPerFile - headerTokens - 5; // 5 tokens for markup
        
        // Truncate content if necessary
        let content = item.content;
        const contentTokens = Math.ceil(content.split(/\s+/).length * 1.3);
        
        if (contentTokens > availableTokens) {
          // Simple truncation - in a more advanced implementation, 
          // you could do smarter truncation based on AST analysis
          const ratio = availableTokens / contentTokens;
          const truncateAt = Math.floor(content.length * ratio);
          content = content.substring(0, truncateAt) + "\n[...content truncated...]";
        }
        
        // Add the file to the result
        result += fileHeader;
        result += '```' + (item.language || '') + '\n';
        result += content;
        result += '\n```\n\n';
        
        // Update token count
        estimatedTokens += headerTokens + contentTokens;
        
        // Stop if we're getting close to token limit
        if (estimatedTokens > maxTokens * 0.95) {
          result += "[Additional context omitted due to token limit]\n";
          break;
        }
      }
    }
    
    return result;
  }

  /**
   * Clear the context cache
   */
  public clearCache(): void {
    this.cachedWorkspaceContext.clear();
    this.lastIndexTime = 0;
  }

  /**
   * Utility to get a TextDocument from a Uri
   */
  private async getTextDocument(uri: vscode.Uri): Promise<vscode.TextDocument | null> {
    try {
      // Try to get already opened document first
      let document = vscode.workspace.textDocuments.find(doc => doc.uri.fsPath === uri.fsPath);
      
      if (!document) {
        // Read the file content
        const content = await vscode.workspace.fs.readFile(uri);
        const size = content.byteLength;
        
        // Skip if too large (>500KB)
        if (size > 500 * 1024) {
          return null;
        }
        
        // Open the document
        document = await vscode.workspace.openTextDocument(uri);
      }
      
      return document;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if a file should be skipped based on name/extension
   */
  private shouldSkipFile(fileName: string): boolean {
    const ext = path.extname(fileName).toLowerCase();
    const skipExtensions = [
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
    
    // Skip files that start with a dot, like .gitignore
    return skipExtensions.includes(ext) || fileName.startsWith('.');
  }

  /**
   * Check if file is a source code file
   */
  private isSourceCodeFile(languageId: string): boolean {
    const sourceCodeLanguages = [
      'javascript', 'typescript', 'jsx', 'tsx',
      'python', 'java', 'csharp', 'cpp', 'c',
      'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'dart'
    ];
    
    return sourceCodeLanguages.includes(languageId);
  }
}

export default FileContextManager.getInstance();