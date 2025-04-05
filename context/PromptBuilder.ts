// src/context/PromptBuilder.ts
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ContextProvider, ContextType, ContextSource, ContextItem } from './ContextProvider';
import logger from '../utils/logger';

/**
 * Prompt templates for different use cases
 */
export enum PromptTemplate {
  CODE_COMPLETION = 'code_completion',
  CODE_EXPLANATION = 'code_explanation',
  CODE_REFACTORING = 'code_refactoring',
  CHAT = 'chat',
  AGENT = 'agent'
}

/**
 * Prompt target model
 */
export enum PromptTarget {
  OLLAMA = 'ollama',
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GENERIC = 'generic'
}

/**
 * Options for building a prompt
 */
export interface PromptOptions {
  template?: PromptTemplate;
  target?: PromptTarget;
  maxTokens?: number;
  userPrompt: string;
  conversationId?: string;
  systemPrompt?: string;
  includeProjectInfo?: boolean;
  activeFileOnly?: boolean;
  selectionOnly?: boolean;
}

/**
 * Result of prompt building
 */
export interface PromptResult {
  prompt: string;
  contextItems: ContextItem[];
  tokenCount: number;
  truncated: boolean;
}

/**
 * Responsible for building optimized prompts with appropriate context
 */
export class PromptBuilder {
  private contextProvider: ContextProvider;
  private templateCache: Map<string, string> = new Map();
  
  constructor() {
    this.contextProvider = ContextProvider.getInstance();
  }

  /**
   * Build a prompt with context for the given options
   */
  public async buildPrompt(options: PromptOptions): Promise<PromptResult> {
    try {
      // Determine context type based on template
      const contextType = this.getContextTypeForTemplate(options.template || PromptTemplate.CHAT);
      
      // Get appropriate context
      const context = await this.contextProvider.getContext({
        query: options.userPrompt,
        contextType,
        sources: this.getContextSourcesForTemplate(options.template || PromptTemplate.CHAT),
        maxTokens: options.maxTokens || 4000,
        includeProjectInfo: options.includeProjectInfo || false,
        conversationId: options.conversationId,
        activeFileOnly: options.activeFileOnly || false,
        selectionOnly: options.selectionOnly || false
      });
      
      // Load the template
      const templateText = await this.loadTemplate(
        options.template || PromptTemplate.CHAT,
        options.target || PromptTarget.GENERIC
      );
      
      // Compose the prompt
      const prompt = this.composePrompt(
        templateText,
        options.userPrompt,
        context.items,
        options.systemPrompt
      );
      
      return {
        prompt,
        contextItems: context.items,
        tokenCount: context.tokenCount,
        truncated: context.truncated
      };
    } catch (error) {
      logger.error('Error building prompt', error);
      
      // Return basic fallback prompt
      return {
        prompt: options.userPrompt,
        contextItems: [],
        tokenCount: 0,
        truncated: false
      };
    }
  }

  /**
   * Get the appropriate context type for a template
   */
  private getContextTypeForTemplate(template: PromptTemplate): ContextType {
    switch (template) {
      case PromptTemplate.CODE_COMPLETION:
        return ContextType.CODE_COMPLETION;
        
      case PromptTemplate.CODE_EXPLANATION:
      case PromptTemplate.CODE_REFACTORING:
      case PromptTemplate.AGENT:
        return ContextType.AGENT;
        
      case PromptTemplate.CHAT:
      default:
        return ContextType.CHAT;
    }
  }

  /**
   * Get the appropriate context sources for a template
   */
  private getContextSourcesForTemplate(template: PromptTemplate): ContextSource[] {
    switch (template) {
      case PromptTemplate.CODE_COMPLETION:
        // For code completion, focus on active file and relevant workspace
        return [
          ContextSource.ACTIVE_FILE,
          ContextSource.WORKSPACE
        ];
        
      case PromptTemplate.CODE_EXPLANATION:
      case PromptTemplate.CODE_REFACTORING:
        // For code understanding, include more context
        return [
          ContextSource.ACTIVE_FILE,
          ContextSource.OPEN_FILES,
          ContextSource.WORKSPACE
        ];
        
      case PromptTemplate.AGENT:
        // For agents, include all available context
        return [
          ContextSource.ACTIVE_FILE,
          ContextSource.OPEN_FILES,
          ContextSource.WORKSPACE,
          ContextSource.CONVERSATION_HISTORY
        ];
        
      case PromptTemplate.CHAT:
      default:
        // For chat, include conversation history
        return [
          ContextSource.ACTIVE_FILE,
          ContextSource.WORKSPACE,
          ContextSource.CONVERSATION_HISTORY
        ];
    }
  }

  /**
   * Load a prompt template
   */
  private async loadTemplate(template: PromptTemplate, target: PromptTarget): Promise<string> {
    try {
      // Generate cache key
      const cacheKey = `${template}_${target}`;
      
      // Check cache
      if (this.templateCache.has(cacheKey)) {
        return this.templateCache.get(cacheKey)!;
      }
      
      // Get template path
      const templatePath = this.getTemplatePath(template, target);
      
      // If template file exists, load it
      if (fs.existsSync(templatePath)) {
        const templateText = fs.readFileSync(templatePath, 'utf8');
        this.templateCache.set(cacheKey, templateText);
        return templateText;
      }
      
      // Otherwise use default template
      const defaultTemplate = this.getDefaultTemplate(template, target);
      this.templateCache.set(cacheKey, defaultTemplate);
      return defaultTemplate;
    } catch (error) {
      logger.error('Error loading template', error);
      
      // Return basic fallback template
      return this.getFallbackTemplate();
    }
  }

  /**
   * Get the path to a template file
   */
  private getTemplatePath(template: PromptTemplate, target: PromptTarget): string {
    // Get extension path
    const extension = vscode.extensions.getExtension('your.publisher.logcai');
    if (!extension) {
      throw new Error('Extension not found');
    }
    
    return path.join(
      extension.extensionPath,
      'templates',
      `${template}_${target}.txt`
    );
  }

  /**
   * Get default template for a template type and target
   */
  private getDefaultTemplate(template: PromptTemplate, target: PromptTarget): string {
    switch (template) {
      case PromptTemplate.CODE_COMPLETION:
        return this.getCodeCompletionTemplate(target);
        
      case PromptTemplate.CODE_EXPLANATION:
        return this.getCodeExplanationTemplate(target);
        
      case PromptTemplate.CODE_REFACTORING:
        return this.getCodeRefactoringTemplate(target);
        
      case PromptTemplate.AGENT:
        return this.getAgentTemplate(target);
        
      case PromptTemplate.CHAT:
      default:
        return this.getChatTemplate(target);
    }
  }

  /**
   * Get default template for code completion
   */
  private getCodeCompletionTemplate(target: PromptTarget): string {
    switch (target) {
      case PromptTarget.OLLAMA:
        return `You are a helpful code assistant. You help complete code based on the context provided.

Here's the current code and context:
{{CONTEXT}}

Complete the code based on this instruction: {{QUERY}}

Return only code without explanations.`;
        
      case PromptTarget.OPENAI:
        return `<system>
You are a specialized code completion assistant. Your task is to provide code continuations and completions based on the context provided. Maintain the coding style and patterns present in the existing code.
</system>

Here's the current code and context:
{{CONTEXT}}

Complete the code based on the following instruction: {{QUERY}}

Return only the completed code without explanations.`;
        
      case PromptTarget.ANTHROPIC:
        return `You are a specialized code completion assistant. Your task is to provide code continuations and completions based on the context provided. Maintain the coding style and patterns present in the existing code.

Here's the current code and context:
{{CONTEXT}}

Complete the code based on the following instruction: {{QUERY}}

Return only the completed code without explanations.`;
        
      case PromptTarget.GENERIC:
      default:
        return `Here's the current code and context:
{{CONTEXT}}

Complete the code based on this instruction: {{QUERY}}

Return only code without explanations.`;
    }
  }

  /**
   * Get default template for code explanation
   */
  private getCodeExplanationTemplate(target: PromptTarget): string {
    switch (target) {
      case PromptTarget.OLLAMA:
        return `You are a helpful code assistant. You help explain code based on the context provided.

Here's the code to explain:
{{CONTEXT}}

Explain the code based on this instruction: {{QUERY}}

Provide a clear and detailed explanation.`;
        
      case PromptTarget.OPENAI:
        return `<system>
You are a skilled code explanation assistant. Your task is to analyze and explain code to help users understand it better. Break down complex logic, explain design patterns, and highlight important aspects.
</system>

Here's the code to explain:
{{CONTEXT}}

Explain the code based on this instruction: {{QUERY}}

Provide a clear and detailed explanation.`;
        
      case PromptTarget.ANTHROPIC:
        return `You are a skilled code explanation assistant. Your task is to analyze and explain code to help users understand it better. Break down complex logic, explain design patterns, and highlight important aspects.

Here's the code to explain:
{{CONTEXT}}

Explain the code based on this instruction: {{QUERY}}

Provide a clear and detailed explanation.`;
        
      case PromptTarget.GENERIC:
      default:
        return `Here's the code to explain:
{{CONTEXT}}

Explain this code based on this instruction: {{QUERY}}

Provide a clear and detailed explanation.`;
    }
  }

  /**
   * Get default template for code refactoring
   */
  private getCodeRefactoringTemplate(target: PromptTarget): string {
    switch (target) {
      case PromptTarget.OLLAMA:
        return `You are a helpful code assistant. You help refactor code based on the context provided.

Here's the code to refactor:
{{CONTEXT}}

Refactor the code based on this instruction: {{QUERY}}

Return the refactored code with brief explanations of the changes made.`;
        
      case PromptTarget.OPENAI:
        return `<system>
You are an expert code refactoring assistant. Your task is to improve code quality by refactoring according to best practices while maintaining functionality. Consider readability, maintainability, and performance.
</system>

Here's the code to refactor:
{{CONTEXT}}

Refactor the code based on this instruction: {{QUERY}}

Return the refactored code with brief explanations of the changes made.`;
        
      case PromptTarget.ANTHROPIC:
        return `You are an expert code refactoring assistant. Your task is to improve code quality by refactoring according to best practices while maintaining functionality. Consider readability, maintainability, and performance.

Here's the code to refactor:
{{CONTEXT}}

Refactor the code based on this instruction: {{QUERY}}

Return the refactored code with brief explanations of the changes made.`;
        
      case PromptTarget.GENERIC:
      default:
        return `Here's the code to refactor:
{{CONTEXT}}

Refactor this code based on this instruction: {{QUERY}}

Return the refactored code with brief explanations of the changes made.`;
    }
  }

  /**
   * Get default template for agent
   */
  private getAgentTemplate(target: PromptTarget): string {
    switch (target) {
      case PromptTarget.OLLAMA:
        return `You are a helpful AI assistant with specialized coding abilities. You can understand context and help with various programming tasks.

Here's the context to consider:
{{CONTEXT}}

Now assist with this request: {{QUERY}}`;
        
      case PromptTarget.OPENAI:
        return `<system>
You are a versatile AI coding assistant with the ability to understand code, suggest improvements, and complete complex tasks. You can analyze provided context to give relevant responses.
</system>

Here's the relevant context for this request:
{{CONTEXT}}

User request: {{QUERY}}`;
        
      case PromptTarget.ANTHROPIC:
        return `You are a versatile AI coding assistant with the ability to understand code, suggest improvements, and complete complex tasks. You can analyze provided context to give relevant responses.

Here's the relevant context for this request:
{{CONTEXT}}

User request: {{QUERY}}`;
        
      case PromptTarget.GENERIC:
      default:
        return `Context information:
{{CONTEXT}}

Based on the above context, respond to this: {{QUERY}}`;
    }
  }

  /**
   * Get default template for chat
   */
  private getChatTemplate(target: PromptTarget): string {
    switch (target) {
      case PromptTarget.OLLAMA:
        return `{{SYSTEM}}

I'll help you with your code and answer questions based on the following context:
{{CONTEXT}}

User: {{QUERY}}`;
        
      case PromptTarget.OPENAI:
        return `<system>
{{SYSTEM}}
</system>

Relevant context:
{{CONTEXT}}

User: {{QUERY}}`;
        
      case PromptTarget.ANTHROPIC:
        return `{{SYSTEM}}

Relevant context:
{{CONTEXT}}

User: {{QUERY}}`;
        
      case PromptTarget.GENERIC:
      default:
        return `I'll help you with your code and programming questions.

Relevant context:
{{CONTEXT}}

User: {{QUERY}}`;
    }
  }

  /**
   * Get a simple fallback template if all else fails
   */
  private getFallbackTemplate(): string {
    return `
I'll help you with your code and programming questions.

{{QUERY}}
`;
  }

  /**
   * Compose a prompt using template, context items, and optional system prompt
   */
  private composePrompt(
    template: string,
    userQuery: string,
    contextItems: ContextItem[],
    systemPrompt?: string
  ): string {
    try {
      // Convert context items to text representation
      let contextText = '';
      
      // Add project info if available
      const projectInfo = contextItems.find(item => item.type === 'project_info');
      if (projectInfo && projectInfo.content) {
        contextText += `Project Information:\n${projectInfo.content}\n\n`;
      }
      
      // Add active file context if available
      const activeFile = contextItems.find(
        item => item.type === 'file' && 
        item.path === vscode.window.activeTextEditor?.document.uri.fsPath
      );
      
      if (activeFile) {
        contextText += `Active File: ${activeFile.name}\n`;
        if (activeFile.language) {
          contextText += `Language: ${activeFile.language}\n`;
        }
        contextText += "```\n";
        contextText += activeFile.content || '';
        contextText += "\n```\n\n";
      }
      
      // Add other relevant files
      const otherFiles = contextItems.filter(item => 
        item.type === 'file' && 
        item.path !== vscode.window.activeTextEditor?.document.uri.fsPath
      );
      
      if (otherFiles.length > 0) {
        contextText += "Related Files:\n";
        
        for (const file of otherFiles) {
          contextText += `File: ${file.path || file.name}\n`;
          contextText += "```\n";
          contextText += file.content || '';
          contextText += "\n```\n\n";
        }
      }
      
      // Add code entities (functions, classes, etc.)
      const codeEntities = contextItems.filter(item => 
        item.type === 'function' || item.type === 'class'
      );
      
      if (codeEntities.length > 0) {
        contextText += "Related Code:\n";
        
        for (const entity of codeEntities) {
          contextText += `${entity.type.charAt(0).toUpperCase() + entity.type.slice(1)}: ${entity.name}\n`;
          contextText += "```\n";
          contextText += entity.content || '';
          contextText += "\n```\n\n";
        }
      }
      
      // Replace system prompt placeholder
      let result = template;
      if (systemPrompt && template.includes('{{SYSTEM}}')) {
        result = result.replace('{{SYSTEM}}', systemPrompt);
      }
      
      // Replace context and query placeholders
      result = result
        .replace('{{CONTEXT}}', contextText)
        .replace('{{QUERY}}', userQuery);
      
      return result;
    } catch (error) {
      logger.error('Error composing prompt', error);
      
      // Fallback to just using the user query
      return userQuery;
    }
  }
}