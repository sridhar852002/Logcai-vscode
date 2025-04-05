// src/components/context/TokenBudgetBar.tsx
import React from 'react';
import { useTheme } from '../../styles/ThemeProvider';

interface TokenBudgetBarProps {
  used: number;
  max: number;
  compact?: boolean; // For smaller display mode
  showWarning?: boolean; // Whether to show warnings for high usage
}

const TokenBudgetBar: React.FC<TokenBudgetBarProps> = ({
  used,
  max,
  compact = false,
  showWarning = true
}) => {
  const theme = useTheme();
  
  // Calculate percentage and status
  const percentage = Math.min(100, Math.round((used / max) * 100));
  const highUsage = percentage > 80;
  const criticalUsage = percentage > 95;
  
  // Determine color based on usage level
  const getBarColor = () => {
    if (criticalUsage) return theme.colors.error;
    if (highUsage) return theme.colors.warning;
    return theme.colors.primary;
  };

  // For compact mode (chip-like display)
  if (compact) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '11px',
      }}>
        <div style={{
          width: '80px',
          height: '5px',
          backgroundColor: theme.colors.backgroundDark,
          borderRadius: '3px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${percentage}%`,
            backgroundColor: getBarColor(),
            borderRadius: '3px',
          }} />
        </div>
        
        <span style={{
          color: getBarColor(),
          fontWeight: highUsage ? 'bold' : 'normal',
        }}>
          {percentage}%
        </span>
      </div>
    );
  }

  // Full display mode
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      width: '100%',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '11px',
        color: theme.colors.textSecondary,
      }}>
        <span>
          Token Budget: <span style={{ fontWeight: 'bold' }}>{used.toLocaleString()}</span> / 
          {max.toLocaleString()}
        </span>
        <span style={{ color: getBarColor() }}>
          {percentage}%
        </span>
      </div>
      
      <div style={{
        height: '6px',
        backgroundColor: theme.colors.backgroundLight,
        borderRadius: '3px',
        overflow: 'hidden',
      }}>
        <div
          style={{
            height: '100%',
            width: `${percentage}%`,
            backgroundColor: getBarColor(),
            borderRadius: '3px',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      
      {showWarning && highUsage && (
        <div style={{
          backgroundColor: `${getBarColor()}22`,
          color: getBarColor(),
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          marginTop: '4px',
        }}>
          <span>⚠</span>
          <span>
            {criticalUsage
              ? 'Token limit nearly reached. Model may truncate context.'
              : 'High token usage. Consider reducing context size.'}
          </span>
        </div>
      )}
    </div>
  );
};

export default TokenBudgetBar;