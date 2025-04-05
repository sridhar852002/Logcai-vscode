// src/monetization/LockedFeatureWrapper.tsx
import React from 'react';
import { isFeatureAvailable } from './planManager';
import UpgradeToast from './UpgradeToast';

interface Props {
  feature: string;
  children: React.ReactNode;
}

const LockedFeatureWrapper: React.FC<Props> = ({ feature, children }) => {
  if (!isFeatureAvailable(feature as any)) {
    return (
      <div className="relative opacity-50 pointer-events-none">
        {children}
        <UpgradeToast feature={feature} />
      </div>
    );
  }

  return <>{children}</>;
};

export default LockedFeatureWrapper;
