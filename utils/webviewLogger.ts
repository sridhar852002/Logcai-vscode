// src/utils/webviewLogger.ts
// A browser-compatible version of the logger for use in webviews

/**
 * Simple logger for webview use
 * Does not depend on vscode API
 */
export function getTimestamp(): string {
    return new Date().toISOString();
  }
  
  export function info(message: string) {
    const formatted = `[${getTimestamp()}] INFO: ${message}`;
    console.log(formatted);
  }
  
  export function error(message: string, err?: any) {
    const formatted = `[${getTimestamp()}] ERROR: ${message}`;
    console.error(formatted, err);
  }
  
  export function debug(message: string, ...args: any[]) {
    const formatted = `[${getTimestamp()}] DEBUG: ${message}`;
    console.debug(formatted, ...args);
  }
  
  export default { info, error, debug };