// src/features/CommandGenerator.ts
import * as vscode from 'vscode';
import { generateLocalResponse } from '../ai/localAI';
import { generateCloudResponse } from '../ai/cloudAI';
import logger from '../utils/logger';
import responseCache from '../utils/responseCache';
import networkAwareness, { NetworkStatus } from '../utils/networkAwareness';
import path from 'path';

// Supported command types
export enum CommandType {
  GIT = 'git',
  NPM = 'npm',
  DOCKER = 'docker',
  TERMINAL = 'terminal', // Generic shell commands
  YARN = 'yarn',
  PNPM = 'pnpm',
  GRADLE = 'gradle',
  MAVEN = 'maven',
  PYTHON = 'python',
  KUBERNETES = 'kubectl',
  AWS = 'aws',
  AZURE = 'azure',
  GCP = 'gcp'
}

interface CommandGenerationOptions {
  contextLines?: number;        // Number of lines of context to include
  projectType?: string;         // Type of project (node, python, java, etc.)
  commandType?: CommandType;    // Type of command to generate
  explanation?: boolean;        // Include explanation with command
  alternativeSuggestions?: boolean; // Include alternative commands
  platform?: 'win32' | 'darwin' | 'linux'; // Target platform
  safeMode?: boolean;           // Generate only safe commands (no destructive operations)
  fromHistory?: boolean;        // Consider command history for suggestions
  maxTokens?: number;           // Maximum token length for response
}

interface GeneratedCommand {
  command: string;              // The command to run
  explanation?: string;         // Explanation of what the command does
  alternatives?: string[];      // Alternative commands that achieve similar results
  type: CommandType;            // The type of command
  safe: boolean;                // Whether the command is considered safe
  requiresConfirmation?: boolean; // Whether command needs confirmation before running
  tags?: string[];              // Tags for categorizing the command
}

export class CommandGenerator {
  // Terminal instance for running commands
  private terminal: vscode.Terminal | null = null;
  
  // Command history
  private commandHistory: string[] = [];
  
  // Maximum history length
  private readonly MAX_HISTORY_LENGTH = 50;
  
  constructor() {
    // Try to load command history from workspace state
    try {
      const state = vscode.workspace.getConfiguration('logcai').get('commandHistory') as string[];
      if (Array.isArray(state)) {
        this.commandHistory = state.slice(0, this.MAX_HISTORY_LENGTH);
      }
    } catch (err) {
      logger.debug('Failed to load command history', err);
    }
  }
  
  /**
   * Generate a command based on user query and context
   */
  public async generateCommand(
    query: string,
    options: CommandGenerationOptions = {}
  ): Promise<GeneratedCommand> {
    logger.info(`Generating command for query: ${query}`);
    
    // Set defaults
    const opts: CommandGenerationOptions = {
      contextLines: 10,
      explanation: true,
      alternativeSuggestions: true,
      platform: process.platform as 'win32' | 'darwin' | 'linux',
      safeMode: true,
      fromHistory: true,
      maxTokens: 500,
      ...options
    };
    
    // Check if we have a cached response
    const cacheKey = `cmd:${query}:${JSON.stringify(opts)}`;
    const cachedResponse = responseCache.get(cacheKey, 'command-generator', opts);
    
    if (cachedResponse) {
      try {
        return JSON.parse(cachedResponse) as GeneratedCommand;
      } catch (err) {
        logger.warn('Failed to parse cached command response', err);
        // Continue with generation if parsing fails
      }
    }
    
    // Get current file and project context
    const context = await this.getContext(opts.contextLines!);
    
    // Get command history if requested
    const historyContext = opts.fromHistory ? 
      `\nRecent commands: ${this.commandHistory.slice(0, 10).join(', ')}` :
      '';
    
    // Build prompt
    const prompt = this.buildCommandPrompt(query, context, opts, historyContext);
    
    try {
      // Choose which AI service to use based on network status
      const isOnline = networkAwareness.isOnline();
      const modelToUse = isOnline ? 'gpt-3.5-turbo' : 'mistral';
      
      // Generate the response
      const response = isOnline ? 
        await this.generateWithCloudAI(prompt, modelToUse, opts) :
        await this.generateWithLocalAI(prompt, 'mistral', opts);
      
      // Parse the response
      const command = this.parseCommandResponse(response, opts);
      
      // Cache the result
      responseCache.set(cacheKey, JSON.stringify(command), 'command-generator', opts);
      
      // Add to history if it's new
      if (!this.commandHistory.includes(command.command)) {
        this.commandHistory.unshift(command.command);
        this.commandHistory = this.commandHistory.slice(0, this.MAX_HISTORY_LENGTH);
        this.saveCommandHistory();
      }
      
      return command;
    } catch (err) {
      logger.error('Failed to generate command', err);
      
      // Return a basic error response
      return {
        command: '',
        explanation: `Error generating command: ${err instanceof Error ? err.message : 'Unknown error'}`,
        type: options.commandType || CommandType.TERMINAL,
        safe: true
      };
    }
  }
  
  /**
   * Execute a generated command in the terminal
   */
  public async executeCommand(command: GeneratedCommand | string): Promise<boolean> {
    const commandStr = typeof command === 'string' ? command : command.command;
    
    if (!commandStr) {
      logger.warn('Attempted to execute empty command');
      return false;
    }
    
    try {
      // Get or create terminal
      if (!this.terminal || this.terminal.exitStatus !== undefined) {
        this.terminal = vscode.window.createTerminal('Logcai Commands');
      }
      
      // Show the terminal
      this.terminal.show();
      
      // If command is potentially destructive and requires confirmation
      if (typeof command !== 'string' && command.requiresConfirmation) {
        // Send the command but don't execute it (user needs to press Enter)
        this.terminal.sendText(commandStr, false);
        
        // Let the user know they need to confirm
        vscode.window.showInformationMessage(
          'Review the command and press Enter to execute, or modify as needed.',
          { modal: false }
        );
      } else {
        // Execute the command directly
        this.terminal.sendText(commandStr, true);
      }
      
      // Add to history
      if (!this.commandHistory.includes(commandStr)) {
        this.commandHistory.unshift(commandStr);
        this.commandHistory = this.commandHistory.slice(0, this.MAX_HISTORY_LENGTH);
        this.saveCommandHistory();
      }
      
      return true;
    } catch (err) {
      logger.error('Failed to execute command in terminal', err);
      vscode.window.showErrorMessage(`Failed to execute command: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return false;
    }
  }
  
  /**
   * Get a list of command suggestions based on the current context
   */
  public async suggestCommands(count: number = 5): Promise<GeneratedCommand[]> {
    // Get current file and project context
    const context = await this.getContext(10);
    
    // Build prompt for command suggestions
    const prompt = `
      Based on the current project context, suggest ${count} useful commands that might be helpful.
      Context:
      ${context}
      
      ${this.commandHistory.length > 0 ? `Recent commands: ${this.commandHistory.slice(0, 5).join(', ')}` : ''}
      
      Return the suggestions in JSON format with the following structure:
      [{ "command": "...", "explanation": "...", "type": "...", "safe": true/false }]
    `;
    
    try {
      // Generate suggestions
      const isOnline = networkAwareness.isOnline();
      const response = isOnline ? 
        await this.generateWithCloudAI(prompt, 'gpt-3.5-turbo', { maxTokens: 1000 }) :
        await this.generateWithLocalAI(prompt, 'mistral', { maxTokens: 1000 });
      
      // Parse response
      let suggestions: GeneratedCommand[] = [];
      
      try {
        // Try to parse as JSON
        const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                          response.match(/\[([\s\S]*?)\]/) ||
                          [null, response];
                          
        const jsonText = jsonMatch ? jsonMatch[1] : response;
        suggestions = JSON.parse(jsonText);
        
        // Validate each suggestion has required fields
        suggestions = suggestions.filter(s => s && s.command && s.type)
                                 .map(s => ({
                                   ...s,
                                   safe: s.safe === undefined ? true : s.safe,
                                   requiresConfirmation: !s.safe
                                 }));
                                 
        // Limit to requested count
        suggestions = suggestions.slice(0, count);
      } catch (e) {
        logger.warn('Failed to parse command suggestions JSON', e);
        
        // Fallback: Extract commands using regex
        const commandMatches = response.match(/`([^`]+)`/g) || [];
        suggestions = commandMatches.map(cmd => ({
          command: cmd.replace(/`/g, '').trim(),
          type: CommandType.TERMINAL,
          safe: true
        })).slice(0, count);
      }
      
      return suggestions;
    } catch (err) {
      logger.error('Failed to suggest commands', err);
      return [];
    }
  }
  
  /**
   * Explain a given command
   */
  public async explainCommand(command: string): Promise<string> {
    const prompt = `
      Explain the following command in detail:
      \`${command}\`
      
      Include:
      1. What the command does
      2. What each parameter or flag means
      3. Any potential risks or side effects
      4. When you would typically use this command
    `;
    
    try {
      // Check cache first
      const cacheKey = `cmd-explain:${command}`;
      const cachedResponse = responseCache.get(cacheKey, 'command-generator', {});
      
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // Generate explanation
      const isOnline = networkAwareness.isOnline();
      const explanation = isOnline ? 
        await this.generateWithCloudAI(prompt, 'gpt-3.5-turbo', { maxTokens: 500 }) :
        await this.generateWithLocalAI(prompt, 'mistral', { maxTokens: 500 });
      
      // Cache the result
      responseCache.set(cacheKey, explanation, 'command-generator', {});
      
      return explanation;
    } catch (err) {
      logger.error('Failed to explain command', err);
      return `Could not generate explanation: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
  }
  
  /**
   * Build a prompt for command generation
   */
  private buildCommandPrompt(
    query: string, 
    context: string,
    options: CommandGenerationOptions,
    historyContext: string
  ): string {
    // Determine safe mode requirements
    const safetyInstructions = options.safeMode ?
      'Generate only safe commands that won\'t cause data loss or destructive operations. Avoid commands like rm -rf, drop, delete without confirmation.' :
      'You can suggest any command, even potentially destructive ones, but mark them as requiring confirmation.';
      
    // Specify platform
    const platformInstructions = `Target platform: ${options.platform}`;
    
    // Specify command type if provided
    const commandTypeInstructions = options.commandType ?
      `Focus on generating ${options.commandType} commands.` :
      'Generate the most appropriate command type for the query.';
      
    // Build the full prompt
    return `
      You are a command generation assistant for developers.
      
      USER QUERY: ${query}
      
      CONTEXT INFORMATION:
      ${context}
      ${historyContext}
      
      REQUIREMENTS:
      ${safetyInstructions}
      ${platformInstructions}
      ${commandTypeInstructions}
      ${options.explanation ? 'Include a detailed explanation of what the command does.' : ''}
      ${options.alternativeSuggestions ? 'Suggest alternative commands that achieve similar results.' : ''}
      
      Return your response as JSON with the following structure:
      {
        "command": "the_command_to_run",
        "explanation": "detailed explanation",
        "alternatives": ["alt command 1", "alt command 2"],
        "type": "one of the CommandType values",
        "safe": true/false,
        "requiresConfirmation": true/false,
        "tags": ["tag1", "tag2"]
      }
    `;
  }
  
  /**
   * Generate a response using cloud API
   */
  private async generateWithCloudAI(
    prompt: string,
    model: string,
    options: CommandGenerationOptions
  ): Promise<string> {
    return await generateCloudResponse(
      'OpenAI', // Provider
      model,
      prompt,
      {
        stream: false,
        maxTokens: options.maxTokens || 500,
        temperature: 0.3 // Low temperature for more precise outputs
      }
    );
  }
  
  /**
   * Generate a response using local AI
   */
  private async generateWithLocalAI(
    prompt: string,
    model: string,
    options: CommandGenerationOptions
  ): Promise<string> {
    return await generateLocalResponse(
      prompt,
      model,
      {
        stream: false,
        maxTokens: options.maxTokens
      }
    );
  }
  
  /**
   * Parse the AI response into a structured command
   */
  private parseCommandResponse(response: string, options: CommandGenerationOptions): GeneratedCommand {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                        response.match(/\{[\s\S]*?\}/);
                        
      if (jsonMatch) {
        const jsonStr = jsonMatch[0].replace(/```json\n|\n```/g, '');
        const parsed = JSON.parse(jsonStr);
        
        // Ensure required fields
        if (!parsed.command) {
          throw new Error('Generated response missing command field');
        }
        
        return {
          command: parsed.command,
          explanation: parsed.explanation || undefined,
          alternatives: parsed.alternatives || undefined,
          type: parsed.type || options.commandType || CommandType.TERMINAL,
          safe: parsed.safe !== undefined ? parsed.safe : true,
          requiresConfirmation: parsed.requiresConfirmation !== undefined ? 
            parsed.requiresConfirmation : !parsed.safe,
          tags: parsed.tags || undefined
        };
      }
      
      // Fallback: Try to extract command using regex
      const commandMatch = response.match(/`([^`]+)`/) || response.match(/Command:\s*(.+)$/m);
      
      if (commandMatch) {
        return {
          command: commandMatch[1].trim(),
          explanation: response.replace(commandMatch[0], '').trim(),
          type: options.commandType || CommandType.TERMINAL,
          safe: true,
          requiresConfirmation: false
        };
      }
      
      // Last resort: Just return the whole response as a command
      return {
        command: response.trim(),
        type: options.commandType || CommandType.TERMINAL,
        safe: true,
        requiresConfirmation: false
      };
    } catch (err) {
      logger.warn('Failed to parse command response', err);
      
      // Return a basic error response
      return {
        command: '',
        explanation: `Error parsing command response: ${err instanceof Error ? err.message : 'Unknown error'}`,
        type: options.commandType || CommandType.TERMINAL,
        safe: true
      };
    }
  }
  
  /**
   * Get context information for command generation
   */
  private async getContext(contextLines: number): Promise<string> {
    let context = '';
    
    try {
      // Get active editor content
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const document = editor.document;
        const selection = editor.selection;
        
        // Get selected text or context around cursor
        if (!selection.isEmpty) {
          context += `Selected text:\n${document.getText(selection)}\n\n`;
        } else {
          // Get lines around cursor
          const startLine = Math.max(0, selection.active.line - contextLines);
          const endLine = Math.min(document.lineCount - 1, selection.active.line + contextLines);
          
          const rangeToGet = new vscode.Range(
            new vscode.Position(startLine, 0),
            new vscode.Position(endLine, document.lineAt(endLine).text.length)
          );
          
          context += `Current file (${path.basename(document.fileName)}):\n`;
          context += document.getText(rangeToGet) + '\n\n';
        }
        
        // Add file type info
        context += `File type: ${document.languageId}\n`;
      }
      
      // Get project type information
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (workspaceFolders && workspaceFolders.length > 0) {
        const projectRoot = workspaceFolders[0].uri.fsPath;
        context += `Project root: ${projectRoot}\n`;
        
        // Try to detect project type
        let projectType = 'unknown';
        try {
          // Check for package.json
          const packageJsonUri = vscode.Uri.joinPath(workspaceFolders[0].uri, 'package.json');
          await vscode.workspace.fs.stat(packageJsonUri);
          projectType = 'node';
          
          // Read package.json to get more info
          const packageJsonContent = await vscode.workspace.fs.readFile(packageJsonUri);
          const packageJson = JSON.parse(packageJsonContent.toString());
          
          if (packageJson.dependencies || packageJson.devDependencies) {
            context += 'Node packages:\n';
            
            const allDeps = {
              ...(packageJson.dependencies || {}),
              ...(packageJson.devDependencies || {})
            };
            
            // Add top packages
            const topPackages = Object.keys(allDeps).slice(0, 10);
            context += topPackages.join(', ') + '\n';
          }
        } catch (e) {
          // Not a Node.js project or error reading package.json
        }
        
        // Check for other project types
        try {
          // Check for pom.xml
          const pomXmlUri = vscode.Uri.joinPath(workspaceFolders[0].uri, 'pom.xml');
          await vscode.workspace.fs.stat(pomXmlUri);
          projectType = 'java-maven';
        } catch (e) {
          // Not a Maven project
        }
        
        try {
          // Check for build.gradle
          const gradleUri = vscode.Uri.joinPath(workspaceFolders[0].uri, 'build.gradle');
          await vscode.workspace.fs.stat(gradleUri);
          projectType = 'java-gradle';
        } catch (e) {
          // Not a Gradle project
        }
        
        try {
          // Check for requirements.txt
          const reqsUri = vscode.Uri.joinPath(workspaceFolders[0].uri, 'requirements.txt');
          await vscode.workspace.fs.stat(reqsUri);
          projectType = 'python';
        } catch (e) {
          // Not a Python project
        }
        
        // Add project type to context
        context += `Project type: ${projectType}\n`;
      }
      
      return context;
    } catch (err) {
      logger.warn('Error getting context for command generation', err);
      return 'Context unavailable';
    }
  }
  
  /**
   * Save command history to workspace state
   */
  private saveCommandHistory(): void {
    try {
      vscode.workspace.getConfiguration('logcai').update(
        'commandHistory',
        this.commandHistory,
        vscode.ConfigurationTarget.Workspace
      );
    } catch (err) {
      logger.debug('Failed to save command history', err);
    }
  }
}

// Export singleton instance
export const commandGenerator = new CommandGenerator();
export default commandGenerator;