import * as vscode from 'vscode';
import axios from 'axios';
import { ModelProvider, ModelRequestOptions, ModelStatus } from './interfaces';
import { OllamaProvider } from './providers/ollamaProvider';
import { ConfigurationManager } from '../config/configuration';
import { handleError } from '../utils/errorHandler';
import { log } from '../utils/logging';

export interface OllamaModel {
  name: string;
  size: string;
  modifiedAt?: string;
  digest?: string;
}

export class ModelManager {
  private providers: Map<string, ModelProvider> = new Map();
  private currentProvider: ModelProvider | undefined;
  private _status: ModelStatus = {
    isAvailable: false,
    modelName: '',
    providerName: ''
  };
  
  // Event emitter for status changes
  private readonly _onStatusChanged = new vscode.EventEmitter<ModelStatus>();
  readonly onStatusChanged = this._onStatusChanged.event;
  
  constructor(private configManager: ConfigurationManager) {
    this.initialize();
  }
  
  private async initialize(): Promise<void> {
    try {
      // Create the Ollama provider
      const ollamaProvider = new OllamaProvider(this.configManager);
      this.providers.set(ollamaProvider.id, ollamaProvider);
      
      // Add more providers here as they're implemented
      // e.g., this.providers.set('openai', new OpenAIProvider(...));
      
      // Set the current provider based on configuration
      await this.setProviderFromConfig();
      log.info('Model Manager initialized successfully');
    } catch (error) {
      handleError(error as Error, "Failed to initialize Model Manager");
    }
  }
  
  async refreshConfiguration(): Promise<void> {
    try {
      // Refresh all providers
      for (const provider of this.providers.values()) {
        if ('refreshConfiguration' in provider) {
          (provider as any).refreshConfiguration();
        }
      }
      
      // Update the current provider
      await this.setProviderFromConfig();
      log.info('Model Manager configuration refreshed');
    } catch (error) {
      handleError(error as Error, "Failed to refresh Model Manager configuration");
    }
  }
  
  /**
   * Force a refresh of the connection status
   * This is useful when Ollama has been started separately
   */
  async refreshConnection(): Promise<boolean> {
    try {
      await this.setProviderFromConfig();
      
      // Return the new connection status
      return this._status.isAvailable;
    } catch (error) {
      handleError(error as Error, "Failed to refresh connection");
      return false;
    }
  }
  
  private async setProviderFromConfig(): Promise<void> {
    const providerId = this.configManager.getModelProvider();
    const provider = this.providers.get(providerId);
    
    if (!provider) {
      const errorMsg = `Provider '${providerId}' not found or not implemented yet`;
      log.error(errorMsg);
      vscode.window.showErrorMessage(`LogCAI: ${errorMsg}`);
      this.currentProvider = undefined;
      this.updateStatus(false, '', '');
      return;
    }
    
    this.currentProvider = provider;
    
    // Check availability
    const isAvailable = await provider.isAvailable().catch(() => false);
    
    // Update status
    const config = this.configManager.getConfiguration();
    let modelName = '';
    
    switch (providerId) {
      case 'ollama':
        modelName = config.ollamaModel;
        break;
      case 'openai':
        modelName = config.openaiModel;
        break;
      case 'anthropic':
        modelName = config.anthropicModel;
        break;
    }
    
    this.updateStatus(isAvailable, modelName, provider.name);
  }
  
  private updateStatus(isAvailable: boolean, modelName: string, providerName: string): void {
    this._status = {
      isAvailable,
      modelName,
      providerName
    };
    
    // Emit status changed event
    this._onStatusChanged.fire(this._status);
    log.info(`Model status updated: ${providerName} (${modelName}) - Available: ${isAvailable}`);
  }
  
  get status(): ModelStatus {
    return this._status;
  }
  
  async getCompletion(prompt: string, options?: ModelRequestOptions): Promise<string> {
    if (!this.currentProvider) {
      throw new Error('No model provider is configured or available');
    }
    
    if (!this._status.isAvailable) {
      throw new Error(`Model provider '${this.currentProvider.name}' is not available`);
    }
    
    try {
      return await this.currentProvider.getCompletion(prompt, options);
    } catch (error) {
      handleError(error as Error, 'Failed to get completion');
      throw error;
    }
  }
  
  async streamCompletion(
    prompt: string,
    callback: (text: string, final: boolean) => void,
    token?: vscode.CancellationToken,
    options?: ModelRequestOptions
  ): Promise<void> {
    if (!this.currentProvider) {
      throw new Error('No model provider is configured or available');
    }
    
    if (!this._status.isAvailable) {
      throw new Error(`Model provider '${this.currentProvider.name}' is not available`);
    }
    
    try {
      await this.currentProvider.streamCompletion(prompt, callback, token, options);
    } catch (error) {
      handleError(error as Error, 'Failed to stream completion');
      throw error;
    }
  }
  
  /**
   * Get available Ollama models
   */
  async getAvailableOllamaModels(): Promise<OllamaModel[]> {
    try {
      const ollamaProvider = this.providers.get('ollama') as OllamaProvider;
      if (!ollamaProvider) {
        throw new Error('Ollama provider not found');
      }
      
      const baseUrl = ollamaProvider.getBaseUrl();
      const response = await axios.get(`${baseUrl}/api/tags`);
      
      if (!response.data || !response.data.models) {
        log.warn('Unexpected response format from Ollama API: missing models property');
        return [];
      }
      
      return response.data.models.map((model: any) => {
        return {
          name: model.name,
          size: this.formatBytes(model.size || 0),
          modifiedAt: model.modified_at,
          digest: model.digest
        };
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`Failed to get available Ollama models: ${errorMsg}`);
      
      // Show error message with action
      if (axios.isAxiosError(error) && error.code === 'ECONNREFUSED') {
        vscode.window.showErrorMessage(
          'Could not connect to Ollama. Make sure Ollama is installed and running.',
          'Check Ollama'
        ).then(selection => {
          if (selection === 'Check Ollama') {
            vscode.env.openExternal(vscode.Uri.parse('https://ollama.com/download'));
          }
        });
      }
      return [];
    }
  }
  
  /**
   * Install an Ollama model
   */
  async installOllamaModel(
    modelName: string,
    progressCallback: (status: string) => void,
    token?: vscode.CancellationToken
  ): Promise<void> {
    try {
      const ollamaProvider = this.providers.get('ollama') as OllamaProvider;
      if (!ollamaProvider) {
        throw new Error('Ollama provider not found');
      }
      
      const baseUrl = ollamaProvider.getBaseUrl();
      
      // Create an abort controller for cancellation
      const abortController = new AbortController();
      if (token) {
        token.onCancellationRequested(() => {
          abortController.abort();
        });
      }
      
      // Start pull request
      const response = await axios.post(
        `${baseUrl}/api/pull`,
        { name: modelName },
        {
          responseType: 'stream',
          signal: abortController.signal
        }
      );
      
      return new Promise<void>((resolve, reject) => {
        let lastProgress = '';
        let lastStatus = '';
        
        response.data.on('data', (chunk: Buffer) => {
          try {
            const data = JSON.parse(chunk.toString());
            
            if (data.status) {
              lastStatus = data.status;
            }
            
            if (data.completed && data.total) {
              const percent = Math.round((data.completed / data.total) * 100);
              const progressStr = `${percent}% - ${this.formatBytes(data.completed)} of ${this.formatBytes(data.total)}`;
              
              if (progressStr !== lastProgress) {
                lastProgress = progressStr;
                progressCallback(`${lastStatus} - ${progressStr}`);
              }
            } else if (lastStatus) {
              progressCallback(lastStatus);
            }
            
            if (data.error) {
              reject(new Error(data.error));
            }
          } catch (e) {
            // Ignore parsing errors, just continue with the stream
          }
        });
        
        response.data.on('end', () => {
          progressCallback('Download complete, finalizing installation...');
          
          // Verify model exists after installation
          this.verifyModelInstalled(modelName).then(installed => {
            if (installed) {
              resolve();
            } else {
              reject(new Error(`Failed to verify model ${modelName} was installed`));
            }
          }).catch(() => {
            // Even if verification fails, consider it a success since the download completed
            resolve();
          });
        });
        
        response.data.on('error', (err: Error) => {
          reject(err);
        });
      });
    } catch (error) {
      if (axios.isCancel(error)) {
        throw new Error('Model installation cancelled');
      }
      
      // Check for common errors
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('Could not connect to Ollama. Make sure Ollama is installed and running.');
        }
        
        const errorResponse = error.response?.data;
        if (errorResponse && typeof errorResponse === 'object' && 'error' in errorResponse) {
          throw new Error(`Ollama error: ${errorResponse.error}`);
        }
      }
      
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`Failed to install Ollama model: ${errorMsg}`);
      throw error;
    }
  }
  
  /**
   * Verify a model was properly installed
   */
  private async verifyModelInstalled(modelName: string): Promise<boolean> {
    try {
      const models = await this.getAvailableOllamaModels();
      return models.some(model => model.name === modelName);
    } catch (error) {
      log.error(`Failed to verify model installation: ${error}`);
      return false;
    }
  }
  
  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) {return '0 Bytes';}
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  /**
   * Dispose of all providers
   */
  dispose(): void {
    // Dispose all providers that have a dispose method
    for (const provider of this.providers.values()) {
      if ('dispose' in provider && typeof (provider as any).dispose === 'function') {
        (provider as any).dispose();
      }
    }
  }
}