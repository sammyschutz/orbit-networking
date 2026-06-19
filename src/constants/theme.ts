import { StyleSheet, useColorScheme } from 'react-native';

/**
 * Orbit Design System — Color Tokens ("Deep-space nebula")
 *
 * Light = soft lavender daylight; Dark = cosmic indigo-black with nebula glow.
 * Both modes share the indigo → violet → magenta brand DNA, accented by an
 * aurora cyan and a starlight gold used sparingly for sparkle.
 */

export const lightColors = {
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  secondary: '#EC4899',
  accent: '#0891B2',      // aurora cyan
  accentStar: '#D97706',  // starlight gold
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',

  surfaceBg: '#FBFAFF',     // faint lavender, not stark white
  surfaceCard: '#FFFFFF',
  surfaceInput: '#F3F1FB',

  textPrimary: '#171327',   // ink with a violet tint
  textSecondary: '#544E6E',
  textTertiary: '#928DAE',

  border: '#ECE8F7',

  // Glassmorphic surfaces + colored glow
  glass: 'rgba(255, 255, 255, 0.70)',
  glassBorder: 'rgba(124, 58, 237, 0.12)',
  glow: 'rgba(99, 102, 241, 0.30)',

  // Semantic overlays
  scrim: 'rgba(23, 19, 39, 0.4)',
} as const;

export const darkColors = {
  primary: '#818CF8',
  primaryDark: '#6366F1',
  secondary: '#F472B6',
  accent: '#22D3EE',      // aurora cyan
  accentStar: '#FBBF24',  // starlight gold
  success: '#34D399',
  error: '#F87171',
  warning: '#FBBF24',

  surfaceBg: '#0A0918',     // deep space
  surfaceCard: '#16132B',   // nebula card
  surfaceInput: '#211D3D',

  textPrimary: '#F4F2FF',
  textSecondary: '#B8B3D6',
  textTertiary: '#807BA6',

  border: 'rgba(255, 255, 255, 0.12)',

  // Glassmorphic surfaces + colored glow
  glass: 'rgba(255, 255, 255, 0.06)',
  glassBorder: 'rgba(255, 255, 255, 0.12)',
  glow: 'rgba(129, 140, 248, 0.45)',

  // Semantic overlays
  scrim: 'rgba(7, 6, 18, 0.7)',
} as const;

export type ColorScheme = Record<keyof typeof lightColors, string>;

/**
 * Brand & cosmic gradients. Arrays drop straight into expo-linear-gradient
 * `colors`. `brand` is the signature indigo → violet → magenta nebula used on
 * primary buttons; `nebula`/`aurora` are richer variants for hero moments.
 */
export const gradients = {
  brand: ["#6366F1", "#8B5CF6", "#EC4899"] as const,
  brandSoft: ["#818CF8", "#C084FC"] as const,
  nebula: ["#4F46E5", "#7C3AED", "#DB2777"] as const,
  aurora: ["#22D3EE", "#6366F1", "#A855F7"] as const,
  starlight: ["#FBBF24", "#F472B6"] as const,
  like: ["#10B981", "#34D399"] as const,
  nope: ["#F43F5E", "#FB7185"] as const,
  // Bottom-up scrim for legible text over photos.
  photoScrim: ["transparent", "rgba(10,9,24,0.15)", "rgba(10,9,24,0.92)"] as const,
  glow: ["#A78BFA", "#F0ABFC"] as const,
  // Full-screen ambient backdrops (deep-space dark / lavender light).
  cosmicBgDark: ["#0A0918", "#181140", "#0A0918"] as const,
  cosmicBgLight: ["#FBFAFF", "#F1ECFF", "#FDF1FA"] as const,
} as const;

/**
 * Deterministic avatar gradient based on a name/string so initials-only
 * fallbacks still look colorful and intentional.
 */
const avatarGradients: readonly (readonly [string, string])[] = [
  ["#6366F1", "#EC4899"],
  ["#8B5CF6", "#6366F1"],
  ["#EC4899", "#F59E0B"],
  ["#06B6D4", "#6366F1"],
  ["#10B981", "#06B6D4"],
  ["#F43F5E", "#8B5CF6"],
  ["#F59E0B", "#EF4444"],
  ["#0EA5E9", "#22D3EE"],
];

export const avatarGradient = (seed = ""): readonly [string, string] => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 997;
  }
  return avatarGradients[hash % avatarGradients.length];
};

/**
 * Hook to get current theme colors based on system preference
 */
export const useThemeColors = (): ColorScheme => {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkColors : lightColors;
};

/**
 * True when the system is in dark mode. Prefer this over comparing color
 * hex values when a screen needs to branch on the active scheme.
 */
export const useIsDark = (): boolean => useColorScheme() === 'dark';

/**
 * The full-screen ambient backdrop for the active scheme.
 */
export const screenBackground = (
  isDark: boolean,
): readonly [string, string, ...string[]] =>
  isDark ? gradients.cosmicBgDark : gradients.cosmicBgLight;

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
 * Typography scale (tight tracking on large text for a refined feel)
 */
export const typography = {
  display: {
    fontSize: 32,
    fontWeight: '700' as const,
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  headline: {
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  title: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 28,
    letterSpacing: -0.2,
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
  xxl: 28,
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
  xl: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 12,
  },
  // Indigo accent glow for hero badges and primary CTAs.
  glow: {
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 10,
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
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
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
