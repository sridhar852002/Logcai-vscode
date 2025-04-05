// src/components/chat/SettingsPanel.tsx (Updated with API Key Settings)
import React, { memo } from 'react';
import { useTheme } from '../../styles/ThemeProvider';
import ApiKeySettings from '../settings/ApiKeySettings';
import { canUseBYOK } from '../../monetization/planManager';

interface SettingsPanelProps {
  systemPrompt: string;
  onSystemPromptChange: (value: string) => void;
  temperature: number;
  onTemperatureChange: (value: number) => void;
  onExportConversation: () => void;
  onClose: () => void;
  hasActiveConversation: boolean;
}

const SettingsPanel = memo(({
  systemPrompt,
  onSystemPromptChange,
  temperature,
  onTemperatureChange,
  onExportConversation,
  onClose,
  hasActiveConversation
}: SettingsPanelProps) => {
  const theme = useTheme();

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      right: 0,
      width: '320px',
      height: '100vh',
      backgroundColor: theme.colors.backgroundLight,
      borderLeft: `1px solid ${theme.colors.border}`,
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '16px',
        borderBottom: `1px solid ${theme.colors.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, color: theme.colors.primary }}>⚙️ Settings</h3>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: theme.colors.textMuted,
            cursor: 'pointer',
            fontSize: '20px',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
          }}
          aria-label="Close settings"
        >
          ×
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {/* API Key Settings */}
        <ApiKeySettings />
        
        {/* System Prompt */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontWeight: 'bold',
            fontSize: '14px',
          }}>
            System Prompt
          </label>
          <textarea
            value={systemPrompt}
            onChange={e => onSystemPromptChange(e.target.value)}
            style={{
              width: '100%',
              height: '120px',
              padding: '12px',
              backgroundColor: theme.colors.backgroundDark,
              color: theme.colors.text,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              outline: 'none',
              fontSize: '14px',
              resize: 'vertical',
              fontFamily: 'monospace',
            }}
            placeholder="You are a helpful assistant..."
          />
        </div>
        
        {/* Temperature Setting */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontWeight: 'bold',
            fontSize: '14px',
          }}>
            Temperature: {temperature.toFixed(1)}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>0.0</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={e => onTemperatureChange(parseFloat(e.target.value))}
              style={{ flex: 1 }}
              aria-label="Temperature"
            />
            <span>2.0</span>
          </div>
          <div style={{ fontSize: '12px', color: theme.colors.textMuted, marginTop: '8px' }}>
            Lower values = more focused, deterministic responses<br />
            Higher values = more creative, varied responses
          </div>
        </div>
        
        {/* Export Conversation Button */}
        <button
          onClick={onExportConversation}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: '#444',
            color: theme.colors.text,
            border: 'none',
            borderRadius: '6px',
            cursor: hasActiveConversation ? 'pointer' : 'not-allowed',
            marginBottom: '8px',
            fontSize: '14px',
            opacity: hasActiveConversation ? 1 : 0.5,
          }}
          disabled={!hasActiveConversation}
        >
          Export Current Conversation
        </button>
      </div>
    </div>
  );
});

export default SettingsPanel;