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
