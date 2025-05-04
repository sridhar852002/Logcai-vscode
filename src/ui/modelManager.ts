import * as vscode from 'vscode';
import { ModelManager } from '../models/modelManager';
import { ConfigurationManager } from '../config/configuration';
import { log } from '../utils/logging';

/**
 * Manages the UI for model installation and selection
 */
export class ModelManagerUI {
  constructor(
    private readonly modelManager: ModelManager,
    private readonly configManager: ConfigurationManager
  ) {}

  /**
   * Show a quick pick to select model provider
   */
  async selectModelProvider(): Promise<void> {
    const providers = [
      { label: 'Ollama', description: 'Local LLM provider', id: 'ollama' },
      { label: 'OpenAI', description: 'Cloud-based AI models', id: 'openai' },
      { label: 'Anthropic', description: 'Claude AI models', id: 'anthropic' }
    ];

    const selected = await vscode.window.showQuickPick(providers, {
      placeHolder: 'Select a model provider',
      title: 'LogCAI: Select Model Provider'
    });

    if (selected) {
      await this.configManager.updateSetting('modelProvider', selected.id);
      await this.modelManager.refreshConfiguration();
      vscode.window.showInformationMessage(`LogCAI: Switched to ${selected.label} provider`);
      
      // If Ollama is selected, offer to install a model
      if (selected.id === 'ollama') {
        this.promptInstallOllamaModel();
      }
    }
  }

  /**
   * Show UI to select an Ollama model
   */
  async selectOllamaModel(): Promise<void> {
    try {
      const availableModels = await this.modelManager.getAvailableOllamaModels();
      
      if (!availableModels || availableModels.length === 0) {
        const installNew = await vscode.window.showInformationMessage(
          'No Ollama models found. Would you like to install one?',
          'Install Model',
          'Cancel'
        );
        
        if (installNew === 'Install Model') {
          this.promptInstallOllamaModel();
        }
        return;
      }
      
      const modelItems = availableModels.map(model => ({
        label: model.name,
        description: `Size: ${model.size}`,
        detail: model.modifiedAt ? `Last modified: ${new Date(model.modifiedAt).toLocaleString()}` : undefined
      }));
      
      const selected = await vscode.window.showQuickPick(modelItems, {
        placeHolder: 'Select an Ollama model',
        title: 'LogCAI: Select Ollama Model'
      });
      
      if (selected) {
        await this.configManager.updateSetting('ollamaModel', selected.label);
        await this.modelManager.refreshConfiguration();
        vscode.window.showInformationMessage(`LogCAI: Switched to ${selected.label} model`);
      }
    } catch (error) {
      log.error(`Failed to list Ollama models: ${error}`);
      vscode.window.showErrorMessage(`LogCAI: Failed to list Ollama models. Make sure Ollama is running.`);
    }
  }

  /**
   * Prompt user to install a new Ollama model
   */
  async promptInstallOllamaModel(): Promise<void> {
    const popularModels = [
      { label: 'stable-code', description: 'StableCode 3B - Compact code model (recommended)' },
      { label: 'codellama:7b', description: 'CodeLlama 7B - Good balance of performance and size' },
      { label: 'codellama:13b', description: 'CodeLlama 13B - Better quality, requires more RAM' },
      { label: 'llama3:8b', description: 'Llama 3 8B - General purpose model with coding abilities' },
      { label: 'deepseek-coder:6.7b', description: 'DeepSeek Coder 6.7B - Specialized code model' },
      { label: 'wizardcoder:7b', description: 'WizardCoder 7B - Optimized for coding tasks' },
      { label: 'Custom...', description: 'Enter a custom model tag' }
    ];
    
    const selected = await vscode.window.showQuickPick(popularModels, {
      placeHolder: 'Select a model to install',
      title: 'LogCAI: Install Ollama Model'
    });
    
    if (!selected) {
      return;
    }
    
    let modelName = selected.label;
    
    if (modelName === 'Custom...') {
      modelName = await vscode.window.showInputBox({
        prompt: 'Enter the Ollama model name/tag to install',
        placeHolder: 'e.g., codellama:7b-instruct',
        title: 'LogCAI: Install Custom Ollama Model'
      }) || '';
      
      if (!modelName) {
        return;
      }
    }
    
    this.installOllamaModel(modelName);
  }

  /**
   * Install an Ollama model with progress indicator
   */
  private async installOllamaModel(modelName: string): Promise<void> {
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `LogCAI: Installing ${modelName}`,
        cancellable: true
      },
      async (progress, token) => {
        try {
          progress.report({ message: 'Starting download...' });
          
          await this.modelManager.installOllamaModel(
            modelName,
            (status) => {
              progress.report({ message: status });
            },
            token
          );
          
          progress.report({ message: 'Model installed successfully' });
          
          // Set as current model
          await this.configManager.updateSetting('ollamaModel', modelName);
          await this.modelManager.refreshConfiguration();
          
          vscode.window.showInformationMessage(`LogCAI: Successfully installed ${modelName}`);
        } catch (error) {
          if (token.isCancellationRequested) {
            vscode.window.showInformationMessage(`LogCAI: Model installation cancelled`);
          } else {
            const errorMsg = error instanceof Error ? error.message : String(error);
            log.error(`Failed to install Ollama model: ${errorMsg}`);
            vscode.window.showErrorMessage(`LogCAI: Failed to install model. ${errorMsg}`);
          }
        }
      }
    );
  }
} 