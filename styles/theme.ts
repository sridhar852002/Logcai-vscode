// src/styles/theme.ts
// Centralized theme configuration

export const theme = {
    colors: {
      // Primary palette
      primary: '#00e5ff',
      primaryHover: '#33eaff',
      primaryDark: '#00b8cc',
      secondary: '#00e676',
      secondaryHover: '#33eb91',
      secondaryDark: '#00b85c',
      accent: '#FF4081',
      accentHover: '#ff6699',
      accentDark: '#cc3366',
  
      // Background colors
      background: '#121212',
      backgroundLight: '#1E1E1E',
      backgroundLighter: '#2D2D2D',
      backgroundDark: '#0D0D0D',
      
      // Text colors
      text: '#FFFFFF',
      textSecondary: '#AAAAAA',
      textMuted: '#777777',
      
      // Interactive elements
      hover: '#333333',
      active: '#404040',
      focus: '#4B4B4B',
      
      // Borders
      border: '#333333',
      borderLight: '#444444',
      borderDark: '#222222',
      
      // Status colors
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
    
    // Common component styles
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
      
      tooltip: {
        backgroundColor: '#333333',
        color: '#FFFFFF',
        borderRadius: '4px',
        padding: '8px 12px',
      },
    },
  };
  
  // Types for theme
  export type ThemeType = typeof theme;
  export type ColorType = keyof typeof theme.colors;
  export type SpacingType = keyof typeof theme.spacing;
  export type FontSizeType = keyof typeof theme.fontSizes;
  export type FontWeightType = keyof typeof theme.fontWeights;
  export type BorderRadiusType = keyof typeof theme.borderRadius;
  export type ShadowType = keyof typeof theme.shadows;