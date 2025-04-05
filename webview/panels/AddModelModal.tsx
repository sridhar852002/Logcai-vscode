import React, { useState } from 'react';

interface Props {
  onClose: () => void;
  onInstall: (model: string) => void;
}

const AddModelModal: React.FC<Props> = ({ onClose, onInstall }) => {
  const [modelName, setModelName] = useState('');

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex',
      justifyContent: 'center', alignItems: 'center', zIndex: 1000
    }}>
      <div style={{
        background: '#1E1E1E', borderRadius: '10px',
        padding: '2rem', width: '100%', maxWidth: '400px'
      }}>
        <h3>Add New Local Model</h3>
        <input
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
          placeholder="e.g., mistral, gemma3"
          style={{
            width: '100%', padding: '10px', borderRadius: '6px',
            border: '1px solid var(--border-color)', backgroundColor: '#111',
            color: '#fff', marginTop: '1rem'
          }}
        />
        <div style={{ marginTop: '1.5rem' }}>
          <button
            onClick={() => {
              if (modelName) {
                onInstall(modelName);
                onClose();
              }
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3D5AFE',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              marginRight: '10px'
            }}
          >
            Install
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '8px 14px',
              background: 'transparent',
              color: '#ccc',
              border: '1px solid #444',
              borderRadius: '6px'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddModelModal;
