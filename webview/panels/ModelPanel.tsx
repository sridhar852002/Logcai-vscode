// src/webview/panels/ModelPanel.tsx
import React, { memo, useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../styles/ThemeProvider';
import { useModelPanel } from '../../hooks/useModelPanel';
import ModelItem from '../../components/model/ModelItem';
import vscode from '../../utils/vscode';
import webviewLogger from '../../utils/webviewLogger';

const ModelPanel: React.FC = () => {
  const theme = useTheme();
  const [expandedHelp, setExpandedHelp] = useState(false);
  
  // Add state for installation status
  const [installStatus, setInstallStatus] = useState<Record<string, {
    status: 'installing' | 'installed' | 'error';
    progress?: number;
    error?: string;
  }>>({});

  // Use our custom hook for model panel state and logic
  const {
    filteredModels,
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab,
    loading,
    error,
    handleInstall,
    toggleActiveStatus,
    refreshModels
  } = useModelPanel();

  // Listen for model installation status updates
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      if (message.command === 'modelInstallStatus') {
        webviewLogger.debug(`Received model install status: ${message.modelId} - ${message.status} (${message.progress || 0}%)`);
        
        setInstallStatus(prev => ({
          ...prev,
          [message.modelId]: {
            status: message.status,
            progress: message.progress,
            error: message.error
          }
        }));
        
        // If installation completed, refresh the model list
        if (message.status === 'installed') {
          refreshModels();
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refreshModels]);

  // Function to handle refresh button click
  const handleRefreshClick = useCallback(() => {
    webviewLogger.info("Manual refresh triggered");
    refreshModels();
  }, [refreshModels]);

  // Function to add a new model manually
  const [addModelInput, setAddModelInput] = useState("");
  const [showAddModelInput, setShowAddModelInput] = useState(false);

  const handleAddModel = useCallback(() => {
    if (addModelInput.trim()) {
      handleInstall(addModelInput.trim());
      setAddModelInput("");
      setShowAddModelInput(false);
    }
  }, [addModelInput, handleInstall]);

  return (
    <div className="model-panel" style={{
      padding: '1.5rem',
      color: theme.colors.text,
      height: '100%',
      overflow: 'auto',
    }}>
      {/* Header with search */}
      <div className="header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{
          display: 'flex',
          width: '100%',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: theme.colors.primary
          }}>
            <span></span> Local Models
          </h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleRefreshClick}
              style={{
                background: 'transparent',
                border: 'none',
                color: theme.colors.textMuted,
                cursor: 'pointer',
                fontSize: '18px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'all 0.2s ease'
              }}
              title="Refresh models"
            >
              ↻
            </button>
            <button
              onClick={() => setExpandedHelp(!expandedHelp)}
              style={{
                background: 'transparent',
                border: 'none',
                color: theme.colors.textMuted,
                cursor: 'pointer',
                fontSize: '18px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'all 0.2s ease'
              }}
            >
              {expandedHelp ? '' : '?'}
            </button>
          </div>
        </div>
        <div className="search-container" style={{
          position: 'relative',
          width: '100%',
        }}>
          <div className="search-icon" style={{
            position: 'absolute',
            left: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: theme.colors.textMuted,
            fontSize: '14px'
          }}>
          </div>
          <input
            type="text"
            className="search-input"
            placeholder="Search models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 10px 10px 35px',
              borderRadius: '8px',
              background: theme.colors.backgroundLight,
              border: `1px solid ${theme.colors.border}`,
              color: theme.colors.text,
              fontSize: '14px',
              transition: 'all 0.2s ease'
            }}
          />
        </div>
      </div>

      {/* Add Model Input (conditionally shown) */}
      {showAddModelInput && (
        <div style={{
          marginBottom: '20px',
          backgroundColor: theme.colors.backgroundLight,
          padding: '12px',
          borderRadius: '8px',
          border: `1px solid ${theme.colors.border}`,
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '8px', fontSize: '15px' }}>
            Add New Model
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={addModelInput}
              onChange={(e) => setAddModelInput(e.target.value)}
              placeholder="e.g., mistral:7b or gemma:4b"
              style={{
                flex: 1,
                padding: '8px 12px',
                backgroundColor: theme.colors.backgroundDark,
                color: theme.colors.text,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '6px',
                fontSize: '14px'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddModel();
                }
              }}
            />
            <button
              onClick={handleAddModel}
              style={{
                backgroundColor: theme.colors.primary,
                color: '#000',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Add
            </button>
            <button
              onClick={() => setShowAddModelInput(false)}
              style={{
                backgroundColor: 'transparent',
                color: theme.colors.textMuted,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '6px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Help section */}
      {expandedHelp && (
        <div style={{
          backgroundColor: theme.colors.backgroundLight,
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: `1px solid ${theme.colors.border}`,
          fontSize: '14px',
          lineHeight: '1.5'
        }}>
          <h3 style={{
            marginTop: 0,
            marginBottom: '12px',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: theme.colors.primary
          }}>
            <span></span> About Local Models
          </h3>
          <p>Logcai uses Ollama to run AI models locally on your machine. This gives you:</p>
          <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
            <li>Better privacy - your code never leaves your computer</li>
            <li>No API costs - run as many queries as you want</li>
            <li>Offline capability - work without an internet connection</li>
          </ul>
          <p style={{ marginBottom: '8px' }}>
            <strong>Installing a model:</strong> Click the Install button and wait for the download to
            complete.
            Model sizes vary from 1GB to 8GB depending on capabilities.
          </p>
          <div style={{
            backgroundColor: theme.colors.backgroundDark,
            padding: '12px',
            borderRadius: '6px',
            marginTop: '16px',
            fontSize: '13px'
          }}>
            <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
              <span></span> Troubleshooting
            </div>
            <p style={{ margin: '0 0 8px 0' }}>
              If models fail to load or install, ensure that:
            </p>
            <ol style={{ paddingLeft: '20px', margin: '0' }}>
              <li>Ollama is installed and running on your machine</li>
              <li>Your firewall is not blocking Ollama connections</li>
              <li>You have enough disk space for the model</li>
            </ol>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs" style={{
        display: 'flex',
        marginBottom: '1rem',
        borderBottom: `1px solid ${theme.colors.border}`,
      }}>
        <div
          className={`tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
          style={{
            padding: '8px 16px',
            cursor: 'pointer',
            color: activeTab === 'all' ? theme.colors.primary : theme.colors.textSecondary,
            borderBottom: `2px solid ${activeTab === 'all' ? theme.colors.primary : 'transparent'}`,
            marginRight: '10px',
            fontWeight: activeTab === 'all' ? 'bold' : 'normal',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span></span> All Models
        </div>
        <div
          className={`tab ${activeTab === 'installed' ? 'active' : ''}`}
          onClick={() => setActiveTab('installed')}
          style={{
            padding: '8px 16px',
            cursor: 'pointer',
            color: activeTab === 'installed' ? theme.colors.primary : theme.colors.textSecondary,
            borderBottom: `2px solid ${activeTab === 'installed' ? theme.colors.primary : 'transparent'}`,
            fontWeight: activeTab === 'installed' ? 'bold' : 'normal',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span></span> Installed
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '2rem',
          color: theme.colors.textMuted
        }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            borderTop: `2px solid ${theme.colors.primary}`,
            borderRight: '2px solid transparent',
            animation: 'spin 1s linear infinite',
            marginRight: '12px'
          }}></div>
          <span>Loading models...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={{
          backgroundColor: theme.colors.errorLight,
          color: theme.colors.error,
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px'
        }}>
          <span style={{ fontSize: '18px' }}>!</span>
          <div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>Error loading models</h3>
            <p style={{ margin: 0 }}>{error}</p>
            <button
              onClick={handleRefreshClick}
              style={{
                marginTop: '12px',
                backgroundColor: 'transparent',
                border: `1px solid ${theme.colors.error}`,
                color: theme.colors.error,
                borderRadius: '4px',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredModels.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem 2rem',
          color: theme.colors.textMuted,
          backgroundColor: theme.colors.backgroundLight,
          borderRadius: '8px',
          border: `1px dashed ${theme.colors.border}`,
        }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>
            {searchQuery ? '' : ''}
          </div>
          <h3 style={{ marginBottom: '8px', color: theme.colors.text }}>
            {searchQuery ? 'No models found matching your search' : 'No models installed yet'}
          </h3>
          <p style={{ marginBottom: '16px', fontSize: '14px' }}>
            {searchQuery
              ? `Try adjusting your search query`
              : `Install a model to get started with Logcai's local AI features`}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                backgroundColor: 'transparent',
                color: theme.colors.primary,
                border: `1px solid ${theme.colors.primary}`,
                borderRadius: '6px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '14px',
                marginRight: '8px'
              }}
            >
              Clear search
            </button>
          )}
          <button
            onClick={() => setShowAddModelInput(true)}
            style={{
              backgroundColor: theme.colors.primary,
              color: '#000',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Add a model
          </button>
        </div>
      ) : (
        <>
          {/* Add Model button */}
          {!showAddModelInput && (
            <button
              onClick={() => setShowAddModelInput(true)}
              style={{
                backgroundColor: 'transparent',
                border: `1px dashed ${theme.colors.border}`,
                color: theme.colors.textSecondary,
                borderRadius: '8px',
                padding: '10px',
                cursor: 'pointer',
                width: '100%',
                marginBottom: '12px',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              + Add New Model
            </button>
          )}

          {/* Model list */}
          <ul className="model-list" style={{
            listStyle: 'none',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {filteredModels.map((model) => (
              <ModelItem
                key={model.id}
                model={model}
                onInstall={handleInstall}
                onToggleActive={toggleActiveStatus}
                installStatus={installStatus[model.id]}
              />
            ))}
          </ul>
        </>
      )}

      {/* Status indicator */}
      <div style={{
        marginTop: '32px',
        padding: '12px 16px',
        backgroundColor: theme.colors.backgroundLight,
        borderRadius: '8px',
        fontSize: '13px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: theme.colors.textSecondary
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: filteredModels.some(m => m.isInstalled)
            ? theme.colors.success
            : theme.colors.error
        }}></div>
        <span>
          {filteredModels.some(m => m.isInstalled)
            ? `Ollama is running with ${filteredModels.filter(m => m.isInstalled).length} installed models`
            : `No models are currently installed`}
        </span>
      </div>

      {/* Animations */}
      <style>
        {`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        `}
      </style>
    </div>
  );
};

export default memo(ModelPanel);