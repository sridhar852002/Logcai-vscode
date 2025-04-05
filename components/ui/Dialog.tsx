import React, { useEffect, useRef } from 'react';
import { useTheme } from '../../styles/ThemeProvider';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnEscape?: boolean;
  closeOnOutsideClick?: boolean;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnEscape = true,
  closeOnOutsideClick = true,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  // Map sizes to width values
  const sizeMap = {
    sm: '320px',
    md: '480px',
    lg: '640px',
    xl: '800px',
  };

  // Handle escape key press
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (closeOnEscape && event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Focus the dialog when it opens (for accessibility)
      dialogRef.current?.focus();
      // Prevent body scrolling
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore body scrolling when dialog closes
      document.body.style.overflow = '';
    };
  }, [closeOnEscape, isOpen, onClose]);

  // Handle outside click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOutsideClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  // Styles
  const backdropStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: theme.zIndex.modal,
  };

  const dialogStyle: React.CSSProperties = {
    backgroundColor: theme.colors.backgroundLight,
    borderRadius: theme.borderRadius.lg,
    boxShadow: theme.shadows.xl,
    width: sizeMap[size],
    maxWidth: '95%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    outline: 'none', // Removes default focus outline
    animation: 'fade-in 0.2s ease-out',
  };

  const headerStyle: React.CSSProperties = {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    borderBottom: title ? `1px solid ${theme.colors.border}` : 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: theme.fontSizes.lg,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.text,
  };

  const closeButtonStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: theme.colors.textSecondary,
    fontSize: '20px',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm,
  };

  const bodyStyle: React.CSSProperties = {
    padding: theme.spacing.lg,
    overflowY: 'auto',
    flex: 1,
  };

  const footerStyle: React.CSSProperties = {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    borderTop: footer ? `1px solid ${theme.colors.border}` : 'none',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
  };

  return (
    <div
      style={backdropStyle}
      onClick={handleBackdropClick}
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={dialogRef}
        style={dialogStyle}
        tabIndex={-1}
      >
        {title && (
          <div style={headerStyle}>
            <h2 style={titleStyle}>{title}</h2>
            <button
              onClick={onClose}
              style={closeButtonStyle}
              aria-label="Close dialog"
            >
              ×
            </button>
          </div>
        )}
        
        <div style={bodyStyle}>
          {children}
        </div>
        
        {footer && (
          <div style={footerStyle}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};