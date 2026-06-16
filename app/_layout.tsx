import { supabase } from "@services/supabase";
import { useAppStore } from "@store/appStore";
import { useFonts } from "expo-font";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  const { fetchCurrentProfile, fetchNotifications } = useAppStore();

  useEffect(() => {
    if (!loaded) return;
    SplashScreen.hideAsync();

    const navigateForSession = async (session: any) => {
      if (!session) {
        router.replace("/auth");
        return;
      }

      const profile = await fetchCurrentProfile(session.user.id);
      if (!profile?.is_complete) {
        router.replace("/onboarding");
      } else {
        await fetchNotifications();
        router.replace("/(tabs)");
      }
    };

    // Supabase fires onAuthStateChange for many events that don't change *who*
    // is signed in — token refreshes, user-metadata updates, and repeat
    // SIGNED_IN events on app foreground. Re-running navigation on those does a
    // router.replace that remounts the current screen and wipes in-progress
    // input (a half-finished onboarding form, a typed-but-unsubmitted signup).
    // So we ignore the non-transition events and only navigate when the active
    // user id actually changes.
    let lastUserId: string | null | undefined = undefined;

    const handleAuthChange = (event: string, session: any) => {
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return;

      const userId = session?.user?.id ?? null;
      if (userId === lastUserId) return; // same user, or still signed out
      lastUserId = userId;

      navigateForSession(session);
    };

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      handleAuthChange(event, session);
    });

    // Initial session check on mount (in case INITIAL_SESSION isn't delivered).
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleAuthChange("INITIAL_SESSION", session);
    });

    return () => subscription.unsubscribe();
  }, [loaded, fetchCurrentProfile, fetchNotifications]);

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ title: "Edit profile" }} />
        <Stack.Screen name="my-algorithm" options={{ title: "My algorithm" }} />
        <Stack.Screen name="connection/[id]" options={{ title: "Connection" }} />
        <Stack.Screen name="chat/[id]" options={{ title: "Chat" }} />
        <Stack.Screen
          name="public-profile/[userId]"
          options={{ title: "Profile" }}
        />
        <Stack.Screen name="+not-found" />
      </Stack>
    </GestureHandlerRootView>
  );
}
