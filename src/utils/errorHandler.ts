import * as vscode from 'vscode';
import { log } from './logging';

/**
 * Centralized error handling for the extension
 * @param error The error to handle
 * @param context Additional context for the error
 */
export function handleError(error: Error, context: string): void {
  // Log the error
  log.error(`${context}: ${error.message}`, error);
  
  // Determine if we should show a notification
  // Don't show for expected errors or cancellations
  if (
    error.message.includes('cancelled') ||
    error.message.includes('canceled') ||
    error.message.includes('ERR_CANCELED')
  ) {
    log.debug('Operation was cancelled, not showing error notification');
    return;
  }
  
  // Show error notification
  vscode.window.showErrorMessage(`LogCAI: ${context}. ${error.message}`);
}

/**
 * Create an error with a user-friendly message
 * @param message The error message
 * @param originalError The original error, if available
 */
export function createUserError(message: string, originalError?: unknown): Error {
  const error = new Error(message);
  
  if (originalError) {
    // Add the original error to the stack for debugging
    error.stack = `${error.stack}\nCaused by: ${
      originalError instanceof Error 
        ? originalError.stack 
        : String(originalError)
    }`;
  }
  
  return error;
}