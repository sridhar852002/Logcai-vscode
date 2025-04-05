// src/context/chains/ContextAwareChain.ts
import * as vscode from 'vscode';
import { LLMService } from '../../ai/LLMService';
import { ContextManager } from '../ContextManager';
import { ContextType } from '../ContextProvider';
import { PromptTemplate, PromptTarget } from '../PromptBuilder';
import logger from '../../utils/logger';

/**
* Chain types for different use cases
*/
export enum ChainType {
  CODE_COMPLETION = 'code_completion',
  CODE_CHAT = 'code_chat',
  INLINE_COMPLETION = 'inline_completion',
  COMMAND_GENERATION = 'command_generation',
  AGENT_EXECUTOR = 'agent_executor'
}

/**
* Chain options with context and model settings
*/
export interface ChainOptions {
  chainType: ChainType;
  modelId: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  contextType?: ContextType;
  includeProjectInfo?: boolean;
}

/**
* Handles context-aware AI chains for different features
* with appropriate context management
*/
export class ContextAwareChain {
  private contextManager: ContextManager;
  // Fix: Using a more general type instead of trying to make LLMService a type
  private llmService: any; // Using any temporarily, ideally would create a proper interface
  private options: ChainOptions;

  constructor(options: ChainOptions) {
    this.contextManager = ContextManager.getInstance();
    this.options = options;
    
    // Create LLM service - modify based on actual LLMService implementation
    this.llmService = new LLMService(
      options.modelId,
      options.temperature?.toString() || '0.7', // Convert to string if needed
      options.maxTokens?.toString() || undefined, // Convert to string, undefined if not provided
      options.systemPrompt || undefined // Pass undefined if not provided
    );
  }

  /**
  * Run the chain with a user query
  */
  public async run(userQuery: string): Promise<string> {
    try {
      // Determine the appropriate context type and prompt template
      const contextType = this.options.contextType || this.getContextTypeForChain(this.options.chainType);
      const promptTemplate = this.getPromptTemplateForChain(this.options.chainType);
      
      // Get the target model type
      const promptTarget = this.isLocalModel(this.options.modelId)
        ? PromptTarget.OLLAMA
        : PromptTarget.GENERIC;
      
      // Get max tokens for the model
      const maxTokens = this.options.maxTokens || this.getMaxTokensForChain(this.options.chainType);
      
      // Build a contextual prompt
      const prompt = await this.contextManager.buildContextualPrompt(
        userQuery,
        promptTemplate,
        promptTarget,
        maxTokens
      );
      
      // Execute with LLM
      const result = await this.llmService.generateWithModel(
        this.options.modelId,
        prompt,
        {
          temperature: this.options.temperature || 0.7,
          max_tokens: this.options.maxTokens,
          system_prompt: this.options.systemPrompt
        }
      );
      
      // Track usage for context improvement
      this.contextManager.trackUsagePattern(
        `chain:${this.options.chainType}`,
        [userQuery.substring(0, 100)]
      );
      
      return result;
    } catch (error: unknown) {
      logger.error('Error running context-aware chain', error);
      if (error instanceof Error) {
        throw new Error(`Error running AI chain: ${error.message}`);
      } else {
        throw new Error(`Error running AI chain: unknown error`);
      }
    }
  }

  // Simple helper to check if model is local
  private isLocalModel(modelId: string): boolean {
    return modelId.startsWith('local:') || modelId.includes('ollama');
  }

  /**
  * Stream the chain results with a user query
  */
  public async *stream(userQuery: string): AsyncGenerator<string, void, unknown> {
    try {
      // Determine the appropriate context type and prompt template
      const contextType = this.options.contextType || this.getContextTypeForChain(this.options.chainType);
      const promptTemplate = this.getPromptTemplateForChain(this.options.chainType);
      
      // Get the target model type
      const promptTarget = this.isLocalModel(this.options.modelId)
        ? PromptTarget.OLLAMA
        : PromptTarget.GENERIC;
      
      // Get max tokens for the model
      const maxTokens = this.options.maxTokens || this.getMaxTokensForChain(this.options.chainType);
      
      // Build a contextual prompt
      const prompt = await this.contextManager.buildContextualPrompt(
        userQuery,
        promptTemplate,
        promptTarget,
        maxTokens
      );
      
      // Stream with LLM
      for await (const chunk of this.llmService.streamWithModel(
        this.options.modelId,
        prompt,
        {
          temperature: this.options.temperature || 0.7,
          max_tokens: this.options.maxTokens,
          system_prompt: this.options.systemPrompt
        }
      )) {
        yield chunk;
      }
      
      // Track usage after streaming
      this.contextManager.trackUsagePattern(
        `chain:${this.options.chainType}`,
        [userQuery.substring(0, 100)]
      );
    } catch (error: unknown) {
      logger.error('Error streaming context-aware chain', error);
      if (error instanceof Error) {
        throw new Error(`Error streaming AI chain: ${error.message}`);
      } else {
        throw new Error(`Error streaming AI chain: unknown error`);
      }
    }
  }

  /**
  * Get the appropriate context type for a chain
  */
  private getContextTypeForChain(chainType: ChainType): ContextType {
    switch (chainType) {
      case ChainType.CODE_COMPLETION:
      case ChainType.INLINE_COMPLETION:
        return ContextType.CODE_COMPLETION;
      case ChainType.AGENT_EXECUTOR:
        return ContextType.AGENT;
      case ChainType.CODE_CHAT:
      case ChainType.COMMAND_GENERATION:
      default:
        return ContextType.CHAT;
    }
  }

  /**
  * Get the appropriate prompt template for a chain
  */
  private getPromptTemplateForChain(chainType: ChainType): PromptTemplate {
    switch (chainType) {
      case ChainType.CODE_COMPLETION:
        return PromptTemplate.CODE_COMPLETION;
      case ChainType.INLINE_COMPLETION:
        return PromptTemplate.CODE_COMPLETION;
      case ChainType.CODE_CHAT:
        return PromptTemplate.CHAT;
      case ChainType.COMMAND_GENERATION:
        return PromptTemplate.CODE_REFACTORING;
      case ChainType.AGENT_EXECUTOR:
        return PromptTemplate.AGENT;
      default:
        return PromptTemplate.CHAT;
    }
  }

  /**
  * Get the maximum tokens for a given chain type
  */
  private getMaxTokensForChain(chainType: ChainType): number {
    switch (chainType) {
      case ChainType.CODE_COMPLETION:
      case ChainType.INLINE_COMPLETION:
        return 2000;
      case ChainType.CODE_CHAT:
        return 6000;
      case ChainType.COMMAND_GENERATION:
        return 3000;
      case ChainType.AGENT_EXECUTOR:
        return 4000;
      default:
        return 4000;
    }
  }
}