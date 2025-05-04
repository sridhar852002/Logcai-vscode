import * as vscode from 'vscode';
import axios, { AxiosResponse, AxiosError, CancelTokenSource } from 'axios';
import { BaseModelProvider } from './baseProvider';
import { ModelRequestOptions } from '../interfaces';
import { ConfigurationManager } from '../../config/configuration';
import { log } from '../../utils/logging';
import { ERROR_MESSAGES } from '../../config/constants';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

export class OllamaProvider extends BaseModelProvider {
  readonly id = 'ollama';
  readonly name = 'Ollama';
  
  // Configuration properties
  private endpoint!: string;
  private baseUrl!: string;
  private model!: string;
  private temperature!: number;
  private maxTokens!: number;
  private autoStartOllama!: boolean;
  
  // Terminal reference
  private ollamaTerminal: vscode.Terminal | null = null;
  private startAttempted: boolean = false;
  
  constructor(private configManager: ConfigurationManager) {
    super();
    this.refreshConfiguration();
  }
  
  refreshConfiguration(): void {
    const config = this.configManager.getConfiguration();
    this.endpoint = config.ollamaEndpoint;
    this.model = config.ollamaModel;
    this.temperature = config.temperature;
    this.maxTokens = config.maxTokens;
    this.autoStartOllama = config.autoStartOllama;
    
    // Fix for endpoint variations
    this.baseUrl = this.getBaseUrl();
    log.info(`Ollama configuration refreshed: endpoint=${this.endpoint}, model=${this.model}, autoStart=${this.autoStartOllama}`);
  }

  /**
   * Start Ollama in a VSCode terminal
   */
  public async startOllamaInTerminal(): Promise<boolean> {
    if (this.startAttempted) {
      log.info('Ollama start already attempted in this session, skipping');
      return false;
    }
    
    this.startAttempted = true;
    
    if (!this.autoStartOllama) {
      log.info('Auto-start Ollama is disabled in settings');
      return false;
    }
    
    try {
      log.info('Starting Ollama in a terminal...');
      
      // Create terminal
      this.ollamaTerminal = vscode.window.createTerminal('Ollama Server');
      
      // Show the terminal
      this.ollamaTerminal.show();
      
      // Run the appropriate command based on the platform
      if (process.platform === 'win32') {
        // Windows
        this.ollamaTerminal.sendText('ollama serve');
      } else if (process.platform === 'darwin') {
        // macOS - try to use open -a if it's installed as an app, otherwise direct command
        if (fs.existsSync('/Applications/Ollama.app') || 
            fs.existsSync(path.join(os.homedir(), 'Applications', 'Ollama.app'))) {
          this.ollamaTerminal.sendText('open -a Ollama');
        } else {
          this.ollamaTerminal.sendText('ollama serve');
        }
      } else {
        // Linux
        this.ollamaTerminal.sendText('ollama serve');
      }
      
      // Wait a moment for Ollama to start
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Show a message to the user
      vscode.window.showInformationMessage(
        "Ollama is starting in a terminal. Please keep this terminal open for LogCAI to function.",
        "Got It"
      );
      
      // Wait for Ollama to become available
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          const response = await axios.get(`${this.baseUrl}/api/tags`, { timeout: 2000 });
          if (response.status === 200) {
            log.info('Successfully connected to Ollama service started in terminal');
            return true;
          }
        } catch (error) {
          log.debug(`Connection attempt ${attempt + 1} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Let the user know if we're having trouble connecting
      vscode.window.showWarningMessage(
        "Ollama terminal is open, but we couldn't connect to the service. " +
        "Please check the terminal for errors.",
        "OK"
      );
      
      return false;
    } catch (error) {
      log.error(`Failed to start Ollama in terminal: ${error}`);
      return false;
    }
  }

  /**
   * Check if Ollama is available, and offer to start it in a terminal if not
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Try to connect to the Ollama API
      const response = await axios.get(`${this.baseUrl}/api/tags`, { timeout: 5000 });
      const availableModels = response.data.models || [];
      
      // Check if the configured model exists
      const modelExists = availableModels.some((m: any) => m.name === this.model);
      if (!modelExists) {
        log.warn(`Ollama model ${this.model} not found in available models`);
      }
      
      return true;
    } catch (error) {
      log.error(`Ollama availability check failed: ${(error as Error).message}`);
      
      if (!this.autoStartOllama) {
        vscode.window.showErrorMessage(
          "Ollama is not running. Please start Ollama manually.",
          "Learn More"
        ).then(selection => {
          if (selection === "Learn More") {
            vscode.env.openExternal(vscode.Uri.parse('https://ollama.com/download'));
          }
        });
        return false;
      }
      
      // Offer to start Ollama in a terminal
      const userResponse = await vscode.window.showInformationMessage(
        "Ollama is not running. Would you like to start it in a terminal?",
        "Start in Terminal",
        "Cancel"
      );
      
      if (userResponse === "Start in Terminal") {
        return vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: "Starting Ollama...",
          cancellable: false
        }, async (progress) => {
          progress.report({ message: "Launching Ollama in terminal..." });
          
          const started = await this.startOllamaInTerminal();
          
          if (started) {
            vscode.window.showInformationMessage("Ollama has been started successfully in a terminal!");
            return true;
          } else {
            vscode.window.showErrorMessage(
              "Ollama started in a terminal, but we couldn't connect. Please check the terminal for errors.",
              "Get Help"
            ).then(selection => {
              if (selection === "Get Help") {
                vscode.env.openExternal(vscode.Uri.parse('https://ollama.com/download'));
              }
            });
            return false;
          }
        });
      }
      
      return false;
    }
  }

  async getCompletion(prompt: string, options?: ModelRequestOptions): Promise<string> {
    return this.withProgress('Generating response', async (progress, token) => {
      progress.report({ message: 'Starting model...' });
      try {
        // Use the correct API endpoint for completions
        const completionUrl = `${this.baseUrl}/api/generate`;
        const response = await axios.post(
          completionUrl,
          {
            model: this.model,
            prompt: prompt,
            stream: false,
            options: {
              temperature: options?.temperature ?? this.temperature,
              num_predict: options?.maxTokens ?? this.maxTokens,
              stop: options?.stopSequences || null
            }
          },
          {
            cancelToken: new axios.CancelToken(cancel => {
              token.onCancellationRequested(() => {
                cancel('Operation cancelled by user');
              });
            })
          }
        );
        progress.report({ message: 'Response received', increment: 100 });
        return response.data.response;
      } catch (error) {
        if (axios.isCancel(error)) {
          log.info('Ollama request cancelled by user');
          return '';
        }
        const errorMsg = error instanceof Error ? error.message : String(error);
        log.error(`Ollama completion failed: ${errorMsg}`);
        throw this.handleProviderError(error);
      }
    });
  }

  async streamCompletion(
    prompt: string,
    callback: (text: string, final: boolean) => void,
    token?: vscode.CancellationToken,
    options?: ModelRequestOptions
  ): Promise<void> {
    return this.withProgress('Streaming response', async (progress, progressToken) => {
      progress.report({ message: 'Starting model...' });
      // Create a merged cancellation token if an external one is provided
      const tokenSource = new vscode.CancellationTokenSource();
      if (token) {
        token.onCancellationRequested(() => tokenSource.cancel());
      }
      progressToken.onCancellationRequested(() => tokenSource.cancel());
      const mergedToken = tokenSource.token;
      try {
        // Use the correct API endpoint for streaming
        const streamUrl = `${this.baseUrl}/api/generate`;
        const response = await axios.post(
          streamUrl,
          {
            model: this.model,
            prompt: prompt,
            stream: true,
            options: {
              temperature: options?.temperature ?? this.temperature,
              num_predict: options?.maxTokens ?? this.maxTokens,
              stop: options?.stopSequences || null
            }
          },
          {
            responseType: 'stream',
            cancelToken: new axios.CancelToken(cancel => {
              mergedToken.onCancellationRequested(() => {
                cancel('Operation cancelled by user');
              });
            })
          }
        );
        progress.report({ message: 'Generating...' });
        let processedChunks = 0;
        const totalChunks = options?.maxTokens ?? this.maxTokens;
        const chunkIncrement = 100 / Math.min(totalChunks, 100); // Update progress every X% of expected response
        
        response.data.on('data', (chunk: Buffer) => {
          if (mergedToken.isCancellationRequested) {
            return;
          }
          try {
            const chunkData = JSON.parse(chunk.toString()) as OllamaResponse;
            // Progress updates (not too frequently)
            processedChunks++;
            if (processedChunks % 10 === 0) {
              progress.report({
                message: 'Generating...',
                increment: chunkIncrement * 10
              });
            }
            // Call the callback with the new chunk
            callback(chunkData.response, chunkData.done);
            if (chunkData.done) {
              progress.report({ message: 'Response complete', increment: 100 });
            }
          } catch (err) {
            log.error(`Error processing chunk: ${(err as Error).message}`);
          }
        });
        
        return new Promise<void>((resolve, reject) => {
          response.data.on('end', () => {
            progress.report({ message: 'Response complete', increment: 100 });
            resolve();
          });
          response.data.on('error', (err: Error) => {
            reject(err);
          });
        });
      } catch (error) {
        if (axios.isCancel(error)) {
          log.info('Ollama stream request cancelled by user');
          return;
        }
        const errorMsg = error instanceof Error ? error.message : String(error);
        log.error(`Ollama stream completion failed: ${errorMsg}`);
        throw this.handleProviderError(error);
      }
    });
  }

  /**
   * Reset the start attempted flag so Ollama can be started again if needed
   */
  public resetStartAttempted(): void {
    this.startAttempted = false;
    log.info('Reset Ollama start attempted flag');
  }

  /**
   * Get the base URL from the endpoint
   */
  getBaseUrl(): string {
    // Extract the base URL from the endpoint
    // E.g., http://localhost:11434/api/generate -> http://localhost:11434
    try {
      const url = new URL(this.endpoint);
      return `${url.protocol}//${url.host}`;
    } catch (error) {
      // If the endpoint isn't a valid URL, use the default
      return 'http://localhost:11434';
    }
  }

  protected handleProviderError(error: unknown): Error {
    if (error instanceof AxiosError) {
      if (error.code === 'ECONNREFUSED') {
        const errorMessage = ERROR_MESSAGES.OLLAMA_CONNECTION;
        // Show notification with action to install
        vscode.window.showErrorMessage(
          'Ollama is not running or not accessible. Make sure Ollama is installed and running.',
          'Check Ollama'
        ).then(selection => {
          if (selection === 'Check Ollama') {
            vscode.env.openExternal(vscode.Uri.parse('https://ollama.com/download'));
          }
        });
        return new Error(errorMessage);
      }
      
      if (error.response) {
        // Handle 404 errors for model not found
        if (error.response.status === 404) {
          const modelName = this.model;
          // Show notification with action to install the missing model
          vscode.window.showErrorMessage(
            `Model "${modelName}" not found in Ollama.`,
            'Install Model'
          ).then(selection => {
            if (selection === 'Install Model') {
              vscode.commands.executeCommand('logcai.installOllamaModel');
            }
          });
          return new Error(`Ollama model "${modelName}" not found. You need to install the model first.`);
        }
        return new Error(`Ollama operation failed: ${error.response.data?.error || error.message}`);
      }
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error(`Ollama error: ${errorMessage}`);
    return new Error(`Ollama operation failed: ${errorMessage}`);
  }

  dispose(): void {
    // Close the terminal if we created one
    if (this.ollamaTerminal) {
      this.ollamaTerminal.dispose();
      this.ollamaTerminal = null;
    }
  }
}