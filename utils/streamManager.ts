// src/utils/streamManager.ts
import { useRef, useState, useCallback, useEffect } from 'react';

interface StreamOptions {
  bufferSize?: number;
  throttleMs?: number;
  onComplete?: (fullText: string) => void;
}

/**
 * A utility hook for efficiently managing streaming text content
 * with optimized rendering and buffering
 */
export function useStreamManager(options: StreamOptions = {}) {
  const {
    bufferSize = 1024,
    throttleMs = 50,
    onComplete
  } = options;
  
  const [streamBuffer, setStreamBuffer] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const bufferRef = useRef<string>('');
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fullTextRef = useRef<string>('');
  
  // Add a chunk to the buffer
  const addChunk = useCallback((chunk: string) => {
    if (!isStreaming) {
      setIsStreaming(true);
    }
    
    fullTextRef.current += chunk;
    bufferRef.current += chunk;
    
    // Throttle updates for better performance
    if (!throttleTimerRef.current) {
      throttleTimerRef.current = setTimeout(() => {
        setStreamBuffer(prev => prev + bufferRef.current);
        bufferRef.current = '';
        throttleTimerRef.current = null;
        
        // Check if buffer exceeds limit and needs trimming
        if (fullTextRef.current.length > bufferSize * 10) {
          const trimmedText = fullTextRef.current.slice(-bufferSize * 5);
          fullTextRef.current = trimmedText;
          setStreamBuffer(trimmedText);
        }
      }, throttleMs);
    }
  }, [isStreaming, throttleMs, bufferSize]);
  
  // Complete the stream
  const completeStream = useCallback(() => {
    // Flush any remaining buffer
    if (bufferRef.current) {
      setStreamBuffer(prev => prev + bufferRef.current);
      bufferRef.current = '';
    }
    
    setIsStreaming(false);
    
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }
    
    if (onComplete) {
      onComplete(fullTextRef.current);
    }
  }, [onComplete]);
  
  // Reset the stream for a new conversation
  const resetStream = useCallback(() => {
    setStreamBuffer('');
    setIsStreaming(false);
    bufferRef.current = '';
    fullTextRef.current = '';
    
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }
  }, []);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
    };
  }, []);
  
  return {
    streamBuffer,
    isStreaming,
    addChunk,
    completeStream,
    resetStream,
    fullText: fullTextRef.current
  };
}