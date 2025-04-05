// src/components/settings/ApiKeySettings.tsx
import React, { useState, useEffect } from 'react';
import { useTheme } from '../../styles/ThemeProvider';
import ApiKeyManager, { ApiProvider } from '../../services/ApiKeyManager'; 
import { useUserPlan } from '../../auth/useUserPlan';
import { isPlanAtLeast, canUseBYOK } from '../../monetization/planManager';

interface ApiKeySettingsProps {
  onSaved?: () => void;
}

const ApiKeySettings: React.FC<ApiKeySettingsProps> = ({ onSaved }) => {
  const theme = useTheme();
  const { user, plan } = useUserPlan();
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [isHidden, setIsHidden] = useState(true);
  const [saveStatus, setSaveStatus] = useState<{
    message: string;
    type: 'success' | 'error' | 'none';
  }>({ message: '', type: 'none' });
  
  // Load existing keys on component mount
  useEffect(() => {
    if (user) {
      const openai = ApiKeyManager.getKey('openai');
      const anthropic = ApiKeyManager.getKey('anthropic');
      
      if (openai) setOpenaiKey(openai);
      if (anthropic) setAnthropicKey(anthropic);
    }
  }, [user]);

  // Check if user plan allows BYOK
  const canUseBYOK = isPlanAtLeast('LocalPro');

  // Handle API key submission
  const handleSaveKeys = async () => {
    if (!user) return;
    
    try {
      let success = true;
      
      // Save OpenAI key if provided
      if (openaiKey) {
        const result = await ApiKeyManager.saveKey('openai', openaiKey);
        if (!result) success = false;
      }
      
      // Save Anthropic key if provided
      if (anthropicKey) {
        const result = await ApiKeyManager.saveKey('anthropic', anthropicKey);
        if (!result) success = false;
      }
      
      if (success) {
        setSaveStatus({
          message: 'API keys saved successfully',
          type: 'success'
        });
        
        // Hide the success message after 3 seconds
        setTimeout(() => {
          setSaveStatus({ message: '', type: 'none' });
        }, 3000);
        
        if (onSaved) onSaved();
      } else {
        setSaveStatus({
          message: 'Failed to save one or more API keys',
          type: 'error'
        });
      }
    } catch (error) {
      setSaveStatus({
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error'
      });
    }
  };

  // Handle clearing a specific key
  const handleClearKey = async (provider: ApiProvider) => {
    if (!user) return;
    
    try {
      const result = await ApiKeyManager.deleteKey(provider);
      if (result) {
        if (provider === 'openai') setOpenaiKey('');
        if (provider === 'anthropic') setAnthropicKey('');
        
        setSaveStatus({
          message: `${provider.charAt(0).toUpperCase() + provider.slice(1)} API key removed`,
          type: 'success'
        });
        
        setTimeout(() => {
          setSaveStatus({ message: '', type: 'none' });
        }, 3000);
        
        if (onSaved) onSaved();
      } else {
        setSaveStatus({
          message: `Failed to remove ${provider} API key`,
          type: 'error'
        });
      }
    } catch (error) {
      setSaveStatus({
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error'
      });
    }
  };

  if (!canUseBYOK) {
    return (
      <div style={{
        padding: '12px 16px',
        backgroundColor: theme.colors.backgroundLight,
        borderRadius: '8px',
        marginBottom: '24px',
        color: theme.colors.textSecondary,
        border: `1px solid ${theme.colors.border}`,
      }}>
        <h3 style={{ 
          fontSize: '16px', 
          fontWeight: 'bold',
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>🔑</span> Cloud API Keys
        </h3>
        <p style={{ marginBottom: '12px' }}>
          Bring your own OpenAI or Anthropic API keys to use cloud models.
        </p>
        <div style={{
          backgroundColor: theme.colors.infoLight,
          padding: '10px',
          borderRadius: '6px',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: theme.colors.info
        }}>
          <span>ℹ️</span> 
          <div>Upgrade to LocalPro or higher to use your own API keys with Logcai.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '12px 16px',
      backgroundColor: theme.colors.backgroundLight,
      borderRadius: '8px',
      marginBottom: '24px',
      border: `1px solid ${theme.colors.border}`,
    }}>
      <h3 style={{ 
        fontSize: '16px', 
        fontWeight: 'bold',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span>🔑</span> Cloud API Keys
      </h3>
      
      {/* Description */}
      <p style={{ 
        marginBottom: '16px',
        color: theme.colors.textSecondary,
        fontSize: '14px'
      }}>
        Add your own API keys to use cloud models with your LocalPro subscription.
        Your keys are securely stored and used only for your requests.
      </p>
      
      {/* OpenAI Key Input */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'block',
          marginBottom: '6px',
          fontSize: '14px',
          fontWeight: 'medium'
        }}>
          OpenAI API Key
        </label>
        <div style={{
          display: 'flex',
          gap: '8px'
        }}>
          <input
            type={isHidden ? 'password' : 'text'}
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            placeholder="sk-..."
            style={{
              flex: 1,
              padding: '8px 12px',
              backgroundColor: theme.colors.backgroundDark,
              color: theme.colors.text,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
          {openaiKey && (
            <button
              onClick={() => handleClearKey('openai')}
              style={{
                padding: '8px 12px',
                backgroundColor: theme.colors.errorLight,
                color: theme.colors.error,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Clear
            </button>
          )}
        </div>
        <div style={{
          fontSize: '12px',
          color: theme.colors.textMuted,
          marginTop: '4px'
        }}>
          Get your OpenAI API key from <a 
            href="https://platform.openai.com/api-keys" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: theme.colors.primary }}
          >
            platform.openai.com
          </a>
        </div>
      </div>
      
      {/* Anthropic Key Input */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'block',
          marginBottom: '6px',
          fontSize: '14px',
          fontWeight: 'medium'
        }}>
          Anthropic API Key
        </label>
        <div style={{
          display: 'flex',
          gap: '8px'
        }}>
          <input
            type={isHidden ? 'password' : 'text'}
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            placeholder="sk_ant_..."
            style={{
              flex: 1,
              padding: '8px 12px',
              backgroundColor: theme.colors.backgroundDark,
              color: theme.colors.text,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
          {anthropicKey && (
            <button
              onClick={() => handleClearKey('anthropic')}
              style={{
                padding: '8px 12px',
                backgroundColor: theme.colors.errorLight,
                color: theme.colors.error,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Clear
            </button>
          )}
        </div>
        <div style={{
          fontSize: '12px',
          color: theme.colors.textMuted,
          marginTop: '4px'
        }}>
          Get your Anthropic API key from <a 
            href="https://console.anthropic.com/keys" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: theme.colors.primary }}
          >
            console.anthropic.com
          </a>
        </div>
      </div>
      
      {/* Show/Hide Keys Toggle */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          fontSize: '14px',
          color: theme.colors.textSecondary
        }}>
          <input
            type="checkbox"
            checked={!isHidden}
            onChange={() => setIsHidden(!isHidden)}
            style={{
              cursor: 'pointer',
            }}
          />
          Show API keys
        </label>
      </div>
      
      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px',
        marginTop: '16px'
      }}>
        <button
          onClick={handleSaveKeys}
          style={{
            padding: '8px 16px',
            backgroundColor: theme.colors.primary,
            color: '#000',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          Save API Keys
        </button>
      </div>
      
      {/* Status Message */}
      {saveStatus.type !== 'none' && (
        <div style={{
          marginTop: '12px',
          padding: '8px 12px',
          borderRadius: '6px',
          backgroundColor: saveStatus.type === 'success' 
            ? theme.colors.successLight
            : theme.colors.errorLight,
          color: saveStatus.type === 'success'
            ? theme.colors.success
            : theme.colors.error,
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>{saveStatus.type === 'success' ? '✅' : '❌'}</span>
          {saveStatus.message}
        </div>
      )}
    </div>
  );
};

export default ApiKeySettings;