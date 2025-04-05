import { agentRegistry } from './AgentRegistry';
import { ExplainCodeAgent } from './builtin/ExplainCodeAgent';
import { modelRegistry } from '../ai/modelRegistry';
import { generateLocalResponse } from '../ai/localAI';
import { generateCloudResponse } from '../ai/cloudAI';
import { UserPlan, isPlanAtLeast } from '../monetization/planManager';

type StreamCallback = (token: string) => void;

function isCloudProvider(p: string): p is 'OpenAI' | 'Anthropic' {
  return p === 'OpenAI' || p === 'Anthropic';
}

/**
 * Runs any agent by ID.
 * - Logic-based agents like `explain-code` are run via custom handlers
 * - Others use promptTemplate + model-based generation
 */
export async function runAgent(
  agentId: string,
  input: any,
  streamCallback?: StreamCallback,
  userPlan: UserPlan = 'Free'
): Promise<string> {
  const config = agentRegistry.find((agent) => agent.id === agentId);
  if (!config) {
    return `❌ Agent '${agentId}' not found.`;
  }

  // Check access based on plan
  if (!config.canAccess(userPlan)) {
    return `❌ "${config.name}" requires ${config.planRequired} plan.`;
  }

  // ✅ 1. Logic-based agent
  if (agentId === 'explain-code') {
    console.log('[DEBUG] Running ExplainCodeAgent');
    try {
      const result = await ExplainCodeAgent.run({
        input: {
          code: input,
          filename: 'input.ts'
        }
      });
      return result.output;
    } catch (err) {
      return `❌ ExplainCodeAgent error: ${(err as Error).message}`;
    }
  }
  
  // ✅ 2. Prompt-template-based agent
  const model = modelRegistry[config.model];
  if (!model) {
    return `❌ Model "${config.model}" not found`;
  }

  const prompt = config.promptTemplate.replace('{{input}}', input || '');

  try {
    // Local model
    if (model.mode === 'local') {
      let fullOutput = '';
      await generateLocalResponse(
        prompt,
        model.id,
        { stream: !!streamCallback },
        (token) => {
          fullOutput += token;
          streamCallback?.(token);
        }
      );
      return fullOutput;
    }

    // Cloud model
    else if (model.mode === 'cloud' && isCloudProvider(model.provider)) {
      let fullOutput = '';
      await generateCloudResponse(
        model.provider,
        model.id,
        prompt,
        { stream: !!streamCallback },
        (token: string) => {
          fullOutput += token;
          streamCallback?.(token);
        }
      );
      return fullOutput;
    }

    return `❌ Unknown or unsupported model mode for "${model.id}"`;
  } catch (err) {
    return `❌ Failed to run agent "${agentId}": ${(err as Error).message}`;
  }
}
