import { Button } from "@components/Button";
import { GoogleAuthButton } from "@components/GoogleAuthButton";
import { TextInput } from "@components/TextInput";
import {
    createStyles,
    gradients,
    screenBackground,
    spacing,
    typography,
    useIsDark,
    useThemeColors,
} from "@constants/theme";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@hooks/useAuth";
import { LinearGradient } from "expo-linear-gradient";
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

/**
 * Cosmic deep-space / lavender backdrop shared by the auth screens.
 */
const AuthBackground: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const isDark = useIsDark();
  return (
    <LinearGradient colors={screenBackground(isDark)} style={localStyles.flex}>
      <SafeAreaView style={localStyles.flex}>{children}</SafeAreaView>
    </LinearGradient>
  );
};

const BrandMark: React.FC<{ label: string; tagline: string }> = ({
  label,
  tagline,
}) => {
  const colors = useThemeColors();
  return (
    <View style={localStyles.header}>
      <LinearGradient
        colors={gradients.nebula}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={localStyles.logoBadge}
      >
        <Feather name="target" size={34} color="#FFFFFF" />
      </LinearGradient>
      <Text style={[localStyles.brandTitle, { color: colors.textPrimary }]}>
        {label}
      </Text>
      <Text
        style={[
          typography.body,
          { color: colors.textSecondary, textAlign: "center" },
        ]}
      >
        {tagline}
      </Text>
    </View>
  );
};

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
  const [googleLoading, setGoogleLoading] = useState(false);

  const { signIn, signInWithGoogle } = useAuth();

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

  // On success the root layout's auth listener handles navigation, so we only
  // need to surface errors here. A dismissed browser resolves without throwing.
  const handleGoogle = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AuthBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={localStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <BrandMark
            label="Orbit"
            tagline="Explore careers, meet professionals, learn without LinkedIn pressure."
          />

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
              disabled={loading || googleLoading}
            />
            <View style={localStyles.socialSpacer}>
              <GoogleAuthButton
                onPress={handleGoogle}
                loading={googleLoading}
                disabled={loading}
              />
            </View>
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
              New to Orbit?{" "}
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
    </AuthBackground>
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
  const [googleLoading, setGoogleLoading] = useState(false);

  const { signUp, signInWithGoogle } = useAuth();

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

  // Google sign-in doubles as sign-up; the root layout's auth listener routes
  // new users into onboarding once the session is established.
  const handleGoogle = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AuthBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={localStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <BrandMark
            label="Join Orbit"
            tagline="Start exploring careers and connecting with professionals."
          />

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
              disabled={loading || googleLoading}
            />
            <View style={localStyles.socialSpacer}>
              <GoogleAuthButton
                onPress={handleGoogle}
                loading={googleLoading}
                disabled={loading}
              />
            </View>
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
    </AuthBackground>
  );
};

const localStyles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingVertical: spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.xxl,
  },
  logoBadge: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  brandTitle: {
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: -1,
    marginBottom: spacing.sm,
  },
  form: {
    marginBottom: spacing.xl,
  },
  actions: {
    marginBottom: spacing.xl,
  },
  socialSpacer: {
    marginTop: spacing.lg,
  },
  footer: {
    alignItems: "center",
  },
  linkPressable: {
    marginTop: 8,
  },
});
