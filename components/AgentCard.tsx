import React from 'react';
import { AgentConfig } from '../agents/AgentRegistry';
// If you use a centralized bridge file
// import { vscode } from '../../utils/vscodeBridge';
const vscode = acquireVsCodeApi();

interface AgentCardProps {
  agent: AgentConfig;
  userPlan: string; // 🔧 keep as string for flexibility
  onRun: (agentId: string) => void;
}

const AgentCard: React.FC<AgentCardProps> = ({ agent, userPlan, onRun }) => {
  const locked = !agent.canAccess(userPlan as any); // 🔧 cast to UserPlan if needed

  return (
    <div className="agent-card" style={{
      backgroundColor: locked ? '#1c1c1c' : '#111',
      border: `1px solid ${locked ? '#444' : '#2a2a2a'}`,
      borderRadius: '10px',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: '1rem',
      height: '100%',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease'
    }}>
      <div>
        <h4 style={{
          fontSize: '16px',
          marginBottom: '0.5rem',
          color: locked ? '#aaa' : '#fff'
        }}>
          {agent.name}
          {locked && (
            <span style={{
              marginLeft: '8px',
              fontSize: '12px',
              color: '#f39c12',
              background: '#2c2c2c',
              padding: '2px 6px',
              borderRadius: '6px'
            }}>
              🔒 {agent.planRequired} only
            </span>
          )}
        </h4>
        <p style={{
          fontSize: '13px',
          color: '#bbb',
          marginBottom: '0.75rem'
        }}>
          {agent.promptTemplate?.slice(0, 100)}...
        </p>
      </div>

      <button
        onClick={() => {
          if (!locked) {
            onRun(agent.id);
          } else {
            vscode.postMessage({
              command: 'triggerUpgradeModal',
              requiredPlan: agent.planRequired
            });
          }
        }}
        style={{
          backgroundColor: locked ? '#333' : '#00e5ff',
          color: locked ? '#888' : '#000',
          fontWeight: 'bold',
          padding: '10px 12px',
          fontSize: '14px',
          borderRadius: '6px',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          width: '100%'
        }}
      >
        {locked ? 'Upgrade to Unlock' : 'Run Agent'}
      </button>
    </div>
  );
};

export default AgentCard;
