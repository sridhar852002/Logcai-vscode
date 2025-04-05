// src/utils/logger.ts
import * as vscode from 'vscode';

// Create output channel if not already created
const outputChannel = vscode.window.createOutputChannel("Logcai");

// Error categories for better organization
export enum ErrorCategory {
  NETWORK = 'Network',
  MODEL = 'Model',
  EXTENSION = 'Extension',
  AUTH = 'Authentication',
  OLLAMA = 'Ollama',
  API = 'API',
  CACHE = 'Cache',
  CONTEXT = 'Context',
  PERFORMANCE = 'Performance',
  UNKNOWN = 'Unknown'
}

// Error severity levels
export enum ErrorSeverity {
  INFO = 'Info',      // Non-critical issues that don't impact functionality
  WARNING = 'Warning', // Issues that may impact functionality but don't stop it
  ERROR = 'Error',    // Issues that cause failure of a specific feature
  CRITICAL = 'Critical' // Issues that make the extension unusable
}

function getTimestamp(): string {
  return new Date().toISOString();
}

export function info(message: string) {
  const formatted = `[${getTimestamp()}] INFO: ${message}`;
  outputChannel.appendLine(formatted);
  console.log(formatted);
}

export function error(message: string, err?: any, category: ErrorCategory = ErrorCategory.UNKNOWN, severity: ErrorSeverity = ErrorSeverity.ERROR) {
  const formatted = `[${getTimestamp()}] ${severity} [${category}]: ${message}`;
  outputChannel.appendLine(formatted);
  
  // Add more detailed error information
  if (err) {
    // Extract full stack trace and details
    const details = err.stack || JSON.stringify(err);
    outputChannel.appendLine(`Details: ${details}`);
    
    // Add request info if available
    if (err.config?.url) {
      outputChannel.appendLine(`Request URL: ${err.config.url}`);
      outputChannel.appendLine(`Request Method: ${err.config.method}`);
    }
    
    // Add status code if available
    if (err.status || err.statusCode) {
      outputChannel.appendLine(`Status Code: ${err.status || err.statusCode}`);
    }
    
    // Add response data if available for API errors
    if (err.response?.data) {
      try {
        outputChannel.appendLine(`Response: ${JSON.stringify(err.response.data)}`);
      } catch (e) {
        outputChannel.appendLine(`Response: ${err.response.data}`);
      }
    }
  }
  
  console.error(formatted, err);
}

export function debug(message: string, ...args: any[]) {
  const formatted = `[${getTimestamp()}] DEBUG: ${message}`;
  outputChannel.appendLine(formatted);
  console.debug(formatted, ...args);
}

export function warn(message: string, err?: any, category: ErrorCategory = ErrorCategory.UNKNOWN) {
  const formatted = `[${getTimestamp()}] WARNING [${category}]: ${message}`;
  outputChannel.appendLine(formatted);
  
  if (err) {
    const details = err.stack || JSON.stringify(err);
    outputChannel.appendLine(`Details: ${details}`);
  }
  
  console.warn(formatted, err);
}

export function performance(operation: string, durationMs: number, details?: any) {
  // Log performance metrics in a structured way
  const formatted = `[${getTimestamp()}] PERF: ${operation} - ${durationMs}ms`;
  outputChannel.appendLine(formatted);
  
  if (details) {
    outputChannel.appendLine(`  Details: ${JSON.stringify(details)}`);
  }
  
  // If an operation takes too long, log a warning
  if (durationMs > 1000) {
    warn(`Slow operation: ${operation} took ${durationMs}ms`, null, ErrorCategory.PERFORMANCE);
  }
  
  console.debug(formatted, details);
}

// Helper to categorize common errors
export function categorizeError(err: any): { category: ErrorCategory, severity: ErrorSeverity } {
  if (!err) {return { category: ErrorCategory.UNKNOWN, severity: ErrorSeverity.INFO };}
  
  const msg = err.message?.toLowerCase() || '';
  const code = err.code?.toLowerCase() || '';
  const stack = err.stack?.toLowerCase() || '';
  
  // Network errors
  if (
    msg.includes('network') || 
    msg.includes('econnrefused') || 
    msg.includes('timeout') ||
    msg.includes('fetch failed') ||
    code.includes('enotfound') ||
    code.includes('etimedout') ||
    msg.includes('offline')
  ) {
    return { 
      category: ErrorCategory.NETWORK, 
      severity: ErrorSeverity.WARNING // Usually recoverable
    };
  }
  
  // Ollama errors
  if (
    msg.includes('ollama') || 
    msg.includes('model not found') ||
    msg.includes('localhost:11434')
  ) {
    return { 
      category: ErrorCategory.OLLAMA, 
      severity: ErrorSeverity.ERROR 
    };
  }
  
  // Authentication errors
  if (
    msg.includes('authentication') || 
    msg.includes('auth') || 
    msg.includes('api key') ||
    msg.includes('unauthorized') ||
    code.includes('401')
  ) {
    return { 
      category: ErrorCategory.AUTH, 
      severity: ErrorSeverity.ERROR
    };
  }
  
  // API errors
  if (
    msg.includes('api') || 
    msg.includes('status code') ||
    (err.status >= 400 && err.status < 600)
  ) {
    // Critical for 500 server errors, Error for 400 client errors
    const severity = (err.status >= 500) ? ErrorSeverity.CRITICAL : ErrorSeverity.ERROR;
    return { 
      category: ErrorCategory.API, 
      severity
    };
  }
  
  // Model errors
  if (
    msg.includes('model') ||
    msg.includes('token limit') ||
    msg.includes('parameter') ||
    msg.includes('generation failed')
  ) {
    return {
      category: ErrorCategory.MODEL,
      severity: ErrorSeverity.ERROR
    };
  }
  
  // Cache errors
  if (
    msg.includes('cache') ||
    msg.includes('storage')
  ) {
    return {
      category: ErrorCategory.CACHE,
      severity: ErrorSeverity.WARNING
    };
  }
  
  // Context errors
  if (
    msg.includes('context') ||
    msg.includes('token limit exceeded') ||
    msg.includes('too long')
  ) {
    return {
      category: ErrorCategory.CONTEXT,
      severity: ErrorSeverity.WARNING
    };
  }
  
  return { category: ErrorCategory.UNKNOWN, severity: ErrorSeverity.ERROR };
}

// Display a user-friendly error notification with appropriate actions
export function notifyError(message: string, err?: any, category?: ErrorCategory, severity?: ErrorSeverity) {
  // Categorize error if not provided
  const errorInfo = err ? categorizeError(err) : { 
    category: category || ErrorCategory.UNKNOWN, 
    severity: severity || ErrorSeverity.ERROR 
  };

  // Format user-friendly message
  const userMessage = `Logcai [${errorInfo.category}]: ${message}`;
  
  // Choose notification type based on severity
  switch (errorInfo.severity) {
    case ErrorSeverity.CRITICAL:
      vscode.window.showErrorMessage(userMessage, 'View Logs', 'Report Issue').then(selection => {
        if (selection === 'View Logs') {
          outputChannel.show();
        } else if (selection === 'Report Issue') {
          vscode.env.openExternal(vscode.Uri.parse('https://github.com/your-repo/logcai/issues/new'));
        }
      });
      break;
    
    case ErrorSeverity.ERROR:
      vscode.window.showErrorMessage(userMessage, 'View Logs').then(selection => {
        if (selection === 'View Logs') {
          outputChannel.show();
        }
      });
      break;
    
    case ErrorSeverity.WARNING:
      vscode.window.showWarningMessage(userMessage);
      break;
    
    case ErrorSeverity.INFO:
      vscode.window.showInformationMessage(userMessage);
      break;
  }
  
  // Log to our structured logger
  error(message, err, errorInfo.category, errorInfo.severity);
}

// Record the start time of an operation for performance measurement
export function startMeasure(label: string): () => void {
  const startTime = Date.now();
  return () => {
    const duration = Date.now() - startTime;
    performance(label, duration);
  };
}

export default { 
  info, 
  error, 
  debug, 
  warn,
  performance,
  notifyError, 
  categorizeError, 
  startMeasure,
  ErrorCategory,
  ErrorSeverity
};