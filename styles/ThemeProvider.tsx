// src/styles/ThemeProvider.tsx (Simplified version)
import React, { createContext, useContext, ReactNode } from 'react';

// Define the theme type based on CSS variables
export interface ThemeType {
  colors: {
    primary: string;
    primaryHover: string;
    primaryDark: string;
    secondary: string;
    secondaryHover: string;
    secondaryDark: string;
    accent: string;
    accentHover: string;
    accentDark: string;
    background: string;
    backgroundLight: string;
    backgroundLighter: string;
    backgroundDark: string;
    text: string;
    textSecondary: string;
    textMuted: string;
    hover: string;
    active: string;
    focus: string;
    border: string;
    borderLight: string;
    borderDark: string;
    error: string;
    errorLight: string;
    warning: string;
    warningLight: string;
    success: string;
    successLight: string;
    info: string;
    infoLight: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    xxl: string;
  };
  borderRadius: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    round: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    xxl: string;
  };
  transitions: {
    fast: string;
    normal: string;
    slow: string;
  };
  zIndex: {
    base: number;
    dropdown: number;
    modal: number;
    tooltip: number;
  };
  fontSizes: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    xxl: string;
  };
  fontWeights: {
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
  };
  components: {
    button: {
      [key: string]: {
        backgroundColor: string;
        color: string;
        hoverBackgroundColor?: string;
        activeBackgroundColor?: string;
      };
    };
    input: {
      backgroundColor: string;
      borderColor: string;
      focusBorderColor: string;
      color: string;
      placeholderColor: string;
    };
    card: {
      backgroundColor: string;
      borderColor: string;
      hoverBorderColor: string;
      shadowColor: string;
    };
  };
  isDark: boolean;
}

// Dark theme only
const darkTheme: ThemeType = {
  colors: {
    primary: '#00e5ff',
    primaryHover: '#33eaff',
    primaryDark: '#00b8cc',
    secondary: '#00e676',
    secondaryHover: '#33eb91',
    secondaryDark: '#00b85c',
    accent: '#FF4081',
    accentHover: '#ff6699',
    accentDark: '#cc3366',
    background: '#121212',
    backgroundLight: '#1E1E1E',
    backgroundLighter: '#2D2D2D',
    backgroundDark: '#0D0D0D',
    text: '#FFFFFF',
    textSecondary: '#AAAAAA',
    textMuted: '#777777',
    hover: '#333333',
    active: '#404040',
    focus: '#4B4B4B',
    border: '#333333',
    borderLight: '#444444',
    borderDark: '#222222',
    error: '#FF5252',
    errorLight: 'rgba(255, 82, 82, 0.1)',
    warning: '#FFD740',
    warningLight: 'rgba(255, 215, 64, 0.1)',
    success: '#00E676',
    successLight: 'rgba(0, 230, 118, 0.1)',
    info: '#2196F3',
    infoLight: 'rgba(33, 150, 243, 0.1)',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
  borderRadius: {
    xs: '2px',
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    round: '50%',
  },
  shadows: {
    sm: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
    md: '0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23)',
    lg: '0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23)',
    xl: '0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.22)',
    xxl: '0 19px 38px rgba(0,0,0,0.30), 0 15px 12px rgba(0,0,0,0.22)',
  },
  transitions: {
    fast: 'all 0.1s ease',
    normal: 'all 0.2s ease',
    slow: 'all 0.3s ease',
  },
  zIndex: {
    base: 1,
    dropdown: 10,
    modal: 100,
    tooltip: 1000,
  },
  fontSizes: {
    xs: '12px',
    sm: '14px',
    md: '16px',
    lg: '18px',
    xl: '24px',
    xxl: '32px',
  },
  fontWeights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  components: {
    button: {
      primary: {
        backgroundColor: '#00e5ff',
        color: '#000000',
        hoverBackgroundColor: '#33eaff',
        activeBackgroundColor: '#00b8cc',
      },
      secondary: {
        backgroundColor: '#00e676',
        color: '#000000',
        hoverBackgroundColor: '#33eb91',
        activeBackgroundColor: '#00b85c',
      },
      danger: {
        backgroundColor: '#FF5252',
        color: '#FFFFFF',
        hoverBackgroundColor: '#ff7575',
        activeBackgroundColor: '#cc4141',
      },
      neutral: {
        backgroundColor: '#333333',
        color: '#FFFFFF',
        hoverBackgroundColor: '#444444',
        activeBackgroundColor: '#222222',
      },
      ghost: {
        backgroundColor: 'transparent',
        color: '#AAAAAA',
        hoverBackgroundColor: 'rgba(255, 255, 255, 0.1)',
        activeBackgroundColor: 'rgba(255, 255, 255, 0.05)',
      },
    },
    input: {
      backgroundColor: '#1E1E1E',
      borderColor: '#333333',
      focusBorderColor: '#00e5ff',
      color: '#FFFFFF',
      placeholderColor: '#777777',
    },
    card: {
      backgroundColor: '#1E1E1E',
      borderColor: '#333333',
      hoverBorderColor: '#444444',
      shadowColor: 'rgba(0, 0, 0, 0.2)',
    },
  },
  isDark: true
};

// Create the theme context with dark theme as the only theme
export const ThemeContext = createContext<ThemeType>(darkTheme);

// Custom hook for accessing the theme
export const useTheme = () => useContext(ThemeContext);

interface ThemeProviderProps {
  children: ReactNode;
}

// Simplified theme provider with no theme switching logic
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  return (
    <ThemeContext.Provider value={darkTheme}>
      {children}
    </ThemeContext.Provider>
  );
};

// Utility types for use in components
export type ColorType = keyof ThemeType['colors'];
export type SpacingType = keyof ThemeType['spacing'];
export type BorderRadiusType = keyof ThemeType['borderRadius'];
export type ShadowType = keyof ThemeType['shadows'];

// Utility functions
export const getColor = (color: ColorType): string => darkTheme.colors[color];
export const getSpacing = (size: SpacingType): string => darkTheme.spacing[size];
export const getBorderRadius = (size: BorderRadiusType): string => darkTheme.borderRadius[size];
export const getShadow = (size: ShadowType): string => darkTheme.shadows[size];