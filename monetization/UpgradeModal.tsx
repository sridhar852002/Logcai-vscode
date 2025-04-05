import React from 'react';

interface Props {
  onClose: () => void;
}

const UpgradeModal: React.FC<Props> = ({ onClose }) => {
  return (
    <div style={overlay}>
      <div style={modal}>
        <h2>Upgrade Required</h2>
        <p>This feature is only available to Pro users.</p>
        <button
          onClick={() => window.open('https://your-stripe-checkout-link.com', '_blank')}
          style={primary}
        >
          Upgrade Now
        </button>
        <button onClick={onClose} style={secondary}>
          Cancel
        </button>
      </div>
    </div>
  );
};

const overlay: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
  background: 'rgba(0, 0, 0, 0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 999,
};

const modal: React.CSSProperties = {
  background: '#1E1E1E', padding: '2rem', borderRadius: '10px',
  width: '90%', maxWidth: '400px', color: '#fff', textAlign: 'center',
};

const primary: React.CSSProperties = {
  background: 'linear-gradient(120deg, var(--primary-color), var(--secondary-color))',
  border: 'none', padding: '10px 20px', color: '#fff', borderRadius: '6px', cursor: 'pointer',
};

const secondary: React.CSSProperties = {
  marginTop: '1rem', background: 'transparent', color: '#ccc', border: '1px solid #444', padding: '8px 14px', borderRadius: '6px',
};

export default UpgradeModal;
