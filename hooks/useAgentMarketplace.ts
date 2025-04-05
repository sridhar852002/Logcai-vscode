// src/hooks/useAgentMarketplace.ts
import { useState, useEffect, useCallback } from 'react';
import { agentRegistry } from '../agents/AgentRegistry';
import { AgentService } from '../services/agentService';
import vscode from '../utils/vscode';

export function useAgentMarketplace() {
  // State management
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [output, setOutput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Get the user plan from the window object (set by extension)
  const userPlan = (window as any).userPlan || 'Free';
  
  // Run the selected agent
  const handleRun = async (agentId: string) => {
    const agent = agentRegistry.find((a) => a.id === agentId);
    if (!agent) {return;}
    
    // Check if user has access to this agent
    if (!agent.canAccess(userPlan)) {
      setShowUpgrade(true);
      return;
    }
    
    if (!inputCode.trim()) {
      // Get text from editor if input is empty
      vscode.postMessage({
        command: 'getEditorContent',
      });
      return;
    }
    
    // Reset output and start streaming
    setOutput('');
    setStreaming(true);
    setSelectedAgent(agentId);
    setLoading(true);
    
    try {
      // Run the agent
      AgentService.runAgent(agentId, inputCode, userPlan);
    } catch (err) {
      setOutput('[Error] ' + (err as Error).message);
      setStreaming(false);
      setLoading(false);
    }
  };
  
  // Load example code for the selected agent
  const loadExample = (agentId: string) => {
    const example = AgentService.getExampleCode(agentId);
    if (example) {
      setInputCode(example);
    }
  };
  
  // Stop generation
  const stopGeneration = () => {
    AgentService.stopAgentExecution();
    setStreaming(false);
    setLoading(false);
  };
  
  // Handle messages from the extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      if (message.type === 'agentResponse' && message.agentId === selectedAgent) {
        setOutput(prev => prev + message.data);
      } else if (message.type === 'agentStreamEnd' && message.agentId === selectedAgent) {
        setStreaming(false);
        setLoading(false);
      } else if (message.command === 'editorContent') {
        setInputCode(message.text || '');
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [selectedAgent]);
  
  return {
    agentRegistry,
    selectedAgent,
    inputCode,
    setInputCode,
    output,
    streaming,
    loading,
    showUpgrade,
    setShowUpgrade,
    userPlan,
    handleRun,
    loadExample,
    stopGeneration
  };
}