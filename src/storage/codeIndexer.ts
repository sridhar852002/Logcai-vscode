import * as vscode from 'vscode';
import * as path from 'path';
import { CodeChunk, VectorStorage } from './vectorStorage';
import { log } from '../utils/logging';
import { ConfigurationManager } from '../config/configuration';

/**
 * Service for indexing code and files into vector storage
 */
export class CodeIndexer {
  private isIndexing: boolean = false;
  private maxFilesToProcess: number;
  private filesIndexed: number = 0;
  private progressBar: vscode.Progress<{ message?: string; increment?: number }> | undefined;
  private cancelTokenSource: vscode.CancellationTokenSource | undefined;

  constructor(
    private vectorStorage: VectorStorage,
    private configManager: ConfigurationManager
  ) {
    this.maxFilesToProcess = configManager.getConfiguration().maxFilesToProcess;
  }

  /**
   * Start incremental indexing of the workspace
   */
  async startIncrementalIndexing(): Promise<void> {
    if (this.isIndexing) {
      log.info('Already indexing, ignoring request');
      return;
    }

    this.isIndexing = true;
    this.filesIndexed = 0;
    this.cancelTokenSource = new vscode.CancellationTokenSource();

    try {
      // Show progress notification
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'LogCAI: Indexing codebase',
          cancellable: true
        },
        async (progress, token) => {
          this.progressBar = progress;
          this.progressBar.report({ message: 'Starting indexing...' });
          
          // Add cancellation listener
          token.onCancellationRequested(() => {
            if (this.cancelTokenSource) {
              this.cancelTokenSource.cancel();
              this.isIndexing = false;
              log.info('Indexing cancelled by user');
            }
          });
          
          // Find workspace files to index
          const workspaceFolders = vscode.workspace.workspaceFolders;
          if (!workspaceFolders || workspaceFolders.length === 0) {
            this.progressBar.report({ message: 'No workspace open', increment: 100 });
            return;
          }
          
          // Find files but exclude node_modules, etc.
          const files = await vscode.workspace.findFiles(
            '**/*.{js,ts,jsx,tsx,py,java,cs,c,cpp,h,hpp}',
            '**/node_modules/**,**/.git/**,**/dist/**,**/build/**',
            this.maxFilesToProcess
          );
          
          const totalFiles = Math.min(files.length, this.maxFilesToProcess);
          this.progressBar.report({ message: `Found ${totalFiles} files to index` });
          
          // Process files in batches to avoid blocking the UI
          const batchSize = 10;
          for (let i = 0; i < files.length; i += batchSize) {
            if (this.cancelTokenSource?.token.isCancellationRequested) {
              break;
            }
            
            const batch = files.slice(i, i + batchSize);
            await Promise.all(batch.map(file => this.indexFile(file)));
            
            this.filesIndexed += batch.length;
            const progress = Math.round((this.filesIndexed / totalFiles) * 100);
            this.progressBar.report({ 
              message: `Indexed ${this.filesIndexed}/${totalFiles} files (${progress}%)`,
              increment: (batch.length / totalFiles) * 100
            });
            
            // Small delay to allow UI updates
            await new Promise(resolve => setTimeout(resolve, 10));
          }
          
          this.progressBar.report({ message: `Indexing complete: ${this.filesIndexed} files`, increment: 100 });
          log.info(`Indexing complete: ${this.filesIndexed} files indexed`);
        }
      );
    } catch (error) {
      log.error(`Error during indexing: ${error}`);
    } finally {
      this.isIndexing = false;
      this.progressBar = undefined;
      this.cancelTokenSource = undefined;
    }
  }

  /**
   * Index a single file
   */
  async indexFile(fileUri: vscode.Uri): Promise<void> {
    try {
      if (this.cancelTokenSource?.token.isCancellationRequested) {
        return;
      }
      
      // Get file content
      const document = await vscode.workspace.openTextDocument(fileUri);
      const content = document.getText();
      const language = document.languageId;
      const filePath = vscode.workspace.asRelativePath(fileUri);
      
      // Delete existing chunks for this file
      await this.vectorStorage.deleteChunksForFile(filePath);
      
      // Extract code chunks
      const chunks = await this.extractCodeChunks(document);
      
      // Add chunks to vector storage
      for (const chunk of chunks) {
        await this.vectorStorage.addChunk(chunk);
      }
      
      log.debug(`Indexed file ${filePath}: ${chunks.length} chunks`);
    } catch (error) {
      log.error(`Error indexing file ${fileUri.fsPath}: ${error}`);
    }
  }

  /**
   * Extract code chunks from a document
   */
  private async extractCodeChunks(document: vscode.TextDocument): Promise<CodeChunk[]> {
    const language = document.languageId;
    const content = document.getText();
    const filePath = vscode.workspace.asRelativePath(document.uri);
    const chunks: CodeChunk[] = [];
    
    // Add the whole file as a single chunk for now
    chunks.push({
      id: '',
      content,
      filePath,
      language,
      chunkType: 'other',
      lastUpdated: Date.now()
    });
    
    // Based on language, extract functions, classes, etc.
    switch (language) {
      case 'javascript':
      case 'typescript':
      case 'javascriptreact':
      case 'typescriptreact':
        await this.extractJavaScriptChunks(document, chunks);
        break;
        
      case 'python':
        await this.extractPythonChunks(document, chunks);
        break;
        
      case 'java':
      case 'csharp':
        await this.extractCStyleChunks(document, chunks);
        break;
      
      default:
        // For unsupported languages, we already have the whole file
        break;
    }
    
    return chunks;
  }

  /**
   * Extract JavaScript/TypeScript chunks
   */
  private async extractJavaScriptChunks(document: vscode.TextDocument, chunks: CodeChunk[]): Promise<void> {
    const content = document.getText();
    const filePath = vscode.workspace.asRelativePath(document.uri);
    const language = document.languageId;
    
    // Extract imports first
    const importRegex = /import\s+(?:(?:{[^}]*}|\*\s+as\s+[^,}\s]+)\s+from\s+)?['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null;
    
    while ((match = importRegex.exec(content)) !== null) {
      const importStatement = match[0];
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + importStatement.length);
      
      chunks.push({
        id: '',
        content: importStatement,
        filePath,
        language,
        chunkType: 'import',
        metadata: {
          startLine: startPos.line,
          endLine: endPos.line,
          importPath: match[1]
        },
        lastUpdated: Date.now()
      });
    }
    
    // Extract functions
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*{/g;
    
    while ((match = functionRegex.exec(content)) !== null) {
      // Find the matching closing brace
      const startIndex = match.index;
      const functionName = match[1];
      let openBraces = 1;
      let endIndex = startIndex + match[0].length;
      
      while (openBraces > 0 && endIndex < content.length) {
        if (content[endIndex] === '{') {
          openBraces++;
        } else if (content[endIndex] === '}') {
          openBraces--;
        }
        endIndex++;
      }
      
      // Extract the full function
      const functionCode = content.substring(startIndex, endIndex);
      const startPos = document.positionAt(startIndex);
      const endPos = document.positionAt(endIndex);
      
      chunks.push({
        id: '',
        content: functionCode,
        filePath,
        language,
        chunkType: 'function',
        metadata: {
          name: functionName,
          startLine: startPos.line,
          endLine: endPos.line
        },
        lastUpdated: Date.now()
      });
    }
    
    // Extract classes
    const classRegex = /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?\s*{/g;
    
    while ((match = classRegex.exec(content)) !== null) {
      // Find the matching closing brace
      const startIndex = match.index;
      const className = match[1];
      let openBraces = 1;
      let endIndex = startIndex + match[0].length;
      
      while (openBraces > 0 && endIndex < content.length) {
        if (content[endIndex] === '{') {
          openBraces++;
        } else if (content[endIndex] === '}') {
          openBraces--;
        }
        endIndex++;
      }
      
      // Extract the full class
      const classCode = content.substring(startIndex, endIndex);
      const startPos = document.positionAt(startIndex);
      const endPos = document.positionAt(endIndex);
      
      chunks.push({
        id: '',
        content: classCode,
        filePath,
        language,
        chunkType: 'class',
        metadata: {
          name: className,
          startLine: startPos.line,
          endLine: endPos.line
        },
        lastUpdated: Date.now()
      });
      
      // Also extract methods within the class
      const methodRegex = /(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*{/g;
      let methodMatch: RegExpExecArray | null;
      const methodContent = classCode.substring(classCode.indexOf('{') + 1);
      
      while ((methodMatch = methodRegex.exec(methodContent)) !== null) {
        const methodName = methodMatch[1];
        // Skip constructor or React lifecycle methods
        if (['constructor', 'render', 'componentDidMount', 'componentWillUnmount'].includes(methodName)) {
          continue;
        }
        
        chunks.push({
          id: '',
          content: methodMatch[0],
          filePath,
          language,
          chunkType: 'method',
          metadata: {
            className,
            methodName,
            classStartLine: startPos.line
          },
          lastUpdated: Date.now()
        });
      }
    }
  }

  /**
   * Extract Python chunks
   */
  private async extractPythonChunks(document: vscode.TextDocument, chunks: CodeChunk[]): Promise<void> {
    const content = document.getText();
    const filePath = vscode.workspace.asRelativePath(document.uri);
    const language = document.languageId;
    
    // Extract imports
    const importRegex = /(?:from\s+[\w.]+\s+import\s+(?:[\w, ]+|\*)|import\s+(?:[\w, ]+|\*)(?:\s+as\s+\w+)?)/g;
    let match: RegExpExecArray | null;
    
    while ((match = importRegex.exec(content)) !== null) {
      const importStatement = match[0];
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + importStatement.length);
      
      chunks.push({
        id: '',
        content: importStatement,
        filePath,
        language,
        chunkType: 'import',
        metadata: {
          startLine: startPos.line,
          endLine: endPos.line
        },
        lastUpdated: Date.now()
      });
    }
    
    // Extract functions and methods
    const functionRegex = /def\s+(\w+)\s*\([^)]*\)(?:\s*->\s*\w+)?:/g;
    const lines = content.split('\n');
    
    while ((match = functionRegex.exec(content)) !== null) {
      const startIndex = match.index;
      const functionName = match[1];
      const startLine = document.positionAt(startIndex).line;
      
      // Find the end of the function (based on indentation)
      let endLine = startLine + 1;
      const startIndent = lines[startLine].match(/^(\s*)/)?.[1]?.length || 0;
      
      while (endLine < lines.length) {
        const line = lines[endLine];
        // If line is not empty and has less or equal indentation as the function definition, we've found the end
        if (line.trim() !== '' && (line.match(/^(\s*)/)?.[1]?.length || 0) <= startIndent) {
          break;
        }
        endLine++;
      }
      
      const functionCode = lines.slice(startLine, endLine).join('\n');
      
      chunks.push({
        id: '',
        content: functionCode,
        filePath,
        language,
        chunkType: 'function',
        metadata: {
          name: functionName,
          startLine,
          endLine: endLine - 1
        },
        lastUpdated: Date.now()
      });
    }
    
    // Extract classes
    const classRegex = /class\s+(\w+)(?:\s*\([^)]*\))?:/g;
    
    while ((match = classRegex.exec(content)) !== null) {
      const startIndex = match.index;
      const className = match[1];
      const startLine = document.positionAt(startIndex).line;
      
      // Find the end of the class (based on indentation)
      let endLine = startLine + 1;
      const startIndent = lines[startLine].match(/^(\s*)/)?.[1]?.length || 0;
      
      while (endLine < lines.length) {
        const line = lines[endLine];
        // If line is not empty and has less or equal indentation as the class definition, we've found the end
        if (line.trim() !== '' && (line.match(/^(\s*)/)?.[1]?.length || 0) <= startIndent) {
          break;
        }
        endLine++;
      }
      
      const classCode = lines.slice(startLine, endLine).join('\n');
      
      chunks.push({
        id: '',
        content: classCode,
        filePath,
        language,
        chunkType: 'class',
        metadata: {
          name: className,
          startLine,
          endLine: endLine - 1
        },
        lastUpdated: Date.now()
      });
    }
  }

  /**
   * Extract C-style language chunks (Java, C#, etc.)
   */
  private async extractCStyleChunks(document: vscode.TextDocument, chunks: CodeChunk[]): Promise<void> {
    const content = document.getText();
    const filePath = vscode.workspace.asRelativePath(document.uri);
    const language = document.languageId;
    
    // Extract imports/using statements
    const importRegex = language === 'java' 
      ? /import\s+(?:static\s+)?[\w.]+(?:\.\*)?;/g 
      : /using\s+(?:static\s+)?[\w.]+(?:\s*=\s*[\w.]+)?;/g;
      
    let match: RegExpExecArray | null;
    
    while ((match = importRegex.exec(content)) !== null) {
      const importStatement = match[0];
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + importStatement.length);
      
      chunks.push({
        id: '',
        content: importStatement,
        filePath,
        language,
        chunkType: 'import',
        metadata: {
          startLine: startPos.line,
          endLine: endPos.line
        },
        lastUpdated: Date.now()
      });
    }
    
    // Extract classes
    const classRegex = language === 'java'
      ? /(?:public|private|protected)?\s*(?:abstract|final)?\s*class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+(?:[\w,\s]+))?\s*{/g
      : /(?:public|private|internal|protected)?\s*(?:abstract|sealed|static)?\s*class\s+(\w+)(?:<[^>]+>)?(?:\s*:\s*(?:[\w,<>\s]+))?\s*{/g;
    
    while ((match = classRegex.exec(content)) !== null) {
      // Find the matching closing brace
      const startIndex = match.index;
      const className = match[1];
      let openBraces = 1;
      let endIndex = startIndex + match[0].length;
      
      while (openBraces > 0 && endIndex < content.length) {
        if (content[endIndex] === '{') {
          openBraces++;
        } else if (content[endIndex] === '}') {
          openBraces--;
        }
        endIndex++;
      }
      
      // Extract the full class
      const classCode = content.substring(startIndex, endIndex);
      const startPos = document.positionAt(startIndex);
      const endPos = document.positionAt(endIndex);
      
      chunks.push({
        id: '',
        content: classCode,
        filePath,
        language,
        chunkType: 'class',
        metadata: {
          name: className,
          startLine: startPos.line,
          endLine: endPos.line
        },
        lastUpdated: Date.now()
      });
      
      // Extract methods within the class
      const methodRegex = language === 'java'
        ? /(?:public|private|protected)?\s*(?:static|final|abstract)?\s*(?:<[^>]+>\s*)?[\w<>[\],\s]+\s+(\w+)\s*\([^)]*\)/g
        : /(?:public|private|internal|protected)?\s*(?:static|virtual|abstract|override|async)?\s*(?:<[^>]+>\s*)?[\w<>[\],\s]+\s+(\w+)\s*\([^)]*\)/g;
      
      let methodMatch;
      const methodsContent = classCode.substring(classCode.indexOf('{') + 1);
      
      while ((methodMatch = methodRegex.exec(methodsContent)) !== null) {
        const methodName = methodMatch[1];
        
        // Skip constructors (same name as class)
        if (methodName === className) {
          continue;
        }
        
        // Find the end of the method
        const methodStartIndex = methodMatch.index + classCode.indexOf('{') + 1;
        let openBraces = 0;
        let methodEndIndex = methodStartIndex + methodMatch[0].length;
        
        // Find opening brace first
        while (methodEndIndex < classCode.length && classCode[methodEndIndex] !== '{') {
          methodEndIndex++;
        }
        
        openBraces = 1;
        methodEndIndex++;
        
        while (openBraces > 0 && methodEndIndex < classCode.length) {
          if (classCode[methodEndIndex] === '{') {
            openBraces++;
          } else if (classCode[methodEndIndex] === '}') {
            openBraces--;
          }
          methodEndIndex++;
        }
        
        const methodCode = classCode.substring(methodStartIndex, methodEndIndex);
        const methodStartPos = document.positionAt(startIndex + methodStartIndex);
        const methodEndPos = document.positionAt(startIndex + methodEndIndex);
        
        chunks.push({
          id: '',
          content: methodCode,
          filePath,
          language,
          chunkType: 'method',
          metadata: {
            className,
            methodName,
            startLine: methodStartPos.line,
            endLine: methodEndPos.line
          },
          lastUpdated: Date.now()
        });
      }
    }
  }
  
  /**
   * When file is changed, re-index it
   */
  async onDocumentChanged(document: vscode.TextDocument): Promise<void> {
    // Skip non-file documents
    if (document.uri.scheme !== 'file') {
      return;
    }
    
    // Skip large files
    if (document.getText().length > 100000) {
      log.debug(`Skipping large file: ${document.fileName}`);
      return;
    }
    
    await this.indexFile(document.uri);
  }
}

/**
 * Set up file watchers and background indexing
 */
export function setupCodeIndexing(
    context: vscode.ExtensionContext,
    vectorStorage: VectorStorage,
    configManager: ConfigurationManager
  ): CodeIndexer {
    const indexer = new CodeIndexer(vectorStorage, configManager);
    
    // Register document change handlers
    const changeSubscription = vscode.workspace.onDidSaveTextDocument(
      document => indexer.onDocumentChanged(document)
    );
    
    // Add to context subscriptions
    context.subscriptions.push(changeSubscription);
    
    // Start initial indexing after activation
    setTimeout(() => {
      indexer.startIncrementalIndexing();
    }, 5000); // Wait 5 seconds after activation
    
    return indexer;
  }