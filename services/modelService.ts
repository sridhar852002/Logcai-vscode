// src/services/modelService.ts
import vscode from '../utils/vscode';
import { isPlanAtLeast } from '../monetization/planManager';
import { modelRegistry } from '../ai/modelRegistry';
import webviewLogger from '../utils/webviewLogger';

type UserPlan = 'Free' | 'LocalPro' | 'CloudPro';
type AIMode = 'local' | 'cloud';

interface ModelInfo {
    id: string;
    name: string;
    provider: 'OpenAI' | 'Anthropic' | 'Ollama';
    planRequired: UserPlan;
    mode: AIMode;
    streaming: boolean;
    canAccess: (userPlan: UserPlan) => boolean;
}

// Local storage key for active models
const ACTIVE_MODELS_KEY = 'logcai.activeModels';

/**
 * Service for managing AI models
 */
export class ModelService {
    private static activeModels: string[] = [];

    /**
     * Initialize the model service
     */
    static initialize() {
        // Load active models from storage
        try {
            const storedModels = localStorage.getItem(ACTIVE_MODELS_KEY);
            if (storedModels) {
                this.activeModels = JSON.parse(storedModels);
            }
        } catch (error) {
            webviewLogger.error('Failed to load active models from storage:', error);
            this.activeModels = [];
        }

        // Ensure built-in models are always active
        Object.values(modelRegistry).forEach(model => {
            if (model.mode === 'local' && !this.activeModels.includes(model.id)) {
                this.activeModels.push(model.id);
            }
        });

        // Save the initial state
        this.saveActiveModels();
    }

    /**
     * Check if a model can be used with the current user plan
     */
    static canUseModel(model: ModelInfo, userPlan: UserPlan): boolean {
        return isPlanAtLeast(model.planRequired);
    }

    /**
     * Get available models filtered by mode and plan
     */
    static getAvailableModels(
        mode: AIMode,
        userPlan: UserPlan
    ): ModelInfo[] {
        return Object.values(modelRegistry)
            .filter(model => model.mode === mode)
            .filter(model => this.canUseModel(model, userPlan));
    }

    /**
     * Get all available models
     */
    static getAllModels(): Record<string, ModelInfo> {
        return modelRegistry;
    }

    /**
     * Get all active local models (built-in + installed)
     */
    static getActiveLocalModels(): string[] {
        return this.activeModels;
    }

    /**
     * Check if a model is active
     */
    static isModelActive(modelId: string): boolean {
        return this.activeModels.includes(modelId);
    }

/**
 * Add a model to the active list
 */
static addModelToActive(modelId: string): void {
    console.log(`Adding model to active list: ${modelId}`);
    
    if (!this.activeModels.includes(modelId)) {
      this.activeModels.push(modelId);
      this.saveActiveModels();
      
      // Notify extension to update model list
      try {
        vscode.postMessage({
          command: 'modelActivationChanged',
          activeModels: this.activeModels
        });
        console.log(`Sent activeModels update: ${this.activeModels.join(', ')}`);
      } catch (error) {
        console.error("Failed to send model activation update:", error);
      }
    }
  }

    /**
     * Remove a model from the active list
     */
    static removeModelFromActive(modelId: string): boolean {
        // Don't allow removing built-in models
        if (modelRegistry[modelId]) {
            return false;
        }

        const index = this.activeModels.indexOf(modelId);
        if (index !== -1) {
            this.activeModels.splice(index, 1);
            this.saveActiveModels();
            
            // Notify extension to update model list
            vscode.postMessage({
                command: 'modelActivationChanged',
                activeModels: this.activeModels
            });
            
            return true;
        }
        return false;
    }

    /**
     * Save active models to storage
     */
    private static saveActiveModels(): void {
        try {
            localStorage.setItem(ACTIVE_MODELS_KEY, JSON.stringify(this.activeModels));
        } catch (error) {
            webviewLogger.error('Failed to save active models to storage:', error);
        }
    }

    /**
     * Request model installation
     */
    static installModel(modelId: string): void {
        vscode.postMessage({
            command: 'installModel',
            modelId
        });
    }

    /**
     * Request model uninstallation
     */
    static uninstallModel(modelId: string): void {
        vscode.postMessage({
            command: 'uninstallModel',
            modelId
        });
        
        // Also remove from active models if it was active
        this.removeModelFromActive(modelId);
    }

    /**
     * Request list of installed models
     */
    static requestInstalledModels(): void {
        vscode.postMessage({
            command: 'listLocalModels'
        });
    }

    /**
     * Get installed models status
     */
    static getInstalledModelsStatus(): void {
        vscode.postMessage({
            command: 'getInstalledModels'
        });
    }

    /**
     * Get model information by ID
     */
    static getModelById(modelId: string): ModelInfo | undefined {
        return modelRegistry[modelId];
    }
}

// Initialize on module load
ModelService.initialize();