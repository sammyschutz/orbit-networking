import { Button } from "@components/Button";
import { TextInput } from "@components/TextInput";
import {
    createStyles,
    spacing,
    typography,
    useThemeColors,
} from "@constants/theme";
import { useAuth } from "@hooks/useAuth";
import React, { useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

interface AuthScreenProps {
  onSuccess?: () => void;
  onSwitchToSignUp?: () => void;
  onSwitchToLogin?: () => void;
}

/**
 * Login screen - user signs in with email/password
 */
export const LoginScreen: React.FC<AuthScreenProps> = ({
  onSuccess,
  onSwitchToSignUp,
}) => {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { signIn } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    setError("");
    setLoading(true);

    try {
      await signIn(email, password);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: colors.surfaceBg }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={localStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={localStyles.header}>
            <Text
              style={[
                typography.display,
                {
                  color: colors.primary,
                  marginBottom: spacing.md,
                },
              ]}
            >
              Zap
            </Text>
            <Text
              style={[
                typography.body,
                {
                  color: colors.textSecondary,
                  textAlign: "center",
                },
              ]}
            >
              Explore careers, meet professionals, learn without LinkedIn
              pressure.
            </Text>
          </View>

          {/* Form */}
          <View style={localStyles.form}>
            <TextInput
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={error ? "Invalid email or password" : undefined}
            />

            <TextInput
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              showPasswordToggle
              error={error ? " " : undefined}
            />

            {error && (
              <Text
                style={[
                  typography.caption,
                  {
                    color: colors.error,
                    marginBottom: spacing.lg,
                  },
                ]}
              >
                {error}
              </Text>
            )}
          </View>

          {/* CTA */}
          <View style={localStyles.actions}>
            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
            />
          </View>

          {/* Footer */}
          <View style={localStyles.footer}>
            <Text
              style={[
                typography.body,
                {
                  color: colors.textSecondary,
                  textAlign: "center",
                },
              ]}
            >
              New to Zap?{" "}
            </Text>
            <Pressable
              onPress={onSwitchToSignUp}
              style={localStyles.linkPressable}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontWeight: "600",
                }}
              >
                Create an account
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

/**
 * Sign up screen - user creates account with email/password
 */
export const SignUpScreen: React.FC<AuthScreenProps> = ({
  onSuccess,
  onSwitchToLogin,
}) => {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { signUp } = useAuth();

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setError("");
    setLoading(true);

    try {
      await signUp(email, password);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: colors.surfaceBg }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={localStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={localStyles.header}>
            <Text
              style={[
                typography.display,
                {
                  color: colors.primary,
                  marginBottom: spacing.md,
                },
              ]}
            >
              Join Zap
            </Text>
            <Text
              style={[
                typography.body,
                {
                  color: colors.textSecondary,
                  textAlign: "center",
                },
              ]}
            >
              Start exploring careers and connecting with professionals.
            </Text>
          </View>

          {/* Form */}
          <View style={localStyles.form}>
            <TextInput
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              showPasswordToggle
              helper="At least 6 characters"
            />

            <TextInput
              label="Confirm Password"
              placeholder="••••••••"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              showPasswordToggle
            />

            {error && (
              <Text
                style={[
                  typography.caption,
                  {
                    color: colors.error,
                    marginBottom: spacing.lg,
                  },
                ]}
              >
                {error}
              </Text>
            )}
          </View>

          {/* CTA */}
          <View style={localStyles.actions}>
            <Button
              title="Create Account"
              onPress={handleSignUp}
              loading={loading}
              disabled={loading}
            />
          </View>

          {/* Footer */}
          <View style={localStyles.footer}>
            <Text
              style={[
                typography.body,
                {
                  color: colors.textSecondary,
                  textAlign: "center",
                },
              ]}
            >
              Already have an account?
            </Text>
            <Pressable
              onPress={onSwitchToLogin}
              style={localStyles.linkPressable}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontWeight: "600",
                }}
              >
                Sign in
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const localStyles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingVertical: spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.xxl,
  },
  form: {
    marginBottom: spacing.xl,
  },
  actions: {
    marginBottom: spacing.xl,
  },
  footer: {
    alignItems: "center",
  },
  linkPressable: {
    marginTop: 8,
  },
});
