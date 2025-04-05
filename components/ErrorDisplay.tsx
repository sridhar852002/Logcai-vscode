// src/components/ErrorDisplay.tsx
import React from 'react';

interface ErrorDisplayProps {
  message: string;
  retry?: () => void;
  dismiss?: () => void;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ message, retry, dismiss }) => {
  // Extract error code if present
  const codeMatch = message.match(/\[(.*?)\]/);
  const errorCode = codeMatch ? codeMatch[1] : 'Error';
  const errorMessage = codeMatch ? message.replace(/\[(.*?)\]\s*/, '') : message;
  
  return (
    <div style={{
      padding: '12px 16px',
      borderRadius: '8px',
      backgroundColor: 'rgba(244, 67, 54, 0.1)',
      border: '1px solid rgba(244, 67, 54, 0.3)',
      marginBottom: '16px',
      color: '#f44336',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span style={{
          fontSize: '18px',
        }}>⚠️</span>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
        }}>
          <div style={{ 
            fontWeight: 'bold',
            fontSize: '14px',
          }}>
            {errorCode}
          </div>
          <div style={{ fontSize: '14px' }}>
            {errorMessage}
          </div>
        </div>
        {dismiss && (
          <button
            onClick={dismiss}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#f44336',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '4px',
            }}
            aria-label="Dismiss error"
          >
            ×
          </button>
        )}
      </div>
      
      {retry && (
        <button
          onClick={retry}
          style={{
            border: 'none',
            background: 'rgba(244, 67, 54, 0.1)',
            borderRadius: '4px',
            padding: '6px 12px',
            color: '#f44336',
            cursor: 'pointer',
            alignSelf: 'flex-start',
            fontSize: '12px',
            fontWeight: 'bold',
          }}
        >
          Try Again
        </button>
      )}
    </div>
  );
};

export default ErrorDisplay;