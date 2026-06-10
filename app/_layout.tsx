import { supabase } from "@services/supabase";
import { useAppStore } from "@store/appStore";
import { useFonts } from "expo-font";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
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

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await navigateForSession(session);
    });

    // Initial session check on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      navigateForSession(session);
    });

    return () => subscription.unsubscribe();
  }, [loaded, fetchCurrentProfile, fetchNotifications]);

  if (!loaded) return null;

  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ title: "Edit profile" }} />
      <Stack.Screen name="connection/[id]" options={{ title: "Connection" }} />
      <Stack.Screen
        name="public-profile/[userId]"
        options={{ title: "Profile" }}
      />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
