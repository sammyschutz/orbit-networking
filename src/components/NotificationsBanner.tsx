import { Avatar } from "@components/Avatar";
import { spacing, typography, useThemeColors } from "@constants/theme";
import { Feather } from "@expo/vector-icons";
import { Notification, Profile, supabase } from "@services/supabase";
import { useAppStore } from "@store/appStore";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Discover banner (handshake spec §4.1). Pending extended hands are
 * first-class: the row shows who is waiting and how many, and tapping it
 * opens their profile to respond ("Shake hands" / "Maybe later"). Falls back
 * to a "You shook hands!" row for an unread connect that happened while away.
 */
export const NotificationsBanner: React.FC = () => {
  const colors = useThemeColors();
  const router = useRouter();
  const {
    currentProfile,
    notifications,
    fetchNotifications,
    markNotificationRead,
  } = useAppStore();
  const [sourceProfile, setSourceProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (currentProfile?.user_id) {
      fetchNotifications();
    }
  }, [currentProfile?.user_id, fetchNotifications]);

  // Newest-first order comes from the store query.
  const pendingHands = useMemo(
    () =>
      notifications.filter(
        (n) => n.type === "incoming_interest" && !n.read_at,
      ),
    [notifications],
  );
  const unreadMatch = useMemo(
    () => notifications.find((n) => n.type === "match" && !n.read_at) ?? null,
    [notifications],
  );

  const activeNotification: Notification | null =
    pendingHands[0] ?? unreadMatch;

  useEffect(() => {
    if (!activeNotification?.source_user_id) {
      setSourceProfile(null);
      return;
    }

    let active = true;

    const loadSourceProfile = async (notification: Notification) => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", notification.source_user_id)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.warn("Failed to load notification source profile:", error);
        setSourceProfile(null);
        return;
      }

      setSourceProfile((data as Profile | null) ?? null);
    };

    loadSourceProfile(activeNotification);

    return () => {
      active = false;
    };
  }, [activeNotification?.id, activeNotification?.source_user_id]);

  if (!activeNotification) return null;

  const isHands = pendingHands.length > 0;
  const sourceName = sourceProfile?.display_name;

  let title: string;
  let detail: string;
  if (isHands) {
    if (pendingHands.length > 1) {
      title = `${pendingHands.length} people extended a hand to you`;
      detail = "Tap to respond";
    } else {
      title = sourceName
        ? `${sourceName} extended a hand to you`
        : "Someone extended a hand to you";
      detail = sourceProfile?.role_title ?? "Tap to respond";
    }
  } else {
    title = "You shook hands!";
    detail = sourceProfile
      ? `${sourceProfile.display_name} · ${sourceProfile.role_title}`
      : "Open to say hello.";
  }

  const handleOpen = () => {
    if (isHands) {
      router.push({
        pathname: "/public-profile/[userId]",
        params: {
          userId: activeNotification.source_user_id,
          notificationId: activeNotification.id,
        },
      });
      return;
    }

    const connectionId = unreadMatch?.payload?.connection_id;
    if (typeof connectionId === "string") {
      router.push({
        pathname: "/connection/[id]",
        params: { id: connectionId },
      });
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={handleOpen}
      style={({ pressed }) => [
        styles.banner,
        {
          backgroundColor: colors.surfaceCard,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {isHands && sourceProfile ? (
        <Avatar
          uri={sourceProfile.photo_url}
          name={sourceProfile.display_name}
          size={36}
          radius={14}
        />
      ) : (
        <View
          style={[styles.iconBadge, { backgroundColor: colors.surfaceInput }]}
        >
          <Text style={styles.iconEmoji}>{isHands ? "👋" : "🤝"}</Text>
        </View>
      )}

      <View style={styles.copy}>
        <Text
          style={[typography.label, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          style={[typography.caption, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {detail}
        </Text>
      </View>

      {/* An extended hand awaits a response — no dismiss, just respond. */}
      {!isHands && unreadMatch ? (
        <Pressable
          accessibilityLabel="Dismiss notification"
          accessibilityRole="button"
          onPress={() => markNotificationRead(unreadMatch.id)}
          style={({ pressed }) => [
            styles.iconButton,
            { opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Feather name="x" size={18} color={colors.textSecondary} />
        </Pressable>
      ) : (
        <Feather name="chevron-right" size={20} color={colors.textTertiary} />
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  banner: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  iconBadge: {
    alignItems: "center",
    borderRadius: 14,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  iconEmoji: {
    fontSize: 18,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  iconButton: {
    alignItems: "center",
    borderRadius: 16,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
});
