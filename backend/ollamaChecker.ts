// src/ai/ollamaChecker.ts

import { spawn, exec } from 'node:child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import logger from '../utils/logger';

const execAsync = promisify(exec);
let alreadyStarted = false;

export async function ensureOllamaInstalled(): Promise<boolean> {
  try {
    await execAsync('ollama --version');
    return true;
  } catch {
    vscode.window.showErrorMessage('❌ Ollama is not installed.');
    vscode.env.openExternal(vscode.Uri.parse('https://ollama.ai/download'));
    return false;
  }
}

export async function startOllamaServer(): Promise<void> {
  if (alreadyStarted) {return;}
  alreadyStarted = true;

  const { promise, resolve, reject } = makeCompleter<void>();
  const proc = spawn('ollama', ['serve']);

  proc.stdout?.on('data', (data: Buffer) => {
    const line = data.toString();
    if (line.includes('Listening on')) {
      resolve();
    }
  });

  proc.stderr?.on('data', (data: Buffer) => {
    const line = data.toString();
    if (line.includes('Listening on')) {
      resolve();
    }
  });

  proc.on('error', (err) => {
    logger.error('❌ Ollama failed to start.', err);
    reject(err);
  });

  return promise;
}

export async function getOllamaModels(): Promise<string[]> {
  try {
    // Try with --json flag first
    try {
      const { stdout } = await execAsync('ollama list --json');
      // If successful, process JSON
      const parsed = JSON.parse(stdout);
      return (parsed.models || parsed).map((m: any) => m.name || m);
    } catch (jsonErr) {
      // Fallback to plain text parsing if --json flag isn't supported
      const { stdout } = await execAsync('ollama list');
      return stdout
        .split('\n')
        .slice(1) // Skip header row
        .map(line => line.split(/\s+/)[0]) // Extract model name (first column)
        .filter(Boolean); // Remove empty entries
    }
  } catch (err) {
    logger.error('🔴 Failed to list Ollama models.', err);
    return [];
  }
}

function makeCompleter<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
