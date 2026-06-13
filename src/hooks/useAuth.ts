import { useEffect, useState } from 'react';
import { supabase } from '@services/supabase';
import { Session, User } from '@supabase/supabase-js';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';

// Required so the auth popup can complete the flow on web. No-op on native.
WebBrowser.maybeCompleteAuthSession();

// Deep-link the provider redirects back to. Resolves to `zapfresh://` in a
// dev/standalone build (the app.json scheme) and the Expo proxy in Expo Go.
const oauthRedirectTo = makeRedirectUri();

/**
 * Turn the redirect URL handed back by the provider into a Supabase session.
 * Supports both the PKCE flow (`?code=`, the supabase-js default) and the
 * implicit token flow (`access_token`/`refresh_token`).
 */
const createSessionFromUrl = async (url: string): Promise<Session | null> => {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  const { access_token, refresh_token, code } = params;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return data.session;
  }

  if (!access_token) return null;

  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });
  if (error) throw error;
  return data.session;
};

/**
 * Hook to manage Supabase auth session and user state
 */
export const useAuth = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get current session
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        setSession(session);
        setUser(session?.user ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to get session');
      } finally {
        setLoading(false);
      }
    };

    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    return () => subscription?.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign up failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Launch the Google OAuth flow in an in-app browser and establish a session
   * from the redirect. Returns the session on success, or `null` if the user
   * dismissed the browser without completing sign-in.
   */
  const signInWithGoogle = async (): Promise<Session | null> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: oauthRedirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;

      const result = await WebBrowser.openAuthSessionAsync(
        data?.url ?? '',
        oauthRedirectTo,
      );

      if (result.type !== 'success') return null; // user cancelled/dismissed
      return await createSessionFromUrl(result.url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google sign-in failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setSession(null);
      setUser(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign out failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    session,
    user,
    loading,
    error,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    isAuthenticated: !!session,
  };
};
