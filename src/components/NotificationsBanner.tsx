import { Feather } from "@expo/vector-icons";
import { spacing, typography, useThemeColors } from "@constants/theme";
import { Notification, Profile, supabase } from "@services/supabase";
import { useAppStore } from "@store/appStore";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

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

  const unreadNotification = useMemo(
    () => notifications.find((notification) => !notification.read_at) ?? null,
    [notifications],
  );

  useEffect(() => {
    if (!unreadNotification?.source_user_id) {
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

    loadSourceProfile(unreadNotification);

    return () => {
      active = false;
    };
  }, [unreadNotification?.id, unreadNotification?.source_user_id]);

  if (!unreadNotification) return null;

  const isMatch = unreadNotification.type === "match";
  const title = isMatch ? "New match" : "Someone wants to connect";
  const detail = sourceProfile
    ? `${sourceProfile.display_name} · ${sourceProfile.role_title}`
    : "Open the profile to take a look.";

  const handleView = () => {
    const connectionId = unreadNotification.payload?.connection_id;

    if (isMatch && typeof connectionId === "string") {
      router.push({
        pathname: "/connection/[id]",
        params: { id: connectionId },
      });
      return;
    }

    router.push({
      pathname: "/public-profile/[userId]",
      params: {
        userId: unreadNotification.source_user_id,
        notificationId: unreadNotification.id,
      },
    });
  };

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: colors.surfaceCard,
          borderColor: colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.iconBadge,
          { backgroundColor: isMatch ? colors.success : colors.primary },
        ]}
      >
        <Feather
          name={isMatch ? "zap" : "heart"}
          size={16}
          color="#FFFFFF"
        />
      </View>

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

      <View style={styles.actions}>
        <Pressable
          accessibilityLabel="View notification"
          accessibilityRole="button"
          onPress={handleView}
          style={({ pressed }) => [
            styles.iconButton,
            { opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Feather name="eye" size={18} color={colors.primary} />
        </Pressable>
        <Pressable
          accessibilityLabel="Dismiss notification"
          accessibilityRole="button"
          onPress={() => markNotificationRead(unreadNotification.id)}
          style={({ pressed }) => [
            styles.iconButton,
            { opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Feather name="x" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
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
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  iconButton: {
    alignItems: "center",
    borderRadius: 16,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
});
