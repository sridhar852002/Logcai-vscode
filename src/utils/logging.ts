import * as vscode from 'vscode';

// Log levels
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

// Define log output channel
let outputChannel: vscode.OutputChannel | undefined;
let currentLogLevel: LogLevel = LogLevel.INFO;

/**
 * Initialize the logging system
 */
export function initializeLogging(level: LogLevel = LogLevel.INFO): void {
  outputChannel = vscode.window.createOutputChannel('LogCAI');
  currentLogLevel = level;
}

/**
 * Set the log level
 */
export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

/**
 * Get the log level from a string representation
 */
export function getLogLevelFromString(level: string): LogLevel {
  switch (level.toLowerCase()) {
    case 'error':
      return LogLevel.ERROR;
    case 'warn':
    case 'warning':
      return LogLevel.WARN;
    case 'info':
      return LogLevel.INFO;
    case 'debug':
      return LogLevel.DEBUG;
    default:
      return LogLevel.INFO;
  }
}

/**
 * Format the current timestamp
 */
function getTimestamp(): string {
  const now = new Date();
  return now.toISOString();
}

/**
 * Format a log message
 */
function formatLogMessage(level: string, message: string): string {
  return `[${getTimestamp()}] [${level}] ${message}`;
}

/**
 * Write a message to the log
 */
function logMessage(level: LogLevel, levelName: string, message: string, error?: unknown): void {
  if (!outputChannel) {
    initializeLogging();
  }
  
  if (level <= currentLogLevel) {
    const formattedMessage = formatLogMessage(levelName, message);
    outputChannel!.appendLine(formattedMessage);
    
    if (error) {
      if (error instanceof Error) {
        outputChannel!.appendLine(`Error Details: ${error.stack || error.message}`);
      } else {
        outputChannel!.appendLine(`Error Details: ${String(error)}`);
      }
    }
  }
}

// Log object for convenient access
export const log = {
  error: (message: string, error?: unknown) => 
    logMessage(LogLevel.ERROR, 'ERROR', message, error),
  
  warn: (message: string, error?: unknown) => 
    logMessage(LogLevel.WARN, 'WARN', message, error),
  
  info: (message: string) => 
    logMessage(LogLevel.INFO, 'INFO', message),
  
  debug: (message: string) => 
    logMessage(LogLevel.DEBUG, 'DEBUG', message),
  
  // Show the log in the output channel
  show: () => {
    if (!outputChannel) {
      initializeLogging();
    }
    outputChannel!.show();
  }
};