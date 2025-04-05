// src/components/chat/ChatInput.tsx
import React, { useRef, useEffect, memo, useState } from 'react';
import { useTheme } from '../../styles/ThemeProvider';

interface ChatInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  isStreaming: boolean;
  disabled?: boolean;
}

const ChatInput = memo(({
  input,
  onInputChange,
  onSend,
  onKeyDown,
  isStreaming,
  disabled = false
}: ChatInputProps) => {
  const theme = useTheme();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Auto-resize input height
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 220)}px`;
    }
  }, [input]);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current && !disabled && !isStreaming) {
      inputRef.current.focus();
    }
  }, [disabled, isStreaming]);

  // Calculate if input is empty (accounting for whitespace)
  const isEmpty = !input.trim();
  
  // Calculate button state
  const isButtonDisabled = isEmpty || isStreaming || disabled;

  return (
    <div style={{
      position: 'relative',
      backgroundColor: theme.colors.backgroundLight,
      border: `1px solid ${isFocused ? theme.colors.primary : theme.colors.border}`,
      borderRadius: '14px',
      marginBottom: '8px',
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      boxShadow: isFocused ? `0 0 0 2px ${theme.colors.primary}22` : 'none',
    }}>
      <textarea
        ref={inputRef}
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        rows={1}
        placeholder={isStreaming ? "Logcai is generating a response..." : "Message Logcai..."}
        style={{
          width: '100%',
          padding: '16px',
          paddingRight: '48px',
          backgroundColor: 'transparent',
          color: theme.colors.text,
          border: 'none',
          borderRadius: '14px',
          outline: 'none',
          fontSize: '14px',
          lineHeight: '1.5',
          resize: 'none',
          minHeight: '54px', // Slightly taller by default
          maxHeight: '220px',
          overflow: 'auto',
          fontFamily: 'inherit',
          caretColor: theme.colors.primary,
        }}
        disabled={disabled || isStreaming}
      />
      
      {/* Character count (only shown when typing) */}
      {input.length > 0 && (
        <div style={{
          position: 'absolute',
          right: '50px',
          bottom: '10px',
          fontSize: '11px',
          color: theme.colors.textMuted,
          opacity: 0.7,
        }}>
          {input.length}
        </div>
      )}
      
      <button
        onClick={onSend}
        disabled={isButtonDisabled}
        aria-label="Send message"
        style={{
          position: 'absolute',
          right: '10px',
          bottom: '10px',
          background: !isButtonDisabled
            ? `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})`
            : theme.colors.backgroundDark,
          border: 'none',
          borderRadius: '50%',
          width: '30px',
          height: '30px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: !isButtonDisabled ? '#000' : theme.colors.textMuted,
          cursor: !isButtonDisabled ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s ease',
          transform: !isButtonDisabled && isFocused ? 'scale(1.05)' : 'scale(1)',
          boxShadow: !isButtonDisabled ? '0 2px 6px rgba(0,229,255,0.4)' : 'none',
        }}
      >
        {isStreaming ? (
          <span style={{
            display: 'block',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            border: '2px solid',
            borderRightColor: 'transparent',
            animation: 'spin 1s linear infinite',
          }}></span>
        ) : (
          <span style={{ fontSize: '14px' }}>▶</span>
        )}
      </button>
      
      {/* Styling for focus indicator animation */}
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(0, 229, 255, 0.4); }
          70% { box-shadow: 0 0 0 6px rgba(0, 229, 255, 0); }
          100% { box-shadow: 0 0 0 0 rgba(0, 229, 255, 0); }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
});

export default ChatInput;