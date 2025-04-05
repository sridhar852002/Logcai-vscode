// src/ai/modelRegistry.ts
export type Plan = 'Free' | 'LocalPro' | 'CloudPro';
export type ModelMode = 'local' | 'cloud';

export interface ModelInfo {
  id: string;
  name: string;
  provider: 'OpenAI' | 'Anthropic' | 'Ollama';
  planRequired: Plan;
  mode: ModelMode;
  streaming: boolean;
  canAccess: (userPlan: Plan) => boolean;
}

export const modelRegistry: Record<string, ModelInfo> = {
  'mistral': {
    id: 'mistral',
    name: 'Mistral 7B',
    provider: 'Ollama',
    planRequired: 'Free',
    mode: 'local',
    streaming: true,
    canAccess: (plan) => ['Free', 'LocalPro', 'CloudPro'].includes(plan),
  },
  'gemma3': {
    id: 'gemma3',
    name: 'Gemma3',
    provider: 'Ollama',
    planRequired: 'LocalPro',
    mode: 'local',
    streaming: true,
    canAccess: (plan) => ['LocalPro', 'CloudPro'].includes(plan),
  },
  'gpt-4': {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: 'OpenAI',
    planRequired: 'CloudPro',
    mode: 'cloud',
    streaming: true,
    canAccess: (plan) => plan === 'CloudPro',
  },
  'claude-3-sonnet': {
    id: 'claude-3-sonnet',
    name: 'Claude 3 Sonnet',
    provider: 'Anthropic',
    planRequired: 'CloudPro',
    mode: 'cloud',
    streaming: true,
    canAccess: (plan) => plan === 'CloudPro',
  }
};
