import * as vscode from 'vscode';
import axios from 'axios';
import { ConfigurationManager } from '../config/configuration';
import { ModelManager } from '../models/modelManager';
import { log } from './logging';

export class DiagnosticsService {
  constructor(
    private readonly configManager: ConfigurationManager,
    private readonly modelManager: ModelManager
  ) {}

  async runDiagnostics(): Promise<void> {
    // Create a channel for diagnostic output
    const channel = vscode.window.createOutputChannel('LogCAI Diagnostics');
    channel.show();
    channel.clear();

    channel.appendLine('=== LogCAI Diagnostics ===');
    channel.appendLine(`Time: ${new Date().toLocaleString()}`);
    channel.appendLine('');

    // OS Info
    channel.appendLine('=== System Information ===');
    channel.appendLine(`VS Code: ${vscode.version}`);
    channel.appendLine(`OS: ${process.platform} ${process.arch}`);
    channel.appendLine('');

    // Configuration
    channel.appendLine('=== Configuration ===');
    const config = this.configManager.getConfiguration();
    channel.appendLine(`Model Provider: ${config.modelProvider}`);
    
    if (config.modelProvider === 'ollama') {
      channel.appendLine(`Ollama Endpoint: ${config.ollamaEndpoint}`);
      channel.appendLine(`Ollama Model: ${config.ollamaModel}`);
      
      // Test Ollama connection
      channel.appendLine('');
      channel.appendLine('=== Ollama Connection Test ===');
      
      try {
        // Test base endpoint
        const baseUrl = new URL(config.ollamaEndpoint).origin;
        channel.appendLine(`Testing connection to: ${baseUrl}`);
        
        try {
          await axios.get(`${baseUrl}/api/tags`);
          channel.appendLine('✅ Successfully connected to Ollama API');
          
          // Get available models
          const availableModels = await this.modelManager.getAvailableOllamaModels();
          
          if (availableModels.length === 0) {
            channel.appendLine('⚠️ No models found in Ollama');
            channel.appendLine('You need to install models using the "LogCAI: Install Ollama Model" command');
          } else {
            channel.appendLine(`✅ Found ${availableModels.length} models in Ollama:`);
            availableModels.forEach(model => {
              channel.appendLine(`   - ${model.name} (${model.size})`);
            });
            
            // Check if configured model exists
            const modelExists = availableModels.some(m => m.name === config.ollamaModel);
            if (modelExists) {
              channel.appendLine(`✅ Configured model "${config.ollamaModel}" is available`);
            } else {
              channel.appendLine(`❌ Configured model "${config.ollamaModel}" is NOT installed in Ollama`);
              channel.appendLine('Please install the model or select a different one');
            }
          }
        } catch (error) {
          channel.appendLine(`❌ API connection failed: ${error}`);
          channel.appendLine('Error details:');
          
          if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNREFUSED') {
              channel.appendLine('  - Connection refused: Ollama is not running or unreachable');
              channel.appendLine('  - Make sure Ollama is installed and running');
              channel.appendLine('  - Download Ollama from: https://ollama.com/download');
            } else if (error.response) {
              channel.appendLine(`  - Status: ${error.response.status}`);
              channel.appendLine(`  - Data: ${JSON.stringify(error.response.data)}`);
            } else {
              channel.appendLine(`  - ${error.message}`);
            }
          } else {
            channel.appendLine(`  - ${error}`);
          }
        }
      } catch (error) {
        channel.appendLine(`❌ Invalid Ollama endpoint URL: ${config.ollamaEndpoint}`);
        channel.appendLine(`Error: ${error}`);
      }
    }
    
    // Extension status
    channel.appendLine('');
    channel.appendLine('=== Extension Status ===');
    const status = this.modelManager.status;
    channel.appendLine(`Provider: ${status.providerName}`);
    channel.appendLine(`Model: ${status.modelName}`);
    channel.appendLine(`Available: ${status.isAvailable ? 'Yes' : 'No'}`);
    
    // Recommendations
    channel.appendLine('');
    channel.appendLine('=== Recommendations ===');
    
    if (!status.isAvailable) {
      if (config.modelProvider === 'ollama') {
        channel.appendLine('1. Check if Ollama is installed and running');
        channel.appendLine('2. Verify the Ollama endpoint in settings');
        channel.appendLine('3. Make sure the model is installed');
        channel.appendLine('4. Try installing a model using "LogCAI: Install Ollama Model" command');
      } else {
        channel.appendLine('1. Check your API key for the selected provider');
        channel.appendLine('2. Verify the model name is correct');
      }
    } else {
      channel.appendLine('LogCAI appears to be correctly configured.');
    }
    
    channel.appendLine('');
    channel.appendLine('=== End of Diagnostics ===');
  }
} 