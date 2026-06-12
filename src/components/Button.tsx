import {
  borderRadius,
  gradients,
  spacing,
  typography,
  useThemeColors,
} from "@constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";

interface ButtonProps {
  onPress: () => void;
  title: string;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}

/**
 * Reusable Button. Primary renders a vibrant brand gradient; secondary and
 * danger are solid. Scale + opacity feedback on press.
 */
export const Button: React.FC<ButtonProps> = ({
  onPress,
  title,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  style,
  testID,
}) => {
  const colors = useThemeColors();
  const isDisabled = disabled || loading;

  const sizeStyle = getSizeStyles(size);

  const content = loading ? (
    <ActivityIndicator color="#FFFFFF" size="small" />
  ) : (
    <Text style={styles.buttonText}>{title}</Text>
  );

  // Primary → gradient
  if (variant === "primary") {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        android_ripple={{ color: "rgba(255,255,255,0.18)" }}
        style={({ pressed }) => [
          styles.shadow,
          {
            opacity: isDisabled ? 0.55 : 1,
            transform: [{ scale: pressed && !isDisabled ? 0.98 : 1 }],
            borderRadius: borderRadius.lg,
          },
          style,
        ]}
        testID={testID}
      >
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.button, sizeStyle]}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  // Secondary / danger → solid
  const bg = variant === "danger" ? colors.error : colors.surfaceInput;
  const textColor = variant === "danger" ? "#FFFFFF" : colors.textPrimary;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      android_ripple={{ color: "rgba(0,0,0,0.08)" }}
      style={({ pressed }) => [
        styles.button,
        sizeStyle,
        {
          backgroundColor: bg,
          opacity: isDisabled ? 0.55 : pressed ? 0.9 : 1,
          transform: [{ scale: pressed && !isDisabled ? 0.98 : 1 }],
        },
        style,
      ]}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
};

const getSizeStyles = (size: "sm" | "md" | "lg"): ViewStyle => {
  switch (size) {
    case "sm":
      return {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        minHeight: 38,
      };
    case "lg":
      return {
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.xl,
        minHeight: 54,
      };
    default:
      return {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        minHeight: 50,
      };
  }
};

const styles = StyleSheet.create({
  button: {
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    ...typography.label,
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  shadow: {
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
});
