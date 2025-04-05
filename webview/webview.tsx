// src/webview/webview.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import SidebarNavigation from './panels/SidebarNavigation';
import { ThemeProvider } from '../styles/ThemeProvider';
import { ToastProvider } from '../components/ui/ToastProvider';

// Import global CSS
import '../styles/global.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ThemeProvider>
        <ToastProvider>
          <SidebarNavigation />
        </ToastProvider>
      </ThemeProvider>
    </React.StrictMode>
  );
}