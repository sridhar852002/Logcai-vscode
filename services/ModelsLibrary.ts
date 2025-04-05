// src/services/ModelsLibrary.ts
import vscode from '../utils/vscode';
import webviewLogger from '../utils/webviewLogger';

export interface OllamaModelInfo {
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
 * Service to fetch and manage information about available Ollama models
 */
export class ModelsLibrary {
    private static models: OllamaModelInfo[] = [];
    private static isLoading: boolean = false;
    private static lastFetchTime: number = 0;
    private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours cache
    
    /**
     * Initialize the models library
     */
    static initialize() {
        // Load models from local storage if available
        try {
            const storedModels = localStorage.getItem('logcai.modelsLibrary');
            const storedTimestamp = localStorage.getItem('logcai.modelsLibraryTimestamp');
            
            if (storedModels && storedTimestamp) {
                this.models = JSON.parse(storedModels);
                this.lastFetchTime = parseInt(storedTimestamp, 10);
                
                // If cache is stale, fetch latest in background
                if (Date.now() - this.lastFetchTime > this.CACHE_DURATION) {
                    this.fetchAllModels();
                }
            } else {
                // No cache, fetch models
                this.fetchAllModels();
            }
        } catch (error) {
            webviewLogger.error('Failed to load models library from storage:', error);
            this.fetchAllModels();
        }
    }
    
    /**
     * Get all available models
     */
    static async getAllModels(): Promise<OllamaModelInfo[]> {
        // If models are already loaded, return them
        if (this.models.length > 0) {
            return this.models;
        }
        
        // If not currently loading, start loading
        if (!this.isLoading) {
            await this.fetchAllModels();
        }
        
        // Return current models (may be empty if still loading)
        return this.models;
    }
    
    /**
     * Fetch all available models from extension
     */
    static async fetchAllModels(): Promise<void> {
        if (this.isLoading) {
            return;
        }
        
        this.isLoading = true;
        
        try {
            // Request models from extension
            vscode.postMessage({
                command: 'fetchModelsLibrary'
            });
            
            // The response will be handled by the message event listener in useModelPanel
        } catch (error) {
            webviewLogger.error('Failed to fetch models library:', error);
        } finally {
            this.isLoading = false;
        }
    }
    
    /**
     * Update models from extension response
     */
    static updateModels(models: OllamaModelInfo[]) {
        this.models = models;
        this.lastFetchTime = Date.now();
        
        // Save to localStorage for caching
        try {
            localStorage.setItem('logcai.modelsLibrary', JSON.stringify(this.models));
            localStorage.setItem('logcai.modelsLibraryTimestamp', this.lastFetchTime.toString());
        } catch (error) {
            webviewLogger.error('Failed to save models library to storage:', error);
        }
    }
    
    /**
     * Search for models by name or description
     */
    static searchModels(query: string): OllamaModelInfo[] {
        const lowerQuery = query.toLowerCase();
        return this.models.filter(model => 
            model.name.toLowerCase().includes(lowerQuery) || 
            model.description.toLowerCase().includes(lowerQuery)
        );
    }
    
    /**
     * Get a model by ID
     */
    static getModelById(id: string): OllamaModelInfo | undefined {
        return this.models.find(model => model.id === id);
    }
}

// Initialize the library when the module is loaded
ModelsLibrary.initialize();

export default ModelsLibrary;