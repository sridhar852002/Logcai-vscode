// src/components/model/ModelItem.tsx
import React from 'react';
import { ModelService } from '../../services/modelService';

interface Props {
  model: any;
  onInstall: (id: string) => void;
  onToggleActive?: (id: string) => void; // Make this optional
  installStatus?: {
    status: 'installing' | 'installed' | 'error';
    progress?: number;
    error?: string;
  };
}

const ModelItem: React.FC<Props> = ({ model, onInstall, onToggleActive, installStatus }) => {
  const isActive = ModelService.isModelActive(model.id);
  const isInstalling = installStatus?.status === 'installing';
  const installProgress = installStatus?.progress || 0;
  const installError = installStatus?.status === 'error' ? 
    installStatus.error : null;
  
  const toggleActivation = () => {
    if (onToggleActive) {
      onToggleActive(model.id);
    } else {
      if (isActive) {
        ModelService.removeModelFromActive(model.id);
      } else {
        ModelService.addModelToActive(model.id);
      }
    }
  };
  
  return (
    <li
      style={{
        padding: '12px',
        borderRadius: '8px',
        background: '#1e1e2f',
        border: '1px solid #333',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}
    >
      <div>
        <div style={{ fontWeight: 'bold' }}>{model.name}</div>
        <div style={{ fontSize: '12px', color: '#888' }}>{model.id}</div>
        {installError && (
          <div style={{ color: '#ff5f5f', fontSize: '12px', marginTop: '4px' }}>
            Error: {installError}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {isInstalling ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '100px', height: '8px', backgroundColor: '#333', borderRadius: '4px' }}>
              <div 
                style={{ 
                  width: `${installProgress}%`, 
                  height: '100%', 
                  backgroundColor: '#4caf50',
                  borderRadius: '4px'
                }}
              />
            </div>
            <span style={{ fontSize: '11px', color: '#aaa' }}>{installProgress}%</span>
          </div>
        ) : model.isInstalled ? (
          <button
            onClick={toggleActivation}
            style={{
              background: isActive ? '#ff5f5f' : '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            {isActive ? 'Deactivate' : 'Activate for Chat'}
          </button>
        ) : (
          <button
            onClick={() => onInstall(model.id)}
            style={{
              background: '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            Install
          </button>
        )}
      </div>
    </li>
  );
};

export default ModelItem;