// src/views/logcaiViewProvider.ts
import * as vscode from 'vscode';
import { getNonce } from '../utils/getNonce';
import { getWebviewContent } from './webview';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import { installModel, fetchAvailableModels } from '../backend/modelManagement';
import { runAgent } from '../features/AgentRunner';
import { modelRegistry } from '../ai/modelRegistry';
import { agentRegistry } from '../agents/AgentRegistry';
import { isPlanAtLeast, setUserPlan, UserPlan } from '../monetization/planManager';
import { generateLocalResponse } from '../ai/localAI';
import * as ollamaChecker from '../backend/ollamaChecker';
import logger, { ErrorCategory } from '../utils/logger';
import ApiKeyManager from '../services/ApiKeyManager';
import FileContextManager from '../services/FileContextManager';

function isCloudProvider(provider: string): provider is 'OpenAI' | 'Anthropic' {
  return provider === 'OpenAI' || provider === 'Anthropic';
}

export class LogcaiViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'logcaiView';
  private _context: vscode.ExtensionContext;
  private _webviewView: vscode.WebviewView | undefined;
  private _inlineProvider: any;
  private _autocompleteProvider: any;
  
  // Track active streaming to allow cancellation
  private _activeStreaming = false;
  
  // For debug logging
  private _debugTokenLogged: boolean = false;
  
  // Store conversations persistently
  private _conversations: any[] = [];
  
  // Track active models
  private _activeModels: string[] = [];

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    // Restore saved conversations from workspace state
    const savedConversations = this._context.workspaceState.get('logcai.conversations') as any[] || [];
    this._conversations = savedConversations;
    // Restore active models from workspace state
    const savedActiveModels = this._context.workspaceState.get('logcai.activeModels') as string[] || [];
    this._activeModels = savedActiveModels;
  }

  public sendMessageToWebview(message: any): boolean {
    if (this._webviewView) {
      this._webviewView.webview.postMessage(message);
      return true;
    }
    return false;
  }

  // Set reference to providers for updating them
  public setProviders(inlineProvider: any, autocompleteProvider: any) {
    this._inlineProvider = inlineProvider;
    this._autocompleteProvider = autocompleteProvider;
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._webviewView = webviewView;
    const nonce = getNonce();
    
    const assetsPath = path.join(this._context.extensionPath, 'dist/assets');
    
    // Find the webview entry file
    const entryFile = fs.readdirSync(assetsPath).find(f =>
      f.startsWith('webview-') && f.endsWith('.js')
    );
    
    if (!entryFile) {
      vscode.window.showErrorMessage('Logcai: Webview JS bundle not found.');
      return;
    }
    
    const scriptUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, 'dist/assets', entryFile)
    );
    
    // Configure webview security and options
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._context.extensionUri, 'dist')],
    };
    
    // Set the webview HTML content
    webviewView.webview.html = getWebviewContent(nonce, scriptUri.toString());
    
    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (msg) => {
      const send = (data: any) => webviewView.webview.postMessage(data);
      
      // FIX: Handle message format from chat panel
      if (msg.type === 'sendMessage' && msg.payload) {
        logger.info(`Received 'type: sendMessage' format message, converting to command format`);
        await this.handleSendMessage({ command: 'sendMessage', payload: msg.payload }, send);
        return;
      }
      
      try {
        switch (msg.command) {
          case 'getEditorContent':
            await this.handleGetEditorContent(send);
            break;
          case 'installModel':
            await this.handleInstallModel(msg.modelId || msg.model, send);
            break;
          case 'uninstallModel':
            await this.handleUninstallModel(msg.modelId, send);
            break;
          case 'getInstalledModels':
            await this.handleGetInstalledModels(send);
            break;
          case 'listLocalModels':
            await this.handleListLocalModels(send);
            break;
          case 'loadConversations':
            this.handleLoadConversations(send);
            break;
          case 'saveConversation':
            this.handleSaveConversation(msg.conversation);
            break;
          case 'deleteConversation':
            this.handleDeleteConversation(msg.conversationId);
            break;
          case 'sendMessage':
            await this.handleSendMessage(msg, send);
            break;
          case 'stopStream':
            this.handleStopStream();
            break;
          case 'runAgent':
            await this.handleRunAgent(msg, send);
            break;
          // API key management handlers
          case 'saveApiKey':
            await this.handleSaveApiKey(msg, send);
            break;
          case 'deleteApiKey':
            await this.handleDeleteApiKey(msg, send);
            break;
          case 'getApiKeys':
            await this.handleGetApiKeys(send);
            break;
          // Context-related handlers
          case 'getContext':
            await this.handleGetContext(msg, send);
            break;
          case 'sendMessageWithContext':
            await this.handleSendMessageWithContext(msg, send);
            break;
          // Model management handlers
          case 'modelActivationChanged':
            await this.handleModelActivationChanged(msg, send);
            break;
          case 'fetchModelsLibrary':
            await this.handleFetchModelsLibrary(send);
            break;
          // User plan handler
          case 'updateUserPlan':
            await this.handleUpdateUserPlan(msg.plan, send);
            break;
          default:
            logger.info(`Unhandled webview command: ${msg.command}`);
        }
      } catch (err: any) {
        this.handleError(err, send, msg.command);
      }
    });
  }

  // New method to handle user plan updates
  private async handleUpdateUserPlan(plan: UserPlan, send: (data: any) => void) {
    try {
      if (!plan || typeof plan !== 'string') {
        throw new Error('Invalid plan type');
      }
      // Update plan in the extension context
      const validPlans: UserPlan[] = ['Free', 'LocalPro', 'CloudPro'];
      if (!validPlans.includes(plan as UserPlan)) {
        throw new Error(`Invalid plan: ${plan}`);
      }
      // Set the plan in the plan manager
      setUserPlan(plan as UserPlan);
      // Save to extension storage
      this._context.globalState.update('logcai.userPlan', plan);
      // Update providers if they exist
      if (this._inlineProvider && typeof this._inlineProvider.setUserPlan === 'function') {
        this._inlineProvider.setUserPlan(plan);
      }
      if (this._autocompleteProvider && typeof this._autocompleteProvider.setUserPlan === 'function') {
        this._autocompleteProvider.setUserPlan(plan);
      }
      // Execute command to update providers in all contexts
      vscode.commands.executeCommand('logcai.updateUserPlan', plan);
      // Send confirmation back to the webview
      send({
        command: 'userPlanChanged',
        plan,
        success: true
      });
      logger.info(`User plan updated to: ${plan}`);
    } catch (err: any) {
      logger.error(`Failed to update user plan: ${err.message}`, err);
      send({
        command: 'userPlanChanged',
        success: false,
        error: err.message
      });
    }
  }

  // Handle getting content from the active editor
  private async handleGetEditorContent(send: (data: any) => void) {
    try {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        throw new Error('No active editor found');
      }
      // Get selected text or full document
      let text: string;
      if (!editor.selection.isEmpty) {
        text = editor.document.getText(editor.selection);
      } else {
        text = editor.document.getText();
      }
      send({
        command: 'editorContent',
        text: text,
        language: editor.document.languageId
      });
    } catch (err: any) {
      this.handleError(err, send, 'getting editor content');
    }
  }

// Handle model installation
private async handleInstallModel(modelName: string, send: (data: any) => void) {
  try {
    if (!modelName || typeof modelName !== 'string') {
      throw new Error('Invalid model name');
    }
    
    logger.info(`Starting installation of model: ${modelName}`);
    
    const progressOptions = {
      location: vscode.ProgressLocation.Notification,
      title: `Installing model "${modelName}"`,
      cancellable: true
    };
    
    await vscode.window.withProgress(progressOptions, async (progress, token) => {
      // Initial progress notification
      progress.report({ increment: 0, message: 'Starting download...' });
      send({
        command: 'modelInstallStatus',
        modelId: modelName,
        status: 'installing',
        progress: 0
      });
      
      // Handle cancellation
      token.onCancellationRequested(() => {
        logger.info(`Installation of model ${modelName} was cancelled`);
        send({
          command: 'modelInstallStatus',
          modelId: modelName,
          status: 'cancelled'
        });
      });
      
      if (token.isCancellationRequested) {return;}
      
      try {
        // Create a cancelable installation process
        const installProcess = this.createCancelableInstallation(modelName, token);
        
        // Progress updates
        const updateProgress = async () => {
          const steps = [10, 30, 50, 70, 90, 100];
          for (const step of steps) {
            if (token.isCancellationRequested) {break;}
            
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            progress.report({
              increment: step - (steps.indexOf(step) > 0 ? steps[steps.indexOf(step) - 1] : 0),
              message: step < 100 ? `Downloading... (${step}%)` : 'Finalizing...'
            });
            
            // Send progress to webview
            send({
              command: 'modelInstallStatus',
              modelId: modelName,
              status: 'installing',
              progress: step
            });
          }
        };
        
        // Run progress updates and actual installation concurrently
        await Promise.all([updateProgress(), installProcess]);
        
        if (!token.isCancellationRequested) {
          // Report success
          logger.info(`Model "${modelName}" installed successfully.`);
          vscode.window.showInformationMessage(`Model "${modelName}" installed successfully.`);
          send({
            command: 'modelInstallStatus',
            modelId: modelName,
            status: 'installed'
          });
          
          // Add to active models by default
          this._activeModels.push(modelName);
          this._context.workspaceState.update('logcai.activeModels', this._activeModels);
          
          // Notify of model list update
          const installedModels = await ollamaChecker.getOllamaModels();
          send({
            command: 'installedModels',
            models: installedModels,
            activeModels: this._activeModels
          });
        }
      } catch (err) {
        // Fix: Handle unknown type error
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to install model ${modelName}: ${errorMessage}`);
        send({
          command: 'modelInstallStatus',
          modelId: modelName,
          status: 'error',
          error: errorMessage
        });
        throw err;
      }
    });
  } catch (err) {
    // Fix: Handle unknown type error
    const errorMessage = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to install model: ${errorMessage}`);
    this.handleError(err, send, `installing model "${modelName}"`);
  }
}


// Add this new helper method to create a cancelable installation
private createCancelableInstallation(modelName: string, token: vscode.CancellationToken): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      // Sanitize the model name to prevent command injection
      const sanitizedModelName = modelName.replace(/[^a-zA-Z0-9:._-]/g, '');
      
      // Spawn process instead of using execSync
      const process = cp.spawn('ollama', ['pull', sanitizedModelName], {
        stdio: 'pipe'
      });
      
      // Set up cancellation
      token.onCancellationRequested(() => {
        process.kill();
        reject(new Error('Installation cancelled'));
      });
      
      // Capture output for logging
      process.stdout?.on('data', (data: Buffer) => {
        logger.debug(`Ollama installation output: ${data}`);
      });
      
      process.stderr?.on('data', (data: Buffer) => {
        logger.debug(`Ollama installation error: ${data}`);
      });
      
      // Handle completion
      process.on('close', (code: number | null) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Installation failed with code ${code}`));
        }
      });
      
      process.on('error', (err: Error) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

  // Handle model uninstallation
  private async handleUninstallModel(modelId: string, send: (data: any) => void) {
    try {
      // This would call the actual model uninstallation API
      // For now, we'll simulate it
      vscode.window.showInformationMessage(`Model "${modelId}" uninstalled successfully.`);
      send({ command: 'modelUninstalled', modelId });
      // Remove from active models if it was active
      const index = this._activeModels.indexOf(modelId);
      if (index !== -1) {
        this._activeModels.splice(index, 1);
        this._context.workspaceState.update('logcai.activeModels', this._activeModels);
        send({
          command: 'activeModelsUpdated',
          activeModels: this._activeModels
        });
      }
      } catch (err: any) {
      this.handleError(err, send, `uninstalling model "${modelId}"`);
      }
      }

      // Get list of installed models
      private async handleGetInstalledModels(send: (data: any) => void) {
      try {
      const installedModels = await ollamaChecker.getOllamaModels();
      send({
        command: 'installedModels',
        models: installedModels,
        activeModels: this._activeModels
      });
      } catch (err: any) {
      logger.error('Failed to get installed models', err);
      send({
        command: 'installedModels',
        models: [],
        activeModels: this._activeModels
      });
      }
      }

      // List available local models from Ollama
      private async handleListLocalModels(send: (data: any) => void) {
      try {
      // Check if Ollama is installed first
      const installed = await ollamaChecker.ensureOllamaInstalled();
      if (!installed) {
        send({
          command: 'localModelsList',
          models: [],
          activeModels: this._activeModels
        });
        return;
      }
      // Start Ollama server if needed
      await ollamaChecker.startOllamaServer();
      // Get models from Ollama
      const models = await fetchAvailableModels();
      send({
        command: 'localModelsList',
        models: models.map(m => m.name),
        activeModels: this._activeModels
      });
      } catch (err: any) {
      logger.error('Failed to list Ollama models', err);
      send({
        command: 'localModelsList',
        models: [],
        activeModels: this._activeModels
      });
      }
      }

      // Load saved conversations from the workspace state
      private handleLoadConversations(send: (data: any) => void) {
      send({
      command: 'loadedConversations',
      conversations: this._conversations
      });
      }

      // Save a conversation to the workspace state
      private handleSaveConversation(conversation: any) {
      try {
      if (!conversation || !conversation.id) {
        logger.error('Invalid conversation data for saving', conversation);
        return;
      }
      // Update or add the conversation
      const index = this._conversations.findIndex(c => c.id === conversation.id);
      if (index >= 0) {
        this._conversations[index] = conversation;
      } else {
        this._conversations.push(conversation);
      }
      // Persist to workspace state
      this._context.workspaceState.update('logcai.conversations', this._conversations);
      } catch (err: any) {
      logger.error('Error saving conversation', err);
      }
      }

      // Delete a conversation from the workspace state
      private handleDeleteConversation(conversationId: string) {
      try {
      if (!conversationId) {
        logger.error('Invalid conversation ID for deletion');
        return;
      }
      this._conversations = this._conversations.filter(c => c.id !== conversationId);
      this._context.workspaceState.update('logcai.conversations', this._conversations);
      } catch (err: any) {
      logger.error('Error deleting conversation', err);
      }
      }

      // Handle chat message sending
      private async handleSendMessage(msg: any, send: (data: any) => void) {
      try {
      logger.info(`Handling sendMessage: ${JSON.stringify(msg.payload || {})}`);

      const modelId = msg.payload?.model || 'mistral';
      const prompt = msg.payload?.prompt;
      const systemPrompt = msg.payload?.systemPrompt || '';
      const temperature = msg.payload?.temperature || 0.7;
      const aiMode = msg.payload?.aiMode || 'local';

      // Get user plan from message if provided, otherwise use current
      const userPlan = msg.payload?.userPlan || this._context.globalState.get('logcai.userPlan') || 'Free';

      // Set the user plan for feature access control
      if (userPlan) {
        vscode.commands.executeCommand('logcai.updateUserPlan', userPlan);
      }

      logger.info(`Using model: ${modelId}, mode: ${aiMode}, plan: ${userPlan}`);

      // Handle both built-in models and dynamically installed models
      const model = modelRegistry[modelId];
      const isLocalInstalledModel = !model && modelId.includes(':'); // Typically Ollama models have format

      if (!model && !isLocalInstalledModel) {
        throw new Error(`Model "${modelId}" not found`);
      }

      // For built-in models, check plan requirements
      if (model && !isPlanAtLeast(model.planRequired)) {
        throw new Error(`"${model.name}" requires ${model.planRequired} plan`);
      }

      // For custom installed models, check if user has at least LocalPro
      if (isLocalInstalledModel && !isPlanAtLeast('LocalPro')) {
        throw new Error(`Custom installed models require at least LocalPro plan`);
      }

      // Set active streaming flag
      this._activeStreaming = true;
      this._debugTokenLogged = false;

      try {
        if (isLocalInstalledModel || (model && model.mode === 'local')) {
          // For both built-in local models and custom installed models
          await this.handleLocalAI({
            id: modelId,
            name: modelId,
            mode: 'local',
            // Add any other required properties that handleLocalAI might need
            provider: 'Ollama',
            streaming: true,
            planRequired: 'LocalPro',
            canAccess: (plan: UserPlan) => isPlanAtLeast('LocalPro')
          }, prompt, systemPrompt, temperature, send);
        } else if (model && model.mode === 'cloud' && isCloudProvider(model.provider)) {
          await this.handleCloudAI(model, prompt, systemPrompt, temperature, send);
        }
      } finally {
        // Reset streaming flag when done
        this._activeStreaming = false;
        send({ command: 'receiveMessage', text: '[STREAM_END]' });
      }
      } catch (err: any) {
      this.handleError(err, send, 'sending message');
      }
      }

      // Handle local AI model interaction via Ollama - IMPROVED VERSION
      private async handleLocalAI(
      model: any,
      prompt: string,
      systemPrompt: string,
      temperature: number,
      send: (data: any) => void
      ) {
      try {
      // Log the request for debugging
      logger.info(`handleLocalAI called with model: ${model.id}, prompt length: ${prompt.length}`);

      // Ensure Ollama is installed
      const installed = await ollamaChecker.ensureOllamaInstalled();
      if (!installed) {
        throw new Error('Ollama is not installed. Please install it from https://ollama.ai/download');
      }

      // Start Ollama server
      await ollamaChecker.startOllamaServer();

      // Format system prompt if provided
      const fullPrompt = systemPrompt
        ? `<s>\n${systemPrompt}\n</s>\n\n${prompt}`
        : prompt;

      // Use the model ID (which might be a custom installed model ID)
      const modelId = model.id;

      // Add explicit logging before generating response
      logger.info(`Generating response with model: ${modelId}`);
      send({ command: 'receiveMessage', text: `Using model: ${modelId}...\n` });

      // Try with the specified model, with fallback to a default model if that fails
      try {
        // Stream the response
        await generateLocalResponse(
          fullPrompt,
          modelId,
          {
            stream: true,
          },
          (token) => {
            if (this._activeStreaming) {
              // Log first few tokens for debugging
              if (!this._debugTokenLogged) {
                logger.debug(`First tokens received: ${token.substring(0, 50)}`);
                this._debugTokenLogged = true;
              }
              send({ command: 'receiveMessage', text: token });
            }
          }
        );
      } catch (modelError) {
        // If the specified model fails, try with a fallback model
        logger.error(`Failed with model ${modelId}, trying fallback model mistral`, modelError);
        send({ command: 'receiveMessage', text: `[Warning] Model ${modelId} failed, trying fallback model...\n\n` });
        
        await generateLocalResponse(
          fullPrompt,
          'mistral', // Fallback model
          {
            stream: true,
          },
          (token) => {
            if (this._activeStreaming) {
              send({ command: 'receiveMessage', text: token });
            }
          }
        );
      }
      } catch (err: any) {
      logger.error(`handleLocalAI error: ${err.message}`, err);
      // Send error message to webview
      send({ command: 'receiveMessage', text: `[Error] ${err.message}` });
      throw err;
      } finally {
      // Reset debug flag
      this._debugTokenLogged = false;
      }
      }

      // Handle cloud AI providers (OpenAI, Anthropic)
      private async handleCloudAI(
      model: any,
      prompt: string,
      systemPrompt: string,
      temperature: number,
      send: (data: any) => void
      ) {
      try {
      // Import cloud AI module
      const { generateCloudResponse } = await import('../ai/cloudAI.js');

      // Format system prompt appropriately for the provider
      const fullPrompt = systemPrompt
        ? model.provider === 'OpenAI'
          ? `<system>\n${systemPrompt}\n</system>\n\n${prompt}`
          : `${systemPrompt}\n\n${prompt}`
        : prompt;

      // Stream the response
      await generateCloudResponse(
        model.provider,
        model.id,
        fullPrompt,
        {
          stream: true,
          temperature
        },
        (token: string) => {
          if (this._activeStreaming) {
            send({ command: 'receiveMessage', text: token });
          }
        }
      );
      } catch (err: any) {
      throw err;
      }
      }

      /**
      * Handle request for code context
      */
      private async handleGetContext(msg: any, send: (data: any) => void) {
      try {
      // Get the active file path
      const activeFilePath = vscode.window.activeTextEditor?.document.uri.fsPath;
      // Get context using FileContextManager
      const contextManager = FileContextManager;
      const context = await contextManager.getContext(msg.options || {});
      // Send back to webview
      send({
        command: 'contextResult',
        context,
        activeFilePath
      });
      } catch (error) {
      logger.error('Error getting context:', error);
      send({
        command: 'contextError',
        error: error instanceof Error ? error.message : 'Unknown error getting context'
      });
      }
      }

      /**
      * Handle messages with context included
      */
      private async handleSendMessageWithContext(msg: any, send: (data: any) => void) {
      try {
      const modelId = msg.model || 'mistral';
      const prompt = msg.text;
      const systemPrompt = msg.systemPrompt || '';
      const temperature = msg.temperature || 0.7;
      const userPlan = msg.userPlan || 'Free';
      const contextItems = msg.contextItems || [];

      // Set the user plan for feature access control
      setUserPlan(userPlan);

      // Format context for prompt if context is enabled
      let contextPrompt = '';
      if (msg.useContext && contextItems.length > 0) {
        // Get the context manager
        const contextManager = FileContextManager;
        // Load the specified context items
        const context = await contextManager.getContext();
        // Filter to only the selected items
        context.items = context.items.filter(item => contextItems.includes(item.id));
        // Format for prompt
        contextPrompt = contextManager.formatContextForPrompt(context);
      }

      // Combine prompt with context
      const fullPrompt = contextPrompt
        ? `${contextPrompt}\n\nUser question: ${prompt}`
        : prompt;

      // Set active streaming flag
      this._activeStreaming = true;

      try {
        // Handle based on model type as before, but now using fullPrompt
        const model = modelRegistry[modelId];
        const isLocalInstalledModel = !model && modelId.includes(':');
        
        if (isLocalInstalledModel || (model && model.mode === 'local')) {
          await this.handleLocalAI({
            id: modelId,
            name: modelId,
            mode: 'local',
            provider: 'Ollama',
            streaming: true,
            planRequired: 'LocalPro',
            canAccess: (plan: UserPlan) => isPlanAtLeast('LocalPro')
          }, fullPrompt, systemPrompt, temperature, send);
        } else if (model && model.mode === 'cloud' && isCloudProvider(model.provider)) {
          await this.handleCloudAI(model, fullPrompt, systemPrompt, temperature, send);
        }
      } finally {
        // Reset streaming flag when done
        this._activeStreaming = false;
        send({ command: 'receiveMessage', text: '[STREAM_END]' });
      }
      } catch (err: any) {
      this.handleError(err, send, 'sending message with context');
      }
      }

      // Stop the current streaming response
      private handleStopStream() {
      this._activeStreaming = false;
      }

      // Run an agent from the marketplace
      private async handleRunAgent(msg: any, send: (data: any) => void) {
      try {
      const userPlan = msg.userPlan || 'Free';
      setUserPlan(userPlan);

      // Find the agent
      const agent = agentRegistry.find(a => a.id === msg.agentId);
      if (!agent) {
        throw new Error(`Agent "${msg.agentId}" not found`);
      }

      // Check if the user plan allows access to this agent
      if (!isPlanAtLeast(agent.planRequired)) {
        throw new Error(`"${agent.name}" requires ${agent.planRequired} plan.`);
      }

      // Get the model used by the agent
      const model = modelRegistry[agent.model];

      // Check if Ollama is installed for local models
      if (model?.mode === 'local') {
        const installed = await ollamaChecker.ensureOllamaInstalled();
        if (!installed) {
          throw new Error('Ollama is not installed. Please install it from https://ollama.ai/download');
        }
        await ollamaChecker.startOllamaServer();
      }

      // Set active streaming flag
      this._activeStreaming = true;

      try {
        // Run the agent and stream the response
        await runAgent(
          agent.id,
          msg.input || '',
          (token: string) => {
            if (this._activeStreaming) {
              send({
                type: 'agentResponse',
                agentId: agent.id,
                data: token
              });
            }
          }
        );
      } finally {
        // Reset streaming flag when done
        this._activeStreaming = false;
        send({ type: 'agentStreamEnd', agentId: agent.id });
      }
      } catch (err: any) {
      this.handleError(err, send, `running agent "${msg.agentId}"`);
      send({ type: 'agentStreamEnd', agentId: msg.agentId });
      }
      }

      // Handle saving API keys
      private async handleSaveApiKey(msg: any, send: (data: any) => void) {
      try {
      if (!msg.provider || !msg.key) {
        throw new Error('Provider and key are required');
      }
      const result = await ApiKeyManager.saveKey(
        msg.provider.toLowerCase(),
        msg.key
      );
      send({
        command: 'apiKeySaved',
        success: result,
        provider: msg.provider
      });
      } catch (err: any) {
      logger.error('Failed to save API key', err);
      send({
        command: 'apiKeySaved',
        success: false,
        provider: msg.provider,
        error: err.message
      });
      }
      }

      // Handle deleting API keys
      private async handleDeleteApiKey(msg: any, send: (data: any) => void) {
      try {
      if (!msg.provider) {
        throw new Error('Provider is required');
      }
      const result = await ApiKeyManager.deleteKey(
        msg.provider.toLowerCase()
      );
      send({
        command: 'apiKeyDeleted',
        success: result,
        provider: msg.provider
      });
      } catch (err: any) {
      logger.error('Failed to delete API key', err);
      send({
        command: 'apiKeyDeleted',
        success: false,
        provider: msg.provider,
        error: err.message
      });
      }
      }

      // Handle getting API keys
      private async handleGetApiKeys(send: (data: any) => void) {
      try {
      const providers = ApiKeyManager.getProvidersWithKeys();
      send({
        command: 'apiKeys',
        providers
      });
      } catch (err: any) {
      logger.error('Failed to get API keys', err);
      send({
        command: 'apiKeys',
        providers: [],
        error: err.message
      });
      }
      }

      // Handles updating the active models list
      private async handleModelActivationChanged(msg: any, send: (data: any) => void) {
      try {
      if (msg.activeModels && Array.isArray(msg.activeModels)) {
        this._activeModels = msg.activeModels;
        // Save to workspace state
        this._context.workspaceState.update('logcai.activeModels', this._activeModels);
        // Confirm back to the webview
        send({
          command: 'activeModelsUpdated',
          activeModels: this._activeModels
        });
      }
      } catch (err: any) {
      this.handleError(err, send, 'updating active models');
      }
      }

      // Handles fetching the models library
      private async handleFetchModelsLibrary(send: (data: any) => void) {
      try {
      // Try to get from workspace state first (pre-fetched)
      const cachedModels = this._context.workspaceState.get('logcai.modelsLibrary');
      if (cachedModels) {
        send({
          command: 'modelsLibraryResult',
          models: cachedModels
        });
        return;
      }

      // Otherwise use a hardcoded list for now
      const hardcodedModels = [
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
        }
      ];

      // Store in workspace state
      this._context.workspaceState.update('logcai.modelsLibrary', hardcodedModels);

      // Send to webview
      send({
        command: 'modelsLibraryResult',
        models: hardcodedModels
      });
      } catch (err: any) {
      this.handleError(err, send, 'fetching models library');
      }
      }

      private handleError(error: any, send: (data: any) => void, operation: string = 'operation') {
        // Categorize the error
        const errorInfo = logger.categorizeError(error);
        // Extract just the category and severity from the errorInfo object
        const category = errorInfo.category;
        const severity = errorInfo.severity;
      
        // Log the error with context and category
        logger.error(`Error during ${operation}`, error, category);
      
        // Determine the user-friendly error message based on category
        let userMessage: string;
        let recoveryAction: string | null = null;
        let isCritical = false;
      
        switch (category) {
          case ErrorCategory.NETWORK:
            userMessage = 'Cannot connect to the Ollama server. Please ensure Ollama is running.';
            recoveryAction = 'Restart Ollama';
            isCritical = true;
            break;
          case ErrorCategory.OLLAMA:
            if (error.message?.includes('not found')) {
              userMessage = `Model not found. Please check if the model is installed.`;
              recoveryAction = 'View Models';
            } else {
              userMessage = `Ollama error: ${error.message || 'Unknown error'}`;
            }
            isCritical = true;
            break;
          case ErrorCategory.AUTH:
            userMessage = 'Authentication error. Please check your API key settings.';
            recoveryAction = 'Open Settings';
            break;
          case ErrorCategory.API:
            userMessage = `API error: ${error.message || 'Unknown error'}`;
            break;
          default:
            if (error.message?.includes('requires') && error.message?.includes('plan')) {
              userMessage = error.message; // Pass through plan requirement errors
            } else {
              userMessage = `An error occurred: ${error.message || 'Unknown error'}`;
            }
        }
      
        // Add error code if available
        if (error.code) {
          userMessage += ` (Code: ${error.code})`;
        }
      
        // Send error message to the webview
        send({
          command: 'receiveMessage',
          text: `[Error] ${userMessage}${recoveryAction ? ' Click the button below to resolve.' : ''}`,
          errorDetails: {
            category: category,
            recoveryAction: recoveryAction,
            errorCode: error.code,
            isCritical
          }
        });
      
        // End streaming if it was active
        send({
          command: 'receiveMessage',
          text: '[STREAM_END]'
        });
      
        // Show a notification for critical errors with recovery actions
        if (isCritical) {
          if (recoveryAction === 'Restart Ollama') {
            vscode.window.showErrorMessage(userMessage, recoveryAction).then(selection => {
              if (selection === recoveryAction) {
                // Attempt to restart Ollama
                vscode.commands.executeCommand('logcai.restartOllama');
              }
            });
          } else if (recoveryAction === 'View Models') {
            vscode.window.showErrorMessage(userMessage, recoveryAction).then(selection => {
              if (selection === recoveryAction) {
                // Show models panel
                vscode.commands.executeCommand('logcai.showModelsPanel');
              }
            });
          } else {
            vscode.window.showErrorMessage(userMessage);
          }
        }
      
        // Reset streaming state
        this._activeStreaming = false;
      
        // For network errors, try to check if Ollama is running
        if (category === ErrorCategory.NETWORK) {
          this.checkOllamaStatus()
            .then(isRunning => {
              if (!isRunning) {
                logger.info('Ollama is not running, attempting to start it');
                // Try to start Ollama
                vscode.commands.executeCommand('logcai.startOllama');
              }
            })
            .catch(err => {
              logger.error('Failed to check Ollama status', err);
            });
        }
      }
    
      // Add helper method to check if Ollama is running
      private async checkOllamaStatus(): Promise<boolean> {
        try {
          // Simple fetch with timeout to check if Ollama API is responding
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1000);
          
          const response = await fetch('http://localhost:11434/api/version', {
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          return response.ok;
        } catch (error) {
          return false;
        }
      }}