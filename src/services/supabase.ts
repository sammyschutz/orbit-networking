import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client initialization
 * Replace these with your actual Supabase project credentials
 */

// Read environment variables (Expo injects `EXPO_PUBLIC_` vars at runtime)
let SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

// Normalize common mistake where the REST endpoint is supplied (e.g. .../rest/v1/)
if (SUPABASE_URL) {
  // remove trailing `/rest/v1` or `/rest/v1/` and any trailing slash
  SUPABASE_URL = SUPABASE_URL.replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "⚠️ Supabase credentials not configured or incomplete. Auth will not work.",
  );
  console.warn("Current values:", {
    SUPABASE_URL,
    SUPABASE_ANON_KEY: SUPABASE_ANON_KEY ? "[REDACTED]" : "",
  });
}

/**
 * Create Supabase client with AsyncStorage for session persistence
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Allow overriding the storage bucket via env (useful for testing or staging)
const SUPABASE_BUCKET_FROM_ENV = process.env.EXPO_PUBLIC_SUPABASE_BUCKET || "";
export const SUPABASE_BUCKET = SUPABASE_BUCKET_FROM_ENV || "profile-photos";

export { SUPABASE_ANON_KEY, SUPABASE_URL };

/**
 * Type definitions for Supabase tables
 * Generated from your schema
 */

export interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  role_title: string;
  industry: string;
  experience_level: "student" | "early" | "mid" | "senior" | "founder";
  bio: string;
  photo_url: string;
  timezone?: string | null;
  ask_me_about?: string | null;
  learning_about?: string | null;
  side_project?: string | null;
  is_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface Swipe {
  id: string;
  from_user_id: string;
  to_user_id: string;
  direction: "like" | "pass";
  created_at: string;
}

export interface SwipeResult {
  swipe_id: string;
  is_match: boolean;
  connection_id: string | null;
  notification_id: string | null;
}

export interface Connection {
  id: string;
  user_a_id: string;
  user_b_id: string;
  status: "pending" | "connected";
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: "incoming_interest" | "match";
  source_user_id: string;
  payload?: Record<string, any>;
  read_at?: string;
  created_at: string;
}

// --- Safe messaging (spec §4) -------------------------------------------------

export interface Conversation {
  id: string;
  connection_id: string;
  user_a_id: string;
  user_b_id: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  user_a_last_read_at: string | null;
  user_b_last_read_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * The other participant in any two-sided row (conversation, connection). Rows
 * store the pair as user_a/user_b; this is the one place that picks "not me".
 */
export function getOtherUserId(
  row: { user_a_id: string; user_b_id: string },
  myUserId: string,
): string {
  return row.user_a_id === myUserId ? row.user_b_id : row.user_a_id;
}

/**
 * Whether a conversation has messages the given user hasn't read yet. True when
 * the latest message is newer than that participant's read pointer (or they have
 * never read it). The sender's pointer is advanced server-side on send, so a
 * user's own messages never count as unread for them.
 */
export function isConversationUnread(
  conversation: Conversation,
  userId: string | null | undefined,
): boolean {
  if (!userId || !conversation.last_message_at) return false;
  const lastRead =
    conversation.user_a_id === userId
      ? conversation.user_a_last_read_at
      : conversation.user_b_last_read_at;
  if (!lastRead) return true;
  return new Date(conversation.last_message_at).getTime() >
    new Date(lastRead).getTime();
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  status: string;
  created_at: string;
  deleted_at?: string | null;
}

export interface Block {
  id: string;
  blocker_id: string;
  blocked_id: string;
  reason?: string | null;
  created_at: string;
}

// Must stay in sync with CATEGORIES in supabase/functions/report-user/index.ts
// (the server is the enforcing copy; this drives the client UI).
export const REPORT_CATEGORIES = [
  "harassment",
  "spam",
  "hate",
  "sexual",
  "threat",
  "other",
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

/**
 * Invoke a safety Edge Function with the current user's JWT (mirrors the
 * delete-account call pattern in settings.tsx). Messaging writes are never made
 * directly against the tables — they all flow through these functions.
 */
export async function invokeEdgeFunction<T = any>(
  name: string,
  body: unknown,
): Promise<{ status: number; data: T | null; error: string | null }> {
  const session = await supabase.auth.getSession();
  const token = session.data?.session?.access_token;
  if (!token) return { status: 401, data: null, error: "Not authenticated" };

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });

  let data: any = null;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await res.json().catch(() => null);
  } else {
    data = await res.text().catch(() => null);
  }

  const error = res.ok
    ? null
    : (data && (data.error || data.reason)) || `${res.status} ${res.statusText}`;
  return { status: res.status, data: data as T, error };
}
