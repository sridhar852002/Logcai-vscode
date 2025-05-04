import * as vscode from 'vscode';

// Model provider interface
export interface ModelProvider {
  readonly id: string;
  readonly name: string;
  isAvailable(): Promise<boolean>;
  getCompletion(prompt: string, options?: ModelRequestOptions): Promise<string>;
  streamCompletion(
    prompt: string, 
    callback: (text: string, final: boolean) => void, 
    token?: vscode.CancellationToken,
    options?: ModelRequestOptions
  ): Promise<void>;
}

// Model request options
export interface ModelRequestOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  contextWindow?: number;
}

// Context information
export interface ContextInfo {
  content: string;
  fileName: string;
  relativePath: string;
  language: string;
  relevanceScore: number;
}

// Message in a conversation
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  timestamp: number;
  id: string;
}

// Conversation history
export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

// Model status
export interface ModelStatus {
  isAvailable: boolean;
  modelName: string;
  providerName: string;
}

// Inline suggestion
export interface InlineSuggestion {
  text: string;
  range: vscode.Range;
}

// Types of code operations
export enum CodeOperationType {
  COMPLETION = 'completion',
  EXPLANATION = 'explanation',
  REFACTORING = 'refactoring',
  ERROR_FIXING = 'error_fixing',
  TEST_GENERATION = 'test_generation',
  DOCUMENTATION = 'documentation'
}

// Result of a code operation
export interface CodeOperationResult {
  type: CodeOperationType;
  input: string;
  output: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}