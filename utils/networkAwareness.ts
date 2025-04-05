// src/utils/networkAwareness.ts
import logger from './logger';
import * as vscode from 'vscode';

/**
 * Network status types
 */
export enum NetworkStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  UNRELIABLE = 'unreliable',  // Connection is spotty or high-latency
  UNKNOWN = 'unknown'
}

/**
 * Configuration options for network awareness
 */
interface NetworkAwarenessOptions {
  checkInterval?: number;        // How often to check connectivity (ms)
  timeout?: number;              // Timeout for connectivity checks (ms)
  endpointUrl?: string;          // URL to ping for connectivity checks
  reliabilityThreshold?: number; // How many successful checks needed to consider reliable
  unreliableThreshold?: number;  // How many failed checks to consider unreliable
  notifyStatusChange?: boolean;  // Whether to show notifications on status changes
}

/**
 * Default options
 */
const defaultOptions: NetworkAwarenessOptions = {
  checkInterval: 3 * 60 * 1000,  // 3 minutes
  timeout: 5000,                 // 5 seconds
  endpointUrl: 'https://www.gstatic.com/generate_204', // Google's connectivity check URL
  reliabilityThreshold: 2,       // 2 consecutive successful checks to be considered online
  unreliableThreshold: 2,        // 2 consecutive failed checks to be considered unreliable
  notifyStatusChange: true       // Show notifications on status change
};

/**
 * Manages network connectivity awareness
 */
export class NetworkAwareness {
  private static instance: NetworkAwareness;
  private options: NetworkAwarenessOptions;
  private status: NetworkStatus = NetworkStatus.UNKNOWN;
  private checkTimer: NodeJS.Timeout | null = null;
  private consecutiveSuccesses: number = 0;
  private consecutiveFailures: number = 0;
  private lastCheckTime: number = 0;
  private statusChangeListeners: ((status: NetworkStatus) => void)[] = [];
  private offlineSince: number | null = null;
  private lastNotificationTime: number = 0;
  
  // Private constructor for singleton pattern
  private constructor(options: NetworkAwarenessOptions = {}) {
    this.options = { ...defaultOptions, ...options };
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(options?: NetworkAwarenessOptions): NetworkAwareness {
    if (!NetworkAwareness.instance) {
      NetworkAwareness.instance = new NetworkAwareness(options);
    } else if (options) {
      // Update options if provided
      NetworkAwareness.instance.options = {
        ...NetworkAwareness.instance.options,
        ...options
      };
    }
    
    return NetworkAwareness.instance;
  }
  
  /**
   * Start monitoring network connectivity
   */
  public startMonitoring(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }
    
    // Perform an initial check
    this.checkConnectivity();
    
    // Set up periodic checks
    this.checkTimer = setInterval(() => {
      this.checkConnectivity();
    }, this.options.checkInterval);
    
    logger.info('Network awareness monitoring started');
  }
  
  /**
   * Stop monitoring network connectivity
   */
  public stopMonitoring(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    
    logger.info('Network awareness monitoring stopped');
  }
  
  /**
   * Check network connectivity
   */
  public async checkConnectivity(): Promise<boolean> {
    this.lastCheckTime = Date.now();
    
    try {
      const controller = new AbortController();
      const signal = controller.signal;
      const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);
      
      try {
        const response = await fetch(this.options.endpointUrl!, {
          method: 'HEAD',
          signal,
          cache: 'no-store',
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          this.handleSuccessfulCheck();
          return true;
        } else {
          this.handleFailedCheck(`Status code: ${response.status}`);
          return false;
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        this.handleFailedCheck(err.message || 'Request failed');
        return false;
      }
    } catch (err: any) {
      // This catches errors from the fetch setup itself
      this.handleFailedCheck(`Error setting up connectivity check: ${err.message}`);
      return false;
    }
  }
  
  /**
   * Handle a successful connectivity check
   */
  private handleSuccessfulCheck(): void {
    this.consecutiveSuccesses += 1;
    this.consecutiveFailures = 0;
    
    const previousStatus = this.status;
    
    // If we have enough consecutive successes, we're online
    if (this.consecutiveSuccesses >= this.options.reliabilityThreshold!) {
      this.status = NetworkStatus.ONLINE;
      
      // If we were previously offline, notify about the change
      if (previousStatus === NetworkStatus.OFFLINE || previousStatus === NetworkStatus.UNRELIABLE) {
        this.notifyStatusChange(this.status, previousStatus);
        this.offlineSince = null;
      }
    }
    
    logger.debug(`Network check successful. Status: ${this.status}, consecutive successes: ${this.consecutiveSuccesses}`);
  }
  
  /**
   * Handle a failed connectivity check
   */
  private handleFailedCheck(reason: string): void {
    this.consecutiveFailures += 1;
    this.consecutiveSuccesses = 0;
    
    const previousStatus = this.status;
    
    // If we have enough consecutive failures, we're offline
    if (this.consecutiveFailures >= this.options.unreliableThreshold!) {
      this.status = NetworkStatus.OFFLINE;
      
      // If this is a new offline period, record the start time
      if (previousStatus !== NetworkStatus.OFFLINE && !this.offlineSince) {
        this.offlineSince = Date.now();
      }
      
      // Notify about the change, but only if we're newly offline
      if (previousStatus !== NetworkStatus.OFFLINE) {
        this.notifyStatusChange(this.status, previousStatus);
      }
    } else if (this.status === NetworkStatus.ONLINE) {
      // We have some failures but not enough to be considered offline
      this.status = NetworkStatus.UNRELIABLE;
      this.notifyStatusChange(this.status, previousStatus);
    }
    
    logger.debug(`Network check failed: ${reason}. Status: ${this.status}, consecutive failures: ${this.consecutiveFailures}`);
  }
  
  /**
   * Notify listeners about a status change
   */
  private notifyStatusChange(newStatus: NetworkStatus, oldStatus: NetworkStatus): void {
    // Notify all registered listeners
    for (const listener of this.statusChangeListeners) {
      try {
        listener(newStatus);
      } catch (error) {
        logger.error(`Error in network status change listener: ${error instanceof Error ? error.message : 'Unknown error'}`, 
                    error, 
                    logger.ErrorCategory.NETWORK);
      }
    }
    
    // Dispatch event to WebView if in VSCode extension context
    try {
      // Get the Logcai view provider from the extension context
      const logcaiView = vscode.window.visibleTextEditors.find(
        editor => editor.document.uri.scheme === 'logcai-view'
      );
      
      if (logcaiView) {
        // Send message to webview
        vscode.commands.executeCommand('logcai.notifyNetworkStatus', newStatus);
      }
    } catch (error) {
      // Silently catch - might be running in a context where vscode is not available
    }
    
    // Show VS Code notification if enabled
    if (this.options.notifyStatusChange) {
      // Limit notifications to once per minute
      const now = Date.now();
      if (now - this.lastNotificationTime > 60000) {
        this.lastNotificationTime = now;

        try {
          if (newStatus === NetworkStatus.ONLINE && oldStatus === NetworkStatus.OFFLINE) {
            const offlineDuration = this.offlineSince ? Math.round((now - this.offlineSince) / 60000) : null;
            const durationText = offlineDuration ? ` after ${offlineDuration} minutes` : '';
            vscode.window.showInformationMessage(`Logcai: Network connection restored${durationText}. Cloud features are now available.`);
          } else if (newStatus === NetworkStatus.OFFLINE) {
            vscode.window.showWarningMessage(
              `Logcai: Network connection lost. Some cloud features may be unavailable.`, 
              'Switch to Local Models', 
              'Retry Connection'
            ).then((selection) => {
              if (selection === 'Switch to Local Models') {
                vscode.commands.executeCommand('logcai.switchToLocalModels');
              } else if (selection === 'Retry Connection') {
                this.checkConnectivity();
              }
            });
          } else if (newStatus === NetworkStatus.UNRELIABLE) {
            vscode.window.showWarningMessage(
              `Logcai: Network connection is unreliable. Some requests may fail.`
            );
          }
        } catch (error) {
          // Silently catch - might be running in a context where vscode notifications aren't available
        }
      }
    }
  }
  
  /**
   * Register a listener for status changes
   */
  public onStatusChange(listener: (status: NetworkStatus) => void): () => void {
    this.statusChangeListeners.push(listener);
    
    // Return function to unregister the listener
    return () => {
      this.statusChangeListeners = this.statusChangeListeners.filter(l => l !== listener);
    };
  }
  
  /**
   * Get the current network status
   */
  public getStatus(): NetworkStatus {
    return this.status;
  }
  
  /**
   * Check if currently online
   */
  public isOnline(): boolean {
    return this.status === NetworkStatus.ONLINE;
  }
  
  /**
   * Check if currently offline
   */
  public isOffline(): boolean {
    return this.status === NetworkStatus.OFFLINE;
  }
  
  /**
   * Check if connection is unreliable
   */
  public isUnreliable(): boolean {
    return this.status === NetworkStatus.UNRELIABLE;
  }
  
  /**
   * Get the duration of the current offline period in minutes
   */
  public getOfflineDuration(): number | null {
    if (!this.offlineSince) {return null;}
    
    const durationMs = Date.now() - this.offlineSince;
    return Math.round(durationMs / 60000); // Convert ms to minutes
  }
  
  /**
   * Force a connectivity check and get the result
   */
  public async forceCheck(): Promise<boolean> {
    return await this.checkConnectivity();
  }
}

// Export the singleton instance
export default NetworkAwareness.getInstance();