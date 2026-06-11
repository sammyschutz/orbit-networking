import {
    Connection,
    Conversation,
    invokeEdgeFunction,
    isConversationUnread,
    Message,
    Notification,
    Profile,
    ReportCategory,
    SwipeResult,
    supabase,
} from "@services/supabase";
import { create } from "zustand";

// Patch a conversation's read pointer for the given user (optimistic update).
// `stamp` is the new last_read_at: a timestamp marks it read, null marks unread.
const patchReadPointer = (
  conversation: Conversation,
  userId: string,
  stamp: string | null,
): Conversation =>
  conversation.user_a_id === userId
    ? { ...conversation, user_a_last_read_at: stamp }
    : { ...conversation, user_b_last_read_at: stamp };

// A send-message attempt result the chat screen reconciles against (spec §8.1).
export interface SendResult {
  ok: boolean;
  status: number;
  message?: Message;
  reason?: "content" | "global" | "conversation" | "duplicate" | "new_connection";
  retryAfter?: number;
  error?: string;
}

interface AppState {
  // Current user's profile
  currentProfile: Profile | null;
  profileLoading: boolean;
  profileError: string | null;

  // Swipe deck candidates
  candidates: Profile[];
  candidatesLoading: boolean;

  // Connections
  connections: Connection[];
  connectionsLoading: boolean;

  // Notifications
  notifications: Notification[];
  unreadCount: number;

  // Messaging
  conversations: Conversation[];
  conversationsLoading: boolean;
  messagesByConversation: Record<string, Message[]>;

  // Actions
  fetchCurrentProfile: (userId: string) => Promise<Profile | null>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  fetchCandidates: () => Promise<Profile[]>;
  submitSwipe: (
    toUserId: string,
    direction: "like" | "pass",
  ) => Promise<SwipeResult | null>;
  fetchConnections: () => Promise<Connection[]>;
  fetchNotifications: () => Promise<Notification[]>;
  markNotificationRead: (notificationId: string) => Promise<void>;

  // Messaging actions (all writes go through the safety Edge Functions / RPC)
  fetchConversations: () => Promise<Conversation[]>;
  markConversationRead: (conversationId: string) => Promise<void>;
  markConversationUnread: (conversationId: string) => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<Message[]>;
  upsertRealtimeMessage: (message: Message) => void;
  sendMessage: (args: {
    conversationId?: string;
    recipientId?: string;
    body: string;
  }) => Promise<SendResult>;
  blockUser: (blockedId: string, reason?: string) => Promise<boolean>;
  unblockUser: (blockedId: string) => Promise<boolean>;
  reportUser: (args: {
    reportedId: string;
    category: ReportCategory;
    conversationId?: string;
    messageId?: string;
    details?: string;
  }) => Promise<boolean>;
  removeConnection: (connectionId: string) => Promise<boolean>;

  clearError: () => void;
}

// Approximate the 6-month discovery cooldown window (spec §13.3).
const SIX_MONTHS_AGO = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return d.getTime();
};

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  currentProfile: null,
  profileLoading: false,
  profileError: null,
  candidates: [],
  candidatesLoading: false,
  connections: [],
  connectionsLoading: false,
  notifications: [],
  unreadCount: 0,
  conversations: [],
  conversationsLoading: false,
  messagesByConversation: {},

  // Fetch current user's profile
  fetchCurrentProfile: async (userId: string) => {
    set({ profileLoading: true, profileError: null });
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) {
        if ((error as any).code === "PGRST116") {
          // No profile row yet for this user.
          set({ currentProfile: null });
          return null;
        }
        throw error;
      }

      const profile = data as Profile;
      set({ currentProfile: profile });
      return profile;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch profile";
      set({ profileError: message });
      return null;
    } finally {
      set({ profileLoading: false });
    }
  },

  // Update or create current profile
  updateProfile: async (updates: Partial<Profile>) => {
    const { currentProfile } = get();

    set({ profileLoading: true, profileError: null });
    try {
      let result;

      if (currentProfile) {
        result = await supabase
          .from("profiles")
          .update(updates)
          .eq("id", currentProfile.id)
          .select()
          .single();
      } else {
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        const userId = sessionData.session?.user?.id;
        if (!userId) {
          throw new Error("No authenticated user available to create profile");
        }

        result = await supabase
          .from("profiles")
          .insert([{ ...updates, user_id: userId }])
          .select()
          .single();
      }

      const { data, error } = result;
      if (error) throw error;
      set({ currentProfile: data as Profile });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save profile";
      set({ profileError: message });
      throw err;
    } finally {
      set({ profileLoading: false });
    }
  },

  // Fetch discovery candidates (profiles not swiped on)
  fetchCandidates: async () => {
    const { currentProfile } = get();
    if (!currentProfile?.user_id) return [];

    set({ candidatesLoading: true });
    try {
      // Get list of users already swiped on, with direction + recency so passes
      // expire after 6 months (spec §13.3): exclude all `like` swipes
      // permanently, but only `pass` swipes from the last 6 months.
      const { data: swipes } = await supabase
        .from("swipes")
        .select("to_user_id, direction, created_at")
        .eq("from_user_id", currentProfile.user_id);

      const cutoff = SIX_MONTHS_AGO();
      const swipedUserIds = (swipes ?? [])
        .filter(
          (s) =>
            s.direction === "like" ||
            (s.direction === "pass" &&
              new Date(s.created_at).getTime() > cutoff),
        )
        .map((s) => s.to_user_id);

      // Get list of connected users
      const { data: connections } = await supabase
        .from("connections")
        .select("user_a_id, user_b_id")
        .or(
          `user_a_id.eq.${currentProfile.user_id},user_b_id.eq.${currentProfile.user_id}`,
        );

      const connectedUserIds =
        connections?.flatMap((c) => [
          c.user_a_id === currentProfile.user_id ? c.user_b_id : c.user_a_id,
        ]) ?? [];

      // Exclude current user, swiped, and connected
      const excludeIds = [
        currentProfile.user_id,
        ...swipedUserIds,
        ...connectedUserIds,
      ];

      // Fetch candidates
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_complete", true)
        .not("user_id", "in", `(${excludeIds.join(",")})`)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      const candidates = (data as Profile[]) ?? [];
      set({ candidates });
      return candidates;
    } catch (err) {
      console.error("Failed to fetch candidates:", err);
      return [];
    } finally {
      set({ candidatesLoading: false });
    }
  },

  // Submit a swipe via the server-side RPC so RLS can keep connections and
  // notifications locked down from direct client inserts.
  submitSwipe: async (toUserId, direction) => {
    const { data, error } = await supabase.rpc("submit_swipe", {
      p_to_user_id: toUserId,
      p_direction: direction,
    });

    if (error) {
      console.error("Swipe failed:", error);
      throw error;
    }

    const result = Array.isArray(data) ? data[0] : data;
    const swipeResult = (result as SwipeResult | undefined) ?? null;

    await get().fetchNotifications();
    if (swipeResult?.is_match) {
      await get().fetchConnections();
    }

    return swipeResult;
  },

  // Fetch user's connections
  fetchConnections: async () => {
    const { currentProfile } = get();
    if (!currentProfile?.user_id) return [];

    set({ connectionsLoading: true });
    try {
      const { data, error } = await supabase
        .from("connections")
        .select("*")
        .or(
          `user_a_id.eq.${currentProfile.user_id},user_b_id.eq.${currentProfile.user_id}`,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      const connections = (data as Connection[]) ?? [];
      set({ connections });
      return connections;
    } catch (err) {
      console.error("Failed to fetch connections:", err);
      return [];
    } finally {
      set({ connectionsLoading: false });
    }
  },

  // Fetch user's notifications
  fetchNotifications: async () => {
    const { currentProfile } = get();
    if (!currentProfile?.user_id) return [];

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", currentProfile.user_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const notifications = (data as Notification[]) ?? [];
      const unreadCount = notifications.filter((n) => !n.read_at).length;
      set({ notifications, unreadCount });
      return notifications;
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
      return [];
    }
  },

  // Mark notification as read
  markNotificationRead: async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId);

      if (error) throw error;
      get().fetchNotifications(); // Refresh
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  },

  // --- Messaging ------------------------------------------------------------

  // Fetch the inbox. RLS hides blocked threads automatically.
  fetchConversations: async () => {
    const { currentProfile } = get();
    if (!currentProfile?.user_id) return [];

    set({ conversationsLoading: true });
    try {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (error) throw error;
      const conversations = (data as Conversation[]) ?? [];
      set({ conversations });
      return conversations;
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
      return [];
    } finally {
      set({ conversationsLoading: false });
    }
  },

  // Mark a conversation read/unread for the current user. The read pointer
  // lives on the conversation row and is written via SECURITY DEFINER RPCs
  // (clients have no UPDATE grant). We optimistically patch local state so the
  // unread indicator flips immediately.
  markConversationRead: async (conversationId: string) => {
    const { currentProfile, conversations } = get();
    const myId = currentProfile?.user_id;
    if (!myId) return;

    const conv = conversations.find((c) => c.id === conversationId);
    // Nothing to do if it's already read.
    if (conv && !isConversationUnread(conv, myId)) return;

    const stamp = conv?.last_message_at ?? new Date().toISOString();
    set({
      conversations: conversations.map((c) =>
        c.id === conversationId ? patchReadPointer(c, myId, stamp) : c,
      ),
    });

    const { error } = await supabase.rpc("mark_conversation_read", {
      p_conversation_id: conversationId,
    });
    if (error) {
      console.error("mark_conversation_read failed:", error);
      get().fetchConversations(); // Re-sync on failure.
    }
  },

  markConversationUnread: async (conversationId: string) => {
    const { currentProfile, conversations } = get();
    const myId = currentProfile?.user_id;
    if (!myId) return;

    set({
      conversations: conversations.map((c) =>
        c.id === conversationId ? patchReadPointer(c, myId, null) : c,
      ),
    });

    const { error } = await supabase.rpc("mark_conversation_unread", {
      p_conversation_id: conversationId,
    });
    if (error) {
      console.error("mark_conversation_unread failed:", error);
      get().fetchConversations(); // Re-sync on failure.
    }
  },

  // Load a conversation's message history (newest first from the DB, stored
  // oldest-first for rendering).
  fetchMessages: async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(200);

      if (error) throw error;
      const messages = (data as Message[]) ?? [];
      set((state) => ({
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: messages,
        },
      }));
      return messages;
    } catch (err) {
      console.error("Failed to fetch messages:", err);
      return [];
    }
  },

  // Merge a message arriving via Realtime (or an optimistic confirm), de-duped.
  upsertRealtimeMessage: (message: Message) => {
    set((state) => {
      const existing = state.messagesByConversation[message.conversation_id] ?? [];
      if (existing.some((m) => m.id === message.id)) return state;
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [message.conversation_id]: [...existing, message],
        },
      };
    });
  },

  // Send a message through the safety gateway. The client never writes to the
  // messages table directly. Returns a structured result the chat UI reconciles
  // against (hard-blocked content, rate-limit cooldown, etc.).
  sendMessage: async ({ conversationId, recipientId, body }) => {
    const { status, data, error } = await invokeEdgeFunction<any>(
      "send-message",
      { conversation_id: conversationId, recipient_id: recipientId, body },
    );

    if (status === 200 && data?.message) {
      get().upsertRealtimeMessage(data.message as Message);
      // Refresh inbox metadata (last_message_at / preview).
      get().fetchConversations();
      return { ok: true, status, message: data.message as Message };
    }

    return {
      ok: false,
      status,
      reason: data?.reason,
      retryAfter: data?.retry_after,
      error: error ?? data?.error ?? "Failed to send",
    };
  },

  blockUser: async (blockedId: string, reason?: string) => {
    const { status } = await invokeEdgeFunction("block-user", {
      blocked_id: blockedId,
      reason,
    });
    if (status === 200) {
      await Promise.all([get().fetchConversations(), get().fetchConnections()]);
      return true;
    }
    return false;
  },

  unblockUser: async (blockedId: string) => {
    const { status } = await invokeEdgeFunction("unblock-user", {
      blocked_id: blockedId,
    });
    if (status === 200) {
      await Promise.all([get().fetchConversations(), get().fetchConnections()]);
      return true;
    }
    return false;
  },

  reportUser: async ({ reportedId, category, conversationId, messageId, details }) => {
    const { status } = await invokeEdgeFunction("report-user", {
      reported_id: reportedId,
      category,
      conversation_id: conversationId,
      message_id: messageId,
      details,
    });
    return status === 200;
  },

  // Neutral unmatch via the security-definer RPC (spec §13).
  removeConnection: async (connectionId: string) => {
    const { error } = await supabase.rpc("remove_connection", {
      p_connection_id: connectionId,
    });
    if (error) {
      console.error("remove_connection failed:", error);
      return false;
    }
    await Promise.all([get().fetchConnections(), get().fetchConversations()]);
    return true;
  },

  // Clear error
  clearError: () => set({ profileError: null }),
}));
