import React, { HTMLAttributes } from 'react';
import { useTheme } from '../../styles/ThemeProvider';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  border?: boolean;
  shadow?: boolean;
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  padding = 'md',
  border = true,
  shadow = false,
  hoverEffect = false,
  ...props
}) => {
  const theme = useTheme();
  
  const paddingMap = {
    none: '0',
    sm: theme.spacing.sm,
    md: theme.spacing.md,
    lg: theme.spacing.lg,
  };
  
  const baseStyle: React.CSSProperties = {
    backgroundColor: theme.components.card.backgroundColor,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    transition: theme.transitions.normal,
    ...(border && {
      border: `1px solid ${theme.components.card.borderColor}`,
    }),
    ...(shadow && {
      boxShadow: theme.shadows.md,
    }),
    ...(hoverEffect && {
      cursor: 'pointer',
      // In a real implementation, this would be handled with :hover
      // Here we're just defining the base style
    }),
  };
  
  const headerStyle: React.CSSProperties = {
    padding: paddingMap[padding],
    borderBottom: border ? `1px solid ${theme.components.card.borderColor}` : 'none',
  };
  
  const bodyStyle: React.CSSProperties = {
    padding: paddingMap[padding],
  };
  
  const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: theme.fontSizes.lg,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.text,
    marginBottom: subtitle ? theme.spacing.xs : 0,
  };
  
  const subtitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
  };
  
  return (
    <div style={baseStyle} {...props}>
      {(title || subtitle) && (
        <div style={headerStyle}>
          {title && <h3 style={titleStyle}>{title}</h3>}
          {subtitle && <p style={subtitleStyle}>{subtitle}</p>}
        </div>
      )}
      
      <div style={bodyStyle}>
        {children}
      </div>
    </div>
  );
};