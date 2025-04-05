import { exec } from 'child_process';

export interface OllamaModel {
  name: string;
  size?: string;
}

/**
 * Fetches installed models using Ollama CLI (`ollama list --json`)
 */
/**
 * Fetches installed models using Ollama CLI
 */
export function fetchAvailableModels(): Promise<OllamaModel[]> {
  return new Promise((resolve, reject) => {
    // Try with --json flag first
    exec('ollama list --json', (error, stdout, stderr) => {
      if (error) {
        // Fallback to plain text parsing if --json flag isn't supported
        exec('ollama list', (plainError, plainStdout, plainStderr) => {
          if (plainError) {
            reject(plainStderr);
          } else {
            try {
              // Parse plain text output
              const models = plainStdout
                .split('\n')
                .slice(1) // Skip header row
                .filter(line => line.trim())
                .map(line => {
                  const parts = line.trim().split(/\s+/);
                  return {
                    name: parts[0],
                    size: parts[1] // Size might be in a different column
                  };
                });
              resolve(models);
            } catch (e) {
              reject(e);
            }
          }
        });
      } else {
        try {
          const parsed = JSON.parse(stdout);
          const models = parsed.models || parsed; // fallback for older CLI
          const normalized = models.map((m: any) => ({
            name: m.name,
            size: m.size,
          }));
          resolve(normalized);
        } catch (e) {
          reject(e);
        }
      }
    });
  });
}

/**
 * Installs a new model via `ollama pull "<modelName>"`
 */
export function installModel(modelName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Log the installation attempt
    console.log(`Installing model: ${modelName}`);
    
    // Sanitize the model name to prevent command injection
    const sanitizedModelName = modelName.replace(/[^a-zA-Z0-9:._-]/g, '');
    
    const proc = exec(`ollama pull "${sanitizedModelName}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Installation error: ${error.message}`);
        console.error(`stderr: ${stderr}`);
        reject(stderr || error.message);
      } else {
        console.log(`Model installed successfully: ${stdout.trim()}`);
        resolve(stdout.trim());
      }
    });
    
    // Pipe progress updates if available
    proc.stdout?.on('data', (data) => {
      console.log(`Installation progress: ${data}`);
    });
    
    proc.stderr?.on('data', (data) => {
      console.error(`Installation stderr: ${data}`);
    });
  });
}

/**
 * Verifies if model is installed using `ollama show "<modelName>"`
 */
export function isModelInstalled(modelName: string): Promise<boolean> {
  return new Promise((resolve) => {
    exec(`ollama show "${modelName}"`, (error) => {
      resolve(!error);
    });
  });
}
