// src/components/chat/VirtualizedMessageList.tsx
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useTheme } from '../../styles/ThemeProvider';
import MemoizedMessageItem from '../MemoizedMessageItem';
import StreamingRenderer from '../MemoizedStreamingRenderer';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  error?: boolean;
}

interface VirtualizedMessageListProps {
  messages: Message[];
  streamBuffer: string;
  isStreaming: boolean;
  error: string | null;
  onDismissError: () => void;
  colors: any;
}

interface MeasuredMessage extends Message {
  height: number;
}

// Default estimated heights
const DEFAULT_MESSAGE_HEIGHT = 150;
const MIN_MESSAGE_HEIGHT = 80;
const HEIGHT_PER_LINE = 20;

const VirtualizedMessageList: React.FC<VirtualizedMessageListProps> = ({
  messages,
  streamBuffer,
  isStreaming,
  error,
  onDismissError,
  colors
}) => {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleIndices, setVisibleIndices] = useState<[number, number]>([0, 10]);
  const [scrolledToBottom, setScrolledToBottom] = useState(true);
  const [measuredMessages, setMeasuredMessages] = useState<MeasuredMessage[]>([]);
  const [totalHeight, setTotalHeight] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Create a map of message ID to index for quick lookup
  const messageIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    messages.forEach((msg, index) => {
      map.set(msg.id, index);
    });
    return map;
  }, [messages]);
  
  // Initialize or update measured messages when messages change
  useEffect(() => {
    setMeasuredMessages(prev => {
      // Create a map of existing measured messages
      const prevMap = new Map<string, MeasuredMessage>();
      prev.forEach(msg => prevMap.set(msg.id, msg));
      
      // Map the new messages, preserving heights for existing ones
      return messages.map(msg => {
        const existing = prevMap.get(msg.id);
        if (existing) {
          return existing;
        }
        
        // Estimate height for new messages
        const lineCount = msg.content.split('\n').length;
        const codeBlocks = (msg.content.match(/```/g) || []).length / 2;
        
        // More complex height estimation based on content
        const estimatedHeight = Math.max(
          MIN_MESSAGE_HEIGHT,
          HEIGHT_PER_LINE * lineCount + (codeBlocks * 50)
        );
        
        return {
          ...msg,
          height: estimatedHeight
        };
      });
    });
  }, [messages]);
  
  // Calculate total content height and update visible indices
  useEffect(() => {
    if (measuredMessages.length === 0) return;
    
    const newTotalHeight = measuredMessages.reduce((sum, msg) => sum + msg.height, 0);
    setTotalHeight(newTotalHeight);
    
    // If there's a streaming message, add its estimated height
    const streamingHeight = isStreaming ? estimateStreamingHeight(streamBuffer) : 0;
    
    // Calculate visible range based on scroll position
    updateVisibleIndices(newTotalHeight + streamingHeight);
  }, [measuredMessages, isStreaming, streamBuffer]);
  
  // Update container height when it changes
  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    
    observer.observe(containerRef.current);
    
    return () => {
      observer.disconnect();
    };
  }, []);
  
  // Auto-scroll to bottom for new messages when not manually scrolling
  useEffect(() => {
    if (!containerRef.current || isUserScrolling) return;
    
    if (scrolledToBottom || messages.length === 0 || isStreaming) {
      scrollToBottom();
    }
  }, [messages, isStreaming, scrolledToBottom, isUserScrolling, streamBuffer]);
  
  // Estimate height of streaming content
  const estimateStreamingHeight = (content: string): number => {
    if (!content) return 0;
    
    const lineCount = content.split('\n').length;
    const codeBlocks = (content.match(/```/g) || []).length / 2;
    
    return Math.max(
      MIN_MESSAGE_HEIGHT,
      HEIGHT_PER_LINE * lineCount + (codeBlocks * 50)
    );
  };
  
  // Scroll to the bottom of the container
  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      setScrolledToBottom(true);
    }
  };
  
  // Update which messages are visible in the viewport
  const updateVisibleIndices = (contentHeight: number) => {
    if (!containerRef.current || measuredMessages.length === 0) return;
    
    const scrollTop = containerRef.current.scrollTop;
    const viewportHeight = containerHeight;
    
    // Add buffer for smoother scrolling (1 viewport height above and below)
    const bufferSize = viewportHeight;
    const minY = Math.max(0, scrollTop - bufferSize);
    const maxY = scrollTop + viewportHeight + bufferSize;
    
    // Find visible messages
    let startIndex = 0;
    let endIndex = measuredMessages.length - 1;
    let currentHeight = 0;
    
    // Find start index
    for (let i = 0; i < measuredMessages.length; i++) {
      if (currentHeight >= minY) {
        startIndex = i;
        break;
      }
      currentHeight += measuredMessages[i].height;
    }
    
    // Find end index
    currentHeight = 0;
    for (let i = 0; i < measuredMessages.length; i++) {
      currentHeight += measuredMessages[i].height;
      if (currentHeight >= maxY) {
        endIndex = i;
        break;
      }
    }
    
    setVisibleIndices([startIndex, endIndex]);
    
    // Determine if scrolled to bottom
    const isAtBottom = scrollTop + viewportHeight >= contentHeight - 20;
    setScrolledToBottom(isAtBottom);
  };
  
  // Handle scroll events
  const handleScroll = () => {
    setIsUserScrolling(true);
    
    // Reset user scrolling status after a delay
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 1000);
    
    // Update which messages are visible
    updateVisibleIndices(totalHeight + (isStreaming ? estimateStreamingHeight(streamBuffer) : 0));
  };
  
  // Render only the visible messages
  const visibleMessages = useMemo(() => {
    if (measuredMessages.length === 0) return [];
    
    const [start, end] = visibleIndices;
    return measuredMessages.slice(start, end + 1);
  }, [measuredMessages, visibleIndices]);
  
  // Calculate offsets for proper positioning
  const contentStyles = useMemo(() => {
    if (measuredMessages.length === 0) return { paddingTop: 0 };
    
    // Calculate height before first visible message
    const [start] = visibleIndices;
    const paddingTop = measuredMessages.slice(0, start).reduce((sum, msg) => sum + msg.height, 0);
    
    return { paddingTop };
  }, [measuredMessages, visibleIndices]);
  
  // Update message height when it's rendered and measured
  const updateMessageHeight = (id: string, height: number) => {
    const index = messageIndexMap.get(id);
    if (index === undefined) return;
    
    setMeasuredMessages(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], height };
      return updated;
    });
  };
  
  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        overflow: 'auto',
        position: 'relative',
      }}
      onScroll={handleScroll}
    >
      {/* Spacer for proper scrolling */}
      <div 
        style={{ 
          height: totalHeight,
          position: 'relative'
        }}
      >
        {/* Actual visible content */}
        <div style={contentStyles}>
          {/* Render only visible messages */}
          {visibleMessages.map((message) => (
            <MeasurableMessageItem
              key={message.id}
              message={message}
              colors={colors}
              onHeightChange={(height) => updateMessageHeight(message.id, height)}
            />
          ))}
          
          {/* Streaming message */}
          {isStreaming && streamBuffer && (
            <div
              className="stream-animation"
              style={{
                marginBottom: '12px',
                padding: '10px',
                backgroundColor: 'rgba(0, 229, 255, 0.05)',
                borderRadius: '8px',
                animation: 'fadeIn 0.3s ease-out'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '6px',
                color: theme.colors.textMuted,
                fontSize: '13px'
              }}>
                <span style={{
                  marginRight: '8px',
                  backgroundColor: theme.colors.primary,
                  color: theme.colors.backgroundDark,
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '12px'
                }}>
                  A
                </span>
                <span>
                  {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
              <StreamingRenderer streamText={streamBuffer} isStreaming={isStreaming} />
            </div>
          )}
          
          {/* Error message */}
          {error && (
            <div className="error-animation" style={{ animation: 'fadeIn 0.3s ease-out' }}>
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
                    <div style={{ fontSize: '14px' }}>{error}</div>
                  </div>
                  <button
                    onClick={onDismissError}
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
                    ✕
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Scroll to bottom button (visible when not at bottom) */}
          {!scrolledToBottom && messages.length > 0 && (
            <div
              onClick={scrollToBottom}
              style={{
                position: 'absolute',
                bottom: '20px',
                right: '20px',
                backgroundColor: theme.colors.primary,
                color: '#000',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                zIndex: 10,
                animation: 'fadeIn 0.3s ease-out'
              }}
            >
              ↓
            </div>
          )}
        </div>
      </div>
      
      {/* Empty state */}
      {messages.length === 0 && !streamBuffer && !error && (
        <div style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.colors.textMuted,
          flexDirection: 'column',
          padding: '2rem'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>💬</div>
          <p>No messages yet. Start a conversation!</p>
        </div>
      )}

      {/* CSS animations */}
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
    </div>
  );
};

// Measurable message item wrapper component that reports its height
interface MeasurableMessageItemProps {
  message: Message;
  colors: any;
  onHeightChange: (height: number) => void;
}

const MeasurableMessageItem: React.FC<MeasurableMessageItemProps> = ({ 
  message, 
  colors, 
  onHeightChange 
}) => {
  const ref = useRef<HTMLDivElement>(null);
  
  // Measure height after rendering
  useEffect(() => {
    if (!ref.current) return;
    
    // Use ResizeObserver to detect size changes
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        onHeightChange(entry.contentRect.height);
      }
    });
    
    observer.observe(ref.current);
    
    return () => {
      observer.disconnect();
    };
  }, [onHeightChange, message.content]);
  
  return (
    <div 
      ref={ref} 
      className="message-animation" 
      style={{
        animation: 'fadeInUp 0.3s ease-out',
      }}
    >
      <MemoizedMessageItem
        message={message}
        colors={colors}
      />
    </div>
  );
};

export default VirtualizedMessageList;