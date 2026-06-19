import {
    City,
    Connection,
    Conversation,
    DiscoverySettings,
    Interest,
    invokeEdgeFunction,
    isConversationUnread,
    MAX_INTERESTS,
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

  // "My algorithm" tuning (interests + locality). `interests` is the full
  // chip vocabulary (curated + the user's own custom tags).
  interests: Interest[];
  myInterestIds: string[];
  myCity: City | null;
  discoverySettings: DiscoverySettings | null;
  algorithmLoading: boolean;

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

  // "My algorithm" actions. Every edit persists immediately (implicit save)
  // and clears the cached candidate queue so the next Discover visit
  // refetches with the new tuning.
  fetchAlgorithm: () => Promise<void>;
  toggleInterest: (interest: Interest) => Promise<boolean>;
  addCustomInterest: (
    name: string,
  ) => Promise<{ ok: boolean; reason?: "length" | "charset" | "cap" | "error" }>;
  setCity: (city: City | null) => Promise<void>;
  updateDiscoverySettings: (
    patch: Partial<Pick<DiscoverySettings, "nearby_only" | "nearby_radius_miles">>,
  ) => Promise<void>;

  clearError: () => void;
}

// The authenticated user id; falls back to the session when the profile row
// doesn't exist yet (onboarding).
const getSessionUserId = async (
  currentProfile: Profile | null,
): Promise<string | null> => {
  if (currentProfile?.user_id) return currentProfile.user_id;
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
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
  interests: [],
  myInterestIds: [],
  myCity: null,
  discoverySettings: null,
  algorithmLoading: false,

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

  // Fetch discovery candidates, ranked and filtered server-side by the
  // user's algorithm (interests overlap + locality, spec §6). The RPC also
  // owns the §13.3 pass-expiry semantics and excludes blocked users.
  fetchCandidates: async () => {
    const { currentProfile } = get();
    if (!currentProfile?.user_id) return [];

    set({ candidatesLoading: true });
    try {
      const { data, error } = await supabase.rpc("get_discover_candidates", {
        p_limit: 20,
      });

      if (error) throw error;
      const candidates = (((data as any[]) ?? []).map((row) => ({
        ...row,
        // numeric can arrive as a string depending on the serializer
        distance_miles:
          row.distance_miles == null ? null : Number(row.distance_miles),
      })) as Profile[]);
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
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(200);

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
      // Refresh inbox metadata (last_message_at / preview). Awaited so a brand
      // new conversation is in the store before Chat's markConversationRead
      // effect fires — otherwise its optimistic patch finds nothing to update.
      await get().fetchConversations();
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

  // --- "My algorithm" (zap-discover-algorithm-spec.md §3) --------------------

  // Load the chip vocabulary (curated + own custom tags), the user's
  // selections, their city, and their discovery settings.
  fetchAlgorithm: async () => {
    const userId = await getSessionUserId(get().currentProfile);
    if (!userId) return;

    set({ algorithmLoading: true });
    try {
      const [curatedRes, mineRes, settingsRes] = await Promise.all([
        supabase.from("interests").select("*").eq("curated", true).order("name"),
        supabase
          .from("user_interests")
          .select("interest_id, interests(*)")
          .eq("user_id", userId),
        supabase
          .from("discovery_settings")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

      const cityId = get().currentProfile?.city_id;
      let myCity: City | null = null;
      if (cityId) {
        const { data } = await supabase
          .from("cities")
          .select("*")
          .eq("id", cityId)
          .maybeSingle();
        myCity = (data as City | null) ?? null;
      }

      const curated = (curatedRes.data as Interest[]) ?? [];
      const mineRows = (mineRes.data as any[]) ?? [];
      const myInterestIds = mineRows.map((r) => r.interest_id as string);
      // Custom tags the user picked aren't in the curated list — append them
      // so their chips render selected instead of disappearing.
      const interests = [...curated];
      for (const row of mineRows) {
        const interest = row.interests as Interest | null;
        if (interest && !interests.some((i) => i.id === interest.id)) {
          interests.push(interest);
        }
      }

      set({
        interests,
        myInterestIds,
        myCity,
        discoverySettings: (settingsRes.data as DiscoverySettings | null) ?? null,
      });
    } catch (err) {
      console.error("Failed to load algorithm settings:", err);
    } finally {
      set({ algorithmLoading: false });
    }
  },

  // Select/deselect an interest chip. Returns false when the cap blocks it.
  toggleInterest: async (interest: Interest) => {
    const userId = await getSessionUserId(get().currentProfile);
    if (!userId) return false;

    const { myInterestIds } = get();
    const selected = myInterestIds.includes(interest.id);

    if (!selected && myInterestIds.length >= MAX_INTERESTS) return false;

    // Optimistic flip; revert on failure.
    set({
      myInterestIds: selected
        ? myInterestIds.filter((id) => id !== interest.id)
        : [...myInterestIds, interest.id],
      candidates: [],
    });

    const { error } = selected
      ? await supabase
          .from("user_interests")
          .delete()
          .eq("user_id", userId)
          .eq("interest_id", interest.id)
      : await supabase
          .from("user_interests")
          .insert({ user_id: userId, interest_id: interest.id });

    if (error) {
      console.error("Failed to update interest:", error);
      set({ myInterestIds });
      return false;
    }
    return true;
  },

  // Create (or find) a free-form tag via the RPC, then select it.
  addCustomInterest: async (name: string) => {
    const { data, error } = await supabase.rpc("add_custom_interest", {
      p_name: name,
    });

    if (error) {
      const message = error.message ?? "";
      if (message.includes("interest_name_length")) return { ok: false, reason: "length" as const };
      if (message.includes("interest_name_charset")) return { ok: false, reason: "charset" as const };
      console.error("add_custom_interest failed:", error);
      return { ok: false, reason: "error" as const };
    }

    const interestId = data as string;
    const { interests, myInterestIds } = get();

    if (myInterestIds.includes(interestId)) return { ok: true };
    if (myInterestIds.length >= MAX_INTERESTS) return { ok: false, reason: "cap" as const };

    let interest = interests.find((i) => i.id === interestId);
    if (!interest) {
      const { data: row } = await supabase
        .from("interests")
        .select("*")
        .eq("id", interestId)
        .maybeSingle();
      interest = (row as Interest | null) ?? undefined;
      if (interest) set({ interests: [...get().interests, interest] });
    }
    if (!interest) return { ok: false, reason: "error" as const };

    const ok = await get().toggleInterest(interest);
    return ok ? { ok: true } : { ok: false, reason: "error" as const };
  },

  // Set (or clear) the self-reported city on the profile.
  setCity: async (city: City | null) => {
    try {
      await get().updateProfile({ city_id: city?.id ?? null });
      set({ myCity: city, candidates: [] });
      // "Nearby only" is meaningless without a city — switch it off with it.
      if (!city && get().discoverySettings?.nearby_only) {
        await get().updateDiscoverySettings({ nearby_only: false });
      }
    } catch (err) {
      console.error("Failed to set city:", err);
    }
  },

  updateDiscoverySettings: async (patch) => {
    const userId = await getSessionUserId(get().currentProfile);
    if (!userId) return;

    const current = get().discoverySettings;
    const next: DiscoverySettings = {
      user_id: userId,
      nearby_only: current?.nearby_only ?? false,
      nearby_radius_miles: current?.nearby_radius_miles ?? 25,
      ...patch,
    };

    // Optimistic; revert on failure.
    set({ discoverySettings: next, candidates: [] });

    const { error } = await supabase.from("discovery_settings").upsert(
      {
        user_id: next.user_id,
        nearby_only: next.nearby_only,
        nearby_radius_miles: next.nearby_radius_miles,
      },
      { onConflict: "user_id" },
    );

    if (error) {
      console.error("Failed to update discovery settings:", error);
      set({ discoverySettings: current ?? null });
    }
  },

  // Clear error
  clearError: () => set({ profileError: null }),
}));
