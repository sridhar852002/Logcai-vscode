// src/services/ApiKeyManager.ts
import firebase from '../auth/firebaseConfig';
import webviewLogger from '../utils/webviewLogger';

export type ApiProvider = 'openai' | 'anthropic' | 'custom';

interface ApiKeyInfo {
  key: string;
  provider: ApiProvider;
  createdAt: Date;
  lastUsed?: Date;
}

/**
 * Manages API keys for cloud providers
 */
export class ApiKeyManager {
  private static instance: ApiKeyManager;
  private apiKeys: Record<string, string> = {};
  private userId: string | null = null;
  private logger = webviewLogger; // Use webview-compatible logger

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): ApiKeyManager {
    if (!ApiKeyManager.instance) {
      ApiKeyManager.instance = new ApiKeyManager();
    }
    return ApiKeyManager.instance;
  }

  /**
   * Initialize with user ID
   */
  public initialize(userId: string | null): void {
    this.userId = userId;
    if (userId) {
      this.loadKeys();
    } else {
      this.apiKeys = {};
      // Update global state
      if (typeof window !== 'undefined') {
        window.userApiKeys = {};
      }
    }
  }

  /**
   * Load API keys from Firestore
   */
  private async loadKeys(): Promise<void> {
    if (!this.userId) {return;}

    try {
      const snapshot = await firebase
        .firestore()
        .collection('users')
        .doc(this.userId)
        .collection('apiKeys')
        .get();

      const keys: Record<string, string> = {};
      
      snapshot.forEach(doc => {
        const data = doc.data() as ApiKeyInfo;
        keys[data.provider] = data.key;
      });

      this.apiKeys = keys;

      // Update global state
      if (typeof window !== 'undefined') {
        window.userApiKeys = { ...keys };
      }

      this.logger.debug('API keys loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load API keys:', error);
    }
  }

  /**
   * Save API key to Firestore
   */
  public async saveKey(provider: ApiProvider, key: string): Promise<boolean> {
    if (!this.userId) {
      return false;
    }

    try {
      // Validate the key format
      if (!this.validateKeyFormat(provider, key)) {
        throw new Error(`Invalid ${provider} API key format`);
      }

      // Store in Firestore
      await firebase
        .firestore()
        .collection('users')
        .doc(this.userId)
        .collection('apiKeys')
        .doc(provider)
        .set({
          key,
          provider,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });

      // Update local cache
      this.apiKeys[provider] = key;
      
      // Update global state
      if (typeof window !== 'undefined') {
        window.userApiKeys = { ...this.apiKeys };
      }

      return true;
    } catch (error) {
      this.logger.error(`Failed to save ${provider} API key:`, error);
      return false;
    }
  }

  /**
   * Delete API key
   */
  public async deleteKey(provider: ApiProvider): Promise<boolean> {
    if (!this.userId) {
      return false;
    }

    try {
      await firebase
        .firestore()
        .collection('users')
        .doc(this.userId)
        .collection('apiKeys')
        .doc(provider)
        .delete();

      // Update local cache
      delete this.apiKeys[provider];
      
      // Update global state
      if (typeof window !== 'undefined') {
        if (window.userApiKeys) {
          delete window.userApiKeys[provider];
        }
      }

      return true;
    } catch (error) {
      this.logger.error(`Failed to delete ${provider} API key:`, error);
      return false;
    }
  }

  /**
   * Get API key for provider
   */
  public getKey(provider: ApiProvider): string | undefined {
    return this.apiKeys[provider];
  }

  /**
   * Check if key exists
   */
  public hasKey(provider: ApiProvider): boolean {
    return !!this.apiKeys[provider];
  }

  /**
   * Update "last used" timestamp
   */
  public async updateLastUsed(provider: ApiProvider): Promise<void> {
    if (!this.userId || !this.apiKeys[provider]) {
      return;
    }

    try {
      await firebase
        .firestore()
        .collection('users')
        .doc(this.userId)
        .collection('apiKeys')
        .doc(provider)
        .update({
          lastUsed: firebase.firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
      // Non-critical operation, just log the error
      this.logger.debug(`Failed to update last used timestamp for ${provider}:`, error);
    }
  }

  /**
   * Validate key format
   */
  private validateKeyFormat(provider: ApiProvider, key: string): boolean {
    if (!key || typeof key !== 'string') {
      return false;
    }

    // Basic validation based on provider
    switch (provider) {
      case 'openai':
        return key.startsWith('sk-') && key.length > 20;
      case 'anthropic':
        return key.length > 20;
      case 'custom':
        return key.length > 0;
      default:
        return true;
    }
  }

  /**
   * Get all providers with keys
   */
  public getProvidersWithKeys(): ApiProvider[] {
    return Object.keys(this.apiKeys) as ApiProvider[];
  }
}

export default ApiKeyManager.getInstance();