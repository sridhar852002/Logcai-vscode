// src/components/chat/ChatControls.tsx
import React, { memo, useState } from 'react';
import { useTheme } from '../../styles/ThemeProvider';

interface ChatControlsProps {
  isStreaming: boolean;
  onStop: () => void;
  onClear: () => void;
  selectedModel: string;
  modelName: string;
}

const ChatControls = memo(({
  isStreaming,
  onStop,
  onClear,
  selectedModel,
  modelName
}: ChatControlsProps) => {
  const theme = useTheme();
  const [showMoreControls, setShowMoreControls] = useState(false);
  
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: '12px'
    }}>
      <div style={{ display: 'flex', gap: '6px' }}>
        {isStreaming && (
          <button
            onClick={onStop}
            style={{
              background: theme.colors.error,
              border: 'none',
              borderRadius: '5px',
              padding: '5px 10px',
              color: theme.colors.text,
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span style={{ fontSize: '10px' }}>■</span> Stop
          </button>
        )}
        <button
          onClick={onClear}
          style={{
            background: '#444',
            border: 'none',
            borderRadius: '5px',
            padding: '5px 10px',
            color: theme.colors.text,
            fontWeight: 500,
            cursor: 'pointer',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '10px' }}>+</span> New
        </button>
        
        {showMoreControls && (
          // Additional control buttons would go here
          <button
            style={{
              background: '#444',
              border: 'none',
              borderRadius: '5px',
              padding: '5px 10px',
              color: theme.colors.text,
              fontWeight: 500,
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Export
          </button>
        )}
        
        {!showMoreControls && (
          <button
            onClick={() => setShowMoreControls(true)}
            style={{
              background: 'transparent',
              border: 'none',
              borderRadius: '5px',
              padding: '5px',
              color: theme.colors.textMuted,
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            •••
          </button>
        )}
      </div>
      <div style={{ 
        fontSize: '11px', 
        color: theme.colors.textMuted,
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        <span style={{ 
          width: '6px', 
          height: '6px', 
          borderRadius: '50%', 
          backgroundColor: theme.colors.primary,
          display: 'inline-block' 
        }}></span>
        {modelName || selectedModel}
      </div>
    </div>
  );
});

export default ChatControls;