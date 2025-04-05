// src/styles/utils.ts
// Utility functions for working with the theme

import { theme, ThemeType, ColorType, SpacingType, BorderRadiusType } from './theme';

/**
 * Get a color from the theme
 * @param color The color key from the theme
 * @returns The color value
 */
export const getColor = (color: ColorType): string => {
  return theme.colors[color];
};

/**
 * Get a spacing value from the theme
 * @param spacing The spacing key from the theme
 * @returns The spacing value
 */
export const getSpacing = (spacing: SpacingType): string => {
  return theme.spacing[spacing];
};

/**
 * Get a border radius value from the theme
 * @param radius The border radius key from the theme
 * @returns The border radius value
 */
export const getBorderRadius = (radius: BorderRadiusType): string => {
  return theme.borderRadius[radius];
};

/**
 * Generate a style object for a button variant
 * @param variant The button variant (primary, secondary, danger, neutral, ghost)
 * @returns Style object for the button
 */
export const getButtonStyle = (variant: keyof typeof theme.components.button) => {
  return theme.components.button[variant];
};

/**
 * Convert a CSS-in-JS style object to a className string
 * This is a utility for when you need to dynamically generate classes
 * @param styles An object of style properties
 * @returns A className string
 */
export const stylesToClassNames = (styles: Record<string, boolean>): string => {
  return Object.entries(styles)
    .filter(([_, value]) => value)
    .map(([key]) => key)
    .join(' ');
};

/**
 * Create a conditional className
 * @param baseClass The base class that's always applied
 * @param conditionalClasses Object with class names as keys and conditions as values
 * @returns A className string
 */
export const cx = (
  baseClass: string, 
  conditionalClasses: Record<string, boolean> = {}
): string => {
  return [
    baseClass,
    ...Object.entries(conditionalClasses)
      .filter(([_, condition]) => condition)
      .map(([className]) => className)
  ].join(' ');
};

/**
 * Create hover styles for an element
 * This is a helper for CSS-in-JS style objects
 * @param baseStyles Base styles
 * @param hoverStyles Styles to apply on hover
 * @returns Style object with hover pseudo-class
 */
export const withHoverStyles = (
  baseStyles: React.CSSProperties,
  hoverStyles: React.CSSProperties
): React.CSSProperties => {
  return {
    ...baseStyles,
    // In a real implementation, this would use a CSS-in-JS library
    // that supports pseudo-classes. For now, we're just returning the base styles.
    // Libraries like styled-components or emotion would handle this properly.
  };
};