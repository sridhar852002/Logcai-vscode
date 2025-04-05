// src/components/chat/ConversationsSidebar.tsx
import React, { memo } from 'react';
import { useTheme } from '../../styles/ThemeProvider';

interface Conversation {
  id: string;
  title: string;
  messages: any[];
  modelId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ConversationsSidebarProps {
  conversations: Conversation[];
  activeConversation: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string, e: React.MouseEvent) => void;
  onClose: () => void;
  onNewConversation: () => void;
}

const ConversationsSidebar = memo(({
  conversations,
  activeConversation,
  onSelectConversation,
  onDeleteConversation,
  onClose,
  onNewConversation
}: ConversationsSidebarProps) => {
  const theme = useTheme();
  
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '280px',
      height: '100vh',
      backgroundColor: theme.colors.backgroundLight,
      borderRight: `1px solid ${theme.colors.border}`,
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '16px',
        borderBottom: `1px solid ${theme.colors.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, color: theme.colors.primary }}>Conversations</h3>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: theme.colors.textMuted,
            cursor: 'pointer',
            fontSize: '20px',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
          }}
          aria-label="Close conversations"
        >
          ×
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        <button
          onClick={onNewConversation}
          style={{
            width: '100%',
            padding: '12px',
            margin: '8px 0',
            backgroundColor: '#333',
            color: theme.colors.text,
            border: 'none',
            borderRadius: '6px',
            textAlign: 'left',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            fontSize: '14px',
          }}
        >
          <span style={{ marginRight: '8px' }}>+</span> New conversation
        </button>
        {conversations.map(conv => (
          <div
            key={conv.id}
            onClick={() => onSelectConversation(conv.id)}
            style={{
              padding: '12px',
              margin: '8px 0',
              backgroundColor: activeConversation === conv.id ? '#444' : '#333',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '14px',
              transition: 'background-color 0.2s ease',
            }}
            className="hover-effect"
          >
            <div style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '200px',
            }}>
              {conv.title}
            </div>
            <button
              onClick={(e) => onDeleteConversation(conv.id, e)}
              style={{
                background: 'transparent',
                border: 'none',
                color: theme.colors.textMuted,
                cursor: 'pointer',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                fontSize: '14px',
              }}
              aria-label="Delete conversation"
            >
              🗑️
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});

export default ConversationsSidebar;
