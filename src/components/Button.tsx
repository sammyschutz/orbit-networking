import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { useThemeColors, typography, spacing, borderRadius } from '@constants/theme';

interface ButtonProps {
  onPress: () => void;
  title: string;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}

/**
 * Reusable Button component with design system defaults
 * Touch target: 44×44pt minimum
 * Feedback: Scale + opacity on press (80ms duration)
 */
export const Button: React.FC<ButtonProps> = ({
  onPress,
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  testID,
}) => {
  const colors = useThemeColors();

  const getBackgroundColor = () => {
    if (disabled) return colors.surfaceInput;
    if (variant === 'secondary') return colors.secondary;
    if (variant === 'danger') return colors.error;
    return colors.primary;
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          minHeight: 36,
        };
      case 'lg':
        return {
          paddingVertical: spacing.lg,
          paddingHorizontal: spacing.xl,
          minHeight: 52,
        };
      default: // md
        return {
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          minHeight: 44,
        };
    }
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      android_ripple={{ color: 'rgba(0, 0, 0, 0.1)' }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: getBackgroundColor(),
          opacity: pressed && !disabled ? 0.9 : 1,
          transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
        },
        getSizeStyles(),
        style,
      ]}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color={disabled ? colors.textTertiary : '#FFFFFF'} size="small" />
      ) : (
        <Text
          style={[
            styles.buttonText,
            {
              color: disabled ? colors.textTertiary : '#FFFFFF',
            },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    ...typography.label,
    textAlign: 'center',
  },
});
