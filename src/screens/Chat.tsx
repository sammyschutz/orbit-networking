import { Avatar } from "@components/Avatar";
import { SafetyMenu } from "@components/SafetyMenu";
import {
  borderRadius,
  spacing,
  typography,
  useThemeColors,
} from "@constants/theme";
import { Feather } from "@expo/vector-icons";
import { getOtherUserId, Message, Profile, supabase } from "@services/supabase";
import { useAppStore } from "@store/appStore";
import { useNavigation, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

interface PendingMessage {
  tempId: string;
  body: string;
  failed?: boolean;
}

interface ChatScreenProps {
  /** conversationId, or "new" when starting from a connection. */
  routeId: string;
  recipientId?: string;
  connectionId?: string;
  name?: string;
  photo?: string;
}

/**
 * 1:1 chat (spec §10). Reads go straight from the DB (RLS-protected) and live
 * updates arrive via Supabase Realtime. Sends are optimistic and reconcile
 * against the send-message gateway's verdict: hard-blocked content rolls back
 * with an error; a rate-limited send shows a cooldown.
 */
export const ChatScreen: React.FC<ChatScreenProps> = ({
  routeId,
  recipientId: recipientParam,
  connectionId: connectionParam,
  name: nameParam,
  photo: photoParam,
}) => {
  const colors = useThemeColors();
  const navigation = useNavigation();
  const router = useRouter();
  const {
    currentProfile,
    messagesByConversation,
    fetchMessages,
    upsertRealtimeMessage,
    sendMessage,
    markConversationRead,
  } = useAppStore();

  const [conversationId, setConversationId] = useState<string | null>(
    routeId && routeId !== "new" ? routeId : null,
  );
  const [recipientId, setRecipientId] = useState<string | undefined>(recipientParam);
  const [connectionId, setConnectionId] = useState<string | undefined>(connectionParam);
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null);
  const [otherName, setOtherName] = useState(nameParam ?? "Chat");

  const [input, setInput] = useState("");
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(!!conversationId);
  const [menuVisible, setMenuVisible] = useState(false);

  const listRef = useRef<FlatList>(null);
  const storeMessages = conversationId
    ? messagesByConversation[conversationId] ?? []
    : [];

  // Resolve conversation participants + the other user's profile.
  const resolveContext = useCallback(async () => {
    if (!currentProfile?.user_id) return;
    let otherId = recipientId;
    let convId = conversationId;

    // Started from a connection ("new"): adopt the existing thread if there is
    // one, so history loads instead of showing an empty composer.
    if (!convId && connectionId) {
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("connection_id", connectionId)
        .maybeSingle();
      if (existing) {
        convId = existing.id;
        setConversationId(existing.id);
      }
    }

    if (convId) {
      const { data: conv } = await supabase
        .from("conversations")
        .select("user_a_id, user_b_id, connection_id")
        .eq("id", convId)
        .maybeSingle();
      if (conv) {
        otherId = getOtherUserId(conv, currentProfile.user_id);
        setRecipientId(otherId);
        setConnectionId(conv.connection_id);
      }
    }

    if (otherId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", otherId)
        .maybeSingle();
      if (profile) {
        setOtherProfile(profile as Profile);
        setOtherName((profile as Profile).display_name);
      }
    }
  }, [conversationId, connectionId, currentProfile?.user_id, recipientId]);

  useEffect(() => {
    resolveContext();
  }, [resolveContext]);

  // Load history when we know the conversation.
  useEffect(() => {
    if (!conversationId) return;
    let active = true;
    setLoadingHistory(true);
    fetchMessages(conversationId).finally(() => {
      if (active) setLoadingHistory(false);
    });
    return () => {
      active = false;
    };
  }, [conversationId, fetchMessages]);

  // Reading the thread clears its unread state — on open and whenever a new
  // message lands while it's on screen.
  useEffect(() => {
    if (conversationId) markConversationRead(conversationId);
  }, [conversationId, storeMessages.length, markConversationRead]);

  // Live updates via Realtime (RLS-filtered to this conversation).
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => upsertRealtimeMessage(payload.new as Message),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, upsertRealtimeMessage]);

  // Header: title + safety overflow.
  useLayoutEffect(() => {
    navigation.setOptions({
      title: otherName,
      headerRight: () => (
        <Pressable
          onPress={() => setMenuVisible(true)}
          hitSlop={12}
          style={{ paddingHorizontal: spacing.sm }}
        >
          <Feather name="more-horizontal" size={22} color={colors.textPrimary} />
        </Pressable>
      ),
    });
  }, [navigation, otherName, colors.textPrimary]);

  const rendered = useMemo(
    () => [
      ...storeMessages.map((m) => ({ kind: "real" as const, ...m })),
      ...pending.map((p) => ({ kind: "pending" as const, ...p })),
    ],
    [storeMessages, pending],
  );

  useEffect(() => {
    if (rendered.length) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [rendered.length]);

  const onSend = async () => {
    const body = input.trim();
    if (!body || sending) return;
    setInput("");
    setNotice(null);
    const tempId = `temp-${Date.now()}`;
    setPending((p) => [...p, { tempId, body }]);
    setSending(true);

    const result = await sendMessage({
      conversationId: conversationId ?? undefined,
      recipientId: conversationId ? undefined : recipientId,
      body,
    });

    setSending(false);
    setPending((p) => p.filter((m) => m.tempId !== tempId));

    if (result.ok) {
      if (!conversationId && result.message) {
        setConversationId(result.message.conversation_id);
      }
      return;
    }

    // Reconcile failure: surface a clear, non-leaky reason.
    if (result.reason === "content") {
      setNotice("That message can't be sent — it may violate our safety rules.");
    } else if (result.status === 429) {
      const secs = result.retryAfter ?? 60;
      setNotice(`You're sending too fast. Try again in ${secs}s.`);
    } else if (result.status === 403) {
      setNotice(result.error ?? "You can't message this user.");
    } else {
      setNotice(result.error ?? "Couldn't send. Try again.");
    }
  };

  const myId = currentProfile?.user_id;

  if (loadingHistory && !storeMessages.length) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surfaceBg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surfaceBg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 96 : 0}
    >
      <FlatList
        ref={listRef}
        data={rendered}
        keyExtractor={(item) =>
          item.kind === "real" ? item.id : item.tempId
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.intro}>
            {otherProfile ? (
              <Avatar
                uri={otherProfile.photo_url}
                name={otherProfile.display_name}
                size={64}
                radius={20}
              />
            ) : null}
            <Text style={[typography.title, { color: colors.textPrimary, marginTop: spacing.sm }]}>
              {otherName}
            </Text>
            <View style={styles.privacyRow}>
              <Feather name="shield" size={12} color={colors.textTertiary} />
              <Text style={[typography.caption, { color: colors.textTertiary, flex: 1 }]}>
                Messages are scanned for safety and aren't end-to-end encrypted.
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const mine =
            item.kind === "pending" || item.sender_id === myId;
          return (
            <View
              style={[
                styles.bubbleRow,
                { justifyContent: mine ? "flex-end" : "flex-start" },
              ]}
            >
              <View
                style={[
                  styles.bubble,
                  mine
                    ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
                    : {
                        backgroundColor: colors.surfaceCard,
                        borderBottomLeftRadius: 4,
                      },
                  item.kind === "pending" ? { opacity: 0.6 } : null,
                ]}
              >
                <Text
                  style={[
                    typography.body,
                    { color: mine ? "#FFFFFF" : colors.textPrimary },
                  ]}
                >
                  {item.body}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {notice ? (
        <View style={[styles.notice, { backgroundColor: colors.error + "1A" }]}>
          <Feather name="alert-circle" size={14} color={colors.error} />
          <Text style={[typography.caption, { color: colors.error, flex: 1 }]}>
            {notice}
          </Text>
        </View>
      ) : null}

      <View style={[styles.composer, { borderTopColor: colors.border, backgroundColor: colors.surfaceBg }]}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surfaceInput,
              color: colors.textPrimary,
              borderColor: colors.border,
            },
          ]}
          placeholder="Message…"
          placeholderTextColor={colors.textTertiary}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={2000}
        />
        <Pressable
          onPress={onSend}
          disabled={!input.trim() || sending}
          style={[
            styles.sendBtn,
            {
              backgroundColor: input.trim() ? colors.primary : colors.surfaceInput,
              opacity: sending ? 0.6 : 1,
            },
          ]}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Feather
              name="send"
              size={18}
              color={input.trim() ? "#FFFFFF" : colors.textTertiary}
            />
          )}
        </Pressable>
      </View>

      {recipientId ? (
        <SafetyMenu
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          otherUserId={recipientId}
          otherName={otherName}
          connectionId={connectionId}
          conversationId={conversationId ?? undefined}
          onRelationshipEnded={() => router.back()}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  intro: {
    alignItems: "center",
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  bubbleRow: {
    flexDirection: "row",
    marginBottom: spacing.sm,
  },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
});
