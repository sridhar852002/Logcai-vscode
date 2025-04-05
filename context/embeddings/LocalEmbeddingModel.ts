// src/context/embeddings/LocalEmbeddingModel.ts
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as child_process from 'child_process';
import logger from '../../utils/logger';

/**
 * Provides local embedding generation for offline support
 * Uses Ollama or a small bundled model for embeddings
 */
export class LocalEmbeddingModel {
  private ready: boolean = false;
  private modelType: 'ollama' | 'bundled' | 'none' = 'none';
  private ollamaEndpoint: string = 'http://localhost:11434/api/embeddings';
  private ollamaModel: string = 'nomic-embed-text';
  private embeddingDimension: number = 384;
  private modelPath: string = '';
  
  /**
   * Initialize the local embedding model
   */
  public async initialize(): Promise<void> {
    try {
      // First try to use Ollama for embeddings
      if (await this.checkOllamaAvailable()) {
        this.modelType = 'ollama';
        this.ready = true;
        logger.info('Using Ollama for local embeddings');
        return;
      }
      
      // Then try to use bundled model
      if (await this.initializeBundledModel()) {
        this.modelType = 'bundled';
        this.ready = true;
        logger.info('Using bundled model for local embeddings');
        return;
      }
      
      // If neither is available, mark as not ready
      this.modelType = 'none';
      this.ready = false;
      logger.warn('No local embedding model available');
    } catch (error) {
      logger.error('Failed to initialize local embedding model', error);
      this.ready = false;
    }
  }

  /**
   * Check if Ollama is available and has embedding model
   */
  private async checkOllamaAvailable(): Promise<boolean> {
    try {
      // Test if Ollama is running by making a simple request
      const response = await fetch(`${this.ollamaEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.ollamaModel,
          prompt: 'test',
        }),
        signal: AbortSignal.timeout(2000) // Timeout after 2 seconds
      });
      
      // If response is not OK, Ollama might be running but model not available
      if (!response.ok) {
        // Try to pull the model
        logger.info('Pulling embedding model from Ollama...');
        await this.pullOllamaModel();
        
        // Check again after pulling
        const verifyResponse = await fetch(`${this.ollamaEndpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: this.ollamaModel,
            prompt: 'test',
          })
        });
        
        return verifyResponse.ok;
      }
      
      return true;
    } catch (error) {
      logger.warn('Ollama not available for embeddings', error);
      return false;
    }
  }

  /**
   * Pull the embedding model from Ollama
   */
  private async pullOllamaModel(): Promise<void> {
    try {
      // Create a notification and show progress
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Downloading embedding model (${this.ollamaModel})...`,
        cancellable: true
      }, async (progress, token) => {
        // Check if Ollama CLI is available
        const ollamaPath = await this.findOllamaPath();
        if (!ollamaPath) {
          throw new Error('Ollama CLI not found');
        }
        
        // Use child_process to pull the model
        return new Promise<void>((resolve, reject) => {
          const process = child_process.spawn(ollamaPath, ['pull', this.ollamaModel]);
          
          // Track progress (very rough approximation)
          let progressValue = 0;
          
          process.stdout.on('data', (data) => {
            const output = data.toString();
            logger.debug(`Ollama pull output: ${output}`);
            
            // Try to extract progress info
            const progressMatch = output.match(/(\d+)%/);
            if (progressMatch) {
              const newProgress = parseInt(progressMatch[1], 10);
              if (newProgress > progressValue) {
                progressValue = newProgress;
                progress.report({ message: `${progressValue}%` });
              }
            }
          });
          
          process.stderr.on('data', (data) => {
            logger.warn(`Ollama pull stderr: ${data.toString()}`);
          });
          
          process.on('close', (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`Ollama pull exited with code ${code}`));
            }
          });
          
          // Handle cancellation
          token.onCancellationRequested(() => {
            process.kill();
            reject(new Error('Model download cancelled'));
          });
        });
      });
      
      logger.info(`Successfully pulled model: ${this.ollamaModel}`);
    } catch (error) {
      logger.error('Failed to pull Ollama model', error);
      throw error;
    }
  }

  /**
   * Find Ollama CLI path
   */
  private async findOllamaPath(): Promise<string | null> {
    try {
      // Check common locations based on platform
      const platform = os.platform();
      
      if (platform === 'win32') {
        // Windows
        const possiblePaths = [
          'C:\\Program Files\\Ollama\\ollama.exe',
          'C:\\Program Files (x86)\\Ollama\\ollama.exe',
          path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Ollama', 'ollama.exe')
        ];
        
        for (const p of possiblePaths) {
          if (fs.existsSync(p)) {
            return p;
          }
        }
      } else if (platform === 'darwin') {
        // macOS
        const possiblePaths = [
          '/usr/local/bin/ollama',
          '/opt/homebrew/bin/ollama',
          path.join(os.homedir(), 'Applications', 'Ollama', 'ollama')
        ];
        
        for (const p of possiblePaths) {
          if (fs.existsSync(p)) {
            return p;
          }
        }
      } else {
        // Linux and others
        const possiblePaths = [
          '/usr/local/bin/ollama',
          '/usr/bin/ollama',
          path.join(os.homedir(), 'bin', 'ollama')
        ];
        
        for (const p of possiblePaths) {
          if (fs.existsSync(p)) {
            return p;
          }
        }
      }
      
      // Try to find in PATH
      return await new Promise<string | null>((resolve) => {
        const command = platform === 'win32' ? 'where ollama' : 'which ollama';
        child_process.exec(command, (error, stdout) => {
          if (error || !stdout) {
            resolve(null);
          } else {
            resolve(stdout.trim());
          }
        });
      });
    } catch (error) {
      logger.error('Error finding Ollama path', error);
      return null;
    }
  }

  /**
   * Initialize bundled model for embeddings
   */
  private async initializeBundledModel(): Promise<boolean> {
    try {
      // Get extension path
      const extension = vscode.extensions.getExtension('your.publisher.logcai');
      if (!extension) {
        return false;
      }
      
      // Check if the bundled model exists
      const modelDir = path.join(extension.extensionPath, 'resources', 'embeddings');
      const modelPath = path.join(modelDir, 'mini-embedding-model');
      
      if (!fs.existsSync(modelPath)) {
        logger.warn('Bundled embedding model not found');
        return false;
      }
      
      // Set model path for future use
      this.modelPath = modelPath;
      
      // Here we would load the model - in a real implementation
      // this would use a lightweight embedding model like TensorFlow.js
      // For now, we'll simulate it's ready
      
      return true;
      
      // Note: In a real implementation, we would load a small model
      // like MiniLM or TinyBERT through TensorFlow.js here, but
      // that's beyond the scope of this example.
    } catch (error) {
      logger.error('Failed to initialize bundled model', error);
      return false;
    }
  }

  /**
   * Generate an embedding using the local model
   */
  public async generateEmbedding(text: string): Promise<Float32Array> {
    if (!this.ready) {
      throw new Error('Local embedding model not initialized');
    }
    
    try {
      if (this.modelType === 'ollama') {
        return await this.generateOllamaEmbedding(text);
      } else if (this.modelType === 'bundled') {
        return await this.generateBundledEmbedding(text);
      } else {
        throw new Error('No embedding model available');
      }
    } catch (error) {
      logger.error('Error generating local embedding', error);
      throw error;
    }
  }

  /**
   * Generate an embedding using Ollama
   */
  private async generateOllamaEmbedding(text: string): Promise<Float32Array> {
    try {
      const response = await fetch(this.ollamaEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.ollamaModel,
          prompt: text
        })
      });
      
      if (!response.ok) {
        throw new Error(`Ollama returned status ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.embedding || !Array.isArray(data.embedding)) {
        throw new Error('Invalid response format from Ollama');
      }
      
      // Convert to Float32Array
      const embedding = new Float32Array(data.embedding.length);
      for (let i = 0; i < data.embedding.length; i++) {
        embedding[i] = data.embedding[i];
      }
      
      // Update the embedding dimension based on what we got
      this.embeddingDimension = embedding.length;
      
      return embedding;
    } catch (error) {
      logger.error('Error generating Ollama embedding', error);
      throw error;
    }
  }

  /**
   * Generate an embedding using the bundled model
   */
  private async generateBundledEmbedding(text: string): Promise<Float32Array> {
    try {
      // This is a simplified implementation
      // In a real scenario, we would use the loaded model to generate
      // an actual embedding. For now, we'll generate a deterministic
      // pseudo-embedding based on the text.
      
      const embedding = new Float32Array(this.embeddingDimension);
      
      // Create a deterministic pseudo-embedding
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
      }
      
      // Seed the random number generator with the hash
      let seed = Math.abs(hash);
      
      const random = () => {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
      };
      
      // Generate the embedding values
      for (let i = 0; i < this.embeddingDimension; i++) {
        embedding[i] = (random() * 2) - 1; // Range: -1 to 1
      }
      
      // Normalize to unit length for cosine similarity
      let sum = 0;
      for (let i = 0; i < this.embeddingDimension; i++) {
        sum += embedding[i] * embedding[i];
      }
      
      const norm = Math.sqrt(sum);
      for (let i = 0; i < this.embeddingDimension; i++) {
        embedding[i] /= norm;
      }
      
      return embedding;
    } catch (error) {
      logger.error('Error generating bundled embedding', error);
      throw error;
    }
  }

  /**
   * Check if the model is ready
   */
  public isReady(): boolean {
    return this.ready;
  }

  /**
   * Get the embedding dimension
   */
  public getEmbeddingDimension(): number {
    return this.embeddingDimension;
  }
}