import * as vscode from 'vscode';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ModelManager } from '../models/modelManager';
import { ContextManager } from '../context/contextManager';
import { RAGService } from '../storage/ragService';
import { ChatMessage, Conversation } from '../models/interfaces';
import { WEBVIEW } from '../config/constants';
import { handleError } from '../utils/errorHandler';
import { log } from '../utils/logging';

export class ChatPanel {
  private static currentPanel: ChatPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private currentConversation: Conversation;
  private ragService: RAGService | undefined;

  private constructor(
    private readonly extensionContext: vscode.ExtensionContext,
    private readonly modelManager: ModelManager,
    private readonly contextManager: ContextManager
  ) {
    // Create WebView panel
    this.panel = vscode.window.createWebviewPanel(
      WEBVIEW.CHAT_PANEL_ID,
      WEBVIEW.CHAT_PANEL_TITLE,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(extensionContext.extensionUri.fsPath, 'media'))
        ]
      }
    );

    // Initialize a new conversation
    this.currentConversation = this.createNewConversation();

    // Set initial HTML content
    this.panel.webview.html = this.getWebviewContent();

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        try {
          switch (message.command) {
            case 'sendMessage':
              await this.handleUserMessage(message.text);
              break;
            case 'regenerateResponse':
              await this.regenerateLastResponse();
              break;
            case 'clearChat':
              this.clearChat();
              break;
            case 'copyToEditor':
              await this.copyToEditor(message.text);
              break;
            case 'startOllama':
              await this.startOllama();
              break;
            case 'checkOllamaConnection':
              await this.checkOllamaConnection();
              break;
            case 'changeModel':
              await this.changeModel();
              break;
          }
        } catch (error) {
          handleError(error as Error, 'Failed to handle webview message');
        }
      },
      null,
      this.disposables
    );

    // When the panel is closed, dispose of resources
    this.panel.onDidDispose(
      () => this.dispose(),
      null,
      this.disposables
    );

    // When the model status changes, update the webview
    this.modelManager.onStatusChanged(
      (status) => {
        this.panel.webview.postMessage({
          command: 'updateStatus',
          status
        });
      },
      null,
      this.disposables
    );
  }

  /**
   * Create and show the chat panel
   */
  public static createOrShow(
    extensionContext: vscode.ExtensionContext,
    modelManager: ModelManager,
    contextManager: ContextManager,
    ragService?: RAGService
  ): ChatPanel {
    // If we already have a panel, show it
    if (ChatPanel.currentPanel) {
      ChatPanel.currentPanel.panel.reveal();
      return ChatPanel.currentPanel;
    }

    // Otherwise, create a new panel
    const panel = new ChatPanel(extensionContext, modelManager, contextManager);

    if (ragService) {
      panel.ragService = ragService;
    }
    ChatPanel.currentPanel = panel;
    return panel;
  }

  /**
   * Set the RAG service
   */
  public setRAGService(ragService: RAGService): void {
    this.ragService = ragService;
  }

  /**
   * Open the chat panel
   */
  public openPanel(): void {
    this.panel.reveal();
  }

  /**
   * Dispose of the panel resources
   */
  private dispose(): void {
    ChatPanel.currentPanel = undefined;
    // Dispose of all disposables
    this.panel.dispose();
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * Get the HTML content for the webview
   */
  private getWebviewContent(): string {
    // Fix: Replace vscode.Uri.joinPath with path.join and vscode.Uri.file
    const scriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(this.extensionContext.extensionUri.fsPath, 'media', 'chat.js'))
    );
    const styleUri = this.panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(this.extensionContext.extensionUri.fsPath, 'media', 'chat.css'))
    );
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LogCAI Chat</title>
  <link href="${styleUri}" rel="stylesheet">
  <style>
    /* Additional styles for connection status */
    .connect-button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 4px 8px;
      border-radius: 2px;
      cursor: pointer;
      font-size: 12px;
      margin-left: 8px;
    }
    .connect-button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    .status-error {
      color: #f14c4c;
    }
    .status-success {
      color: #73c991;
    }
    .model-selector {
      display: flex;
      align-items: center;
      margin-left: 8px;
      font-size: 12px;
    }
    .model-selector button {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 3px 8px;
      font-size: 12px;
      border-radius: 2px;
      cursor: pointer;
    }
    .model-selector button:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }
  </style>
</head>
<body>
  <div class="chat-container">
    <div class="status-bar">
      <div class="model-status" id="model-status">
        <span class="status-icon"></span>
        <span id="model-name">Connecting...</span>
        <div class="model-selector">
          <button id="change-model-button" title="Change Model">Change Model</button>
        </div>
      </div>
      <div class="shortcut-hint">Press Shift+Enter for new line</div>
      <div class="action-buttons">
        <button id="clear-button" title="Clear Chat">
          Clear
        </button>
      </div>
    </div>
    <div class="messages-container" id="messages-container">
      <div class="welcome-message">
        <h2>Welcome to LogCAI</h2>
        <p>Your intelligent coding assistant. Ask me about your code, get completions, explanations, or help with debugging.</p>
        <div class="suggestion-buttons">
          <button class="suggestion-button">Explain this file</button>
          <button class="suggestion-button">Help me debug</button>
          <button class="suggestion-button">Generate unit tests</button>
          <button class="suggestion-button">Optimize my code</button>
        </div>
      </div>
    </div>
    <div class="input-container">
      <textarea id="message-input" placeholder="Ask a question or request help with your code..." rows="3"></textarea>
      <button id="send-button" title="Send">
        Send
      </button>
    </div>
  </div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }

  /**
   * Create a new conversation
   */
  private createNewConversation(): Conversation {
    return {
      id: uuidv4(),
      title: 'New Conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  /**
   * Handle user messages
   */
  private async handleUserMessage(text: string): Promise<void> {
    if (!text.trim()) {
      return;
    }
    try {
      // Create user message
      const userMessage: ChatMessage = {
        role: 'user',
        content: text,
        timestamp: Date.now(),
        id: uuidv4()
      };

      // Add to conversation
      this.currentConversation.messages.push(userMessage);
      this.currentConversation.updatedAt = Date.now();

      // Update UI
      this.panel.webview.postMessage({
        command: 'addMessage',
        message: userMessage
      });

      // Show typing indicator
      this.panel.webview.postMessage({
        command: 'showTypingIndicator'
      });

      // Get context from current file if available
      let contextInfo = '';
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        contextInfo = await this.contextManager.getFullContext(
          activeEditor.document,
          activeEditor.selection.active
        );
      }

      // Prepare the prompt with context
      let prompt = `User question: ${text}\n\n`;
      if (contextInfo) {
        prompt += `Current code context:\n${contextInfo}\n\n`;
      }

      // Add conversation history (limited to last 5 messages)
      const recentMessages = this.currentConversation.messages
        .slice(-10) // Last 10 messages
        .filter(msg => msg.id !== userMessage.id); // Exclude current message
      if (recentMessages.length > 0) {
        prompt += "Previous conversation:\n";
        for (const msg of recentMessages) {
          prompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
        }
        prompt += "\n";
      }

      // Use RAG to augment the prompt if available
      if (this.ragService) {
        const config = vscode.workspace.getConfiguration('logcai');
        const enableRAG = config.get<boolean>('enableRAG', true);
        const maxSnippets = config.get<number>('maxRAGSnippets', 3);
        if (enableRAG) {
          prompt = await this.ragService.augmentPromptWithRAG(
            prompt,
            text,
            activeEditor?.document.languageId,
            maxSnippets
          );
        }
      }

      // Add latest question
      prompt += `Please respond to the user's question: ${text}`;

      // Generate response using streaming
      let responseContent = '';
      await this.modelManager.streamCompletion(
        prompt,
        (text, final) => {
          responseContent += text;
          // Update UI with streamed response
          this.panel.webview.postMessage({
            command: 'updateStreamedResponse',
            text: responseContent
          });
        }
      );

      // Create assistant message
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: responseContent,
        timestamp: Date.now(),
        id: uuidv4()
      };

      // Add to conversation
      this.currentConversation.messages.push(assistantMessage);
      this.currentConversation.updatedAt = Date.now();

      // Update UI
      this.panel.webview.postMessage({
        command: 'replaceStreamedResponse',
        message: assistantMessage
      });
    } catch (error) {
      // Hide typing indicator
      this.panel.webview.postMessage({
        command: 'hideTypingIndicator'
      });

      // Show error message
      this.panel.webview.postMessage({
        command: 'showError',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      handleError(error as Error, 'Failed to handle user message');
    }
  }

  /**
   * Regenerate the last assistant response
   */
  private async regenerateLastResponse(): Promise<void> {
    try {
      // Find the last user and assistant message pair
      const messages = this.currentConversation.messages;
      let lastUserMessageIndex = -1;
      let lastAssistantMessageIndex = -1;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'assistant' && lastAssistantMessageIndex === -1) {
          lastAssistantMessageIndex = i;
        } else if (messages[i].role === 'user' && lastUserMessageIndex === -1) {
          lastUserMessageIndex = i;
          break;
        }
      }
      if (lastUserMessageIndex === -1) {
        vscode.window.showErrorMessage('No user message found to regenerate response for');
        return;
      }

      // Get the user message
      const userMessage = messages[lastUserMessageIndex];

      // Remove the last assistant message if it exists
      if (lastAssistantMessageIndex !== -1) {
        messages.splice(lastAssistantMessageIndex, 1);
      }

      // Now handle the user message again to generate a new response
      await this.handleUserMessage(userMessage.content);
    } catch (error) {
      handleError(error as Error, 'Failed to regenerate response');
    }
  }

  /**
   * Clear the chat
   */
  private clearChat(): void {
    this.currentConversation = this.createNewConversation();
    this.panel.webview.postMessage({
      command: 'clearChat'
    });
  }

  /**
   * Copy code to the active editor
   */
  private async copyToEditor(text: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor to copy text to');
      return;
    }
    try {
      // Insert text at current cursor position
      await editor.edit(editBuilder => {
        editBuilder.insert(editor.selection.active, text);
      });
      // Show success message
      vscode.window.showInformationMessage('Code inserted into editor');
    } catch (error) {
      handleError(error as Error, 'Failed to copy text to editor');
    }
  }

  /**
   * Start the Ollama server
   */
  private async startOllama(): Promise<void> {
    try {
      // Get the Ollama provider from the model manager
      const ollamaProvider = (this.modelManager as any).providers?.get('ollama');
      
      if (ollamaProvider && typeof ollamaProvider.startOllamaInTerminal === 'function') {
        // Use the existing provider method if available
        this.panel.webview.postMessage({
          command: 'showMessage',
          message: {
            role: 'system',
            content: 'Starting Ollama server...',
            timestamp: Date.now(),
            id: uuidv4()
          }
        });
        
        // Call the provider's start method
        const started = await ollamaProvider.startOllamaInTerminal();
        
        if (started) {
          this.panel.webview.postMessage({
            command: 'showMessage',
            message: {
              role: 'system',
              content: 'Ollama server started successfully!',
              timestamp: Date.now(),
              id: uuidv4()
            }
          });
          
          // Refresh connection status
          await this.checkOllamaConnection();
        } else {
          this.panel.webview.postMessage({
            command: 'showMessage',
            message: {
              role: 'system',
              content: 'Ollama server was started but connection failed. Check terminal for errors.',
              timestamp: Date.now(),
              id: uuidv4()
            }
          });
        }
      } else {
        // Fallback to simple terminal command if provider method not available
        const terminal = vscode.window.createTerminal('Ollama');
        terminal.show();
        
        // Use platform-specific command
        if (process.platform === 'darwin' && 
            (require('fs').existsSync('/Applications/Ollama.app') || 
             require('fs').existsSync(require('path').join(require('os').homedir(), 'Applications', 'Ollama.app')))) {
          terminal.sendText('open -a Ollama');
        } else {
          terminal.sendText('ollama serve');
        }
        
        this.panel.webview.postMessage({
          command: 'showMessage',
          message: {
            role: 'system',
            content: 'Starting Ollama server. Please keep terminal window open.',
            timestamp: Date.now(),
            id: uuidv4()
          }
        });
        
        // Try to reconnect after a short delay
        setTimeout(() => {
          this.checkOllamaConnection();
        }, 3000);
      }
    } catch (error) {
      this.panel.webview.postMessage({
        command: 'showMessage',
        message: {
          role: 'system',
          content: `Error starting Ollama: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: Date.now(),
          id: uuidv4()
        }
      });
    }
  }
  
  /**
   * Check Ollama connection status
   */
  private async checkOllamaConnection(): Promise<void> {
    try {
      // Try to refresh the model connection
      await this.modelManager.refreshConnection();
      
      // Check if connection is successful
      if (this.modelManager.status.isAvailable) {
        // Show success message if connection is established
        this.panel.webview.postMessage({
          command: 'showMessage',
          message: {
            role: 'system',
            content: 'Successfully connected to Ollama!',
            timestamp: Date.now(),
            id: uuidv4()
          }
        });
      } else {
        // Connection failed, reset provider start flag if needed
        const ollamaProvider = (this.modelManager as any).providers?.get('ollama');
        if (ollamaProvider && typeof ollamaProvider.resetStartAttempted === 'function') {
          ollamaProvider.resetStartAttempted();
        }
        
        // Show connection failed message
        this.panel.webview.postMessage({
          command: 'showMessage',
          message: {
            role: 'system',
            content: 'Could not connect to Ollama. Please ensure it\'s running.',
            timestamp: Date.now(),
            id: uuidv4()
          }
        });
      }
    } catch (error) {
      // Reset provider start flag if available
      const ollamaProvider = (this.modelManager as any).providers?.get('ollama');
      if (ollamaProvider && typeof ollamaProvider.resetStartAttempted === 'function') {
        ollamaProvider.resetStartAttempted();
      }
      
      // Show error message
      this.panel.webview.postMessage({
        command: 'showMessage',
        message: {
          role: 'system',
          content: `Failed to connect to Ollama: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: Date.now(),
          id: uuidv4()
        }
      });
    }
  }

  /**
   * Change the current model by triggering the model selection command
   */
  private async changeModel(): Promise<void> {
    // Use the existing command to select an Ollama model
    vscode.commands.executeCommand('logcai.selectOllamaModel');
    
    // Show a message to the user
    this.panel.webview.postMessage({
      command: 'showMessage',
      message: {
        role: 'system',
        content: 'Opening model selection...',
        timestamp: Date.now(),
        id: uuidv4()
      }
    });
  }
}