// src/components/agent/AgentCard.tsx
import React, { memo, useState } from 'react';
import { useTheme } from '../../styles/ThemeProvider';
import { Agent, UserPlan } from '../../services/agentService';

interface AgentCardProps {
  agent: Agent;
  onRun: (agentId: string) => void;
  userPlan: string | UserPlan;
}

const AgentCard = memo(({ agent, onRun, userPlan }: AgentCardProps) => {
  const theme = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const canAccess = agent.canAccess(userPlan as UserPlan);

  // Helper function to get appropriate icon for each agent type
  const getAgentIcon = (agentId: string) => {
    const icons: Record<string, { icon: string, color: string }> = {
      'fix-compiler-errors': { icon: '🔧', color: '#FF9800' },
      'explain-code': { icon: '📝', color: '#2196F3' },
      'refactor-code': { icon: '🔄', color: '#4CAF50' },
      'optimizer': { icon: '⚡', color: '#9C27B0' },
      'docwriter': { icon: '📚', color: '#FF5722' },
      'default': { icon: '🤖', color: '#00E5FF' }
    };
    return icons[agentId] || icons.default;
  };

  // Get agent icon and color
  const { icon, color } = getAgentIcon(agent.id);

  // Get a trimmed and more readable version of the prompt template for display
  const getFormattedDescription = () => {
    // Extract first line from prompt template for description
    const firstLine = agent.promptTemplate.split('\n')[0];
    
    // Remove any template markers like '{input}'
    const cleanedLine = firstLine.replace(/{[^}]+}/g, '');
    
    return cleanedLine.length > 80 
      ? cleanedLine.substring(0, 80) + '...' 
      : cleanedLine;
  };

  // Helper to display plan requirement badge
  const getPlanBadge = () => {
    const planColors: Record<string, { bg: string, text: string }> = {
      'Free': { bg: '#4CAF50', text: '#000' },
      'LocalPro': { bg: '#2196F3', text: '#000' },
      'CloudPro': { bg: '#9C27B0', text: '#fff' }
    };
    
    const badgeStyle = planColors[agent.planRequired] || { bg: '#888', text: '#fff' };
    
    return (
      <span style={{
        position: 'absolute',
        top: '12px',
        right: '12px',
        backgroundColor: badgeStyle.bg,
        color: badgeStyle.text,
        fontSize: '11px',
        padding: '3px 8px',
        borderRadius: '12px',
        fontWeight: 'bold',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        {!canAccess && <span>🔒</span>}
        {agent.planRequired}
      </span>
    );
  };

  return (
    <div 
      className="agent-card" 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: theme.colors.backgroundLight,
        borderRadius: '12px',
        border: `1px solid ${isHovered && canAccess ? color : theme.colors.border}`,
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        transition: 'all 0.2s ease',
        position: 'relative',
        opacity: canAccess ? 1 : 0.75,
        boxShadow: isHovered && canAccess ? `0 8px 16px rgba(0, 0, 0, 0.1), 0 0 0 1px ${color}22` : 'none',
        transform: isHovered && canAccess ? 'translateY(-4px)' : 'translateY(0)',
      }}
    >
      {/* Plan badge */}
      {getPlanBadge()}

      {/* Icon and name */}
      <div style={{ 
        display: 'flex',
        alignItems: 'flex-start',
        marginBottom: '12px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          backgroundColor: `${color}22`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
          marginRight: '12px',
          boxShadow: `0 2px 8px ${color}22`
        }}>
          {icon}
        </div>
        
        <div style={{ flex: 1 }}>
          <h3 style={{
            margin: '0 0 4px 0',
            fontSize: '18px',
            fontWeight: 'bold',
            color: canAccess ? theme.colors.text : theme.colors.textMuted
          }}>
            {agent.name}
          </h3>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            color: theme.colors.textMuted
          }}>
            <span>Model: {agent.model}</span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p style={{
        color: theme.colors.textSecondary,
        fontSize: '14px',
        lineHeight: '1.5',
        margin: '0 0 16px 0',
        flex: 1
      }}>
        {getFormattedDescription()}
      </p>

      {/* Use cases (could be expanded based on agent properties) */}
      <div style={{
        marginBottom: '16px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px'
      }}>
        {['Code', agent.model].map((tag, index) => (
          <span key={index} style={{
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: '12px',
            backgroundColor: theme.colors.backgroundDark,
            color: theme.colors.textMuted
          }}>
            {tag}
          </span>
        ))}
      </div>

      {/* Action Button */}
      <button
        onClick={() => canAccess && onRun(agent.id)}
        disabled={!canAccess}
        style={{
          backgroundColor: canAccess ? color : theme.colors.backgroundDark,
          color: canAccess ? '#000' : theme.colors.textMuted,
          border: 'none',
          borderRadius: '8px',
          padding: '10px',
          cursor: canAccess ? 'pointer' : 'not-allowed',
          fontWeight: 'bold',
          marginTop: 'auto',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
      >
        {canAccess ? (
          <>
            <span>{icon}</span> Run Agent
          </>
        ) : (
          <>
            <span>🔒</span> {agent.planRequired} Required
          </>
        )}
      </button>
    </div>
  );
});

export default AgentCard;