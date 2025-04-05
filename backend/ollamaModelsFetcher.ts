// src/backend/ollamaModelsFetcher.ts
import axios from 'axios';
import logger from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

interface OllamaModel {
    id: string;
    name: string;
    description: string;
    size: string;
    tags?: string[];
    parameters?: {
        contextLength?: number;
        modelType?: string;
        quantization?: string;
    };
    creator?: string;
    license?: string;
}

/**
 * Fetch all available Ollama models from various sources
 */
export async function fetchOllamaModelsLibrary(): Promise<OllamaModel[]> {
    try {
      // Try to fetch models from the Ollama API first
      const apiModels = await fetchFromOllamaAPI();
      if (apiModels && apiModels.length > 0) {
        logger.info(`Retrieved ${apiModels.length} models from Ollama API`);
        return apiModels;
      }
    } catch (error) {
      logger.error('Failed to fetch models from Ollama API:', error);
    }
    
    try {
      // Fallback to local models.json file
      const localModels = await loadFromLocalFile();
      if (localModels && localModels.length > 0) {
        logger.info(`Loaded ${localModels.length} models from local file`);
        return localModels;
      }
    } catch (error) {
      logger.error('Failed to load models from local file:', error);
    }
    
    // Last resort: Return a hardcoded minimal list
    logger.info('Using hardcoded fallback model list');
    return getHardcodedModels();
  }

/**
 * Fetch models from the Ollama API
 */
async function fetchFromOllamaAPI(): Promise<OllamaModel[]> {
    try {
        // Try to connect to the Ollama API
        const response = await axios.get('http://localhost:11434/api/tags', { timeout: 5000 });
        const data = response.data;
        
        // Transform the API response into our model format
        if (data && data.models) {
            return data.models.map((model: any) => ({
                id: model.name,
                name: formatModelName(model.name),
                description: model.details?.description || `${formatModelName(model.name)} model`,
                size: formatSize(model.size || 0),
                tags: model.tags || [],
                parameters: {
                    contextLength: model.details?.context_length,
                    modelType: model.details?.model_type,
                    quantization: model.details?.quantization,
                },
                creator: model.details?.family || 'Unknown',
                license: model.details?.license || 'Unknown'
            }));
        }
        
        return [];
    } catch (error) {
        // If the API call fails, let the caller handle the error
        throw new Error(`Ollama API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Load models from the local models.json file
 */
async function loadFromLocalFile(): Promise<OllamaModel[]> {
    try {
      // Locate the models.json file in the extension assets
      const extensionPath = vscode.extensions.getExtension('your-extension-id')?.extensionPath;
      if (!extensionPath) {
        throw new Error('Extension path not found');
      }
      
      const filePath = path.join(extensionPath, 'assets', 'models.json');
      
      // Check if the file exists
      try {
        await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
      } catch {
        throw new Error(`Models file not found: ${filePath}`);
      }
      
      // Read and parse the file using async API
      const fileContent = await fs.promises.readFile(filePath, 'utf8');
      const models = JSON.parse(fileContent);
      return models;
    } catch (error) {
      throw new Error(`Local file error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
/**
 * Provide a hardcoded list of common models as a fallback
 */
function getHardcodedModels(): OllamaModel[] {
    return [
        {
            id: 'mistral',
            name: 'Mistral 7B',
            description: 'The Mistral 7B model is a general-purpose model with strong performance on a wide range of tasks',
            size: '4.1 GB',
            tags: ['general', 'instruction'],
            parameters: {
                contextLength: 8192,
                modelType: 'transformer',
                quantization: 'q4_k_m'
            },
            creator: 'Mistral AI',
            license: 'Apache 2.0'
        },
        {
            id: 'llama3',
            name: 'Llama 3',
            description: 'Meta\'s latest open model with enhanced coding capabilities, reasoning and instruction following',
            size: '8.2 GB',
            tags: ['general', 'instruction', 'coding'],
            parameters: {
                contextLength: 8192,
                modelType: 'transformer',
                quantization: 'q4_k_m'
            },
            creator: 'Meta',
            license: 'Llama 3 Community License'
        },
        {
            id: 'phi3',
            name: 'Phi 3',
            description: 'Microsoft\'s compact yet powerful model optimized for reasoning and coding tasks',
            size: '3.8 GB',
            tags: ['general', 'instruction', 'coding'],
            parameters: {
                contextLength: 4096,
                modelType: 'transformer',
                quantization: 'q4_k_m'
            },
            creator: 'Microsoft',
            license: 'Phi License'
        },
        {
            id: 'codellama',
            name: 'Code Llama',
            description: 'Specialized for code generation and completion with support for multiple programming languages',
            size: '7.2 GB',
            tags: ['coding', 'instruction'],
            parameters: {
                contextLength: 16384,
                modelType: 'transformer',
                quantization: 'q4_k_m'
            },
            creator: 'Meta',
            license: 'Llama 2 Community License'
        },
        {
            id: 'gemma',
            name: 'Gemma',
            description: 'Google\'s lightweight and efficient model with strong instruction-following capabilities',
            size: '4.8 GB',
            tags: ['general', 'instruction'],
            parameters: {
                contextLength: 8192,
                modelType: 'transformer',
                quantization: 'q4_k_m'
            },
            creator: 'Google',
            license: 'Gemma License'
        }
    ];
}

/**
 * Format model name to be more readable
 * Convert "llama3:8b" to "Llama 3 8B" for example
 */
function formatModelName(name: string): string {
    // Split on colon to separate model name and size
    const parts = name.split(':');
    let modelName = parts[0];
    let sizePart = parts[1] || '';
    
    // Replace hyphens and underscores with spaces
    modelName = modelName.replace(/[-_]/g, ' ');
    
    // Capitalize words
    modelName = modelName.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    
    // Add formatted size if available
    if (sizePart) {
        // Format size (e.g., "7b" to "7B")
        sizePart = sizePart.replace(/([0-9]+)([a-z]+)/i, '$1' + '$2'.toUpperCase());
        return `${modelName} ${sizePart}`;
    }
    
    return modelName;
}

/**
 * Format file size
 */
function formatSize(bytes: number | string): string {
    if (typeof bytes === 'string') {
        // If already formatted, return as is
        if (bytes.includes('GB') || bytes.includes('MB')) {
            return bytes;
        }
        // Try to parse as number
        bytes = parseInt(bytes, 10);
        if (isNaN(bytes)) {
            return 'Unknown size';
        }
    }
    
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    } else if (bytes < 1024 * 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    } else {
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
}