import { StyleSheet, useColorScheme } from 'react-native';

/**
 * Zap Design System - Color Tokens
 * Light and dark mode color mappings
 */

export const lightColors = {
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  secondary: '#EC4899',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  
  surfaceBg: '#FFFFFF',
  surfaceCard: '#F9FAFB',
  surfaceInput: '#F3F4F6',
  
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  
  border: '#E5E7EB',
  
  // Semantic overlays
  scrim: 'rgba(0, 0, 0, 0.4)',
} as const;

export const darkColors = {
  primary: '#818CF8',
  primaryDark: '#6366F1',
  secondary: '#EC4899',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  
  surfaceBg: '#0F172A',
  surfaceCard: '#1E293B',
  surfaceInput: '#334155',
  
  textPrimary: '#F1F5F9',
  textSecondary: '#CBD5E1',
  textTertiary: '#94A3B8',
  
  border: '#475569',
  
  // Semantic overlays
  scrim: 'rgba(0, 0, 0, 0.6)',
} as const;

export type ColorScheme = Record<keyof typeof lightColors, string>;

/**
 * Hook to get current theme colors based on system preference
 */
export const useThemeColors = (): ColorScheme => {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkColors : lightColors;
};

/**
 * Spacing tokens (4pt base unit)
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/**
 * Typography scale
 */
export const typography = {
  display: {
    fontSize: 32,
    fontWeight: '700' as const,
    lineHeight: 38,
  },
  headline: {
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 18,
  },
} as const;

/**
 * Border radius values
 */
export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

/**
 * Shadow/elevation values
 */
export const elevation = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

/**
 * Animation timing values (in ms)
 */
export const timing = {
  micro: 80,
  transition: 200,
  modal: 250,
  snap: 300,
  stagger: 30,
} as const;

/**
 * Safe area / layout constants
 */
export const layout = {
  screenHorizontalPadding: spacing.lg, // 16pt
  minTouchSize: 44, // 44×44pt minimum
  minTouchGap: spacing.sm, // 8pt minimum gap
  modalScrimOpacity: 0.4, // 40% opacity for light mode
} as const;

/**
 * Helper function to create reusable style objects
 */
export const createStyles = (colors: ColorScheme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surfaceBg,
  },
  container: {
    flex: 1,
    paddingHorizontal: layout.screenHorizontalPadding,
  },
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...elevation.md,
  },
  input: {
    backgroundColor: colors.surfaceInput,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.textPrimary,
    minHeight: 48, // Touch-safe height
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44, // Touch-safe height
  },
  buttonText: {
    color: '#FFFFFF',
    ...typography.label,
  },
  text: {
    color: colors.textPrimary,
    ...typography.body,
  },
  textSecondary: {
    color: colors.textSecondary,
    ...typography.caption,
  },
});
