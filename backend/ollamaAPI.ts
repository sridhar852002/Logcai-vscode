// src/backend/ollamaAPI.ts
import { execSync } from 'child_process';

export function listOllamaModels(): string[] {
  try {
    const result = execSync('ollama list', { encoding: 'utf-8' });
    const lines = result.split('\n').slice(1); // skip header
    const models = lines
      .filter(line => line.trim())
      .map(line => line.split(/\s+/)[0]); // extract model name
    return models;
  } catch (err) {
    console.error('Failed to list models:', err);
    return [];
  }
}
