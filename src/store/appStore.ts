import {
    Connection,
    Notification,
    Profile,
    supabase,
} from "@services/supabase";
import { create } from "zustand";

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

  // Actions
  fetchCurrentProfile: (userId: string) => Promise<Profile | null>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  fetchCandidates: () => Promise<void>;
  fetchConnections: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  clearError: () => void;
}

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
    if (!currentProfile?.user_id) return;

    set({ candidatesLoading: true });
    try {
      // Get list of users already swiped on
      const { data: swipes } = await supabase
        .from("swipes")
        .select("to_user_id")
        .eq("from_user_id", currentProfile.user_id);

      const swipedUserIds = swipes?.map((s) => s.to_user_id) ?? [];

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
      set({ candidates: (data as Profile[]) ?? [] });
    } catch (err) {
      console.error("Failed to fetch candidates:", err);
    } finally {
      set({ candidatesLoading: false });
    }
  },

  // Fetch user's connections
  fetchConnections: async () => {
    const { currentProfile } = get();
    if (!currentProfile?.user_id) return;

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
      set({ connections: (data as Connection[]) ?? [] });
    } catch (err) {
      console.error("Failed to fetch connections:", err);
    } finally {
      set({ connectionsLoading: false });
    }
  },

  // Fetch user's notifications
  fetchNotifications: async () => {
    const { currentProfile } = get();
    if (!currentProfile?.user_id) return;

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
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
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

  // Clear error
  clearError: () => set({ profileError: null }),
}));
