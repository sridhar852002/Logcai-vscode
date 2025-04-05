// src/agents/AgentRegistry.ts

import { UserPlan } from '../monetization/planManager';

export interface AgentConfig {
  id: string;
  name: string;
  model: string;
  promptTemplate: string;
  planRequired: UserPlan;
  canAccess: (userPlan: UserPlan) => boolean; // ✅ Add this
}

export const agentRegistry: AgentConfig[] = [
  {
    id: 'fix-compiler-errors',
    name: 'Fix Compiler Errors',
    model: 'mistral',
    promptTemplate: 'Fix errors in the following code:\n\n{{input}}',
    planRequired: 'Free',
    canAccess: (userPlan) => ['Free', 'LocalPro', 'CloudPro'].includes(userPlan),
  },
  {
    id: 'explain-code',
    name: 'Explain Code',
    model: 'gemma3',
    promptTemplate: 'Explain what this code does:\n\n{{input}}',
    planRequired: 'LocalPro',
    canAccess: (userPlan) => ['LocalPro', 'CloudPro'].includes(userPlan),
  },
  {
    id: 'refactor-code',
    name: 'Refactor Code',
    model: 'mistral',
    promptTemplate: 'Refactor this code for clarity and efficiency:\n\n{{input}}',
    planRequired: 'CloudPro',
    canAccess: (userPlan) => userPlan === 'CloudPro',
  },
];
