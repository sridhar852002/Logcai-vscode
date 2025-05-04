import * as vscode from 'vscode';
import * as path from 'path';
import { ContextInfo } from '../models/interfaces';
import { ConfigurationManager } from '../config/configuration';
import { handleError } from '../utils/errorHandler';
import { log } from '../utils/logging';

export class ContextManager {
  // Use the ! non-null assertion operator to tell TypeScript these will be initialized
  private maxContextLength!: number;
  private includeImports!: boolean;
  private includeProjectStructure!: boolean;
  private maxFilesToProcess!: number;

  constructor(private configManager: ConfigurationManager) {
    this.refreshConfiguration();
  }

  refreshConfiguration(): void {
    const config = this.configManager.getConfiguration();
    this.maxContextLength = config.maxContextLength;
    this.includeImports = config.includeImports;
    this.includeProjectStructure = config.includeProjectStructure;
    this.maxFilesToProcess = config.maxFilesToProcess;
    log.info('Context Manager configuration refreshed');
  }

  /**
   * Extract context from the current file and cursor position
   */
  async extractCurrentFileContext(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<ContextInfo> {
    try {
      const fileName = path.basename(document.fileName);
      const language = document.languageId;
      const content = document.getText();
      const relativePath = vscode.workspace.asRelativePath(document.uri);
      
      // Get semantic context with language-specific extraction
      const enhancedContent = await this.extractSemanticContext(document, position);

      return {
        content: enhancedContent,
        fileName,
        relativePath,
        language,
        relevanceScore: 1.0 // Current file has maximum relevance
      };
    } catch (error) {
      handleError(error as Error, 'Failed to extract current file context');
      throw error;
    }
  }

  /**
   * Extract semantic context with language-specific processing
   * @param document The current document
   * @param position The current cursor position
   */
  private async extractSemanticContext(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<string> {
    try {
      const language = document.languageId;
      const content = document.getText();
      
      // Extract local context (scope-aware) around cursor
      const localContext = this.extractLocalContext(document, position);
      
      // Apply language-specific extraction
      const enhancedContext = await this.applyLanguageSpecificExtraction(
        language,
        content,
        localContext,
        document.uri
      );
      
      return enhancedContext;
    } catch (error) {
      log.error(`Error extracting semantic context: ${error}`);
      // Fall back to simple content
      return document.getText();
    }
  }
  
  /**
   * Extract local context around cursor position
   */
  private extractLocalContext(
    document: vscode.TextDocument,
    position: vscode.Position,
    contextLines: number = 20
  ): string {
    const startLine = Math.max(0, position.line - contextLines);
    const endLine = Math.min(document.lineCount - 1, position.line + contextLines);
    
    // Get current function/class/block scope
    const scopeRange = this.getCurrentScopeRange(document, position);
    
    // If we found a valid scope, use that as primary context
    if (scopeRange) {
      const scopeText = document.getText(scopeRange);
      
      // If scope is small, add surrounding context
      if (scopeRange.end.line - scopeRange.start.line < contextLines) {
        const additionalStartLine = Math.max(0, scopeRange.start.line - 10);
        const additionalEndLine = Math.min(document.lineCount - 1, scopeRange.end.line + 10);
        
        const preContext = document.getText(new vscode.Range(
          additionalStartLine, 0,
          scopeRange.start.line, 0
        ));
        
        const postContext = document.getText(new vscode.Range(
          scopeRange.end.line, 0,
          additionalEndLine, document.lineAt(additionalEndLine).text.length
        ));
        
        return `${preContext}\n${scopeText}\n${postContext}`;
      }
      
      return scopeText;
    }
    
    // Fall back to simple line-based context
    return document.getText(new vscode.Range(
      startLine, 0,
      endLine, document.lineAt(endLine).text.length
    ));
  }
  
  /**
   * Get the range of the current scope (function, class, block)
   */
  private getCurrentScopeRange(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.Range | null {
    try {
      const text = document.getText();
      const currentOffset = document.offsetAt(position);
      
      // Find opening brace before cursor
      let braceBalance = 0;
      let scopeStart = -1;
      
      // Scan backward for opening brace
      for (let i = currentOffset; i >= 0; i--) {
        const char = text.charAt(i);
        
        if (char === '}') {
          braceBalance++;
        } else if (char === '{') {
          if (braceBalance === 0) {
            // Found opening brace - now find the start of the definition
            let defStart = i;
            while (defStart > 0 && !/[;{}]/.test(text.charAt(defStart - 1))) {
              defStart--;
            }
            scopeStart = defStart;
            break;
          } else {
            braceBalance--;
          }
        }
      }
      
      // If we found an opening brace, find the matching closing brace
      if (scopeStart >= 0) {
        braceBalance = 1; // Start with 1 for the opening brace we found
        
        for (let i = scopeStart + 1; i < text.length; i++) {
          const char = text.charAt(i);
          
          if (char === '{') {
            braceBalance++;
          } else if (char === '}') {
            braceBalance--;
            if (braceBalance === 0) {
              // Found matching closing brace
              return new vscode.Range(
                document.positionAt(scopeStart),
                document.positionAt(i + 1)
              );
            }
          }
        }
      }
      
      return null;
    } catch (error) {
      log.error(`Error finding current scope: ${error}`);
      return null;
    }
  }
  
  /**
   * Apply language-specific extraction techniques
   */
  private async applyLanguageSpecificExtraction(
    language: string,
    content: string,
    localContext: string,
    uri: vscode.Uri
  ): Promise<string> {
    switch (language) {
      case 'typescript':
      case 'javascript':
        return this.extractJavaScriptContext(content, localContext, uri);
      case 'python':
        return this.extractPythonContext(content, localContext, uri);
      case 'java':
        return this.extractJavaContext(content, localContext, uri);
      case 'csharp':
        return this.extractCSharpContext(content, localContext, uri);
      default:
        return localContext;
    }
  }
  
  /**
   * Extract context for JavaScript/TypeScript
   */
  private async extractJavaScriptContext(
    content: string,
    localContext: string,
    uri: vscode.Uri
  ): Promise<string> {
    try {
      // Extract imports
      const importRegex = /import\s+(?:(?:{[^}]*}|\*\s+as\s+[^,}\s]+)\s+from\s+)?['"]([^'"]+)['"]/g;
      const importMatches = [...content.matchAll(importRegex)];
      const imports = importMatches.map(match => match[0]).join('\n');
      
      // Extract function and class declarations
      const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*{/g;
      const classRegex = /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?\s*{/g;
      const interfaceRegex = /(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+[^{]+)?\s*{/g;
      
      const functionMatches = [...content.matchAll(functionRegex)];
      const classMatches = [...content.matchAll(classRegex)];
      const interfaceMatches = [...content.matchAll(interfaceRegex)];
      
      // Get export statements
      const exportRegex = /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g;
      const exportMatches = [...content.matchAll(exportRegex)];
      
      // Build an index of key declarations to help with navigation
      const declarations = [
        ...functionMatches.map(m => `function ${m[1]}()`),
        ...classMatches.map(m => `class ${m[1]}`),
        ...interfaceMatches.map(m => `interface ${m[1]}`),
        ...exportMatches.map(m => `export ${m[1]}`)
      ].join('\n');
      
      // Return enhanced context
      return `// Imports\n${imports}\n\n// File Structure\n${declarations}\n\n// Current Context\n${localContext}`;
    } catch (error) {
      log.error(`Error extracting JS/TS context: ${error}`);
      return localContext;
    }
  }
  
  /**
   * Extract context for Python
   */
  private async extractPythonContext(
    content: string,
    localContext: string,
    uri: vscode.Uri
  ): Promise<string> {
    try {
      // Extract imports
      const importRegex = /(?:from\s+[\w.]+\s+import\s+(?:[\w, ]+|\*)|import\s+(?:[\w, ]+|\*)(?:\s+as\s+\w+)?)/g;
      const importMatches = [...content.matchAll(importRegex)];
      const imports = importMatches.map(match => match[0]).join('\n');
      
      // Extract function and class declarations
      const functionRegex = /def\s+(\w+)\s*\([^)]*\)(?:\s*->\s*\w+)?:/g;
      const classRegex = /class\s+(\w+)(?:\s*\([^)]*\))?:/g;
      
      const functionMatches = [...content.matchAll(functionRegex)];
      const classMatches = [...content.matchAll(classRegex)];
      
      // Build an index of key declarations
      const declarations = [
        ...functionMatches.map(m => `def ${m[1]}()`),
        ...classMatches.map(m => `class ${m[1]}`)
      ].join('\n');
      
      return `# Imports\n${imports}\n\n# File Structure\n${declarations}\n\n# Current Context\n${localContext}`;
    } catch (error) {
      log.error(`Error extracting Python context: ${error}`);
      return localContext;
    }
  }
  
  /**
   * Extract context for Java
   */
  private async extractJavaContext(
    content: string,
    localContext: string,
    uri: vscode.Uri
  ): Promise<string> {
    try {
      // Extract imports and package declaration
      const packageRegex = /package\s+[\w.]+;/;
      const importRegex = /import\s+(?:static\s+)?[\w.]+(?:\.\*)?;/g;
      
      const packageMatch = content.match(packageRegex);
      const packageDecl = packageMatch ? packageMatch[0] : '';
      
      const importMatches = [...content.matchAll(importRegex)];
      const imports = importMatches.map(match => match[0]).join('\n');
      
      // Extract class and method declarations
      const classRegex = /(?:public|private|protected)?\s*(?:abstract|final)?\s*class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+(?:[\w,\s]+))?/g;
      const methodRegex = /(?:public|private|protected)?\s*(?:static|final|abstract)?\s*(?:<[^>]+>\s*)?[\w<>[\],\s]+\s+(\w+)\s*\([^)]*\)/g;
      
      const classMatches = [...content.matchAll(classRegex)];
      const methodMatches = [...content.matchAll(methodRegex)];
      
      // Build declarations index
      const declarations = [
        ...classMatches.map(m => `class ${m[1]}`),
        ...methodMatches.map(m => `method ${m[1]}()`)
      ].join('\n');
      
      return `${packageDecl}\n\n// Imports\n${imports}\n\n// File Structure\n${declarations}\n\n// Current Context\n${localContext}`;
    } catch (error) {
      log.error(`Error extracting Java context: ${error}`);
      return localContext;
    }
  }
  
  /**
   * Extract context for C#
   */
  private async extractCSharpContext(
    content: string,
    localContext: string,
    uri: vscode.Uri
  ): Promise<string> {
    try {
      // Extract namespace, using and other declarations
      const namespaceRegex = /namespace\s+[\w.]+(?:\s*{)?/;
      const usingRegex = /using\s+(?:static\s+)?[\w.]+(?:\s*=\s*[\w.]+)?;/g;
      
      const namespaceMatch = content.match(namespaceRegex);
      const namespaceDecl = namespaceMatch ? namespaceMatch[0] : '';
      
      const usingMatches = [...content.matchAll(usingRegex)];
      const usings = usingMatches.map(match => match[0]).join('\n');
      
      // Extract class and method declarations
      const classRegex = /(?:public|private|internal|protected)?\s*(?:abstract|sealed|static)?\s*class\s+(\w+)(?:<[^>]+>)?(?:\s*:\s*(?:[\w,<>\s]+))?/g;
      const methodRegex = /(?:public|private|internal|protected)?\s*(?:static|virtual|abstract|override|async)?\s*(?:<[^>]+>\s*)?[\w<>[\],\s]+\s+(\w+)\s*\([^)]*\)/g;
      
      const classMatches = [...content.matchAll(classRegex)];
      const methodMatches = [...content.matchAll(methodRegex)];
      
      // Build declarations index
      const declarations = [
        ...classMatches.map(m => `class ${m[1]}`),
        ...methodMatches.map(m => `method ${m[1]}()`)
      ].join('\n');
      
      return `// Using Directives\n${usings}\n\n${namespaceDecl}\n\n// File Structure\n${declarations}\n\n// Current Context\n${localContext}`;
    } catch (error) {
      log.error(`Error extracting C# context: ${error}`);
      return localContext;
    }
  }

  /**
   * Extract context from visible editor content
   */
  async extractVisibleEditorsContext(): Promise<ContextInfo[]> {
    try {
      const visibleEditors = vscode.window.visibleTextEditors;
      const contexts: ContextInfo[] = [];
      for (const editor of visibleEditors) {
        const document = editor.document;
        const fileName = path.basename(document.fileName);
        const language = document.languageId;
        const content = document.getText();
        const relativePath = vscode.workspace.asRelativePath(document.uri);
        contexts.push({
          content,
          fileName,
          relativePath,
          language,
          relevanceScore: 0.8 // Open editors have high relevance
        });
      }
      return contexts;
    } catch (error) {
      handleError(error as Error, 'Failed to extract visible editors context');
      return [];
    }
  }

  /**
   * Extract context from project structure
   */
  async extractProjectStructure(): Promise<string> {
    if (!this.includeProjectStructure) {
      return '';
    }
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return 'No workspace folder is open.';
      }
      const rootPath = workspaceFolders[0].uri.fsPath;
      const projectName = workspaceFolders[0].name;
      // Use glob pattern to find files, but limit depth and exclude node_modules, etc.
      const files = await vscode.workspace.findFiles(
        '**/*',
        '**/node_modules/**,**/.git/**,**/dist/**,**/build/**',
        this.maxFilesToProcess
      );
      // Create a tree-like structure of the project
      let structure = `Project Structure for ${projectName}:\n`;
      // Group files by directory
      const filesByDir = new Map<string, string[]>();
      for (const file of files) {
        const relativePath = vscode.workspace.asRelativePath(file);
        const dirPath = path.dirname(relativePath);
        if (!filesByDir.has(dirPath)) {
          filesByDir.set(dirPath, []);
        }
        filesByDir.get(dirPath)!.push(path.basename(relativePath));
      }
      // Sort directories for consistent output
      const sortedDirs = Array.from(filesByDir.keys()).sort();
      for (const dir of sortedDirs) {
        const files = filesByDir.get(dir)!.sort();
        structure += `\n${dir}/\n`;
        for (const file of files) {
          structure += ` - ${file}\n`;
        }
      }
      return structure;
    } catch (error) {
      handleError(error as Error, 'Failed to extract project structure');
      return '';
    }
  }

  /**
   * Analyze code to find imports and related files
   */
  async findRelatedFiles(document: vscode.TextDocument): Promise<ContextInfo[]> {
    if (!this.includeImports) {
      return [];
    }
    try {
      const text = document.getText();
      const language = document.languageId;
      // Simple import pattern matching - will be extended in future phases
      const importPatterns: Record<string, RegExp[]> = {
        'typescript': [
          /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g,
          /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
        ],
        'javascript': [
          /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g,
          /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
        ],
        'python': [
          /import\s+([\w.]+)/g,
          /from\s+([\w.]+)\s+import/g
        ],
        'java': [
          /import\s+([\w.]+);/g
        ],
        'csharp': [
          /using\s+([\w.]+);/g
        ]
      };
      // Get patterns for current language or default to empty array
      const patterns = importPatterns[language] || [];
      const importPaths = new Set<string>();
      // Extract all import paths
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          if (match[1]) {
            importPaths.add(match[1]);
          }
        }
      }
      // Find files matching the import paths
      const contexts: ContextInfo[] = [];
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return [];
      }
      for (const importPath of importPaths) {
        // Handle relative imports
        if (importPath.startsWith('.')) {
          const currentDir = path.dirname(document.uri.fsPath);
          const targetPath = path.resolve(currentDir, importPath);
          // Try to find the file with various extensions
          const extensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cs'];
          for (const ext of extensions) {
            try {
              const filePath = targetPath + ext;
              const uri = vscode.Uri.file(filePath);
              const doc = await vscode.workspace.openTextDocument(uri);
              contexts.push({
                content: doc.getText(),
                fileName: path.basename(filePath),
                relativePath: vscode.workspace.asRelativePath(uri),
                language: doc.languageId,
                relevanceScore: 0.7 // Imported files have medium-high relevance
              });
              break; // Found a matching file, stop looking
            } catch (e) {
              // File not found with this extension, try next
            }
          }
        } else {
          // Non-relative imports (node_modules, etc.) - skip for now
          // Will be handled more comprehensively in Enhancement Phase
        }
      }
      return contexts;
    } catch (error) {
      handleError(error as Error, 'Failed to find related files');
      return [];
    }
  }

  /**
   * Get all relevant context for a given document and position
   */
  async getFullContext(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<string> {
    try {
      // Collect context information from various sources
      const currentFileContext = await this.extractCurrentFileContext(document, position);
      const relatedFilesContext = await this.findRelatedFiles(document);
      const visibleEditorsContext = await this.extractVisibleEditorsContext();
      const projectStructure = await this.extractProjectStructure();
      // Combine all contexts, sorted by relevance
      const allContexts = [
        currentFileContext,
        ...relatedFilesContext,
        ...visibleEditorsContext.filter(ctx => ctx.fileName !== currentFileContext.fileName) // Avoid duplicating current file
      ].sort((a, b) => b.relevanceScore - a.relevanceScore);
      // Format the combined context
      let formattedContext = '';
      // Add current file first
      formattedContext += `=== Current file: ${currentFileContext.relativePath} ===\n`;
      formattedContext += currentFileContext.content + '\n\n';
      // Add related files
      for (const ctx of allContexts.slice(1)) {
        formattedContext += `=== Related file: ${ctx.relativePath} ===\n`;
        formattedContext += ctx.content + '\n\n';
      }
      // Add project structure if available
      if (projectStructure) {
        formattedContext += `=== Project structure ===\n${projectStructure}\n`;
      }
      // Limit context length if needed
      if (formattedContext.length > this.maxContextLength) {
        log.info(`Context exceeds max length (${formattedContext.length} > ${this.maxContextLength}). Truncating...`);
        formattedContext = formattedContext.substring(0, this.maxContextLength);
      }
      return formattedContext;
    } catch (error) {
      handleError(error as Error, 'Failed to get full context');
      return '';
    }
  }
}