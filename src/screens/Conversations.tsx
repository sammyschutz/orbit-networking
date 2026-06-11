import { Avatar } from "@components/Avatar";
import {
  spacing,
  typography,
  useThemeColors,
  createStyles,
  gradients,
} from "@constants/theme";
import { Feather } from "@expo/vector-icons";
import {
  Conversation,
  isConversationUnread,
  Profile,
  supabase,
} from "@services/supabase";
import { useAppStore } from "@store/appStore";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";

interface ConversationWithProfile extends Conversation {
  profile?: Profile;
}

type ThemeColors = ReturnType<typeof useThemeColors>;

/**
 * A single inbox row. Swiping left reveals an iOS-style action to flip the
 * thread's read/unread state (familiar from Mail). The action is tapped to
 * confirm, then the row closes.
 */
const ConversationRow: React.FC<{
  item: ConversationWithProfile;
  unread: boolean;
  colors: ThemeColors;
  formatTime: (iso: string | null) => string;
  onOpen: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
}> = ({ item, unread, colors, formatTime, onOpen, onMarkRead, onMarkUnread }) => {
  const swipeRef = useRef<React.ComponentRef<typeof ReanimatedSwipeable>>(null);

  const renderRightActions = () => (
    <Pressable
      onPress={() => {
        if (unread) onMarkRead();
        else onMarkUnread();
        swipeRef.current?.close();
      }}
      style={[
        local.swipeAction,
        { backgroundColor: unread ? colors.textTertiary : colors.primary },
      ]}
    >
      <Feather
        name={unread ? "check-circle" : "circle"}
        size={20}
        color="#FFFFFF"
      />
      <Text style={[typography.caption, { color: "#FFFFFF", marginTop: 4 }]}>
        {unread ? "Read" : "Unread"}
      </Text>
    </Pressable>
  );

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={renderRightActions}
      containerStyle={{ backgroundColor: colors.surfaceBg }}
    >
      <Pressable
        onPress={onOpen}
        style={({ pressed }) => [
          local.row,
          { backgroundColor: colors.surfaceBg, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Avatar
          uri={item.profile?.photo_url}
          name={item.profile?.display_name ?? "?"}
          size={56}
          radius={18}
        />
        <View style={local.rowText}>
          <View style={local.rowTop}>
            <Text
              style={[
                typography.label,
                {
                  color: colors.textPrimary,
                  flex: 1,
                  fontWeight: unread ? "800" : typography.label.fontWeight,
                },
              ]}
              numberOfLines={1}
            >
              {item.profile?.display_name ?? "Unknown"}
            </Text>
            <Text
              style={[
                typography.caption,
                { color: unread ? colors.primary : colors.textTertiary },
              ]}
            >
              {formatTime(item.last_message_at)}
            </Text>
          </View>
          <View style={local.rowBottom}>
            <Text
              style={[
                typography.body,
                {
                  color: unread ? colors.textPrimary : colors.textSecondary,
                  fontWeight: unread ? "600" : "400",
                  flex: 1,
                },
              ]}
              numberOfLines={1}
            >
              {item.last_message_preview ?? "Say hello 👋"}
            </Text>
            {unread ? (
              <View style={[local.unreadDot, { backgroundColor: colors.primary }]} />
            ) : null}
          </View>
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
};

/**
 * Inbox — 1:1 conversations with connected users, sorted by recency (spec §10).
 * Blocked threads are filtered out server-side by RLS, so they simply don't
 * appear here.
 */
export const ConversationsList: React.FC = () => {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const router = useRouter();

  const {
    conversations,
    fetchConversations,
    markConversationRead,
    markConversationUnread,
    currentProfile,
  } = useAppStore();
  // Other participants' profiles, keyed by user_id. Conversations themselves
  // live in the store so optimistic read/unread changes reflect immediately.
  const [profilesById, setProfilesById] = useState<Map<string, Profile>>(
    new Map(),
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const myId = currentProfile?.user_id;

  const load = useCallback(async () => {
    if (!myId) return;
    setLoading(true);
    try {
      const convs = await fetchConversations();
      if (!convs.length) return;

      const otherIds = convs.map((c) =>
        c.user_a_id === myId ? c.user_b_id : c.user_a_id,
      );
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", otherIds);
      setProfilesById(
        new Map(((profiles as Profile[]) ?? []).map((p) => [p.user_id, p])),
      );
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setLoading(false);
    }
  }, [myId, fetchConversations]);

  // Refresh on focus so returning from a chat (which marks it read) reflects.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const rows = useMemo<ConversationWithProfile[]>(() => {
    if (!myId) return [];
    return conversations.map((c) => {
      const otherId = c.user_a_id === myId ? c.user_b_id : c.user_a_id;
      return { ...c, profile: profilesById.get(otherId) };
    });
  }, [conversations, profilesById, myId]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const day = 86_400_000;
    if (diff < day && d.getDate() === new Date().getDate()) {
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    if (diff < 7 * day) return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  if (loading && !rows.length) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.surfaceBg }]}>
        <View style={local.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!rows.length) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.surfaceBg }]}>
        <View style={[styles.container, local.empty]}>
          <LinearGradient
            colors={gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={local.emptyIcon}
          >
            <Feather name="message-circle" size={32} color="#FFFFFF" />
          </LinearGradient>
          <Text
            style={[
              typography.title,
              { color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm },
            ]}
          >
            No messages yet
          </Text>
          <Text
            style={[typography.body, { color: colors.textSecondary, textAlign: "center", lineHeight: 24 }]}
          >
            Open a connection and tap Message to start a conversation.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.surfaceBg }]}>
      <View style={styles.container}>
        <Text style={[local.header, { color: colors.textPrimary }]}>Messages</Text>
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          contentContainerStyle={{ paddingBottom: spacing.xl }}
          renderItem={({ item }) => (
            <ConversationRow
              item={item}
              unread={isConversationUnread(item, myId)}
              colors={colors}
              formatTime={formatTime}
              onOpen={() => {
                markConversationRead(item.id);
                router.push({ pathname: "/chat/[id]", params: { id: item.id } });
              }}
              onMarkRead={() => markConversationRead(item.id)}
              onMarkUnread={() => markConversationUnread(item.id)}
            />
          )}
        />
      </View>
    </SafeAreaView>
  );
};

const local = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.lg },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowText: { flex: 1, gap: 4 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowBottom: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  swipeAction: {
    width: 88,
    alignItems: "center",
    justifyContent: "center",
  },
});
