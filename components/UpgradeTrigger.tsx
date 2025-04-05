import React, { useState } from 'react';
import UpgradeModal from '../monetization/UpgradeModal';

const UpgradeTrigger: React.FC<{ label?: string }> = ({ label = 'Upgrade to Pro' }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: 'transparent',
          color: '#4FC3F7',
          border: 'none',
          textDecoration: 'underline',
          cursor: 'pointer',
        }}
      >
        {label}
      </button>
      {open && <UpgradeModal onClose={() => setOpen(false)} />}
    </>
  );
};

export default UpgradeTrigger;
