// src/components/chat/ChatHeader.tsx
import React, { memo } from 'react';
import { useTheme } from '../../styles/ThemeProvider';

interface ChatHeaderProps {
  onToggleConversations: () => void;
  onToggleSettings: () => void;
  showConversations: boolean;
  showSettings: boolean;
}

const ChatHeader = memo(({
  onToggleConversations,
  onToggleSettings,
  showConversations,
  showSettings
}: ChatHeaderProps) => {
  const theme = useTheme();
  
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '12px' // Reduced from 16px
    }}>
      <h2 style={{ 
        margin: 0, 
        color: theme.colors.primary,
        fontSize: '20px', // Slightly smaller title
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <span style={{ 
          fontSize: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>💬</span>
        Logcai
      </h2>
      
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={onToggleConversations}
          style={{
            backgroundColor: showConversations ? theme.colors.primary : '#333',
            border: 'none',
            borderRadius: '6px',
            padding: '6px', // Smaller padding
            color: showConversations ? '#000' : theme.colors.text,
            cursor: 'pointer',
            width: '32px', // Smaller button
            height: '32px', // Smaller button
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px' // Smaller icon
          }}
          title="Conversations"
          aria-label="Conversations"
        >
          📋
        </button>
        
        <button
          onClick={onToggleSettings}
          style={{
            backgroundColor: showSettings ? theme.colors.primary : '#333',
            border: 'none',
            borderRadius: '6px',
            padding: '6px', // Smaller padding
            color: showSettings ? '#000' : theme.colors.text,
            cursor: 'pointer',
            width: '32px', // Smaller button
            height: '32px', // Smaller button
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px' // Smaller icon
          }}
          title="Settings"
          aria-label="Settings"
        >
          ⚙️
        </button>
      </div>
    </div>
  );
});

export default ChatHeader;