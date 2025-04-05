import React, { useEffect, useState } from 'react';
import { useTheme } from '../../styles/ThemeProvider';

export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  variant?: ToastVariant;
  duration?: number;
  onClose?: () => void;
  icon?: React.ReactNode;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  variant = 'default',
  duration = 3000,
  onClose,
  icon,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const theme = useTheme();

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        if (onClose) {
          setTimeout(onClose, 300); // Wait for fade-out animation
        }
      }, duration);

      return () => clearTimeout(timer);
    }
    
    return undefined;
  }, [duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    if (onClose) {
      setTimeout(onClose, 300); // Wait for fade-out animation
    }
  };

  const variantStyles: Record<ToastVariant, { bg: string; color: string; icon?: string }> = {
    default: {
      bg: theme.colors.backgroundLighter,
      color: theme.colors.text,
    },
    success: {
      bg: theme.colors.successLight,
      color: theme.colors.success,
      icon: '✓',
    },
    error: {
      bg: theme.colors.errorLight,
      color: theme.colors.error,
      icon: '✕',
    },
    warning: {
      bg: theme.colors.warningLight,
      color: theme.colors.warning,
      icon: '⚠',
    },
    info: {
      bg: theme.colors.infoLight,
      color: theme.colors.info,
      icon: 'ℹ',
    },
  };

  const currentVariant = variantStyles[variant];

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: currentVariant.bg,
    color: currentVariant.color,
    borderRadius: theme.borderRadius.md,
    boxShadow: theme.shadows.md,
    display: 'flex',
    alignItems: 'center',
    maxWidth: '320px',
    zIndex: theme.zIndex.tooltip,
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? 'translateY(0)' : 'translateY(10px)',
    transition: `opacity 0.3s ease, transform 0.3s ease`,
  };

  const iconStyle: React.CSSProperties = {
    marginRight: theme.spacing.sm,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: theme.fontSizes.md,
  };

  const closeButtonStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: currentVariant.color,
    marginLeft: theme.spacing.md,
    cursor: 'pointer',
    opacity: 0.7,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px',
    borderRadius: theme.borderRadius.sm,
  };

  const messageStyle: React.CSSProperties = {
    flex: 1,
    fontSize: theme.fontSizes.sm,
  };

  return (
    <div style={containerStyle} role="alert" aria-live="polite">
      {icon ? (
        <span style={iconStyle}>{icon}</span>
      ) : currentVariant.icon ? (
        <span style={iconStyle}>{currentVariant.icon}</span>
      ) : null}
      
      <div style={messageStyle}>{message}</div>
      
      <button 
        style={closeButtonStyle} 
        onClick={handleClose}
        aria-label="Close"
      >
        ×
      </button>
    </div>
  );
};

// Toast Container Component to manage multiple toasts
interface Toast {
  id: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onRemove,
}) => {
  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    zIndex: 9999,
  };

  return (
    <div style={containerStyle}>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          variant={toast.variant}
          duration={toast.duration}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </div>
  );
};