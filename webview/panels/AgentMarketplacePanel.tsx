// src/webview/panels/AgentMarketplacePanel.tsx
import React, { memo, useState, useMemo } from 'react';
import StreamingRenderer from '../../components/MemoizedStreamingRenderer';
import UpgradeModal from '../../monetization/UpgradeModal';
import AgentCard from '../../components/agent/AgentCard';
import { useAgentMarketplace } from '../../hooks/useAgentMarketplace';
import { useTheme } from '../../styles/ThemeProvider';

// Define categories for agent filtering
const AGENT_CATEGORIES = [
  "All",
  "Code Analysis",
  "Code Generation",
  "Refactoring",
  "Documentation"
];

// Map agent IDs to categories for filtering
const AGENT_CATEGORY_MAP: Record<string, string> = {
  'fix-compiler-errors': 'Code Analysis',
  'explain-code': 'Code Analysis',
  'refactor-code': 'Refactoring',
  'optimizer': 'Refactoring',
  'docwriter': 'Documentation'
};

const AgentMarketplacePanel: React.FC = () => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Use our custom hook for agent marketplace state and logic
  const {
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
  } = useAgentMarketplace();

  // Filter agents based on search query and selected category
  const filteredAgents = useMemo(() => {
    return agentRegistry.filter(agent => {
      const matchesSearch = 
        agent.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        agent.promptTemplate.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = 
        selectedCategory === 'All' || 
        AGENT_CATEGORY_MAP[agent.id] === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [agentRegistry, searchQuery, selectedCategory]);

  // Group agents by category for display
  const agentsByCategory = useMemo(() => {
    const groupedAgents: Record<string, typeof agentRegistry> = {};
    
    filteredAgents.forEach(agent => {
      const category = AGENT_CATEGORY_MAP[agent.id] || 'Uncategorized';
      if (!groupedAgents[category]) {
        groupedAgents[category] = [];
      }
      groupedAgents[category].push(agent);
    });
    
    return groupedAgents;
  }, [filteredAgents]);

  return (
    <div className="agent-marketplace" style={{
      padding: '1.5rem',
      backgroundColor: theme.colors.background,
      height: '100%',
      overflow: 'auto',
      color: theme.colors.text
    }}>
      <h2 style={{
        fontSize: '24px',
        marginBottom: '1.5rem',
        color: theme.colors.primary,
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        🤖 AI Agents Marketplace
      </h2>

      {/* Search and Filter Controls */}
      <div style={{
        display: 'flex',
        marginBottom: '1.5rem',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        {/* Search input */}
        <div style={{
          position: 'relative',
          flex: '1',
          minWidth: '200px'
        }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search agents..."
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              backgroundColor: theme.colors.backgroundLight,
              color: theme.colors.text,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
          <span style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: theme.colors.textMuted,
            fontSize: '14px'
          }}>
            🔍
          </span>
        </div>

        {/* Category filter */}
        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          {AGENT_CATEGORIES.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              style={{
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: selectedCategory === category ? 'bold' : 'normal',
                backgroundColor: selectedCategory === category 
                  ? theme.colors.primary 
                  : theme.colors.backgroundLight,
                color: selectedCategory === category 
                  ? '#000' 
                  : theme.colors.textSecondary,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Code Input Area */}
      <div className="code-input-container" style={{ marginBottom: '1.5rem' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem'
        }}>
          <h3 style={{ margin: 0, fontSize: '16px' }}>Code Input</h3>
          {selectedAgent && (
            <button
              onClick={() => loadExample(selectedAgent)}
              style={{
                backgroundColor: theme.colors.backgroundLight,
                color: theme.colors.text,
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>📄</span> Load Example
            </button>
          )}
        </div>
        <textarea
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value)}
          placeholder="Paste your code snippet here or select an agent first..."
          style={{
            width: '100%',
            minHeight: '200px',
            fontFamily: 'monospace',
            backgroundColor: theme.colors.backgroundLight,
            color: theme.colors.text,
            padding: '1rem',
            marginBottom: '1rem',
            borderRadius: '8px',
            border: `1px solid ${theme.colors.border}`,
            resize: 'vertical',
            fontSize: '14px',
            lineHeight: '1.5',
            transition: 'border-color 0.2s ease'
          }}
        />
      </div>

      {/* Agents Grid with Categories */}
      <h3 style={{ 
        marginBottom: '1rem', 
        fontSize: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        Available Agents
        {filteredAgents.length > 0 && (
          <span style={{
            fontSize: '13px',
            color: theme.colors.textMuted,
            fontWeight: 'normal'
          }}>
            ({filteredAgents.length} found)
          </span>
        )}
      </h3>

      {filteredAgents.length === 0 ? (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: theme.colors.backgroundLight,
          borderRadius: '8px',
          color: theme.colors.textMuted
        }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔍</div>
          <p>No agents found matching your criteria</p>
          <button 
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
            }}
            style={{
              backgroundColor: 'transparent',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '4px',
              padding: '6px 12px',
              marginTop: '12px',
              color: theme.colors.textSecondary,
              cursor: 'pointer'
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        Object.entries(agentsByCategory).length > 0 && selectedCategory === 'All' ? (
          // Grouped by category when "All" is selected
          Object.entries(agentsByCategory).map(([category, agents]) => (
            <div key={category} style={{ marginBottom: '2rem' }}>
              <h4 style={{ 
                marginBottom: '0.75rem',
                color: theme.colors.textSecondary,
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                {category}
                <div style={{ 
                  height: '1px', 
                  backgroundColor: theme.colors.border, 
                  flex: 1 
                }} />
              </h4>
              <div className="agents-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '1rem'
              }}>
                {agents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onRun={handleRun}
                    userPlan={userPlan}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          // Simple grid for filtered results or specific category
          <div className="agents-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem'
          }}>
            {filteredAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onRun={handleRun}
                userPlan={userPlan}
              />
            ))}
          </div>
        )
      )}

      {/* Output Area */}
      {(output || streaming) && (
        <div className="output-container" style={{
          marginTop: '2rem',
          backgroundColor: theme.colors.backgroundLight,
          borderRadius: '8px',
          border: `1px solid ${theme.colors.border}`,
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${theme.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: theme.colors.backgroundDark
          }}>
            {loading ? (
              <span style={{
                display: 'inline-block',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                border: `2px solid ${theme.colors.primary}`,
                borderTopColor: 'transparent',
                animation: 'spin 1s linear infinite'
              }}></span>
            ) : (
              <span>🤖</span>
            )}
            <h3 style={{
              margin: 0,
              fontSize: '15px',
              fontWeight: 'bold'
            }}>
              Agent Output {selectedAgent && `- ${agentRegistry.find(a => a.id === selectedAgent)?.name}`}
            </h3>
          </div>

          <div className="output-box" style={{
            padding: '1rem',
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            {streaming ? (
              <StreamingRenderer streamText={output} isStreaming={streaming} />
            ) : (
              <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                {output}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ 
            padding: '12px 16px',
            display: 'flex',
            gap: '8px',
            borderTop: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.backgroundDark
          }}>
            {streaming && (
              <button
                onClick={stopGeneration}
                style={{
                  backgroundColor: theme.colors.error,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>⏹️</span> Stop Generation
              </button>
            )}
            <button
              onClick={() => {
                navigator.clipboard.writeText(output);
              }}
              style={{
                backgroundColor: theme.colors.backgroundLighter,
                color: theme.colors.text,
                border: 'none',
                borderRadius: '4px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>📋</span> Copy Output
            </button>
            {!streaming && selectedAgent && (
              <button
                onClick={() => {
                  if (selectedAgent) {
                    handleRun(selectedAgent);
                  }
                }}
                style={{
                  backgroundColor: theme.colors.secondary,
                  color: '#000',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>🔄</span> Run Again
              </button>
            )}
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}

      {/* CSS for animations */}
      <style>
        {`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .agent-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 6px 12px rgba(0, 229, 255, 0.1);
        }
        `}
      </style>
    </div>
  );
};

export default memo(AgentMarketplacePanel);