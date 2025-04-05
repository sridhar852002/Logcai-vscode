//src/monetization/UpgradeToast.tsx

import React from 'react';

const UpgradeToast: React.FC<{ feature: string }> = ({ feature }) => {
  return (
    <div className="absolute bottom-2 left-2 bg-yellow-400 text-black px-3 py-1 rounded shadow z-10">
      🔒 {feature} is available in Pro plans
    </div>
  );
};

export default UpgradeToast;
