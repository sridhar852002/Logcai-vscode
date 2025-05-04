//src/extension.ts
import * as vscode from 'vscode';
import { ConfigurationManager } from './config/configuration';
import { ModelManager } from './models/modelManager';
import { ContextManager } from './context/contextManager';
import { ChatPanel } from './ui/chatPanel';
import { InlineSuggestionProvider } from './ui/inlineSuggestions';
import { StatusBarManager } from './ui/statusBar';
import { RAGService } from './storage/ragService';
import { VectorStorage } from './storage/vectorStorage';
import { handleError } from './utils/errorHandler';
import { log } from './utils/logging';
import { initializeLogging, LogLevel, getLogLevelFromString } from './utils/logging';
import { ModelManagerUI } from './ui/modelManager';
import { DiagnosticsService } from './utils/diagnostics';
// Main extension state
export class LogCAIExtension {
// Use the ! non-null assertion operator
private configManager!: ConfigurationManager;
private modelManager!: ModelManager;
private contextManager!: ContextManager;
private chatPanel: ChatPanel | undefined;
private inlineSuggestionProvider!: InlineSuggestionProvider;
private statusBar!: StatusBarManager;
private ragService!: RAGService;
private modelManagerUI!: ModelManagerUI;
private diagnosticsService!: DiagnosticsService;
private disposables: vscode.Disposable[] = [];

constructor(private context: vscode.ExtensionContext) {
  // Initialize components immediately
  this.initializeComponents().catch(error => {
    handleError(error as Error, "Extension initialization failed");
  });
}

// Add getter methods to access needed components
get configurationManager(): ConfigurationManager {
  return this.configManager;
}

get modelManagerInstance(): ModelManager {
  return this.modelManager;
}

get chatPanelInstance(): ChatPanel | undefined {
  return this.chatPanel;
}

private async initializeComponents(): Promise<void> {
  try {
    // Initialize logging
    const config = vscode.workspace.getConfiguration('logcai');
    const logLevelString = config.get<string>('logLevel', 'info');
    initializeLogging(getLogLevelFromString(logLevelString));
    
    // Initialize components
    this.configManager = new ConfigurationManager(this.context);
    this.modelManager = new ModelManager(this.configManager);
    this.contextManager = new ContextManager(this.configManager);
    this.statusBar = new StatusBarManager(this.modelManager);
    this.modelManagerUI = new ModelManagerUI(this.modelManager, this.configManager);
    this.diagnosticsService = new DiagnosticsService(this.configManager,
    this.modelManager);

    // Initialize RAG service
    this.ragService = new RAGService(this.context, this.configManager);
    await this.ragService.initialize().catch(error => {
      handleError(error as Error, "Failed to initialize RAG service");
    });
    
    // Use the static method instead of constructor for ChatPanel
    this.chatPanel = ChatPanel.createOrShow(
      this.context,
      this.modelManager,
      this.contextManager,
      this.ragService
    );
    
    this.inlineSuggestionProvider = new InlineSuggestionProvider(
      this.modelManager,
      this.contextManager,
      this.configManager
    );
    
    // Register all services
    await this.registerServices();
    log.info('LogCAI extension initialized successfully');
  } catch (error) {
    handleError(error as Error, "Extension initialization failed");
    throw error;
  }
}

private async registerServices(): Promise<void> {
  try {
    // Register the webview provider that will automatically open the chat
    const provider = {
      resolveWebviewView: (webviewView: vscode.WebviewView) => {
        webviewView.webview.options = {
          enableScripts: true
        };
        webviewView.webview.html = `
          <html>
            <head>
              <style>
                body { 
                  color: var(--vscode-foreground);
                  background-color: var(--vscode-editor-background);
                  font-family: var(--vscode-font-family);
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  margin: 0;
                  padding: 0;
                }
                .container {
                  text-align: center;
                }
                button {
                  background: var(--vscode-button-background);
                  color: var(--vscode-button-foreground);
                  border: none;
                  padding: 8px 12px;
                  cursor: pointer;
                  margin-top: 10px;
                  border-radius: 2px;
                }
                button:hover {
                  background: var(--vscode-button-hoverBackground);
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h3>LogCAI Assistant</h3>
                <button id="open-chat">Open Chat</button>
              </div>
              <script>
                const vscode = acquireVsCodeApi();
                document.getElementById('open-chat').addEventListener('click', () => {
                  vscode.postMessage({ command: 'openChat' });
                });
                // Auto-open chat when loaded
                window.addEventListener('load', () => {
                  vscode.postMessage({ command: 'openChat' });
                });
              </script>
            </body>
          </html>
        `;
        
        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(message => {
          if (message.command === 'openChat') {
            vscode.commands.executeCommand('logcai.openChat');
          }
        });
        
        // Automatically open the chat when the webview becomes visible
        vscode.commands.executeCommand('logcai.openChat');
      }
    };
    
    // Register the webview provider
    const webviewRegistration = vscode.window.registerWebviewViewProvider('logcai.welcome', provider);
    this.disposables.push(webviewRegistration);

    // Get existing commands to avoid registration conflicts
    const existingCommands = await vscode.commands.getCommands(true);
    
    // Helper function to register a command safely
    const registerCommand = (id: string, handler: (...args: any[]) => any) => {
      if (!existingCommands.includes(id)) {
        return vscode.commands.registerCommand(id, handler);
      } else {
        // Unregister the command first, then register it again to ensure it works
        vscode.commands.executeCommand('workbench.action.quickOpen', `>${id}`).then(() => {
          vscode.commands.executeCommand('workbench.action.closeQuickOpen');
        });
        return vscode.commands.registerCommand(id, handler, true); // Force registration
      }
    };
    
    // Register commands safely
    const commandDisposables = [
      registerCommand('logcai.openChatInternal', () => {
        try {
          // If chat panel already exists and is valid, just reveal it
          if (this.chatPanel) {
            try {
              this.chatPanel.openPanel();
              
              // Hide sidebar after revealing the chat panel
              setTimeout(() => {
                vscode.commands.executeCommand('workbench.action.closeSidebar');
              }, 100);
              return;
            } catch (error) {
              // If there's an error opening the panel, it might be disposed
              this.chatPanel = undefined;
            }
          }
          
          // Create new panel
          this.chatPanel = ChatPanel.createOrShow(
            this.context,
            this.modelManager,
            this.contextManager,
            this.ragService
          );
          
          // Hide sidebar after creating the chat panel
          setTimeout(() => {
            vscode.commands.executeCommand('workbench.action.closeSidebar');
          }, 100);
        } catch (error) {
          handleError(error as Error, "Failed to open chat panel");
          vscode.window.showErrorMessage("Failed to open chat panel");
        }
      }),      
      registerCommand('logcai.getInlineCompletion', (textEditor: vscode.TextEditor) => {
        this.inlineSuggestionProvider.provideInlineCompletion(textEditor);
      }),
      registerCommand('logcai.indexCodebase', () => {
        this.ragService.triggerCodebaseIndexing();
      }),
      registerCommand('logcai.clearCodebaseIndex', async () => {
        const confirmed = await vscode.window.showWarningMessage(
          'Are you sure you want to clear all indexed data?',
          { modal: true },
          'Yes', 'No'
        );
        if (confirmed === 'Yes') {
          await this.ragService.clearIndexedData();
          vscode.window.showInformationMessage('Codebase index cleared successfully');
        }
      }),
      registerCommand('logcai.selectModelProvider', () => {
        this.modelManagerUI.selectModelProvider();
      }),
      registerCommand('logcai.selectOllamaModel', () => {
        this.modelManagerUI.selectOllamaModel();
      }),
      registerCommand('logcai.installOllamaModel', () => {
        this.modelManagerUI.promptInstallOllamaModel();
      }),
      registerCommand('logcai.runDiagnostics', () => {
        this.diagnosticsService.runDiagnostics();
      })
    ];
    
    // Add all valid disposables
    commandDisposables.forEach(disposable => {
      if (disposable) {
        this.disposables.push(disposable);
      }
    });
    
    // Register InlineCompletionItemProvider - fixing the trigger characters issue
    const providerInline = vscode.languages.registerInlineCompletionItemProvider(
      { pattern: '**' }, // All files
      this.inlineSuggestionProvider
    );
    this.disposables.push(providerInline);
    
    // Set up configuration change listener
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('logcai')) {
          this.configManager.refresh();
          this.modelManager.refreshConfiguration();
          this.contextManager.refreshConfiguration();
          this.inlineSuggestionProvider.refreshConfiguration();
        }
      })
    );
    
    // Register all disposables
    this.disposables.forEach(disposable => {
      if (disposable) {
        this.context.subscriptions.push(disposable);
      }
    });
  } catch (error) {
    handleError(error as Error, "Service registration failed");
  }
}

dispose(): void {
  // Dispose all disposables
  this.disposables.forEach(disposable => disposable.dispose());
  
  // Explicitly dispose the model providers to ensure Ollama process is cleaned up
  if (this.modelManager) {
    this.modelManager.dispose();
  }
}

resetChatPanel(): void {
  this.chatPanel = undefined;
}
}

/**
 * Prompt the user to select an Ollama model if none is configured
 */
async function promptForOllamaModelIfUnset(
  extension: LogCAIExtension
): Promise<void> {
  try {
    const configManager = extension.configurationManager;
    const modelManager = extension.modelManagerInstance;
    
    // Get the currently configured Ollama model
    const config = vscode.workspace.getConfiguration('logcai');
    const configuredModel = config.get<string>('ollamaModel', '');
    
    // If no model is configured or it's empty
    if (!configuredModel || configuredModel.trim() === '') {
      log.info('No Ollama model configured, prompting user to select one');
      
      // Only proceed if the provider is Ollama
      if (config.get<string>('modelProvider', 'ollama') === 'ollama') {
        try {
          // Get available models
          const availableModels = await modelManager.getAvailableOllamaModels();
          
          if (!availableModels || availableModels.length === 0) {
            // No models available, offer to install one
            const installModel = await vscode.window.showInformationMessage(
              'No Ollama models found. Would you like to install one?',
              'Install Model',
              'Cancel'
            );
            
            if (installModel === 'Install Model') {
              vscode.commands.executeCommand('logcai.installOllamaModel');
            } else {
              vscode.window.showWarningMessage(
                'LogCAI requires an Ollama model to function. Please install a model using the command palette.'
              );
            }
            return;
          }
          
          // Create items for the quick pick
          const modelItems = availableModels.map(model => ({
            label: model.name,
            description: `Size: ${model.size}`,
            detail: model.modifiedAt ? `Last modified: ${new Date(model.modifiedAt).toLocaleString()}` : undefined
          }));
          
          // Show the quick pick
          const selected = await vscode.window.showQuickPick(modelItems, {
            placeHolder: 'Select an Ollama model for LogCAI',
            title: 'LogCAI: Select Default Ollama Model'
          });
          
          if (selected) {
            // Save the selected model to configuration
            await config.update('ollamaModel', selected.label, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`LogCAI: Default model set to '${selected.label}'`);
            
            // Refresh the configuration
            await modelManager.refreshConfiguration();
          } else {
            vscode.window.showWarningMessage(
              'No model selected. LogCAI may not work correctly until a model is set.'
            );
          }
        } catch (error) {
          // Handle Ollama connection errors
          log.error(`Failed to get Ollama models: ${error}`);
          const installOption = await vscode.window.showErrorMessage(
            'Could not connect to Ollama. Make sure Ollama is installed and running.',
            'Get Ollama',
            'Dismiss'
          );
          
          if (installOption === 'Get Ollama') {
            vscode.env.openExternal(vscode.Uri.parse('https://ollama.com/download'));
          }
        }
      }
    }
  } catch (error) {
    handleError(error as Error, "Failed to prompt for Ollama model");
  }
}

// Extension activation
let extension: LogCAIExtension | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  try {
    extension = new LogCAIExtension(context);
    
    // Directly register the command to ensure it works in the command palette
    context.subscriptions.push(
      vscode.commands.registerCommand('logcai.openChat', () => {
        if (extension) {
          // Get access to the chatPanel through the extension
          const chatPanel = extension.chatPanelInstance;
          
          if (chatPanel) {
            try {
              // Try to open the panel - this might throw if the panel was disposed
              chatPanel.openPanel();
            } catch (error) {
              // Reset the chat panel and create a new one
              extension.resetChatPanel();
              vscode.commands.executeCommand('logcai.openChatInternal');
            }
          } else {
            // We need to use the internal command to create a new panel
            vscode.commands.executeCommand('logcai.openChatInternal');
          }
          
          // Close sidebar
          setTimeout(() => {
            vscode.commands.executeCommand('workbench.action.closeSidebar');
          }, 100);
        }
      })
    );

    await promptForOllamaModelIfUnset(extension);
    
    // Show initial status after a delay to allow initialization to complete
    setTimeout(() => {
      vscode.window.showInformationMessage('LogCAI is now active with RAG capabilities!');
    }, 1000);
  } catch (error) {
    handleError(error as Error, "Extension activation failed");
  }
}

// Extension deactivation
export function deactivate(): void {
  if (extension) {
    extension.dispose();
    extension = undefined;
  }
}