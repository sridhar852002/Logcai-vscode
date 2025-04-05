// src/services/types.ts - Complete implementation
export type AIMode = 'local' | 'cloud';
export type UserPlan = 'Free' | 'LocalPro' | 'CloudPro';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  error?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  modelId: string;
  createdAt: Date;
  updatedAt: Date;
  systemPrompt?: string;
  temperature?: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: 'OpenAI' | 'Anthropic' | 'Ollama';
  planRequired: UserPlan;
  mode: AIMode;
  streaming: boolean;
  canAccess: (userPlan: UserPlan) => boolean;
}

export interface Agent {
  id: string;
  name: string;
  model: string;
  promptTemplate: string;
  planRequired: UserPlan;
  canAccess: (userPlan: UserPlan) => boolean;
}