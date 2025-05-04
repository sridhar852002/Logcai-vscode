import * as vscode from 'vscode';
import { VectorStorage, SearchResult, CodeChunk } from './vectorStorage';
import { CodeIndexer, setupCodeIndexing } from './codeIndexer';
import { ConfigurationManager } from '../config/configuration';
import { log } from '../utils/logging';

/**
 * RAG (Retrieval Augmented Generation) Service
 * Integrates the vector storage and indexing with context retrieval
 */
export class RAGService {
  private vectorStorage: VectorStorage;
  private codeIndexer: CodeIndexer;
  private initialized: boolean = false;

  constructor(
    private context: vscode.ExtensionContext,
    private configManager: ConfigurationManager
  ) {
    this.vectorStorage = new VectorStorage(context);
    this.codeIndexer = setupCodeIndexing(context, this.vectorStorage, configManager);
  }

  /**
   * Initialize the RAG service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.vectorStorage.initialize();
      this.initialized = true;
      log.info('RAG Service initialized');
    } catch (error) {
      log.error(`Failed to initialize RAG service: ${error}`);
      throw error;
    }
  }

  /**
   * Get relevant code snippets for a query
   */
  async getRelevantCodeSnippets(
    query: string,
    language?: string,
    limit: number = 5
  ): Promise<SearchResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Create search options with optional language filter
    const options = {
      limit,
      threshold: 0.2,
      filter: language ? ((chunk: CodeChunk) => chunk.language === language) : undefined
            };

    // Search for relevant code
    return this.vectorStorage.search(query, options);
  }

  /**
   * Augment a prompt with relevant code snippets
   */
  async augmentPromptWithRAG(
    prompt: string,
    query: string,
    language?: string,
    limit: number = 3
  ): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Get relevant code snippets
    const snippets = await this.getRelevantCodeSnippets(query, language, limit);

    if (snippets.length === 0) {
      return prompt;
    }

    // Create context from snippets
    let context = `\n\nHere are some relevant code snippets from the codebase:\n\n`;

    snippets.forEach((result, index) => {
      const { chunk, score } = result;
      context += `Snippet ${index + 1} (relevance: ${Math.round(score * 100)}%):\nFile: ${chunk.filePath}\n`;
      context += `\`\`\`${chunk.language}\n${chunk.content}\n\`\`\`\n\n`;
    });

    // Append context to prompt
    return `${prompt}\n${context}`;
  }

  /**
   * Manually trigger indexing
   */
  async triggerCodebaseIndexing(): Promise<void> {
    return this.codeIndexer.startIncrementalIndexing();
  }

  /**
   * Get indexing statistics
   */
  async getIndexingStats(): Promise<{ totalChunks: number }> {
    if (!this.initialized) {
      await this.initialize();
    }

    const totalChunks = await this.vectorStorage.count();
    return { totalChunks };
  }

  /**
   * Clear all indexed data
   */
  async clearIndexedData(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    await this.vectorStorage.clear();
    log.info('Cleared all indexed data');
  }
}