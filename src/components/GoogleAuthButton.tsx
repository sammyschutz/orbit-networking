import { borderRadius, spacing, typography, useThemeColors } from "@constants/theme";
import { FontAwesome } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface GoogleAuthButtonProps {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
}

/**
 * "or" divider + outlined "Continue with Google" button. Shared by the login
 * and sign-up screens so the social entry point looks identical in both.
 */
export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  onPress,
  loading = false,
  disabled = false,
  label = "Continue with Google",
}) => {
  const colors = useThemeColors();
  const isDisabled = disabled || loading;

  return (
    <View>
      <View style={styles.dividerRow}>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
        <Text
          style={[
            typography.caption,
            { color: colors.textSecondary, marginHorizontal: spacing.md },
          ]}
        >
          or
        </Text>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
      </View>

      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        android_ripple={{ color: "rgba(0,0,0,0.08)" }}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: colors.surfaceCard,
            borderColor: colors.border,
            opacity: isDisabled ? 0.55 : pressed ? 0.9 : 1,
            transform: [{ scale: pressed && !isDisabled ? 0.98 : 1 }],
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.textPrimary} size="small" />
        ) : (
          <>
            <FontAwesome
              name="google"
              size={18}
              color="#EA4335"
              style={styles.icon}
            />
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              {label}
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 50,
  },
  icon: {
    marginRight: spacing.sm,
  },
  label: {
    ...typography.label,
    fontSize: 16,
    fontWeight: "700",
  },
});
