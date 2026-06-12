import {
  borderRadius,
  spacing,
  typography,
  useThemeColors,
} from "@constants/theme";
import { Feather } from "@expo/vector-icons";
import { useAppStore } from "@store/appStore";
import { REPORT_CATEGORIES, ReportCategory } from "@services/supabase";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface SafetyMenuProps {
  visible: boolean;
  onClose: () => void;
  otherUserId: string;
  otherName: string;
  connectionId?: string;
  conversationId?: string;
  /** Called after a block or remove so the caller can navigate away. */
  onRelationshipEnded?: () => void;
}

// Labels for every category in REPORT_CATEGORIES; the Record type makes adding
// a category without a label a compile error.
const CATEGORY_LABELS: Record<ReportCategory, string> = {
  harassment: "Harassment or bullying",
  spam: "Spam or scam",
  hate: "Hate speech",
  sexual: "Unwanted sexual content",
  threat: "Threats or violence",
  other: "Something else",
};

const CATEGORY_OPTIONS = REPORT_CATEGORIES.map((key) => ({
  key,
  label: CATEGORY_LABELS[key],
}));

/**
 * Bottom-sheet safety menu reachable from a chat or a connection (spec §10).
 * Block / Report / Remove connection — all routed through the server-side
 * Edge Functions / RPC via the store. Styling mirrors settings.tsx rows.
 */
export const SafetyMenu: React.FC<SafetyMenuProps> = ({
  visible,
  onClose,
  otherUserId,
  otherName,
  connectionId,
  conversationId,
  onRelationshipEnded,
}) => {
  const colors = useThemeColors();
  const { blockUser, reportUser, removeConnection } = useAppStore();
  const [mode, setMode] = useState<"menu" | "report">("menu");
  const [busy, setBusy] = useState(false);

  const close = () => {
    setMode("menu");
    onClose();
  };

  const handleBlock = () => {
    Alert.alert(
      `Block ${otherName}?`,
      "They won't be able to message you and will disappear from your connections. They aren't told. You can unblock later.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            const ok = await blockUser(otherUserId);
            setBusy(false);
            close();
            if (ok) onRelationshipEnded?.();
            else Alert.alert("Couldn't block", "Please try again.");
          },
        },
      ],
    );
  };

  const handleRemove = () => {
    if (!connectionId) return;
    Alert.alert(
      "Remove connection?",
      "Your conversation will be deleted for both of you. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            const ok = await removeConnection(connectionId);
            setBusy(false);
            close();
            if (ok) onRelationshipEnded?.();
            else Alert.alert("Couldn't remove", "Please try again.");
          },
        },
      ],
    );
  };

  const handleReport = async (category: ReportCategory) => {
    setBusy(true);
    const ok = await reportUser({
      reportedId: otherUserId,
      category,
      conversationId,
    });
    setBusy(false);
    close();
    Alert.alert(
      ok ? "Report submitted" : "Couldn't submit report",
      ok
        ? "Thanks — our team will review this. Consider blocking them too."
        : "Please try again.",
    );
  };

  const Row = ({
    icon,
    label,
    onPress,
    danger,
  }: {
    icon: keyof typeof Feather.glyphMap;
    label: string;
    onPress: () => void;
    danger?: boolean;
  }) => (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.surfaceCard, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View
        style={[
          styles.rowIcon,
          { backgroundColor: (danger ? colors.error : colors.textSecondary) + "1F" },
        ]}
      >
        <Feather name={icon} size={18} color={danger ? colors.error : colors.textSecondary} />
      </View>
      <Text
        style={[
          typography.body,
          { flex: 1, fontWeight: "600", color: danger ? colors.error : colors.textPrimary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={close}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.surfaceBg }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />

          {busy && (
            <View style={styles.busy}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}

          {mode === "menu" ? (
            <View style={styles.list}>
              <Text style={[styles.sheetTitle, { color: colors.textTertiary }]}>
                {otherName.toUpperCase()}
              </Text>
              <Row icon="flag" label="Report" onPress={() => setMode("report")} />
              <Row icon="slash" label="Block" danger onPress={handleBlock} />
              {connectionId ? (
                <Row
                  icon="user-x"
                  label="Remove connection"
                  onPress={handleRemove}
                />
              ) : null}
              <Row icon="x" label="Cancel" onPress={close} />
            </View>
          ) : (
            <View style={styles.list}>
              <Text style={[styles.sheetTitle, { color: colors.textTertiary }]}>
                WHY ARE YOU REPORTING?
              </Text>
              {CATEGORY_OPTIONS.map((c) => (
                <Row
                  key={c.key}
                  icon="alert-triangle"
                  label={c.label}
                  onPress={() => handleReport(c.key)}
                />
              ))}
              <Row icon="arrow-left" label="Back" onPress={() => setMode("menu")} />
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.sm,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: borderRadius.full,
    marginBottom: spacing.md,
  },
  busy: { paddingVertical: spacing.sm },
  list: { gap: spacing.sm },
  sheetTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 16,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
