import React, { ButtonHTMLAttributes } from 'react';
import { useTheme } from '../../styles/ThemeProvider';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'neutral' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  children,
  ...props
}) => {
  const theme = useTheme();
  
  const variantStyle = theme.components.button[variant];
  
  const sizeStyles = {
    sm: {
      padding: '6px 12px',
      fontSize: theme.fontSizes.xs,
      borderRadius: theme.borderRadius.sm,
    },
    md: {
      padding: '8px 16px',
      fontSize: theme.fontSizes.sm,
      borderRadius: theme.borderRadius.md,
    },
    lg: {
      padding: '10px 20px',
      fontSize: theme.fontSizes.md,
      borderRadius: theme.borderRadius.md,
    },
  };
  
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    border: 'none',
    fontWeight: theme.fontWeights.medium,
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    transition: theme.transitions.normal,
    opacity: disabled ? 0.6 : 1,
    width: fullWidth ? '100%' : 'auto',
    position: 'relative',
    ...sizeStyles[size],
    backgroundColor: variantStyle.backgroundColor,
    color: variantStyle.color,
  };
  
  // Add hover/active styles using the :hover pseudo-class in a real implementation
  
  return (
    <button
      style={baseStyle}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <span 
          style={{ 
            display: 'inline-block',
            width: '1em',
            height: '1em',
            borderRadius: '50%',
            borderTop: `2px solid ${variantStyle.color}`,
            borderRight: `2px solid transparent`,
            animation: 'spin 0.75s linear infinite',
            marginRight: leftIcon || children ? '8px' : 0,
          }}
        />
      )}
      
      {!isLoading && leftIcon}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
};