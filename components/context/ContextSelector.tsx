// src/components/context/ContextSelector.tsx
import React, { useState, useEffect } from 'react';
import { useTheme } from '../../styles/ThemeProvider';
import { useContext } from './ContextProvider';

interface ContextSelectorProps {
  onContextChange?: (isActive: boolean, items: string[]) => void;
}

const ContextSelector: React.FC<ContextSelectorProps> = ({ onContextChange }) => {
  const theme = useTheme();
  const {
    context,
    isLoading,
    updateContext,
    showExplorer,
    setShowExplorer,
    isContextActive,
    setIsContextActive,
    activeContextItems,
    removeContextItem
  } = useContext();

  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Calculate selected items details
  const selectedCount = activeContextItems.length;
  const tokenCount = estimateSelectedTokens();
  const isTokenCountHigh = tokenCount > 3500;

  // Toggle context and notify parent
  const toggleActive = () => {
    const newState = !isContextActive;
    setIsContextActive(newState);
    if (onContextChange) {
      onContextChange(newState, activeContextItems);
    }
  };

  // Open context explorer
  const openExplorer = () => {
    if (!context) {
      updateContext({
        includeActiveFile: true,
        includeSelection: true,
        includeImports: true
      });
    }
    setShowExplorer(true);
  };

  // Notify parent component when context changes
  useEffect(() => {
    if (onContextChange) {
      onContextChange(isContextActive, activeContextItems);
    }
  }, [isContextActive, activeContextItems, onContextChange]);

  // Estimate token count from selected items
  function estimateSelectedTokens(): number {
    if (!context) return 0;
    let count = 0;
    for (const item of context.items) {
      if (activeContextItems.includes(item.id) && item.content) {
        // Rough estimate: 1 token ~= 4 characters
        count += Math.ceil(item.content.length / 4);
      }
    }
    return count;
  }

  // Get file or item name for display
  const getDisplayName = (itemId: string): string => {
    if (!context) return itemId;
    const item = context.items.find(i => i.id === itemId);
    if (!item) return itemId;
    
    if (item.name) {
      return item.name;
    }
    
    if (item.path) {
      const parts = item.path.split(/[/\\]/);
      return parts[parts.length - 1];
    }
    
    return 'Unknown';
  };

  // Handle removing an item from context
  const handleRemoveItem = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening explorer
    removeContextItem(itemId);
  };

  // Toggle collapse state
  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // If no context items and not loading, show minimal version
  if ((activeContextItems.length === 0 && !isLoading) || isCollapsed) {
    return (
      <div 
        onClick={toggleCollapse}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 10px',
          backgroundColor: theme.colors.backgroundLight,
          borderRadius: '8px',
          border: `1px solid ${theme.colors.border}`,
          fontSize: '12px',
          color: isContextActive ? theme.colors.primary : theme.colors.textSecondary,
          cursor: 'pointer'
        }}
      >
        <span style={{ transform: 'rotate(180deg)' }}>⌄</span>
        {activeContextItems.length > 0 ? (
          <span>
            <strong>{activeContextItems.length}</strong> context files selected
            {isTokenCountHigh && <span style={{ color: theme.colors.error, marginLeft: '4px' }}>!</span>}
          </span>
        ) : (
          <span>No context files selected</span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            openExplorer();
          }}
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            border: 'none',
            color: theme.colors.primary,
            fontSize: '12px',
            padding: '0'
          }}
        >
          Select
        </button>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: theme.colors.backgroundLight,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: '8px',
      padding: '6px 8px',
      gap: '6px',
      fontSize: '13px',
      color: isContextActive ? theme.colors.primary : theme.colors.textSecondary,
      marginBottom: '4px'
    }}>
      {/* Header row with toggle and counts */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          {/* Toggle switch */}
          <label className="switch" style={{
            position: 'relative',
            display: 'inline-block',
            width: '28px',
            height: '16px',
          }}>
            <input
              type="checkbox"
              checked={isContextActive}
              onChange={toggleActive}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span style={{
              position: 'absolute',
              cursor: 'pointer',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: isContextActive ? theme.colors.primary : theme.colors.backgroundDark,
              borderRadius: '16px',
              transition: '0.3s',
            }}>
              <span style={{
                position: 'absolute',
                content: '""',
                height: '12px',
                width: '12px',
                left: isContextActive ? '14px' : '2px',
                bottom: '2px',
                backgroundColor: theme.colors.backgroundLight,
                borderRadius: '50%',
                transition: '0.3s',
              }}></span>
            </span>
          </label>
          
          {/* Context status */}
          <div>
            {isLoading ? (
              <span>Loading...</span>
            ) : (
              <span style={{ fontSize: '12px' }}>
                <strong>{selectedCount}</strong> {selectedCount !== 1 ? 'files' : 'file'}
                <span style={{
                  color: isTokenCountHigh ? theme.colors.error : theme.colors.textMuted,
                  marginLeft: '4px',
                  fontSize: '11px'
                }}>
                  (~{tokenCount} tokens)
                </span>
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '4px' }}>
          {/* Collapse button */}
          <button
            onClick={toggleCollapse}
            style={{
              background: 'transparent',
              border: 'none',
              color: theme.colors.textMuted,
              cursor: 'pointer',
              padding: '2px',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
            }}
            aria-label="Collapse context selector"
          >
            ⌄
          </button>
          
          {/* Select context button */}
          <button
            onClick={openExplorer}
            style={{
              background: 'transparent',
              border: 'none',
              color: theme.colors.primary,
              padding: '2px 4px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Select
          </button>
        </div>
      </div>

      {/* Context chips row - only show if there are selected items */}
      {activeContextItems.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
          maxHeight: '48px',
          overflowY: 'auto',
          padding: '2px 0',
        }}>
          {activeContextItems.map(itemId => (
            <div
              key={itemId}
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: isContextActive ? `${theme.colors.primary}22` : theme.colors.backgroundDark,
                border: `1px solid ${isContextActive ? theme.colors.primary : theme.colors.border}`,
                borderRadius: '12px',
                padding: '1px 6px',
                fontSize: '11px',
                maxWidth: '150px',
                position: 'relative',
              }}
              onMouseEnter={() => setShowTooltip(itemId)}
              onMouseLeave={() => setShowTooltip(null)}
            >
              <span style={{
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginRight: '4px',
              }}>
                {getDisplayName(itemId)}
              </span>
              <button
                onClick={(e) => handleRemoveItem(itemId, e)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: theme.colors.textMuted,
                  cursor: 'pointer',
                  padding: '0',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '14px',
                }}
                aria-label={`Remove ${getDisplayName(itemId)} from context`}
              >
                ×
              </button>
              
              {/* Tooltip */}
              {showTooltip === itemId && (
                <div style={{
                  position: 'absolute',
                  bottom: '-24px',
                  left: '0',
                  backgroundColor: theme.colors.backgroundDark,
                  color: theme.colors.text,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  zIndex: 10,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                }}>
                  {getDisplayName(itemId)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Token warning - only shown if high token count */}
      {isTokenCountHigh && (
        <div style={{
          backgroundColor: `${theme.colors.error}22`,
          color: theme.colors.error,
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '11px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          <span>⚠</span>
          <span>High token count may affect performance</span>
        </div>
      )}
    </div>
  );
};

export default ContextSelector;