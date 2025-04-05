// src/features/AgentRunner.ts
import { agentRegistry } from '../agents/AgentRegistry';
import { isPlanAtLeast } from '../monetization/planManager';
import { LLMService } from '../ai/LLMService';

export async function runAgent(
  agentId: string,
  inputCode: string,
  onToken: (token: string) => void // ✅ Required now
): Promise<void> { // ✅ No longer returns string
  const agent = agentRegistry.find((a) => a.id === agentId);
  if (!agent) {throw new Error(`Agent ${agentId} not found`);}

  if (!isPlanAtLeast(agent.planRequired)) {
    throw new Error(`${agent.name} requires ${agent.planRequired} plan`);
  }

  const filledPrompt = agent.promptTemplate.replace('{input}', inputCode.trim());
  await LLMService(agent.model, filledPrompt, { stream: true }, onToken);
}
