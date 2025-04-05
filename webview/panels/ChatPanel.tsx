// src/webview/panels/ChatPanel.tsx
import React, { useRef, useCallback, useState, useEffect } from 'react';
import { useTheme } from '../../styles/ThemeProvider';

// Import memoized components
import StreamingRenderer from '../../components/MemoizedStreamingRenderer';
import MessageItem from '../../components/MemoizedMessageItem';
import ChatHeader from '../../components/chat/ChatHeader';
import ModelSelector from '../../components/chat/ModelSelector';
import ChatInput from '../../components/chat/ChatInput';
import ChatControls from '../../components/chat/ChatControls';
import ConversationsSidebar from '../../components/chat/ConversationsSidebar';
import SettingsPanel from '../../components/chat/SettingsPanel';
import ErrorDisplay from '../../components/ErrorDisplay';

// Import context components
import { ContextProvider } from '../../components/context/ContextProvider';
import ContextSelector from '../../components/context/ContextSelector';
import ContextIntegrationSection from '../../components/chat/ContextIntegrationSection';

// Import modals
import UpgradeModal from '../../monetization/UpgradeModal';
import AddModelModal from './AddModelModal';

// Import custom hooks and services
import { useChatState } from '../../hooks/useChatState';
import { ModelService } from '../../services/modelService';

const ChatPanel: React.FC = () => {
  const theme = useTheme();
  const chatRef = useRef<HTMLDivElement>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [fadeIntro, setFadeIntro] = useState(false);

  // Use our custom hook to manage chat state
  const {
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
    handleExportConversation
  } = useChatState();

  useEffect(() => {
    const activeModels = ModelService.getActiveLocalModels();
    setLocalModels(activeModels);
  }, [aiMode, showAddModel]);
  

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, streamBuffer]);

  // Hide intro when user starts typing or messages exist
  useEffect(() => {
    if (input || messages.length > 0) {
      setFadeIntro(true);
      setTimeout(() => setShowIntro(false), 300); // Fade out before removing
    }
  }, [input, messages]);

  // Handle key press in input
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Handle model change
  const handleModelChange = useCallback((modelId: string) => {
    setSelectedModel(modelId);
  }, [setSelectedModel]);

  // Handle AI mode change
  const handleAIModeChange = useCallback((mode: 'local' | 'cloud') => {
    setAiMode(mode);
    if (mode === 'local') {
      ModelService.requestInstalledModels();
    }
  }, [setAiMode]);

  // Get model name
  const getModelName = useCallback((modelId: string) => {
    return ModelService.getModelById(modelId)?.name || modelId;
  }, []);

  // Styles - Optimized for space
  const containerStyle: React.CSSProperties = {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: theme.colors.background,
    position: 'relative',
};

const headerStyle: React.CSSProperties = {
    padding: '12px 14px 8px', // Further reduced padding
    borderBottom: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.backgroundDark,
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)', // Lighter shadow
    zIndex: 5,
};

const contentStyle: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    padding: '14px 16px', // Further reduced padding
    scrollBehavior: 'smooth',
};

const inputAreaStyle: React.CSSProperties = {
    padding: '10px 14px 14px', // Further reduced padding
    backgroundColor: theme.colors.backgroundDark,
    position: 'relative',
    zIndex: 5,
    boxShadow: '0 -1px 2px rgba(0,0,0,0.1)' // Lighter shadow
};
  const introContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '0 1.5rem', // Reduced from 2rem
    textAlign: 'center',
    opacity: fadeIntro ? 0 : 1,
    transition: 'opacity 0.3s ease',
  };

  // Sample chat suggestions for the intro screen
  const chatSuggestions = [
    "Explain this code to me",
    "Help me optimize this function",
    "Generate a unit test for this class",
    "Find bugs in my code"
  ];

  return (
    <ContextProvider>
        <div style={containerStyle}>
            {/* Top controls */}
            <div style={headerStyle}>
                <ChatHeader
                    onToggleConversations={() => setShowConversations(!showConversations)}
                    onToggleSettings={() => setShowSettings(!showSettings)}
                    showConversations={showConversations}
                    showSettings={showSettings}
                />
                <ModelSelector
                    selectedModel={selectedModel}
                    onModelChange={handleModelChange}
                    aiMode={aiMode}
                    onAIModeChange={handleAIModeChange}
                    localModels={localModels}
                    modelRegistry={ModelService.getAllModels()}
                />
            </div>

        {/* Chat messages */}
        <div
          ref={chatRef}
          style={contentStyle}
          className="chat-messages-container"
        >
          {/* Empty state */}
          {messages.length === 0 && !streamBuffer && showIntro && (
            <div style={introContainerStyle} className="intro-animation">
              <div style={{
                fontSize: '48px', // Reduced from 64px
                marginBottom: '12px', // Reduced from 16px
                animation: 'float 3s ease-in-out infinite',
              }}>💬</div>
              <h3 style={{
                marginBottom: '12px', // Reduced from 16px
                color: theme.colors.text,
                fontSize: '20px', // Reduced from 24px
                fontWeight: 'bold'
              }}>
                Welcome to Logcai
              </h3>
              <p style={{
                fontSize: '14px', // Reduced from 16px
                color: theme.colors.textSecondary,
                maxWidth: '500px', // Reduced from 600px
                marginBottom: '24px', // Reduced from 32px
                lineHeight: '1.5'
              }}>
                Your AI coding assistant is ready to help. Ask questions, get explanations,
                or request assistance with your code.
              </p>
              
              {/* Chat suggestions */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', // Smaller minimum size
                gap: '10px', // Reduced from 12px
                width: '100%',
                maxWidth: '500px' // Reduced from 600px
              }}>
                {chatSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setInput(suggestion);
                      setFadeIntro(true);
                      setTimeout(() => setShowIntro(false), 300);
                    }}
                    style={{
                      backgroundColor: theme.colors.backgroundLight,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: '8px',
                      padding: '10px', // Reduced from 12px
                      textAlign: 'left',
                      color: theme.colors.textSecondary,
                      cursor: 'pointer',
                      fontSize: '13px', // Reduced from 14px
                      transition: 'all 0.2s ease',
                    }}
                    className="suggestion-button"
                  >
                    "{suggestion}"
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="error-animation" style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <ErrorDisplay
                message={error}
                dismiss={() => setError(null)}
                retry={selectedModel && input ? () => {
                  setError(null);
                  handleSend();
                } : undefined}
              />
            </div>
          )}

          {/* Message list */}
          {messages.map((message, index) => (
            <div
              key={message.id}
              className="message-animation"
              style={{
                animation: 'fadeInUp 0.3s ease-out',
                animationDelay: `${index * 0.05}s`
              }}
            >
              <MessageItem
                message={message}
                colors={theme.colors}
              />
            </div>
          ))}

          {/* Streaming message */}
          {streamBuffer && (
            <div
              className="stream-animation"
              style={{
                marginBottom: '12px', // Reduced from 16px
                padding: '10px', // Reduced from 12px
                backgroundColor: 'rgba(0, 229, 255, 0.05)',
                borderRadius: '8px',
                animation: 'fadeIn 0.3s ease-out'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '6px', // Reduced from 8px
                color: theme.colors.textMuted,
                fontSize: '13px' // Reduced from 14px
              }}>
                <span style={{
                  marginRight: '8px',
                  backgroundColor: theme.colors.primary,
                  color: theme.colors.backgroundDark,
                  width: '24px', // Reduced from 28px
                  height: '24px', // Reduced from 28px
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '12px' // Reduced from default
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

          {/* Loading indicator */}
          {isStreaming && !streamBuffer && (
            <div
              className="loading-animation"
              style={{
                padding: '12px', // Reduced from 16px
                display: 'flex',
                alignItems: 'center',
                animation: 'fadeIn 0.3s ease-out'
              }}
            >
              <div style={{
                backgroundColor: theme.colors.backgroundLight,
                padding: '10px 14px', // Reduced from 12px 16px
                borderRadius: '16px',
                display: 'inline-flex',
                alignItems: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
              }}>
                <span style={{ fontSize: '13px', color: theme.colors.textSecondary, marginRight: '8px' }}>
                  Thinking
                </span>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      style={{
                        width: '6px', // Reduced from 8px
                        height: '6px', // Reduced from 8px
                        backgroundColor: theme.colors.primary,
                        borderRadius: '50%',
                        opacity: 0.7,
                        animation: 'bounce 1.4s infinite ease-in-out',
                        animationDelay: `${i * 0.16}s`
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Context Selector - shown above input area */}
        <div style={{
          padding: '0 16px', // Reduced padding
          borderTop: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundDark,
          position: 'relative',
          zIndex: 5,
        }}>
          <ContextSelector
            onContextChange={handleContextChange}
          />
        </div>

        {/* Input and controls */}
        <div style={inputAreaStyle}>
                    <ChatInput
                        input={input}
                        onInputChange={setInput}
                        onSend={handleSend}
                        onKeyDown={handleKeyDown}
                        isStreaming={isStreaming}
                    />
                    <ChatControls
                        isStreaming={isStreaming}
                        onStop={handleStop}
                        onClear={handleClear}
                        selectedModel={selectedModel}
                        modelName={getModelName(selectedModel)}
                    />
                </div>


        {/* Sidebars */}
        {showConversations && (
          <div className="sidebar-animation" style={{ animation: 'slideInLeft 0.3s ease-out' }}>
            <ConversationsSidebar
              conversations={conversations}
              activeConversation={activeConversation}
              onSelectConversation={handleSelectConversation}
              onDeleteConversation={handleDeleteConversation}
              onClose={() => setShowConversations(false)}
              onNewConversation={handleClear}
            />
          </div>
        )}

        {showSettings && (
          <div className="sidebar-animation" style={{ animation: 'slideInRight 0.3s ease-out' }}>
            <SettingsPanel
              systemPrompt={systemPrompt}
              onSystemPromptChange={setSystemPrompt}
              temperature={temperature}
              onTemperatureChange={setTemperature}
              onExportConversation={handleExportConversation}
              onClose={() => setShowSettings(false)}
              hasActiveConversation={!!activeConversation}
            />
          </div>
        )}

        {/* Modals */}
        {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
        {showAddModel && (
          <AddModelModal
            onClose={() => setShowAddModel(false)}
            onInstall={(model) => {
              ModelService.installModel(model);
              setShowAddModel(false);
            }}
          />
        )}

        {/* Global Styles for animations */}
        <style>
          {`
          @keyframes bounce {
            0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
            40% { transform: scale(1); opacity: 1; }
          }
          @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
          }
          @keyframes blink {
            0% { opacity: 1; }
            50% { opacity: 0; }
            100% { opacity: 1; }
          }
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
          @keyframes slideInLeft {
            from { transform: translateX(-100%); }
            to { transform: translateX(0); }
          }
          @keyframes slideInRight {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
          .suggestion-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 3px 6px rgba(0, 0, 0, 0.1);
            border-color: ${theme.colors.primary};
            color: ${theme.colors.primary};
          }
          .hover-effect {
            transition: transform 0.2s ease, box-shadow 0.2s ease;
          }
          .hover-effect:hover {
            transform: translateY(-2px);
            box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);
          }
          `}
        </style>
      </div>
    </ContextProvider>
  );
};
export default ChatPanel;