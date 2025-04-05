// Add to src/extension.ts

import * as vscode from 'vscode';
import * as cp from 'child_process';
import { LogcaiViewProvider } from './views/logcaiViewProvider';
import { fetchOllamaModelsLibrary } from './backend/ollamaModelsFetcher';
import { InlineAutocompleteProvider } from './features/InlineAutocompleteProvider';
import { AutocompleteProvider } from './features/AutocompleteProvider';
import { setUserPlan, UserPlan } from './monetization/planManager';
import logger from './utils/logger';
import { AICodeActionProvider, registerAICodeActionCommand } from './features/AICodeAction';
import networkAwareness from './utils/networkAwareness';
import responseCache from './utils/responseCache';
import commandGenerator, { CommandType } from './features/CommandGenerator';

export function activate(context: vscode.ExtensionContext) {
  // Load saved user plan from extension storage
  const savedPlan = context.globalState.get('logcai.userPlan') as UserPlan || 'Free';
  setUserPlan(savedPlan);
  logger.info(`Loaded user plan from storage: ${savedPlan}`);

  // Register the main webview provider
  const logcaiViewProvider = new LogcaiViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'logcaiView',
      logcaiViewProvider
    )
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('logcai.openChat', () => {
      vscode.commands.executeCommand('workbench.view.extension.logcaiSidebar');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('logcai.signIn', () => {
      const provider = new LogcaiViewProvider(context);
      const panel = vscode.window.createWebviewPanel(
        'logcaiAuth',
        'Logcai Sign In',
        vscode.ViewColumn.One,
        { enableScripts: true }
      );
      // This will trigger the authentication flow
      // Cast to unknown first to avoid type checking errors
      provider.resolveWebviewView(({
        webview: panel.webview,
        onDidChangeVisibility: () => {},
        onDidDispose: () => {},
        visible: true,
        viewType: 'logcaiAuth',
        show: () => {}
      } as unknown) as vscode.WebviewView);
    })
  );

  // Create the providers
  const inlineProvider = new InlineAutocompleteProvider();
  const autocompleteProvider = new AutocompleteProvider();

  // Read initial settings from configuration
  const config = vscode.workspace.getConfiguration('logcai');
  const inlineEnabled = config.get<boolean>('inlineCompletions.enabled', true);
  const autocompleteEnabled = config.get<boolean>('completions.enabled', true);
  const defaultModel = config.get<string>('defaultModel', 'mistral');

  // Apply initial settings
  inlineProvider.setEnabled(inlineEnabled);
  autocompleteProvider.setEnabled(autocompleteEnabled);
  inlineProvider.setModel(defaultModel);
  autocompleteProvider.setModel(defaultModel);

  // Set user plan on providers
  inlineProvider.setUserPlan(savedPlan);
  autocompleteProvider.setUserPlan(savedPlan);

  // Initialize network awareness
  networkAwareness.startMonitoring();
  
  // Register AI Code Action provider
  const aiCodeActionProvider = registerAICodeActionCommand(context);
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      [
        { scheme: 'file', language: 'javascript' },
        { scheme: 'file', language: 'typescript' },
        { scheme: 'file', language: 'python' },
        { scheme: 'file', language: 'java' },
        { scheme: 'file', language: 'csharp' },
        { scheme: 'file', language: 'php' },
        { scheme: 'file', language: 'ruby' },
        { scheme: 'file', language: 'go' },
        { scheme: 'file', language: 'rust' },
        { scheme: 'file', language: 'cpp' },
        { scheme: 'file', language: 'c' }
      ],
      aiCodeActionProvider,
      {
        providedCodeActionKinds: AICodeActionProvider.providedCodeActionKinds
      }
    )
  );

  // Register command to update user plan
  context.subscriptions.push(
    vscode.commands.registerCommand('logcai.updateUserPlan', (plan: UserPlan) => {
      // Update global plan
      setUserPlan(plan);
      // Save to extension storage
      context.globalState.update('logcai.userPlan', plan);
      // Update providers
      inlineProvider.setUserPlan(plan);
      autocompleteProvider.setUserPlan(plan);
      // Log the update
      logger.info(`Updated user plan to: ${plan}`);
    })
  );

  // Register the inline completion provider
  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(
      // Register for all languages
      { pattern: '**' },
      inlineProvider
    )
  );

  // Register the regular completion provider
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      // Register for common programming languages
      [
        'typescript', 'javascript', 'python', 'java',
        'csharp', 'c', 'cpp', 'go', 'rust', 'php',
        'ruby', 'html', 'css', 'json'
      ],
      autocompleteProvider,
      '.', '(', '{', '[', ':', ',' // Trigger characters
    )
  );

  // Add command to toggle inline suggestions
  context.subscriptions.push(
    vscode.commands.registerCommand('logcai.toggleInlineSuggestions', () => {
      const newState = !inlineProvider.isEnabled;
      inlineProvider.setEnabled(newState);
      // Update configuration
      config.update('inlineCompletions.enabled', newState, true);
      vscode.window.showInformationMessage(
        `Logcai Inline Suggestions: ${newState ? 'Enabled' : 'Disabled'}`
      );
    })
  );

  // Add command to toggle autocomplete
  context.subscriptions.push(
    vscode.commands.registerCommand('logcai.toggleAutocomplete', () => {
      const newState = !autocompleteProvider.isEnabled;
      autocompleteProvider.setEnabled(newState);
      // Update configuration
      config.update('completions.enabled', newState, true);
      vscode.window.showInformationMessage(
        `Logcai Autocomplete: ${newState ? 'Enabled' : 'Disabled'}`
      );
    })
  );

  // Add command to change model for suggestions
  context.subscriptions.push(
    vscode.commands.registerCommand('logcai.selectModel', async (modelId?: string) => {
      if (modelId) {
        // Directly set the selected model if provided as parameter
        inlineProvider.setModel(modelId);
        autocompleteProvider.setModel(modelId);
        config.update('defaultModel', modelId, true);
        vscode.window.showInformationMessage(
          `Logcai model set to: ${modelId}`
        );
        return;
      }
      
      // Get installed models from the extension
      const modelsLibrary = context.workspaceState.get('logcai.modelsLibrary') as any[] || [];
      const modelNames = modelsLibrary.length > 0
        ? modelsLibrary.map(m => m.id)
        : ['mistral', 'gemma3', 'llama3', 'phi3'];
      
      const selectedModel = await vscode.window.showQuickPick(modelNames, {
        placeHolder: 'Select a model for Logcai suggestions'
      });
      
      if (selectedModel) {
        // Update both providers
        inlineProvider.setModel(selectedModel);
        autocompleteProvider.setModel(selectedModel);
        // Update configuration
        config.update('defaultModel', selectedModel, true);
        vscode.window.showInformationMessage(
          `Logcai model set to: ${selectedModel}`
        );
      }
    })
  );

  // Register command generator commands
  context.subscriptions.push(
    vscode.commands.registerCommand('logcai.generateCommand', async () => {
      // Show input box to enter command description
      const query = await vscode.window.showInputBox({
        prompt: 'Describe the command you need',
        placeHolder: 'e.g., "git commit all changes with message"'
      });
      
      if (!query) {return;}
      
      try {
        // Show progress notification
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: 'Generating command...',
          cancellable: true
        }, async (progress, token) => {
          // Generate the command
          const result = await commandGenerator.generateCommand(query);
          
          if (token.isCancellationRequested) {return;}
          
          if (!result.command) {
            vscode.window.showErrorMessage('Failed to generate a command');
            return;
          }
          
          // Show command with options to execute
          const option = await vscode.window.showInformationMessage(
            `Command: ${result.command}`,
            { modal: false, detail: result.explanation },
            'Execute', 'Copy', 'Explain'
          );
          
          if (option === 'Execute') {
            commandGenerator.executeCommand(result);
          } else if (option === 'Copy') {
            vscode.env.clipboard.writeText(result.command);
          } else if (option === 'Explain') {
            const explanation = await commandGenerator.explainCommand(result.command);
            const document = await vscode.workspace.openTextDocument({
              content: `# Command Explanation\n\n## Command\n\`${result.command}\`\n\n## Explanation\n${explanation}`,
              language: 'markdown'
            });
            await vscode.window.showTextDocument(document);
          }
        });
      } catch (error) {
        logger.error('Error generating command', error);
        vscode.window.showErrorMessage(`Error generating command: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    })
  );
  
  // Register command suggestions command
  context.subscriptions.push(
    vscode.commands.registerCommand('logcai.suggestCommands', async () => {
      try {
        const suggestions = await commandGenerator.suggestCommands(5);
        
        if (suggestions.length === 0) {
          vscode.window.showInformationMessage('No command suggestions available');
          return;
        }
        
        // Create quick pick items
        const items = suggestions.map(cmd => ({
          label: cmd.command,
          description: cmd.type,
          detail: cmd.explanation || '',
          command: cmd
        }));
        
        // Show quick pick
        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select a command to execute',
          matchOnDescription: true,
          matchOnDetail: true
        });
        
        if (selected) {
          await commandGenerator.executeCommand(selected.command);
        }
      } catch (error) {
        logger.error('Error suggesting commands', error);
        vscode.window.showErrorMessage(`Error suggesting commands: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    })
  );
  
  // Register cache management commands
  context.subscriptions.push(
    vscode.commands.registerCommand('logcai.clearResponseCache', () => {
      responseCache.clear();
      vscode.window.showInformationMessage('Response cache cleared');
    })
  );
  
  // Register command to check network connectivity
  context.subscriptions.push(
    vscode.commands.registerCommand('logcai.checkConnectivity', async () => {
      const isOnline = await networkAwareness.forceCheck();
      const status = isOnline ? 'online' : 'offline';
      
      vscode.window.showInformationMessage(`Network status: ${status}`);
      
      return isOnline;
    })
  );
  
  // Register command to switch to local models
  context.subscriptions.push(
    vscode.commands.registerCommand('logcai.switchToLocalModels', () => {
      vscode.commands.executeCommand('logcai.selectModel', 'mistral');
      vscode.window.showInformationMessage('Switched to local Mistral model');
    })
  );
  
  // Command to generate and run a specific type of command
  context.subscriptions.push(
    vscode.commands.registerCommand('logcai.generateGitCommand', async () => {
      runTypeSpecificCommand(CommandType.GIT, 'Git command');
    })
  );
  
  context.subscriptions.push(
    vscode.commands.registerCommand('logcai.generateDockerCommand', async () => {
      runTypeSpecificCommand(CommandType.DOCKER, 'Docker command');
    })
  );
  
  context.subscriptions.push(
    vscode.commands.registerCommand('logcai.generateNpmCommand', async () => {
      runTypeSpecificCommand(CommandType.NPM, 'npm command');
    })
  );

  // Listen for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('logcai')) {
        const newConfig = vscode.workspace.getConfiguration('logcai');
        // Update inline provider settings
        if (e.affectsConfiguration('logcai.inlineCompletions.enabled')) {
          inlineProvider.setEnabled(newConfig.get<boolean>('inlineCompletions.enabled', true));
        }
        // Update autocomplete provider settings
        if (e.affectsConfiguration('logcai.completions.enabled')) {
          autocompleteProvider.setEnabled(newConfig.get<boolean>('completions.enabled', true));
        }
        // Update model settings
        if (e.affectsConfiguration('logcai.defaultModel')) {
          const model = newConfig.get<string>('defaultModel', 'mistral');
          inlineProvider.setModel(model);
          autocompleteProvider.setModel(model);
        }
      }
    })
  );

  // Pre-fetch models library on startup
  context.subscriptions.push(
    vscode.commands.registerCommand('logcai.refreshModels', async () => {
      try {
        vscode.window.showInformationMessage("Refreshing models list...");
        const models = await fetchOllamaModelsLibrary();
        context.workspaceState.update('logcai.modelsLibrary', models);
        vscode.window.showInformationMessage("Models refreshed successfully");
      } catch (error) {
        logger.error('Failed to refresh models library:', error);
        vscode.window.showErrorMessage("Failed to refresh models library");
      }
    })
  );

  // Register command to restart Ollama
  context.subscriptions.push(
    vscode.commands.registerCommand('logcai.restartOllama', async () => {
      try {
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: "Restarting Ollama...",
          cancellable: false
        }, async (progress) => {
          progress.report({ message: "Stopping Ollama service..." });
          
          // This depends on the platform - simple implementation for demo
          const platform = process.platform;
          const stopCommand = platform === 'win32' ? 'taskkill /F /IM ollama.exe' : 'pkill -f ollama';
          
          await new Promise<void>((resolve, reject) => {
            const process = cp.exec(stopCommand);
            process.on('close', (code) => {
              logger.info(`Ollama stop process exited with code ${code}`);
              resolve();
            });
            process.on('error', (err) => {
              logger.warn(`Error stopping Ollama: ${err.message}`);
              resolve(); // Continue anyway
            });
            
            // Don't hang forever
            setTimeout(resolve, 2000);
          });
          
          progress.report({ message: "Starting Ollama service..." });
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Start Ollama
          const ollamaProcess = cp.spawn('ollama', ['serve'], {
            stdio: 'pipe',
            detached: false
          });
          
          // Store reference to kill later if needed
          global.ollamaProcess = ollamaProcess;
          
          // Log output for debugging
          ollamaProcess.stdout?.on('data', (data) => {
            logger.debug(`Ollama stdout: ${data}`);
          });
          
          ollamaProcess.stderr?.on('data', (data) => {
            logger.debug(`Ollama stderr: ${data}`);
          });
          
          // Wait for Ollama to start
          progress.report({ message: "Waiting for Ollama to start..." });
          await new Promise(resolve => setTimeout(resolve, 3000));
        });
        
        vscode.window.showInformationMessage("Ollama restarted successfully");
      } catch (error) {
        logger.error("Failed to restart Ollama", error);
        vscode.window.showErrorMessage("Failed to restart Ollama. Please restart it manually.");
      }
    })
  );

  // Register command to start Ollama
  context.subscriptions.push(
    vscode.commands.registerCommand('logcai.startOllama', async () => {
      try {
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: "Starting Ollama...",
          cancellable: false
        }, async (progress) => {
          // Start Ollama process
          const platform = process.platform;
          if (platform === 'win32') {
            cp.spawn('ollama', ['serve'], { detached: true });
          } else {
            cp.spawn('ollama', ['serve'], { detached: true });
          }
          
          // Wait for a few seconds to give it time to start
          progress.report({ message: "Waiting for Ollama to initialize..." });
          await new Promise(resolve => setTimeout(resolve, 3000));
        });
        
        vscode.window.showInformationMessage("Ollama started");
      } catch (error) {
        logger.error("Failed to start Ollama", error);
        vscode.window.showErrorMessage("Failed to start Ollama. Please start it manually.");
      }
    })
  );

  // Register command to show models panel
  context.subscriptions.push(
    vscode.commands.registerCommand('logcai.showModelsPanel', () => {
      // First show the sidebar
      vscode.commands.executeCommand('workbench.view.extension.logcaiSidebar');
      
      // Then send a message to the webview to switch to models tab
      // Using the public method instead of accessing private property
      logcaiViewProvider.sendMessageToWebview({
        command: 'switchToTab',
        tab: 'models'
      });
    })
  );
  
  // Helper for type-specific commands
  async function runTypeSpecificCommand(type: CommandType, label: string) {
    const query = await vscode.window.showInputBox({
      prompt: `Describe the ${label} you need`,
      placeHolder: `e.g., "${getPlaceholderForType(type)}"`
    });
    
    if (!query) {return;}
    
    try {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Generating ${label}...`,
        cancellable: true
      }, async (progress, token) => {
        const result = await commandGenerator.generateCommand(query, {
          commandType: type
        });
        
        if (token.isCancellationRequested) {return;}
        
        if (!result.command) {
          vscode.window.showErrorMessage(`Failed to generate ${label}`);
          return;
        }
        
        const option = await vscode.window.showInformationMessage(
          `${label}: ${result.command}`,
          { modal: false, detail: result.explanation },
          'Execute', 'Copy'
        );
        
        if (option === 'Execute') {
          commandGenerator.executeCommand(result);
        } else if (option === 'Copy') {
          vscode.env.clipboard.writeText(result.command);
        }
      });
    } catch (error) {
      logger.error(`Error generating ${label}`, error);
      vscode.window.showErrorMessage(`Error generating ${label}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  function getPlaceholderForType(type: CommandType): string {
    switch (type) {
      case CommandType.GIT:
        return "commit changes with message 'fix: update error handling'";
      case CommandType.NPM:
        return "install all dependencies and save exact versions";
      case CommandType.DOCKER:
        return "build and tag image from current directory";
      case CommandType.YARN:
        return "add react and react-dom with types";
      case CommandType.KUBERNETES:
        return "get all pods in the default namespace";
      default:
        return "run a command";
    }
  }

  // Log extension activation
  vscode.window.showInformationMessage('Logcai AI Coding Assistant activated!');
}

export function deactivate() {
  // Stop network monitoring
  networkAwareness.stopMonitoring();
  
  // ADD: Kill Ollama process if we started it
  if (global.ollamaProcess) {
    try {
      global.ollamaProcess.kill();
      global.ollamaProcess = null;
    } catch (error) {
      logger.debug('Error killing Ollama process on extension deactivation', error);
    }
  }
}