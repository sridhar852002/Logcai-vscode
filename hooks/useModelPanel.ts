// src/hooks/useModelPanel.ts
import { useState, useEffect, useCallback } from 'react';
import vscode from '../utils/vscode';
import { ModelService } from '../services/modelService';
import webviewLogger from '../utils/webviewLogger';

export interface Model {
  id: string;
  name: string;
  size: string;
  description: string;
  isInstalled: boolean;
  isActive?: boolean;
  isDownloading?: boolean;
  downloadProgress?: number;
}

export function useModelPanel() {
  // Initial model data (will be updated from backend)
  const [models, setModels] = useState<Model[]>([
    {
      id: 'mistral:7b',
      name: 'Mistral 7B',
      size: '4.1 GB',
      description: 'General purpose model with strong performance across various tasks',
      isInstalled: false
    },
    {
      id: 'llama3',
      name: 'Llama 3',
      size: '8.2 GB',
      description: 'Meta\'s latest open model with enhanced coding capabilities',
      isInstalled: false
    },
    {
      id: 'phi3.5',
      name: 'Phi 3.5',
      size: '3.8 GB',
      description: 'Microsoft\'s compact yet powerful model optimized for reasoning',
      isInstalled: false
    },
    {
      id: 'stable-code',
      name: 'Stable Code',
      size: '5.6 GB',
      description: 'Specialized for code generation and completion',
      isInstalled: false
    },
    {
      id: 'smollm2',
      name: 'SmoLLM 2',
      size: '1.2 GB',
      description: 'Ultra-lightweight model for resource-constrained environments',
      isInstalled: false
    }
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installStatus, setInstallStatus] = useState<Record<string, {
    status: 'installing' | 'installed' | 'error';
    progress?: number;
    error?: string;
  }>>({});

  // Set active status on models based on ModelService
  const updateActiveStatus = useCallback((modelsList: Model[]) => {
    return modelsList.map(model => ({
      ...model,
      isActive: ModelService.isModelActive(model.id)
    }));
  }, []);

  // Update model status when receiving updates from the extension
  const updateModelStatus = useCallback((modelId: string, status: string, progress?: number, errorMessage?: string) => {
    webviewLogger.debug(`Updating model status: ${modelId} -> ${status}, progress: ${progress}`);
    
    setModels(prevModels => prevModels.map(model => {
      if (model.id === modelId) {
        if (status === 'downloading' || status === 'installing') {
          return { 
            ...model, 
            isDownloading: true, 
            downloadProgress: progress || 0 
          };
        } else if (status === 'installed') {
          return {
            ...model,
            isInstalled: true,
            isDownloading: false,
            // Auto-add newly installed models to active list
            isActive: true
          };
        } else if (status === 'error') {
          return { 
            ...model, 
            isDownloading: false, 
            error: true 
          };
        }
      }
      return model;
    }));

    // Also update install status for UI
    if (status === 'downloading' || status === 'installing') {
      setInstallStatus(prev => ({
        ...prev,
        [modelId]: {
          status: 'installing',
          progress: progress || 0
        }
      }));
    } else if (status === 'installed') {
      setInstallStatus(prev => ({
        ...prev,
        [modelId]: {
          status: 'installed'
        }
      }));
    } else if (status === 'error') {
      setInstallStatus(prev => ({
        ...prev,
        [modelId]: {
          status: 'error',
          error: errorMessage || 'Installation failed'
        }
      }));
    }
  }, []);

  // Update installed models based on response from extension
  const updateInstalledModels = useCallback((installedModelIds: string[]) => {
    webviewLogger.debug(`Updating installed models: ${installedModelIds.join(', ')}`);
    
    setModels(prevModels => {
      const updatedModels = prevModels.map(model => ({
        ...model,
        isInstalled: installedModelIds.includes(model.id)
      }));
      // Update active status for all models
      return updateActiveStatus(updatedModels);
    });
  }, [updateActiveStatus]);

  // Handle install/uninstall action
  const handleInstall = useCallback((modelId: string) => {
    const model = models.find(m => m.id === modelId);
    
    webviewLogger.info(`Installing model: ${modelId}`);
    setInstallStatus(prev => ({
      ...prev,
      [modelId]: {
        status: 'installing',
        progress: 0
      }
    }));
    
    if (model?.isInstalled) {
      // If already installed, prompt to uninstall
      if (confirm(`Are you sure you want to uninstall ${model.name}?`)) {
        ModelService.uninstallModel(modelId);
        updateModelStatus(modelId, 'uninstalling');
      }
    } else {
      // Otherwise install
      ModelService.installModel(modelId);
      updateModelStatus(modelId, 'installing', 0);
    }
  }, [models, updateModelStatus]);

  // Toggle active status for a model
  const toggleActiveStatus = useCallback((modelId: string) => {
    const model = models.find(m => m.id === modelId);
    if (!model) {return;}
    
    webviewLogger.debug(`Toggling active status for model: ${modelId}`);
    
    if (model.isActive) {
      ModelService.removeModelFromActive(modelId);
    } else {
      ModelService.addModelToActive(modelId);
    }
    
    // Update the models list to reflect new active status
    setModels(prevModels => updateActiveStatus(prevModels));
  }, [models, updateActiveStatus]);

  // Filter models based on search and active tab
  const filteredModels = models.filter(model => {
    const matchesSearch = 
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === 'all') { 
      return matchesSearch; 
    }
    if (activeTab === 'installed') { 
      return matchesSearch && model.isInstalled; 
    }
    return matchesSearch;
  });

  // Refresh models from extension
  const refreshModels = useCallback(() => {
    setLoading(true);
    setError(null);
    
    webviewLogger.info("Requesting local models from extension");
    
    try {
      // Request installed models
      vscode.postMessage({ command: 'getInstalledModels' });
      
      // Also request available local models
      vscode.postMessage({ command: 'listLocalModels' });
    } catch (err: any) {
      webviewLogger.error("Error requesting models:", err);
      setError(err.message || "Failed to request models");
      setLoading(false);
    }
  }, []);

  // Listen for messages from extension
  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      
      if (message.command === 'modelInstallStatus') {
        updateModelStatus(
          message.modelId, 
          message.status, 
          message.progress,
          message.error
        );
        
        // When installation completes, refresh model list
        if (message.status === 'installed') {
          refreshModels();
        }
        
        // If status is error or installed, we're no longer loading
        if (message.status === 'error' || message.status === 'installed') {
          setLoading(false);
        }
      } 
      else if (message.command === 'installedModels') {
        // Update installed status based on extension data
        updateInstalledModels(message.models);
        setLoading(false);
      } 
      else if (message.command === 'localModelsList') {
        webviewLogger.debug(`Received local models list with ${message.models?.length || 0} models`);
        // If we have models, update activeModels and set loading to false
        if (message.models && message.models.length > 0) {
          // Update model activation status based on activeModels
          const activeModels = message.activeModels || [];
          
          // Create model objects for all available models
          const availableModels = message.models.map((modelName: string) => {
            // Try to find existing model with this name
            const existingModel = models.find(m => m.id === modelName);
            
            if (existingModel) {
              return {
                ...existingModel,
                isInstalled: true,
                isActive: activeModels.includes(modelName)
              };
            }
            
            // Create a new model entry
            return {
              id: modelName,
              name: formatModelName(modelName),
              size: 'Unknown',
              description: `Local model: ${modelName}`,
              isInstalled: true,
              isActive: activeModels.includes(modelName)
            };
          });
          
          setModels(availableModels);
        }
        
        setLoading(false);
      }
      else if (message.command === 'modelActivationChanged') {
        // Update model active status
        setModels(prevModels => updateActiveStatus(prevModels));
      }
    };
    
    window.addEventListener('message', messageHandler);
    
    // Initial data load
    refreshModels();
    
    // Set up periodic refresh
    const intervalId = setInterval(refreshModels, 60000); // Refresh every minute
    
    return () => {
      window.removeEventListener('message', messageHandler);
      clearInterval(intervalId);
    };
  }, [updateModelStatus, updateInstalledModels, updateActiveStatus, refreshModels]);

  // Helper function to format model names
  function formatModelName(id: string): string {
    // Handle formats like "llama3:8b" -> "Llama 3 8B"
    const parts = id.split(':');
    let name = parts[0];
    const variant = parts[1] || '';
    
    // Replace hyphens and underscores
    name = name.replace(/[-_]/g, ' ');
    
    // Capitalize words
    name = name.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    // Add variant if present
    if (variant) {
      return `${name} ${variant.toUpperCase()}`;
    }
    
    return name;
  }

  return {
    models,
    filteredModels,
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab,
    loading,
    error,
    installStatus,
    handleInstall,
    toggleActiveStatus,
    refreshModels
  };
}