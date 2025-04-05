// src/services/agentService.ts
import vscode from '../utils/vscode';
import { isPlanAtLeast } from '../monetization/planManager';
import { agentRegistry, AgentConfig } from '../agents/AgentRegistry';

// Re-export AgentConfig as Agent to maintain API compatibility
// but with a compatible type definition
export type UserPlan = 'Free' | 'LocalPro' | 'CloudPro';
export type Agent = AgentConfig;

/**
 * Service for interacting with AI agents
 */
export class AgentService {
  /**
   * Check if an agent can be accessed with the current user plan
   */
  static canAccessAgent(agent: Agent, userPlan: UserPlan | string): boolean {
    return agent.canAccess(userPlan as UserPlan);
  }
  
  /**
   * Run an agent with input code
   */
  static runAgent(agentId: string, input: string, userPlan: UserPlan | string): void {
    vscode.postMessage({
      command: 'runAgent',
      agentId,
      input,
      userPlan
    });
  }
  
  /**
   * Get example code for an agent
   */
  static getExampleCode(agentId: string): string {
    const examples: Record<string, string> = {
      'fix-compiler-errors': `// This code has errors
function calculateTotal(items) {
  let total = 0;
  for (const item of items) {
    total += item.price;
  }
  return totl; // Typo error
}
const cart = [
  { name: "Product 1", price: 10 },
  { name: "Product 2", price: 20 },
  { name: "Product 3", prce: 30 } // Missing 'i' in price
];
console.log(calculateTotal(cart));`,
      'explain-code': `// Please explain this code
async function fetchUserData(userId) {
  try {
    const response = await fetch(\`https://api.example.com/users/\${userId}\`);
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
    const userData = await response.json();
    return {
      ...userData,
      fullName: \`\${userData.firstName} \${userData.lastName}\`,
      isActive: userData.lastLogin > Date.now() - 86400000
    };
  } catch (error) {
    console.error("Failed to fetch user data:", error);
    return null;
  }
}`,
      'refactor-code': `// Help me refactor this code
function processData(data) {
  // Calculate total
  let total = 0;
  for (let i = 0; i < data.length; i++) {
    total = total + data[i].value;
  }
  // Find maximum
  let max = data[0].value;
  for (let i = 0; i < data.length; i++) {
    if (data[i].value > max) {
      max = data[i].value;
    }
  }
  // Find minimum
  let min = data[0].value;
  for (let i = 0; i < data.length; i++) {
    if (data[i].value < min) {
      min = data[i].value;
    }
  }
  // Calculate average
  let avg = total / data.length;
  // Return results
  return {
    total: total,
    maximum: max,
    minimum: min,
    average: avg
  };
}`
    };
    
    return examples[agentId] || '';
  }
  
  /**
   * Stop the current agent execution
   */
  static stopAgentExecution(): void {
    vscode.postMessage({ command: 'stopStream' });
  }
  
  /**
   * Get agent by ID
   */
  static getAgentById(agentId: string): Agent | undefined {
    return agentRegistry.find(agent => agent.id === agentId);
  }
  
  /**
   * Get available agents for the current user plan
   */
  static getAvailableAgents(userPlan: UserPlan | string): Agent[] {
    return agentRegistry.filter(agent => this.canAccessAgent(agent, userPlan));
  }
  
  /**
   * Validate input code before running an agent
   */
  static validateInputCode(code: string): boolean {
    return code.trim().length > 0;
  }
  
  /**
   * Format agent prompt with input code
   */
  static formatAgentPrompt(agent: Agent, inputCode: string): string {
    return agent.promptTemplate.replace('{input}', inputCode.trim());
  }
}