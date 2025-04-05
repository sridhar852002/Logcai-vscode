// src/components/chat/ContextIntegrationSection.tsx
import React from 'react';
import { useTheme } from '../../styles/ThemeProvider';
import { useContext } from '../context/ContextProvider';
import TokenBudgetBar from '../context/TokenBudgetBar';

interface ContextIntegrationSectionProps {
  isEnabled: boolean;
  onToggle: (isEnabled: boolean) => void;
}

/**
* Context integration section - provides a visual display of current context
* with information about selected files and token usage
*/
const ContextIntegrationSection: React.FC<ContextIntegrationSectionProps> = ({
  isEnabled,
  onToggle
}) => {
  const theme = useTheme();
  const {
    context,
    isLoading,
    activeContextItems,
    tokenBudget,
    setShowExplorer,
    refreshContext
  } = useContext();

  // No context or items available - show compact version
  if (!context || activeContextItems.length === 0) {
    return (
      <div style={{
        padding: '8px 12px',
        backgroundColor: theme.colors.backgroundLight,
        borderRadius: '8px',
        border: `1px dashed ${theme.colors.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        margin: '10px 0',
        fontSize: '13px',
        color: theme.colors.textSecondary
      }}>
        <span>No context files selected</span>
        <button
          onClick={() => setShowExplorer(true)}
          style={{
            backgroundColor: 'transparent',
            color: theme.colors.primary,
            border: 'none',
            borderRadius: '4px',
            padding: '4px 8px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold'
          }}
        >
          Select Files
        </button>
      </div>
    );
  }

  // Get first few file names for display
  const getContextSummary = () => {
    if (!context) return '';
    const fileNames = activeContextItems
      .map(id => {
        const item = context.items.find(i => i.id === id);
        return item?.name || '';
      })
      .filter(Boolean);
    
    // Show first 2 files, then "and X more"
    if (fileNames.length <= 2) {
      return fileNames.join(', ');
    }
    return `${fileNames.slice(0, 2).join(', ')} and ${fileNames.length - 2} more`;
  };

  return (
    <div style={{
      padding: '8px 12px',
      backgroundColor: isEnabled
        ? `${theme.colors.primary}11`
        : theme.colors.backgroundLight,
      borderRadius: '8px',
      border: `1px solid ${isEnabled ? theme.colors.primary : theme.colors.border}`,
      transition: 'all 0.2s ease',
      margin: '10px 0',
      fontSize: '13px'
    }}>
      {/* Header with toggle and controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div className="switch" style={{
            position: 'relative',
            display: 'inline-block',
            width: '32px',
            height: '18px',
          }}>
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={() => onToggle(!isEnabled)}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span style={{
              position: 'absolute',
              cursor: 'pointer',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: isEnabled ? theme.colors.primary : theme.colors.backgroundDark,
              borderRadius: '18px',
              transition: '0.3s',
            }}>
              <span style={{
                position: 'absolute',
                content: '""',
                height: '14px',
                width: '14px',
                left: isEnabled ? '16px' : '2px',
                bottom: '2px',
                backgroundColor: theme.colors.backgroundLight,
                borderRadius: '50%',
                transition: '0.3s',
              }}></span>
            </span>
          </div>
          
          <h4 style={{
            margin: 0,
            fontWeight: 'bold',
            fontSize: '13px',
            color: isEnabled ? theme.colors.primary : theme.colors.textSecondary
          }}>
            Context
          </h4>
        </div>
        
        <div style={{
          display: 'flex',
          gap: '6px'
        }}>
          <button
            onClick={() => refreshContext()}
            title="Refresh context"
            style={{
              backgroundColor: 'transparent',
              color: theme.colors.textSecondary,
              border: 'none',
              cursor: 'pointer',
              padding: '2px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px'
            }}
          >
            ↻
          </button>
          
          <button
            onClick={() => setShowExplorer(true)}
            title="Manage context files"
            style={{
              backgroundColor: 'transparent',
              color: theme.colors.primary,
              border: 'none',
              cursor: 'pointer',
              padding: '2px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '12px'
            }}
          >
            Select
          </button>
        </div>
      </div>

      {/* Context information - simplified and compacted */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        flexWrap: 'wrap',
        marginBottom: '6px'
      }}>
        <span style={{
          color: theme.colors.textSecondary,
          fontWeight: 'bold'
        }}>
          <strong>{activeContextItems.length}</strong> files:
        </span>
        
        <span style={{
          color: isEnabled ? theme.colors.text : theme.colors.textMuted,
          fontSize: '12px',
          fontStyle: 'italic'
        }}>
          {getContextSummary()}
        </span>
      </div>

      {/* Token budget indicator */}
      <TokenBudgetBar
        used={tokenBudget.used}
        max={tokenBudget.max}
        compact={true}
        showWarning={false}
      />

      {/* Conditional info message - only shown when enabled */}
      {isEnabled && tokenBudget.percentage > 75 && (
        <div style={{
          fontSize: '11px',
          color: theme.colors.warning,
          marginTop: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <span>⚠</span>
          <span>High token usage may impact performance</span>
        </div>
      )}
    </div>
  );
};

export default ContextIntegrationSection;