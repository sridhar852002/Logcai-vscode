import * as vscode from 'vscode';
import { ModelProvider, ModelRequestOptions } from '../interfaces';
import { log } from '../../utils/logging';

export abstract class BaseModelProvider implements ModelProvider {
  abstract readonly id: string;
  abstract readonly name: string;
  
  protected constructor() {
    // Cannot access abstract properties in constructor
    log.info(`Initializing model provider`);
  }
  
  /**
   * Check if the model provider is available
   */
  abstract isAvailable(): Promise<boolean>;
  
  /**
   * Get a completion from the model
   * @param prompt The prompt to send to the model
   * @param options Optional request configuration
   */
  abstract getCompletion(prompt: string, options?: ModelRequestOptions): Promise<string>;
  
  /**
   * Stream a completion from the model
   * @param prompt The prompt to send to the model
   * @param callback Function to call with each chunk of the response
   * @param token Cancellation token to abort the request
   * @param options Optional request configuration
   */
  abstract streamCompletion(
    prompt: string, 
    callback: (text: string, final: boolean) => void, 
    token?: vscode.CancellationToken,
    options?: ModelRequestOptions
  ): Promise<void>;
  
  /**
   * Show progress indicator for model requests
   * @param title Progress indicator title
   * @param task Async task to run with progress
   * @param token Optional cancellation token
   */
  protected async withProgress<T>(
    title: string, 
    task: (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => Promise<T>,
    token?: vscode.CancellationToken
  ): Promise<T> {
    try {
      return await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `LogCAI: ${title}`,
          cancellable: true
        },
        async (progress, progressToken) => {
          // Create combined token if provided
          const tokenSource = new vscode.CancellationTokenSource();
          if (token) {
            // Dispose when either token is canceled
            token.onCancellationRequested(() => tokenSource.cancel());
          }
          progressToken.onCancellationRequested(() => tokenSource.cancel());
          const combinedToken = tokenSource.token;
          
          return await task(progress, combinedToken);
        }
      );
    } catch (error) {
      // FIX: Handle the error properly without calling problematic function
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error(`Model operation failed: ${errorMsg}`);
      
      // Show error notification if needed
      vscode.window.showErrorMessage(`LogCAI: Model operation failed. ${errorMsg}`);
      
      throw error instanceof Error ? error : new Error(String(error));
    }
  }
  
  /**
   * Process an error from the model provider
   * @param error The error to process
   * @param operation The operation that failed
   */
  protected handleProviderError(error: unknown): Error {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error(`Provider error: ${errorMessage}`);
    
    // Create an error with a user-friendly message
    const userError = new Error(`Operation failed: ${errorMessage}`);
    return userError;
  }
}