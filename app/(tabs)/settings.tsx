import { Avatar } from "@components/Avatar";
import { Button } from "@components/Button";
import {
  borderRadius,
  gradients,
  spacing,
  typography,
  useThemeColors,
} from "@constants/theme";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@hooks/useAuth";
import { useAppStore } from "@store/appStore";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { invokeEdgeFunction, supabase } from "../../src/services/supabase";

interface RowProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  tint?: string;
}

export default function SettingsScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { signOut } = useAuth();
  const currentProfile = useAppStore((s) => s.currentProfile);

  const [modalVisible, setModalVisible] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  // null = still resolving. A user has a password only if they have an "email"
  // identity; OAuth-only users (e.g. Google) have nothing to re-enter, so we
  // confirm intent with a typed phrase instead of password re-auth.
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const identities = data?.user?.identities ?? [];
      setHasPassword(identities.some((i) => i.provider === "email"));
    });
  }, []);

  const usesPassword = hasPassword !== false; // default to password until known
  const DELETE_PHRASE = "DELETE";
  const canDelete = usesPassword
    ? password.length > 0
    : confirmText.trim().toUpperCase() === DELETE_PHRASE;

  const resetModal = () => {
    setModalVisible(false);
    setPassword("");
    setConfirmText("");
  };

  const confirmDelete = async () => {
    setLoading(true);
    try {
      // Password users re-authenticate; OAuth users are gated by the typed
      // confirmation (enforced via canDelete) since they have no password.
      if (usesPassword) {
        const { data: userData } = await supabase.auth.getUser();
        const email = userData?.user?.email;
        if (!email) throw new Error("No email for current user");

        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInErr) throw new Error("Incorrect password. Please try again.");
      }

      const { error: deleteErr } = await invokeEdgeFunction("delete-account", {});
      if (deleteErr) throw new Error(`Delete failed: ${deleteErr}`);

      await supabase.auth.signOut();
      Alert.alert("Account deleted", "Your account and data have been removed.");
      router.replace("/auth");
    } catch (err: any) {
      console.error("delete account error:", err);
      Alert.alert("Error", err.message || String(err));
    } finally {
      setLoading(false);
      resetModal();
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace("/auth");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to sign out");
    }
  };

  const Row: React.FC<RowProps> = ({ icon, label, onPress, danger, tint }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surfaceCard,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.rowIcon,
          { backgroundColor: (tint ?? colors.primary) + "1F" },
        ]}
      >
        <Feather name={icon} size={18} color={tint ?? colors.primary} />
      </View>
      <Text
        style={[
          typography.body,
          styles.rowLabel,
          { color: danger ? colors.error : colors.textPrimary },
        ]}
      >
        {label}
      </Text>
      <Feather name="chevron-right" size={20} color={colors.textTertiary} />
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.surfaceBg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Settings
        </Text>

        {/* Profile preview card */}
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.profileCard}
        >
          <Avatar
            uri={currentProfile?.photo_url}
            name={currentProfile?.display_name ?? "You"}
            size={64}
            radius={20}
            style={styles.profileAvatarBorder}
          />
          <View style={styles.profileText}>
            <Text style={styles.profileName} numberOfLines={1}>
              {currentProfile?.display_name ?? "Your profile"}
            </Text>
            <Text style={styles.profileMeta} numberOfLines={1}>
              {currentProfile
                ? `${currentProfile.role_title} · ${currentProfile.industry}`
                : "Complete your profile"}
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.section}>
          <Row
            icon="edit-2"
            label="Edit profile"
            onPress={() => router.push("/profile")}
          />
          <Row
            icon="sliders"
            label="My algorithm"
            onPress={() => router.push("/my-algorithm")}
          />
          <Row
            icon="log-out"
            label="Sign out"
            tint={colors.textSecondary}
            onPress={handleSignOut}
          />
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
          DANGER ZONE
        </Text>
        <View style={styles.section}>
          <Row
            icon="trash-2"
            label="Delete account"
            danger
            tint={colors.error}
            onPress={() => setModalVisible(true)}
          />
        </View>
      </ScrollView>

      <Modal visible={modalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: colors.surfaceBg }]}
          >
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Delete account?
            </Text>
            <Text style={[styles.modalHelp, { color: colors.textSecondary }]}>
              This permanently removes your profile, discovery activity, and connections.
              {usesPassword
                ? " Re-enter your password to confirm."
                : ` Type ${DELETE_PHRASE} to confirm.`}
            </Text>
            {usesPassword ? (
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Password"
                placeholderTextColor={colors.textTertiary}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surfaceInput,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  },
                ]}
                autoCapitalize="none"
              />
            ) : (
              <TextInput
                value={confirmText}
                onChangeText={setConfirmText}
                placeholder={DELETE_PHRASE}
                placeholderTextColor={colors.textTertiary}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surfaceInput,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  },
                ]}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            )}
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={resetModal}
                style={styles.modalButton}
              />
              <Button
                title="Delete"
                variant="danger"
                loading={loading}
                disabled={!canDelete}
                onPress={confirmDelete}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.lg, paddingTop: spacing.xl },
  title: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: spacing.lg,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: 24,
    marginBottom: spacing.xl,
  },
  profileAvatarBorder: {
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
  },
  profileText: { flex: 1 },
  profileName: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  profileMeta: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    marginTop: 2,
  },
  section: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 18,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { flex: 1, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    padding: spacing.xl,
    borderRadius: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: spacing.sm,
  },
  modalHelp: {
    ...typography.body,
    marginBottom: spacing.lg,
    lineHeight: 21,
  },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    fontSize: 16,
    minHeight: 50,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  modalButton: { flex: 1 },
});
