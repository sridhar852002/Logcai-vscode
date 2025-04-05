import React, { useState, useRef, useEffect, ReactElement } from 'react';
import { useTheme } from '../../styles/ThemeProvider';

interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
  width?: number | string;
  closeOnItemClick?: boolean;
}

// Type for the props that we expect DropdownItem to have
interface DropdownItemReactProps {
  onClick?: (e: React.MouseEvent) => void;
}

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  children,
  align = 'left',
  width = 200,
  closeOnItemClick = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  
  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);
  
  // Handle escape key to close dropdown
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen]);
  
  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };
  
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-block',
  };
  
  const triggerStyle: React.CSSProperties = {
    cursor: 'pointer',
  };
  
  const menuStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    [align === 'left' ? 'left' : 'right']: 0,
    width: typeof width === 'number' ? `${width}px` : width,
    backgroundColor: theme.colors.backgroundLight,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    boxShadow: theme.shadows.md,
    marginTop: theme.spacing.xs,
    zIndex: theme.zIndex.dropdown,
    overflow: 'hidden',
    display: isOpen ? 'block' : 'none',
    padding: `${theme.spacing.xs} 0`,
  };
  
  // Create a wrapper with onClick handler if closeOnItemClick is true
  const childrenWithCloseHandler = closeOnItemClick
    ? React.Children.map(children, (child) => {
        if (React.isValidElement<DropdownItemReactProps>(child)) {
          return React.cloneElement(child, {
            onClick: (e: React.MouseEvent) => {
              // Call the original onClick if it exists
              if (child.props.onClick) {
                child.props.onClick(e);
              }
              // Close the dropdown
              setIsOpen(false);
            },
          });
        }
        return child;
      })
    : children;
  
  return (
    <div style={containerStyle} ref={dropdownRef}>
      <div 
        style={triggerStyle} 
        onClick={toggleDropdown}
        role="button"
        tabIndex={0}
        aria-haspopup="true"
        aria-expanded={isOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            toggleDropdown();
            e.preventDefault();
          }
        }}
      >
        {trigger}
      </div>
      
      <div 
        style={menuStyle}
        role="menu"
      >
        {childrenWithCloseHandler}
      </div>
    </div>
  );
};

// Dropdown Item component
interface DropdownItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  danger?: boolean;
}

export const DropdownItem: React.FC<DropdownItemProps> = ({
  children,
  icon,
  danger = false,
  ...props
}) => {
  const theme = useTheme();
  
  const itemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: 'transparent',
    border: 'none',
    textAlign: 'left',
    cursor: 'pointer',
    color: danger ? theme.colors.error : theme.colors.text,
    fontSize: theme.fontSizes.sm,
    transition: theme.transitions.fast,
  };
  
  // In a real implementation, hover/focus styles would be handled with :hover/:focus
  
  const iconStyle: React.CSSProperties = {
    marginRight: theme.spacing.sm,
    display: 'flex',
    alignItems: 'center',
  };
  
  return (
    <button 
      style={itemStyle}
      role="menuitem"
      {...props}
    >
      {icon && <span style={iconStyle}>{icon}</span>}
      {children}
    </button>
  );
};

// Dropdown Divider component
export const DropdownDivider: React.FC = () => {
  const theme = useTheme();
  
  const dividerStyle: React.CSSProperties = {
    height: '1px',
    margin: `${theme.spacing.xs} 0`,
    backgroundColor: theme.colors.border,
  };
  
  return <div style={dividerStyle} role="separator" />;
};