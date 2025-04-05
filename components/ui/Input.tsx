import React, { InputHTMLAttributes } from 'react';
import { useTheme } from '../../styles/ThemeProvider';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  ...props
}) => {
  const theme = useTheme();
  
  const inputContainerStyle: React.CSSProperties = {
    position: 'relative',
    width: fullWidth ? '100%' : 'auto',
    marginBottom: error ? theme.spacing.md : '0',
  };
  
  const inputStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: `${theme.spacing.md} ${theme.spacing.md}`,
    paddingLeft: leftIcon ? theme.spacing.xl : theme.spacing.md,
    paddingRight: rightIcon ? theme.spacing.xl : theme.spacing.md,
    backgroundColor: theme.components.input.backgroundColor,
    color: theme.components.input.color,
    border: `1px solid ${error ? theme.colors.error : theme.components.input.borderColor}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.fontSizes.sm,
    transition: theme.transitions.normal,
    opacity: disabled ? 0.7 : 1,
  };
  
  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: theme.spacing.xs,
    fontSize: theme.fontSizes.sm,
    color: error ? theme.colors.error : theme.colors.text,
  };
  
  const errorStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  };
  
  const iconStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    color: theme.colors.textSecondary,
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'none',
  };
  
  return (
    <div style={{ marginBottom: theme.spacing.md }}>
      {label && <label style={labelStyle}>{label}</label>}
      
      <div style={inputContainerStyle}>
        {leftIcon && (
          <span style={{ ...iconStyle, left: theme.spacing.sm }}>
            {leftIcon}
          </span>
        )}
        
        <input
          style={inputStyle}
          disabled={disabled}
          {...props}
        />
        
        {rightIcon && (
          <span style={{ ...iconStyle, right: theme.spacing.sm }}>
            {rightIcon}
          </span>
        )}
      </div>
      
      {error && <div style={errorStyle}>{error}</div>}
    </div>
  );
};