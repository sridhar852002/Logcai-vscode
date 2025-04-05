// src/webview/panels/SidebarNavigation.tsx
import React, { useState } from 'react';
import { MessageSquare, Settings, Database, Code, Shield } from 'lucide-react';
import ChatPanel from './ChatPanel';
import AgentMarketplacePanel from './AgentMarketplacePanel';
import ModelPanel from './ModelPanel';
import SettingsPanel from './SettingsPanel';
import AdminPanel from './AdminPanel';
import { useUserPlan } from '../../auth/useUserPlan';
import { useTheme } from '../../styles/ThemeProvider';

// Define the tab types
type TabType = 'chat' | 'agents' | 'models' | 'settings' | 'admin';

// Define tab item interface
interface TabItem {
  key: TabType;
  label: string;
  icon: React.ReactNode;
  requiresAdmin?: boolean;
}

const SidebarNavigation: React.FC = () => {
  const [tab, setTab] = useState<TabType>('chat');
  const { isAdmin, isLoading } = useUserPlan();
  const theme = useTheme();

  // Tab configuration
  const tabs: TabItem[] = [
    { key: 'chat', label: 'Chat', icon: <MessageSquare size={22} /> },
    { key: 'agents', label: 'Agents', icon: <Code size={22} /> },
    { key: 'models', label: 'Models', icon: <Database size={22} /> },
    { key: 'settings', label: 'Settings', icon: <Settings size={22} /> },
    { key: 'admin', label: 'Admin', icon: <Shield size={22} />, requiresAdmin: true },
  ];

  // Filter tabs based on permissions
  const visibleTabs = tabs.filter(t => !t.requiresAdmin || isAdmin);

  // Styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    height: '100vh',
    width: '100%',
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    overflow: 'hidden',
  };

  const sidebarStyle: React.CSSProperties = {
    width: '72px',
    backgroundColor: theme.colors.backgroundDark,
    borderRight: `1px solid ${theme.colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px 0',
  };

  const logoStyle: React.CSSProperties = {
    width: '40px',
    height: '40px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: '24px',
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: '32px',
  };

  const navContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    flex: 1,
    gap: '8px',
  };

  const navButtonStyle = (isActive: boolean): React.CSSProperties => ({
    width: '48px',
    height: '48px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: '10px',
    cursor: 'pointer',
    backgroundColor: isActive ? theme.colors.backgroundLight : 'transparent',
    color: isActive ? theme.colors.primary : theme.colors.textMuted,
    border: 'none',
    outline: 'none',
    transition: 'all 0.2s ease',
  });

  const navButtonHoverStyle: React.CSSProperties = {
    backgroundColor: theme.colors.backgroundLight,
    transform: 'translateY(-2px)',
  };

  const avatarStyle: React.CSSProperties = {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    backgroundColor: theme.colors.primary,
    color: theme.colors.backgroundDark,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontWeight: 'bold',
    marginTop: 'auto',
    fontSize: '16px',
    boxShadow: theme.shadows.sm,
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
  };

  return (
    <div style={containerStyle}>
      {/* Sidebar */}
      <div style={sidebarStyle}>
        {/* Logo */}
        <div style={logoStyle}>L</div>

        {/* Navigation Tabs */}
        <nav style={navContainerStyle}>
          {visibleTabs.map(({ key, icon, label }) => {
            const isActive = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key as TabType)}
                style={navButtonStyle(isActive)}
                title={label}
                aria-label={label}
                aria-pressed={isActive}
                className="hover-effect"
                onMouseOver={(e) => {
                  // Only apply hover styles if not active
                  if (!isActive) {
                    Object.assign(e.currentTarget.style, navButtonHoverStyle);
                  }
                }}
                onMouseOut={(e) => {
                  // Remove hover styles on mouse out
                  if (!isActive) {
                    Object.assign(e.currentTarget.style, navButtonStyle(false));
                  }
                }}
              >
                {icon}
              </button>
            );
          })}
        </nav>

        {/* User Avatar */}
        <div style={avatarStyle}>
          {isLoading ? '...' : isAdmin ? 'A' : 'U'}
        </div>
      </div>

      {/* Panel Container */}
      <div style={contentStyle}>
        {tab === 'chat' && <ChatPanel />}
        {tab === 'agents' && <AgentMarketplacePanel />}
        {tab === 'models' && <ModelPanel />}
        {tab === 'settings' && <SettingsPanel />}
        {tab === 'admin' && isAdmin && <AdminPanel />}
      </div>
    </div>
  );
};

export default SidebarNavigation;