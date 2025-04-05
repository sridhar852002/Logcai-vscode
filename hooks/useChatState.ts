// src/hooks/useChatState.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import vscode from '../utils/vscode';
import { isPlanAtLeast } from '../monetization/planManager';
import { modelRegistry } from '../ai/modelRegistry';

// Define types needed for the hook
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  error?: boolean;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  modelId: string;
  createdAt: Date;
  updatedAt: Date;
  systemPrompt?: string;
  temperature?: number;
  contextItems?: string[]; // Add support for storing context per conversation
}

type AIMode = 'local' | 'cloud';

/**
 * Custom hook to manage chat state
 */
export function useChatState() {
  // Enable debug logging
  const DEBUG = true;
  const debugLog = (...args: any[]) => {
    if (DEBUG) {console.log('[ChatState]', ...args);}
  };

  // State for input and messages
  const [input, setInput] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Streaming state
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamBuffer, setStreamBuffer] = useState<string>('');
  const streamTimerRef = useRef<NodeJS.Timeout | null>(null);

  // AI model state
  const [selectedModel, setSelectedModel] = useState<string>('mistral');
  const [aiMode, setAiMode] = useState<AIMode>('local');
  const [localModels, setLocalModels] = useState<string[]>([]);

  // Conversations state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);

  // UI state
  const [showConversations, setShowConversations] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showAddModel, setShowAddModel] = useState<boolean>(false);
  const [showUpgrade, setShowUpgrade] = useState<boolean>(false);

  // Model settings
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [temperature, setTemperature] = useState<number>(0.7);

  // Context support
  const [useContextInChat, setUseContextInChat] = useState<boolean>(false);
  const [contextItems, setContextItems] = useState<string[]>([]);

  // Generate a title from the first message
  const generateConversationTitle = useCallback((message: string): string => {
    const words = message.split(' ');
    const title = words.slice(0, 5).join(' ');
    return title.length < message.length ? `${title}...` : title;
  }, []);

  // Handle adding a chunk to the stream buffer
  const addChunk = useCallback((chunk: string) => {
    debugLog(`Received chunk: ${chunk.length} characters`);
    setStreamBuffer(prev => {
      const newBuffer = prev + chunk;
      debugLog(`Updated buffer length: ${newBuffer.length} characters`);
      return newBuffer;
    });
    
    // Make sure we're in streaming state
    if (!isStreaming) {
      debugLog('Setting streaming state to true');
      setIsStreaming(true);
    }
  }, [isStreaming]);

  // Handle completing the stream
  const completeStream = useCallback(() => {
    debugLog('Completing stream');
    setIsStreaming(false);
    // Process the buffer into a message
    if (streamBuffer) {
      const assistantMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: streamBuffer,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
      // Update the conversation in the list
      if (activeConversation) {
        setConversations(prev => prev.map(conv =>
          conv.id === activeConversation
            ? {
                ...conv,
                messages: [...conv.messages, assistantMessage],
                updatedAt: new Date()
              }
            : conv
        ));
        // Save the updated conversation
        const updatedConversation = conversations.find(c => c.id === activeConversation);
        if (updatedConversation) {
          vscode.postMessage({
            command: 'saveConversation',
            conversation: {
              ...updatedConversation,
              messages: [...updatedConversation.messages, assistantMessage],
              updatedAt: new Date()
            }
          });
        }
      }
      // Reset the buffer
      debugLog('Resetting stream buffer');
      setStreamBuffer('');
    }
  }, [streamBuffer, activeConversation, conversations]);

  // Reset the stream state
  const resetStream = useCallback(() => {
    debugLog('Resetting stream state');
    setStreamBuffer('');
    setIsStreaming(false);
    if (streamTimerRef.current) {
      clearTimeout(streamTimerRef.current);
      streamTimerRef.current = null;
    }
  }, []);

  // Load conversations on mount
  useEffect(() => {
    debugLog('Loading conversations');
    vscode.postMessage({ command: 'loadConversations' });
  }, []);

  // Handle message sending
  const handleSend = useCallback(() => {
    if (!input.trim()) {return;}
    
    debugLog('Sending message:', input.substring(0, 50) + '...');
    debugLog('Selected model:', selectedModel);
    debugLog('AI mode:', aiMode);
    
    // Clear any previous errors
    setError(null);
    const modelInfo = modelRegistry[selectedModel];
    if (modelInfo?.mode === 'cloud' && !isPlanAtLeast('CloudPro')) {
      setShowUpgrade(true);
      return;
    }
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };
    // Create a new conversation if none is active
    if (!activeConversation) {
      const newConversationId = uuidv4();
      const newConversation: Conversation = {
        id: newConversationId,
        title: generateConversationTitle(input),
        messages: [userMessage],
        modelId: selectedModel,
        createdAt: new Date(),
        updatedAt: new Date(),
        systemPrompt: systemPrompt || undefined,
        temperature: temperature,
        contextItems: useContextInChat ? contextItems : undefined
      };
      setConversations(prev => [...prev, newConversation]);
      setActiveConversation(newConversationId);
      setMessages([userMessage]);
    } else {
      // Add to existing conversation
      setMessages(prev => [...prev, userMessage]);
      // Update the conversation in the list
      setConversations(prev => prev.map(conv =>
        conv.id === activeConversation
          ? {
              ...conv,
              messages: [...conv.messages, userMessage],
              updatedAt: new Date(),
              systemPrompt: systemPrompt || conv.systemPrompt,
              temperature: temperature,
              contextItems: useContextInChat ? contextItems : conv.contextItems
            }
          : conv
      ));
    }
    resetStream();
    setIsStreaming(true);
    setInput('');

    // FIX: Change message type to command for consistency with handler
    // If context is being used, send a different message to the extension
    if (useContextInChat && contextItems.length > 0) {
      debugLog('Sending message with context');
      vscode.postMessage({
        command: 'sendMessageWithContext', // Using command instead of type
        model: selectedModel,
        text: input,
        conversationId: activeConversation,
        systemPrompt: systemPrompt,
        temperature: temperature,
        userPlan: window.userPlan,
        useContext: true,
        contextItems: contextItems
      });
    } else {
      debugLog('Sending regular message');
      vscode.postMessage({
        command: 'sendMessage', // Changed from 'type' to 'command'
        payload: {
          prompt: input,
          model: selectedModel,
          temperature,
          systemPrompt,
          context: useContextInChat ? contextItems : [],
          aiMode
        }
      });
    }
    
    debugLog('Message sent to extension host');
  }, [
    input,
    selectedModel,
    activeConversation,
    systemPrompt,
    temperature,
    generateConversationTitle,
    resetStream,
    conversations,
    useContextInChat,
    contextItems,
    aiMode
  ]);

  // Handle stop message generation
  const handleStop = useCallback(() => {
    debugLog('Stopping message generation');
    vscode.postMessage({ command: 'stopStream' });
    completeStream();
  }, [completeStream]);

  // Handle creating a new conversation
  const handleClear = useCallback(() => {
    debugLog('Creating new conversation');
    const newConversationId = uuidv4();
    const newConversation: Conversation = {
      id: newConversationId,
      title: "New conversation",
      messages: [],
      modelId: selectedModel,
      createdAt: new Date(),
      updatedAt: new Date(),
      systemPrompt: systemPrompt || undefined,
      temperature: temperature
    };
    setConversations(prev => [...prev, newConversation]);
    setActiveConversation(newConversationId);
    setMessages([]);
    resetStream();
    setError(null);
    vscode.postMessage({
      command: 'saveConversation',
      conversation: newConversation
    });
  }, [selectedModel, systemPrompt, temperature, resetStream]);

  // Handle selecting a conversation
  const handleSelectConversation = useCallback((id: string) => {
    debugLog('Selecting conversation:', id);
    const conversation = conversations.find(c => c.id === id);
    if (conversation) {
      setActiveConversation(id);
      setMessages(conversation.messages);
      setSelectedModel(conversation.modelId);
      setSystemPrompt(conversation.systemPrompt || '');
      setTemperature(conversation.temperature || 0.7);
      setShowConversations(false);
      setError(null);
      // Restore context if available for this conversation
      if (conversation.contextItems && conversation.contextItems.length > 0) {
        setContextItems(conversation.contextItems);
        setUseContextInChat(true);
      } else {
        setContextItems([]);
        setUseContextInChat(false);
      }
    }
  }, [conversations]);

  // Handle deleting a conversation
  const handleDeleteConversation = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    debugLog('Deleting conversation:', id);
    setConversations(prev => prev.filter(conv => conv.id !== id));
    if (activeConversation === id) {
      if (conversations.length > 1) {
        // Set active to another conversation
        const nextConversation = conversations.find(c => c.id !== id);
        if (nextConversation) {
          setActiveConversation(nextConversation.id);
          setMessages(nextConversation.messages);
          setSystemPrompt(nextConversation.systemPrompt || '');
          setTemperature(nextConversation.temperature || 0.7);
          // Restore context if available for this conversation
          if (nextConversation.contextItems && nextConversation.contextItems.length > 0) {
            setContextItems(nextConversation.contextItems);
            setUseContextInChat(true);
          } else {
            setContextItems([]);
            setUseContextInChat(false);
          }
        } else {
          handleClear(); // Create a new conversation if none left
        }
      } else {
        handleClear();
      }
    }
    vscode.postMessage({
      command: 'deleteConversation',
      conversationId: id
    });
  }, [activeConversation, conversations, handleClear]);

  // Handle exporting a conversation
  const handleExportConversation = useCallback(() => {
    debugLog('Exporting conversation');
    const conversation = conversations.find(c => c.id === activeConversation);
    if (conversation) {
      const exportData = {
        title: conversation.title,
        model: conversation.modelId,
        systemPrompt: conversation.systemPrompt,
        temperature: conversation.temperature,
        messages: conversation.messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp
        })),
        contextItems: conversation.contextItems
      };
      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${conversation.title.replace(/\s+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [activeConversation, conversations]);

  // Handle context changes
  const handleContextChange = useCallback((isActive: boolean, items?: string[]) => {
    debugLog('Context changed - active:', isActive, 'items:', items?.length);
    setUseContextInChat(isActive);
    if (items) {
      setContextItems(items);
    }
    // Update the active conversation with new context settings
    if (activeConversation) {
      setConversations(prev => prev.map(conv =>
        conv.id === activeConversation
          ? {
              ...conv,
              contextItems: isActive && items ? items : undefined
            }
          : conv
      ));
    }
  }, [activeConversation]);

  // Handle messages from extension
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      debugLog('Received message from extension:', message);
      
      if (message.command === 'receiveMessage') {
        // Check if the message is an error
        if (message.text.startsWith('[Error]')) {
          debugLog('Error received:', message.text);
          setError(message.text);
          setIsStreaming(false);
        } else if (message.text === '[STREAM_END]') {
          debugLog('Stream end received');
          completeStream();
        } else {
          debugLog('Received message chunk:', message.text.substring(0, 30) + '...');
          addChunk(message.text);
        }
      }
      
      if (message.command === 'localModelsList') {
        debugLog('Local models list received:', message.models);
        setLocalModels(message.models || []);
      }
      
      if (message.command === 'loadedConversations') {
        debugLog('Loaded conversations:', message.conversations?.length);
        setConversations(message.conversations || []);
        if (message.conversations?.length > 0) {
          // Load the most recent conversation
          const latestConv = message.conversations.sort((a: Conversation, b: Conversation) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )[0];
          setActiveConversation(latestConv.id);
          setMessages(latestConv.messages);
          setSelectedModel(latestConv.modelId);
          setSystemPrompt(latestConv.systemPrompt || '');
          setTemperature(latestConv.temperature || 0.7);
          // Restore context if available for this conversation
          if (latestConv.contextItems && latestConv.contextItems.length > 0) {
            setContextItems(latestConv.contextItems);
            setUseContextInChat(true);
          }
        }
      }
      
      if (message.type === 'editorContent' && message.text) {
        debugLog('Editor content received:', message.text.substring(0, 50) + '...');
        setInput(message.text);
      }
    };
    
    debugLog('Setting up message event listener');
    window.addEventListener('message', handler);
    return () => {
      debugLog('Removing message event listener');
      window.removeEventListener('message', handler);
    };
  }, [addChunk, completeStream]);

  return {
    // Input state
    input,
    setInput,
    // Message state
    messages,
    streamBuffer,
    isStreaming,
    error,
    setError,
    // Model state
    selectedModel,
    setSelectedModel,
    aiMode,
    setAiMode,
    localModels,
    setLocalModels,
    // Conversation state
    conversations,
    activeConversation,
    // UI state
    showConversations,
    setShowConversations,
    showSettings,
    setShowSettings,
    showAddModel,
    setShowAddModel,
    showUpgrade,
    setShowUpgrade,
    // Settings
    systemPrompt,
    setSystemPrompt,
    temperature,
    setTemperature,
    // Context support
    useContextInChat,
    setUseContextInChat,
    contextItems,
    setContextItems,
    handleContextChange,
    // Actions
    handleSend,
    handleStop,
    handleClear,
    handleSelectConversation,
    handleDeleteConversation,
    handleExportConversation,
    // Stream management
    addChunk,
    completeStream,
    resetStream
  };
}