import React from 'react';
import { useTheme } from '../../styles/ThemeProvider';

export type BadgeVariant = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
export type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  outline?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  outline = false,
  className = '',
}) => {
  const theme = useTheme();
  
  const variantStyles: Record<BadgeVariant, { bg: string; color: string; border?: string }> = {
    default: {
      bg: outline ? 'transparent' : theme.colors.backgroundLighter,
      color: theme.colors.text,
      border: outline ? `1px solid ${theme.colors.border}` : undefined,
    },
    primary: {
      bg: outline ? 'transparent' : theme.colors.primary,
      color: outline ? theme.colors.primary : '#000',
      border: outline ? `1px solid ${theme.colors.primary}` : undefined,
    },
    secondary: {
      bg: outline ? 'transparent' : theme.colors.secondary,
      color: outline ? theme.colors.secondary : '#000',
      border: outline ? `1px solid ${theme.colors.secondary}` : undefined,
    },
    success: {
      bg: outline ? 'transparent' : theme.colors.success,
      color: outline ? theme.colors.success : '#000',
      border: outline ? `1px solid ${theme.colors.success}` : undefined,
    },
    warning: {
      bg: outline ? 'transparent' : theme.colors.warning,
      color: outline ? theme.colors.warning : '#000',
      border: outline ? `1px solid ${theme.colors.warning}` : undefined,
    },
    error: {
      bg: outline ? 'transparent' : theme.colors.error,
      color: outline ? theme.colors.error : '#fff',
      border: outline ? `1px solid ${theme.colors.error}` : undefined,
    },
    info: {
      bg: outline ? 'transparent' : theme.colors.info,
      color: outline ? theme.colors.info : '#fff',
      border: outline ? `1px solid ${theme.colors.info}` : undefined,
    },
  };
  
  const sizeStyles: Record<BadgeSize, { fontSize: string; padding: string }> = {
    sm: {
      fontSize: theme.fontSizes.xs,
      padding: `2px 6px`,
    },
    md: {
      fontSize: theme.fontSizes.xs,
      padding: `3px 8px`,
    },
    lg: {
      fontSize: theme.fontSizes.sm,
      padding: `4px 10px`,
    },
  };
  
  const currentVariant = variantStyles[variant];
  const currentSize = sizeStyles[size];
  
  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm,
    fontWeight: theme.fontWeights.medium,
    whiteSpace: 'nowrap',
    backgroundColor: currentVariant.bg,
    color: currentVariant.color,
    ...currentSize,
    ...(currentVariant.border ? { border: currentVariant.border } : {}),
  };
  
  return (
    <span 
      style={badgeStyle} 
      className={className}>
      {children}
    </span>
  );
};