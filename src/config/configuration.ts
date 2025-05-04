import * as vscode from 'vscode';
import { DEFAULT_SETTINGS } from './constants';

export interface LogCAIConfiguration {
  // Model Settings
  modelProvider: 'ollama' | 'openai' | 'anthropic';
  ollamaEndpoint: string;
  ollamaModel: string;
  openaiApiKey: string;
  openaiModel: string;
  anthropicApiKey: string;
  anthropicModel: string;
  temperature: number;
  maxTokens: number;
  // Context Settings
  maxContextLength: number;
  includeImports: boolean;
  includeProjectStructure: boolean;
  maxFilesToProcess: number;
  // UI Settings
  enableInlineSuggestions: boolean;
  completionTriggerChars: string;
  showModelStatus: boolean;
  inlinePreviewDelay: number;
  chatPanelPosition: 'right' | 'left';
  autoStartOllama: boolean; // New setting for auto-starting Ollama
  // Inline Suggestion Settings
  showInlinePreview: boolean;
  continueInlineOnAccept: boolean;
  inlineCompletionStop: string[];
  // Advanced Settings
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  cacheTTL: number;
}

export class ConfigurationManager {
  private config: vscode.WorkspaceConfiguration;
  private secretStorage: vscode.SecretStorage;

  constructor(private context: vscode.ExtensionContext) {
    this.config = vscode.workspace.getConfiguration('logcai');
    this.secretStorage = context.secrets;
    // Initialize secure storage if needed
    this.initializeSecureStorage();
  }

  private async initializeSecureStorage(): Promise<void> {
    // Check if we need to migrate any API keys from settings to secure storage
    const openaiApiKey = this.config.get<string>('openaiApiKey');
    const anthropicApiKey = this.config.get<string>('anthropicApiKey');
    
    if (openaiApiKey && openaiApiKey !== '') {
      await this.secretStorage.store('logcai.openaiApiKey', openaiApiKey);
      // Remove from settings for security
      await this.config.update('openaiApiKey', '', vscode.ConfigurationTarget.Global);
    }
    
    if (anthropicApiKey && anthropicApiKey !== '') {
      await this.secretStorage.store('logcai.anthropicApiKey', anthropicApiKey);
      // Remove from settings for security
      await this.config.update('anthropicApiKey', '', vscode.ConfigurationTarget.Global);
    }
  }

  refresh(): void {
    this.config = vscode.workspace.getConfiguration('logcai');
  }

  // Retrieve the full configuration
  getConfiguration(): LogCAIConfiguration {
    return {
      // Model Settings
      modelProvider: this.config.get<'ollama' | 'openai' | 'anthropic'>('modelProvider', DEFAULT_SETTINGS.modelProvider),
      ollamaEndpoint: this.config.get<string>('ollamaEndpoint', DEFAULT_SETTINGS.ollamaEndpoint),
      ollamaModel: this.config.get<string>('ollamaModel', DEFAULT_SETTINGS.ollamaModel),
      openaiApiKey: '', // Retrieved securely when needed
      openaiModel: this.config.get<string>('openaiModel', DEFAULT_SETTINGS.openaiModel),
      anthropicApiKey: '', // Retrieved securely when needed
      anthropicModel: this.config.get<string>('anthropicModel', DEFAULT_SETTINGS.anthropicModel),
      temperature: this.config.get<number>('temperature', DEFAULT_SETTINGS.temperature),
      maxTokens: this.config.get<number>('maxTokens', DEFAULT_SETTINGS.maxTokens),
      // Context Settings
      maxContextLength: this.config.get<number>('maxContextLength', DEFAULT_SETTINGS.maxContextLength),
      includeImports: this.config.get<boolean>('includeImports', DEFAULT_SETTINGS.includeImports),
      includeProjectStructure: this.config.get<boolean>('includeProjectStructure', DEFAULT_SETTINGS.includeProjectStructure),
      maxFilesToProcess: this.config.get<number>('maxFilesToProcess', DEFAULT_SETTINGS.maxFilesToProcess),
      // UI Settings
      enableInlineSuggestions: this.config.get<boolean>('enableInlineSuggestions', DEFAULT_SETTINGS.enableInlineSuggestions),
      completionTriggerChars: this.config.get<string>('completionTriggerChars', DEFAULT_SETTINGS.completionTriggerChars),
      showModelStatus: this.config.get<boolean>('showModelStatus', DEFAULT_SETTINGS.showModelStatus),
      inlinePreviewDelay: this.config.get<number>('inlinePreviewDelay', DEFAULT_SETTINGS.inlinePreviewDelay),
      chatPanelPosition: this.config.get<'right' | 'left'>('chatPanelPosition', DEFAULT_SETTINGS.chatPanelPosition),
      autoStartOllama: this.config.get<boolean>('autoStartOllama', DEFAULT_SETTINGS.autoStartOllama),
      // Inline Suggestion Settings
      showInlinePreview: this.config.get<boolean>('showInlinePreview', DEFAULT_SETTINGS.showInlinePreview),
      continueInlineOnAccept: this.config.get<boolean>('continueInlineOnAccept', DEFAULT_SETTINGS.continueInlineOnAccept),
      inlineCompletionStop: this.config.get<string[]>('inlineCompletionStop', DEFAULT_SETTINGS.inlineCompletionStop),
      // Advanced Settings
      logLevel: this.config.get<'error' | 'warn' | 'info' | 'debug'>('logLevel', DEFAULT_SETTINGS.logLevel),
      cacheTTL: this.config.get<number>('cacheTTL', DEFAULT_SETTINGS.cacheTTL)
    };
  }

  // Simple getters for frequently used settings
  getModelProvider(): string {
    return this.config.get<string>('modelProvider', DEFAULT_SETTINGS.modelProvider);
  }
  
  getCompletionTriggerCharacters(): string[] {
    const chars = this.config.get<string>('completionTriggerChars', DEFAULT_SETTINGS.completionTriggerChars);
    return chars.split('');
  }

  // Add a generic method to get any setting with proper TypeScript typing
  getSetting<T>(key: string, defaultValue?: T): T | undefined {
    const value = this.config.get<T>(key);
    return value !== undefined ? value : defaultValue;
  }

  // Secure API key retrieval
  async getOpenAIApiKey(): Promise<string | undefined> {
    return this.secretStorage.get('logcai.openaiApiKey');
  }
  
  async getAnthropicApiKey(): Promise<string | undefined> {
    return this.secretStorage.get('logcai.anthropicApiKey');
  }
  
  // Set API keys securely
  async setOpenAIApiKey(key: string): Promise<void> {
    await this.secretStorage.store('logcai.openaiApiKey', key);
  }
  
  async setAnthropicApiKey(key: string): Promise<void> {
    await this.secretStorage.store('logcai.anthropicApiKey', key);
  }
  
  /**
   * Update a configuration setting
   */
  async updateSetting(key: string, value: any): Promise<void> {
    try {
      await this.config.update(key, value, vscode.ConfigurationTarget.Global);
      this.refresh();
    } catch (error) {
      throw new Error(`Failed to update setting '${key}': ${error}`);
    }
  }
}