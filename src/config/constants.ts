import { LogCAIConfiguration } from './configuration';

// Default settings
export const DEFAULT_SETTINGS: LogCAIConfiguration = {
  // Model Settings
  modelProvider: 'ollama',
  ollamaEndpoint: 'http://localhost:11434',
  ollamaModel: '', // Changed from 'stable-code' to empty string
  openaiApiKey: '',
  openaiModel: 'gpt-4o',
  anthropicApiKey: '',
  anthropicModel: 'claude-3-opus-20240229',
  temperature: 0.2,
  maxTokens: 2048,
  // Context Settings
  maxContextLength: 4000,
  includeImports: true,
  includeProjectStructure: true,
  maxFilesToProcess: 20,
  // UI Settings
  enableInlineSuggestions: true,
  completionTriggerChars: ' .({[',
  showModelStatus: true,
  inlinePreviewDelay: 0.2,
  chatPanelPosition: 'right',
  autoStartOllama: true, // New setting for auto-starting Ollama
  // Inline Suggestion Settings
  showInlinePreview: true, // Show preview before full completion
  continueInlineOnAccept: true, // Continue generating more text when accepting suggestion
  inlineCompletionStop: ['```'], // Stop sequences for inline completions
  // Advanced Settings
  logLevel: 'info',
  cacheTTL: 3600 // 1 hour in seconds
};

// Prompts
export const PROMPTS = {
  CODE_COMPLETION:
  `You are an intelligent coding assistant. Complete the code based on the context provided.
Think step by step to ensure the completion is correct and follows best practices.
File: {FILE_NAME}
Language: {LANGUAGE}
Project: {PROJECT_NAME}
Context:
{CONTEXT}

Code to complete:
{CODE}`,
  CODE_EXPLANATION:
  `You are an intelligent coding assistant. Explain the following code in a clear and concise manner.
Identify key patterns, algorithms, and concepts used.
File: {FILE_NAME}
Language: {LANGUAGE}
Project: {PROJECT_NAME}
Code to explain:
{CODE}`,
  CODE_REFACTORING:
  `You are an intelligent coding assistant. Refactor the following code to improve:
- Readability
- Performance
- Maintainability
- Best practices
File: {FILE_NAME}
Language: {LANGUAGE}
Project: {PROJECT_NAME}
Code to refactor:
{CODE}`,
  ERROR_FIXING:
  `You are an intelligent coding assistant. Fix the error in the following code:
File: {FILE_NAME}
Language: {LANGUAGE}
Project: {PROJECT_NAME}
Error message:
{ERROR_MESSAGE}
Code with error:
{CODE}`,
  TEST_GENERATION:
  `You are an intelligent coding assistant. Generate unit tests for the following code:
File: {FILE_NAME}
Language: {LANGUAGE}
Project: {PROJECT_NAME}
Code to test:
{CODE}`
};

// Error messages
export const ERROR_MESSAGES = {
  OLLAMA_CONNECTION: "Could not connect to Ollama server. Please ensure Ollama is running and the endpoint is correct.",
  API_KEY_MISSING: "API key is missing. Please add your API key in the extension settings.",
  MODEL_UNAVAILABLE: "The selected model is not available. Please check your configuration.",
  REQUEST_FAILED: "The request to the model provider failed. Please check your connection and try again.",
  CONTEXT_EXTRACTION: "Failed to extract context from the current file or project."
};

// Command IDs
export const COMMANDS = {
  OPEN_CHAT: "logcai.openChat",
  GET_INLINE_COMPLETION: "logcai.getInlineCompletion",
  REGENERATE_RESPONSE: "logcai.regenerateResponse",
  CLEAR_CHAT: "logcai.clearChat",
  CONFIGURE_MODEL: "logcai.configureModel"
};

// WebView panel IDs
export const WEBVIEW = {
  CHAT_PANEL_ID: "logcai.chatPanel",
  CHAT_PANEL_TITLE: "LogCAI Chat"
};