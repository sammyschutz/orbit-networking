import {
    borderRadius,
    spacing,
    typography,
    useThemeColors,
} from "@constants/theme";
import React, { useState } from "react";
import {
    Pressable,
    TextInput as RNTextInput,
    StyleSheet,
    Text,
    View,
    ViewStyle,
} from "react-native";

interface TextInputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  error?: string;
  helper?: string;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
  secureTextEntry?: boolean;
  showPasswordToggle?: boolean;
  multiline?: boolean;
  maxLength?: number;
  editable?: boolean;
  style?: ViewStyle;
  testID?: string;
}

/**
 * Reusable TextInput component with design system defaults
 * Touch target: 48pt height (touch-safe)
 * Features: Label above, error below, helper text
 */
export const TextInput: React.FC<TextInputProps> = ({
  label,
  placeholder,
  value,
  onChangeText,
  onBlur,
  error,
  helper,
  keyboardType = "default",
  autoCapitalize = "sentences",
  autoCorrect = false,
  secureTextEntry = false,
  showPasswordToggle = false,
  multiline = false,
  maxLength,
  editable = true,
  style,
  testID,
}) => {
  const colors = useThemeColors();
  const [isFocused, setIsFocused] = useState(false);

  const borderColor = error
    ? colors.error
    : isFocused
      ? colors.primary
      : colors.border;
  const [passwordVisible, setPasswordVisible] = useState(false);

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text
          style={[
            styles.label,
            {
              color: colors.textPrimary,
            },
          ]}
        >
          {label}
        </Text>
      )}

      <View style={styles.inputWrapper}>
        <RNTextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surfaceInput,
              borderColor,
              color: colors.textPrimary,
              minHeight: multiline ? 100 : 48,
              paddingRight: showPasswordToggle ? 90 : spacing.md,
            },
          ]}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            onBlur?.();
          }}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          secureTextEntry={secureTextEntry && !passwordVisible}
          multiline={multiline}
          maxLength={maxLength}
          editable={editable}
          testID={testID}
        />

        {secureTextEntry && showPasswordToggle && (
          <Pressable
            style={styles.passwordToggle}
            onPress={() => setPasswordVisible((prev) => !prev)}
          >
            <Text
              style={[
                styles.passwordToggleText,
                {
                  color: colors.primary,
                },
              ]}
            >
              {passwordVisible ? "Hide" : "Show"}
            </Text>
          </Pressable>
        )}
      </View>

      {error && (
        <Text
          style={[
            styles.error,
            {
              color: colors.error,
            },
          ]}
        >
          {error}
        </Text>
      )}

      {helper && !error && (
        <Text
          style={[
            styles.helper,
            {
              color: colors.textSecondary,
            },
          ]}
        >
          {helper}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.label,
    marginBottom: spacing.md,
  },
  inputWrapper: {
    position: "relative",
  },
  input: {
    // Intentionally not spreading typography.body: its lineHeight (24) clips
    // descenders (g, p, y, @) at the bottom of a single-line TextInput. Let the
    // font set its own line height instead.
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  passwordToggle: {
    position: "absolute",
    right: spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  passwordToggleText: {
    ...typography.label,
    fontWeight: "600",
  },
  error: {
    ...typography.caption,
    marginTop: spacing.sm,
  },
  helper: {
    ...typography.caption,
    marginTop: spacing.sm,
  },
});
