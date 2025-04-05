// src/components/MemoizedStreamingRenderer.tsx
import React, { useEffect, useRef, memo } from 'react';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

interface StreamingRendererProps {
  streamText: string;
  isStreaming: boolean;
}

/**
 * Renders streaming text content with syntax highlighting for code blocks
 * Memoized to prevent unnecessary re-renders
 */
const StreamingRenderer: React.FC<StreamingRendererProps> = memo(({
  streamText,
  isStreaming
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when content changes
  useEffect(() => {
    if (containerRef.current) {
      const container = containerRef.current;
      const isNearBottom = 
        container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      
      if (isNearBottom) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [streamText]);
  
  // Function to render text with code highlighting
  const renderWithHighlighting = (text: string) => {
    // Skip rendering if text is empty
    if (!text) return null;
    
    // Split text on code block markers (```)
    const parts = text.split(/```/);
    return parts.map((part, i) => {
      const isCode = i % 2 === 1;
      if (!isCode) {
        return (
          <p
            key={i}
            style={{
              whiteSpace: 'pre-wrap',
              marginBottom: '0.75rem',
              lineHeight: '1.5'
            }}
          >
            {part}
          </p>
        );
      }
      
      // Handle code blocks - parse language from first line
      const lines = part.split('\n');
      const language = lines[0].trim();
      
      // If we have a valid language marker, use it and remove from code
      let code = language && hljs.getLanguage(language)
        ? lines.slice(1).join('\n')
        : part;
        
      // Highlight the code
      const highlighted = language && hljs.getLanguage(language)
        ? hljs.highlight(code, { language }).value
        : hljs.highlightAuto(code).value;
        
      return (
        <div key={i} style={{ marginBottom: '1rem' }}>
          {language && (
            <div style={{
              backgroundColor: '#252525',
              padding: '4px 12px',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
              fontSize: '12px',
              color: '#aaa',
              borderTop: '1px solid #444',
              borderLeft: '1px solid #444',
              borderRight: '1px solid #444',
            }}>
              {language}
            </div>
          )}
          <pre
            style={{
              backgroundColor: '#1e1e1e',
              padding: '1rem',
              borderRadius: language ? '0 0 8px 8px' : '8px',
              overflowX: 'auto',
              border: '1px solid #444',
              margin: 0
            }}
          >
            <code dangerouslySetInnerHTML={{ __html: highlighted }} />
          </pre>
        </div>
      );
    });
  };
  
  return (
    <div
      ref={containerRef}
      style={{
        fontFamily: 'system-ui, -apple, sans-serif',
        whiteSpace: 'pre-wrap',
        overflowY: 'auto',
        overflowX: 'hidden',
        maxHeight: '100%',
        color: '#f0f0f0'
      }}
    >
      {renderWithHighlighting(streamText)}
      {isStreaming && (
        <span
          className="blinking-cursor"
          style={{
            display: 'inline-block',
            width: '8px',
            height: '16px',
            backgroundColor: '#00e5ff',
            animation: 'blink 1s infinite',
            verticalAlign: 'middle',
            marginLeft: '2px'
          }}
        />
      )}
      <style>
        {`
        @keyframes blink {
          0% { opacity: 1; }
          50% { opacity: 0; }
          100% { opacity: 1; }
        }
        code {
          font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
          font-size: 0.9em;
        }
        pre {
          position: relative;
        }
        `}
      </style>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  // Only update if the streaming state changed or text content actually changed
  return prevProps.isStreaming === nextProps.isStreaming && 
         prevProps.streamText === nextProps.streamText;
});

export default StreamingRenderer;