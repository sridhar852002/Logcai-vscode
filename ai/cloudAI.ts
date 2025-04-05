// src/ai/cloudAI.ts (Updated with BYOK support)
import ApiKeyManager from '../services/ApiKeyManager';
import webviewLogger from '../utils/webviewLogger';
import { isFeatureAvailable } from '../monetization/planManager';
import logger from '../utils/logger';

/**
 * Enhanced cloud AI service with BYOK support
 */
export async function generateCloudResponse(
  provider: 'OpenAI' | 'Anthropic',
  model: string,
  prompt: string,
  options: {
    stream?: boolean;
    temperature?: number;
    maxTokens?: number;
    apiKey?: string;
  },
  onToken?: (token: string) => void
): Promise<string> {
  // Determine which API key to use
  let apiKey: string | undefined;
  
  // If an API key is explicitly provided, use it
  if (options.apiKey) {
    apiKey = options.apiKey;
  } 
  // Otherwise check if user has BYOK enabled and has their own key
  else if (isFeatureAvailable('CloudAI_BYOK')) {
    const providerKey = provider.toLowerCase() as 'openai' | 'anthropic';
    apiKey = ApiKeyManager.getKey(providerKey);
    
    // Update last used timestamp
    if (apiKey) {
      ApiKeyManager.updateLastUsed(providerKey).catch(err => {
        logger.debug(`Failed to update last used timestamp: ${err}`);
      });
    }
  }
  
  // Fall back to global API keys if set (for CloudPro)
  if (!apiKey && typeof window !== 'undefined' && window.userApiKeys) {
    apiKey = window.userApiKeys[provider.toLowerCase()];
  }
  
  // If no API key is available, throw an error
  if (!apiKey) {
    if (isFeatureAvailable('CloudAI_BYOK')) {
      throw new Error(`No ${provider} API key found. Please add your API key in Settings.`);
    } else {
      throw new Error(`${provider} API key not set. This feature requires CloudPro plan.`);
    }
  }

  // Set up the API endpoint based on provider
  const url =
    provider === 'OpenAI'
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://api.anthropic.com/v1/messages';

  // Set up headers based on provider
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Add authorization header based on provider requirements
  if (provider === 'OpenAI') {
    headers.Authorization = `Bearer ${apiKey}`;
  } else if (provider === 'Anthropic') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
  }

  // Construct request body based on provider API format
  const body =
    provider === 'OpenAI'
      ? {
          model,
          messages: [{ role: 'user', content: prompt }],
          stream: options.stream ?? true,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 1024,
        }
      : {
          model,
          max_tokens: options.maxTokens ?? 1024,
          stream: options.stream ?? true,
          temperature: options.temperature ?? 0.7,
          messages: [{ role: 'user', content: prompt }],
        };

  // Make the API request
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  // Handle error responses
  if (!res.ok) {
    const errorText = await res.text();
    let errorMessage = `Cloud AI Error: ${res.status}`;
    
    try {
      // Try to parse error as JSON for more details
      const errorJson = JSON.parse(errorText);
      if (errorJson.error) {
        errorMessage += ` - ${errorJson.error.message || errorJson.error.type || errorJson.error}`;
      }
    } catch {
      // If not JSON, use the text
      errorMessage += ` - ${errorText}`;
    }
    
    // Log the detailed error
    webviewLogger.error('Cloud AI request failed', { provider, status: res.status, error: errorText });
    
    throw new Error(errorMessage);
  }

  // Handle non-streaming response
  if (!options.stream) {
    const data = await res.json();
    return provider === 'OpenAI'
      ? data.choices[0]?.message?.content ?? ''
      : data.content[0]?.text ?? '';
  }

  // Handle streaming response
  const reader = res.body?.getReader();
  const decoder = new TextDecoder('utf-8');
  let fullText = '';
  
  if (!reader) {
    throw new Error('Stream reader not available');
  }
  
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      
      const chunk = decoder.decode(value);
      const token = extractToken(chunk, provider);
      
      if (token) {
        onToken?.(token);
        fullText += token;
      }
    }
    
    return fullText;
  } catch (error) {
    webviewLogger.error('Error during streaming', error);
    throw error;
  } finally {
    reader.releaseLock();
  }
}

/**
 * Extract text tokens from streaming response based on provider format
 */
function extractToken(chunk: string, provider: 'OpenAI' | 'Anthropic'): string {
  try {
    if (provider === 'OpenAI') {
      const lines = chunk.split('\n').filter(line => line.trim() && line.startsWith('data: '));
      let token = '';
      
      for (const line of lines) {
        // Skip "[DONE]" messages
        if (line === 'data: [DONE]') {continue;}
        
        try {
          const json = JSON.parse(line.replace('data: ', ''));
          token += json.choices?.[0]?.delta?.content || '';
        } catch {
          // Skip invalid JSON
        }
      }
      
      return token;
    } else if (provider === 'Anthropic') {
      // Extract Anthropic content from streaming chunks
      const regex = /"content":\s*"([^"]*)"/g;
      const tokens: string[] = [];
      let match;
      
      while ((match = regex.exec(chunk)) !== null) {
        tokens.push(match[1]);
      }
      
      return tokens.join('');
    }
  } catch (error) {
    webviewLogger.debug('Error extracting token', error);
  }
  
  return '';
}