import * as vscode from 'vscode';
import { ModelManager } from '../models/modelManager';
import { ModelStatus } from '../models/interfaces';
import { COMMANDS } from '../config/constants';
import { log } from '../utils/logging';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private disposables: vscode.Disposable[] = [];

  constructor(private modelManager: ModelManager) {
    // Create status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    
    // Set command to show menu
    this.statusBarItem.command = 'logcai.showModelMenu';
    
    // Register menu command
    const menuCommand = vscode.commands.registerCommand('logcai.showModelMenu', () => {
      this.showMenu();
    });
    
    // Add to our own disposables
    this.disposables.push(menuCommand);
    
    // Initial update
    this.updateStatusBar(modelManager.status);
    this.statusBarItem.show();
    
    // Listen for status changes
    modelManager.onStatusChanged(this.updateStatusBar.bind(this));
    log.info('Status Bar Manager initialized');
  }

  /**
   * Update the status bar with model information
   */
  private updateStatusBar(status: ModelStatus): void {
    const { isAvailable, modelName, providerName } = status;
    
    if (isAvailable) {
      this.statusBarItem.text = `$(check) LogCAI: ${providerName} (${modelName})`;
      this.statusBarItem.tooltip = `${providerName} model "${modelName}" is ready. Click to manage models.`;
      this.statusBarItem.backgroundColor = undefined;
    } else {
      this.statusBarItem.text = `$(warning) LogCAI: Disconnected`;
      this.statusBarItem.tooltip = 'LogCAI model is not available. Click to connect.';
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }
  }

  /**
   * Show model management menu
   */
  private async showMenu(): Promise<void> {
    const status = this.modelManager.status;
    interface MenuItem {
      label: string;
      description: string;
      command: string;
      arguments?: any[];
    }
    
    const items: MenuItem[] = [
      {
        label: '$(chat) Open Chat',
        description: 'Start a conversation with the AI',
        command: COMMANDS.OPEN_CHAT
      },
      {
        label: '$(server) Change Model Provider',
        description: 'Switch between Ollama, OpenAI, or Anthropic',
        command: 'logcai.selectModelProvider'
      }
    ];
    
    // Add provider-specific options
    if (status.providerName === 'Ollama') {
      items.push(
        {
          label: '$(package) Change Ollama Model',
          description: `Current: ${status.modelName}`,
          command: 'logcai.selectOllamaModel'
        },
        {
          label: '$(cloud-download) Install New Ollama Model',
          description: 'Download and install a new model',
          command: 'logcai.installOllamaModel'
        }
      );
    }
    
    // Add settings option
    items.push({
      label: '$(gear) Settings',
      description: 'Configure LogCAI extension',
      command: 'workbench.action.openSettings',
      arguments: ['@ext:logcai']
    });
    
    // Add diagnostics option
    items.push({
      label: '$(debug) Run Diagnostics',
      description: 'Troubleshoot connection issues',
      command: 'logcai.runDiagnostics'
    });
    
    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: `LogCAI: ${status.providerName} ${status.isAvailable ? '(Connected)' : '(Disconnected)'}`,
      title: 'LogCAI Model Management'
    });
    
    if (selected && selected.command) {
      if (selected.arguments) {
        vscode.commands.executeCommand(selected.command, ...selected.arguments);
      } else {
        vscode.commands.executeCommand(selected.command);
      }
    }
  }

  /**
   * Dispose of status bar resources
   */
  dispose(): void {
    this.statusBarItem.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}