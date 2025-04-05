// src/components/MemoizedMessageItem.tsx
import React, { useState, useCallback, memo } from 'react';
import hljs from 'highlight.js';

interface MessageItemProps {
  message: {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    error?: boolean;
  };
  colors: any;
}

const MessageItem = memo(({ message, colors }: MessageItemProps) => {
  const [copiedMap, setCopiedMap] = useState<Record<string, boolean>>({});
  
  const handleCopyMessage = useCallback(() => {
    navigator.clipboard.writeText(message.content);
    const key = `message-${message.id}`;
    setCopiedMap(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setCopiedMap(prev => ({ ...prev, [key]: false }));
    }, 2000);
  }, [message.id, message.content]);

  const handleCopyCode = useCallback((code: string, key: string) => {
    navigator.clipboard.writeText(code);
    setCopiedMap(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setCopiedMap(prev => ({ ...prev, [key]: false }));
    }, 2000);
  }, []);

  // Expensive content parsing - only done once per message render
  const renderedContent = React.useMemo(() => {
    const parts = message.content.split(/```/);
    return parts.map((part, idx) => {
      const isCode = idx % 2 === 1;
      const key = `${message.id}-${idx}`;
      const isCopied = copiedMap[key];
      
      if (!isCode) {
        return (
          <p key={key} style={{
            whiteSpace: 'pre-wrap',
            marginBottom: '8px', // Reduced from 12px
            lineHeight: '1.5',
            fontSize: '14px'
          }}>
            {part}
          </p>
        );
      }
      
      const lines = part.split('\n');
      const language = lines[0].trim();
      const code = language ? lines.slice(1).join('\n') : part;
      const highlighted = language && hljs.getLanguage(language)
        ? hljs.highlight(code, { language }).value
        : hljs.highlightAuto(code).value;
      
      return (
        <div key={key} style={{ 
          position: 'relative', 
          marginBottom: '14px', // Reduced from 16px
          borderRadius: '6px',
          overflow: 'hidden'
        }}>
          {language && (
            <div style={{
              position: 'absolute',
              top: '6px',
              left: '12px',
              fontSize: '11px', // Smaller font
              color: colors.textMuted,
              zIndex: 1
            }}>
              {language}
            </div>
          )}
          
          <button
            onClick={() => handleCopyCode(code, key)}
            style={{
              position: 'absolute',
              top: '6px',
              right: '8px',
              background: isCopied ? colors.secondary : '#333',
              color: isCopied ? colors.backgroundDark : colors.text,
              border: 'none',
              padding: '3px 6px', // Smaller padding
              borderRadius: '4px',
              fontSize: '11px', // Smaller font
              cursor: 'pointer',
              zIndex: 1,
            }}
          >
            {isCopied ? 'Copied!' : 'Copy'}
          </button>
          
          <pre
            style={{
              backgroundColor: '#1a1a1a',
              padding: '36px 12px 12px 12px', // More space at top, less on sides
              borderRadius: '6px',
              overflowX: 'auto',
              marginTop: '0',
              marginBottom: '0',
              fontSize: '13px',
              lineHeight: '1.4',
            }}
          >
            <code dangerouslySetInnerHTML={{ __html: highlighted }} />
          </pre>
        </div>
      );
    });
  }, [message.content, message.id, copiedMap, colors, handleCopyCode]);

  return (
    <div
      className="hover-effect"
      style={{
        marginBottom: '12px', // Reduced from 16px
        padding: '10px', // Reduced from 12px
        backgroundColor: message.role === 'user'
          ? 'rgba(0, 230, 118, 0.05)'
          : 'rgba(0, 229, 255, 0.05)',
        borderRadius: '8px',
        border: message.error ? `1px solid ${colors.error}` : 'none',
      }}
    >
      {/* Message header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '6px', // Reduced from 8px
        color: colors.textMuted,
        fontSize: '13px' // Smaller font
      }}>
        <span style={{
          marginRight: '8px',
          backgroundColor: message.role === 'user' ? colors.secondary : colors.primary,
          color: colors.backgroundDark,
          width: '24px', // Smaller avatar
          height: '24px', // Smaller avatar 
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          fontSize: '12px' // Smaller font
        }}>
          {message.role === 'user' ? 'U' : 'A'}
        </span>
        
        <span style={{ fontSize: '12px' }}>
          {new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </span>
        
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button
            onClick={handleCopyMessage}
            style={{
              background: 'transparent',
              border: 'none',
              color: copiedMap[`message-${message.id}`] ? colors.secondary : colors.textMuted,
              cursor: 'pointer',
              padding: '3px 6px', // Smaller padding
              fontSize: '12px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            aria-label="Copy message"
          >
            {copiedMap[`message-${message.id}`] ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>
      
      {/* Message content with code highlighting */}
      {renderedContent}
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if the message content changes or error state changes
  return prevProps.message.content === nextProps.message.content &&
    prevProps.message.error === nextProps.message.error;
});

export default MessageItem;