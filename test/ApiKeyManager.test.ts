// src/test/ApiKeyManager.test.ts
import * as assert from 'assert';
import * as vscode from 'vscode';
import { describe, it, beforeEach, afterEach } from 'mocha';
import ApiKeyManager, { ApiProvider } from '../services/ApiKeyManager';

// Create mock Firebase with stub functions
const mockFirebase = {
  firestore: () => {
    const firestoreObj = {
      collection: () => ({
        doc: () => ({
          collection: () => ({
            doc: () => ({
              set: async () => Promise.resolve(),
              update: async () => Promise.resolve(),
              delete: async () => Promise.resolve(),
              get: async () => Promise.resolve({
                data: () => ({ key: 'test-key', provider: 'openai' })
              })
            }),
            get: async () => Promise.resolve({
              forEach: (callback: Function) => {
                callback({
                  data: () => ({ key: 'test-key', provider: 'openai' })
                });
              }
            })
          })
        })
      })
    };
    
    // Add FieldValue property to the firestoreObj
    Object.defineProperty(firestoreObj, 'FieldValue', {
      value: {
        serverTimestamp: () => 'server-timestamp'
      }
    });
    
    return firestoreObj;
  },
  auth: () => ({})
};

// We'll manually patch ApiKeyManager's dependencies instead
// No mocking library needed

describe('ApiKeyManager', () => {
  beforeEach(() => {
    // Reset window state
    global.window = { userApiKeys: {} } as any;
    
    // Reset ApiKeyManager state
    ApiKeyManager.initialize(null);
  });
  
  afterEach(() => {
    // Clean up
    global.window = {} as any;
  });
  
  it('should initialize with null user ID', () => {
    ApiKeyManager.initialize(null);
    assert.strictEqual((ApiKeyManager as any).userId, null);
    assert.deepStrictEqual((ApiKeyManager as any).apiKeys, {});
  });
  
  it('should initialize with user ID and load keys', async () => {
    // Manually replace the firebase dependency
    const originalFirebase = require('../auth/firebaseConfig').default;
    require('../auth/firebaseConfig').default = mockFirebase;
    
    ApiKeyManager.initialize('test-user');
    
    // Wait for loadKeys to complete
    await new Promise(resolve => setTimeout(resolve, 10));
    
    assert.strictEqual((ApiKeyManager as any).userId, 'test-user');
    assert.deepStrictEqual((ApiKeyManager as any).apiKeys, { openai: 'test-key' });
    assert.deepStrictEqual(global.window.userApiKeys, { openai: 'test-key' });
    
    // Restore original firebase
    require('../auth/firebaseConfig').default = originalFirebase;
  });
  
  it('should save API key', async () => {
    // Manually replace the firebase dependency
    const originalFirebase = require('../auth/firebaseConfig').default;
    require('../auth/firebaseConfig').default = mockFirebase;
    
    // Set user ID
    (ApiKeyManager as any).userId = 'test-user';
    
    const result = await ApiKeyManager.saveKey('openai', 'sk-test1234567890');
    
    assert.strictEqual(result, true);
    assert.strictEqual((ApiKeyManager as any).apiKeys.openai, 'sk-test1234567890');
    assert.strictEqual(global.window.userApiKeys?.openai, 'sk-test1234567890');
    
    // Restore original firebase
    require('../auth/firebaseConfig').default = originalFirebase;
  });
  
  it('should fail to save API key with invalid format', async () => {
    // Manually replace the firebase dependency
    const originalFirebase = require('../auth/firebaseConfig').default;
    require('../auth/firebaseConfig').default = mockFirebase;
    
    // Set user ID
    (ApiKeyManager as any).userId = 'test-user';
    
    // Invalid OpenAI key (doesn't start with sk-)
    const result = await ApiKeyManager.saveKey('openai', 'invalid-key');
    
    assert.strictEqual(result, false);
    
    // Restore original firebase
    require('../auth/firebaseConfig').default = originalFirebase;
  });
  
  it('should delete API key', async () => {
    // Manually replace the firebase dependency
    const originalFirebase = require('../auth/firebaseConfig').default;
    require('../auth/firebaseConfig').default = mockFirebase;
    
    // Set user ID and initialize keys
    (ApiKeyManager as any).userId = 'test-user';
    (ApiKeyManager as any).apiKeys = { openai: 'sk-test1234567890' };
    global.window.userApiKeys = { openai: 'sk-test1234567890' };
    
    const result = await ApiKeyManager.deleteKey('openai');
    
    assert.strictEqual(result, true);
    assert.strictEqual((ApiKeyManager as any).apiKeys.openai, undefined);
    assert.strictEqual(global.window.userApiKeys?.openai, undefined);
    
    // Restore original firebase
    require('../auth/firebaseConfig').default = originalFirebase;
  });
  
  it('should check if key exists', () => {
    // Set keys
    (ApiKeyManager as any).apiKeys = { openai: 'sk-test1234567890' };
    
    assert.strictEqual(ApiKeyManager.hasKey('openai'), true);
    assert.strictEqual(ApiKeyManager.hasKey('anthropic'), false);
  });
  
  it('should get key for provider', () => {
    // Set keys
    (ApiKeyManager as any).apiKeys = { 
      openai: 'sk-test1234567890',
      anthropic: 'sk-ant-test123'
    };
    
    assert.strictEqual(ApiKeyManager.getKey('openai'), 'sk-test1234567890');
    assert.strictEqual(ApiKeyManager.getKey('anthropic'), 'sk-ant-test123');
    assert.strictEqual(ApiKeyManager.getKey('custom'), undefined);
  });
  
  it('should get providers with keys', () => {
    // Set keys
    (ApiKeyManager as any).apiKeys = { 
      openai: 'sk-test1234567890',
      anthropic: 'sk-ant-test123'
    };
    
    const providers = ApiKeyManager.getProvidersWithKeys();
    
    assert.deepStrictEqual(providers, ['openai', 'anthropic']);
  });
  
  it('should update last used timestamp', async () => {
    // Manually replace the firebase dependency
    const originalFirebase = require('../auth/firebaseConfig').default;
    require('../auth/firebaseConfig').default = mockFirebase;
    
    // Set user ID and initialize keys
    (ApiKeyManager as any).userId = 'test-user';
    (ApiKeyManager as any).apiKeys = { openai: 'sk-test1234567890' };
    
    await ApiKeyManager.updateLastUsed('openai');
    
    // Verify the method completes without error
    assert.ok(true);
    
    // Restore original firebase
    require('../auth/firebaseConfig').default = originalFirebase;
  });
});