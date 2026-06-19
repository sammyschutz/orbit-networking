import { Button } from "@components/Button";
import { useAuth } from "@hooks/useAuth";
import { LoginScreen, SignUpScreen } from "@screens/AuthScreens";
import { ConnectionsList } from "@screens/Connections";
import { DiscoveryIntro } from "@screens/DiscoveryIntro";
import { ProfileOnboarding } from "@screens/ProfileOnboarding";
import { useAppStore } from "@store/appStore";
import React, { useEffect, useState } from "react";
import { useColorScheme, View } from "react-native";

type AppState = "loading" | "auth" | "onboarding" | "ready";

/**
 * Root app navigator
 * Manages auth flow: auth → onboarding → discovery/connections
 */
export const RootNavigator: React.FC = () => {
  const scheme = useColorScheme();
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const { currentProfile, fetchCurrentProfile } = useAppStore();
  const [appState, setAppState] = useState<AppState>("loading");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  // Determine app state based on auth and profile
  useEffect(() => {
    if (authLoading) {
      setAppState("loading");
      return;
    }

    if (!isAuthenticated || !user) {
      setAppState("auth");
      return;
    }

    // User is authenticated, check profile
    if (!currentProfile && user.id) {
      fetchCurrentProfile(user.id);
    }

    if (!currentProfile || !currentProfile.is_complete) {
      setAppState("onboarding");
    } else {
      setAppState("ready");
    }
  }, [isAuthenticated, user, authLoading, currentProfile]);

  const handleAuthSuccess = () => {
    // This will trigger useEffect above
    setAppState("loading");
  };

  const handleProfileComplete = () => {
    setAppState("ready");
  };

  // Loading state
  if (appState === "loading") {
    return null; // Or show a splash screen
  }

  // Auth state
  if (appState === "auth") {
    return authMode === "login" ? (
      <LoginScreen onSuccess={handleAuthSuccess} />
    ) : (
      <SignUpScreen onSuccess={handleAuthSuccess} />
    );
  }

  // Onboarding state
  if (appState === "onboarding") {
    return <ProfileOnboarding onComplete={handleProfileComplete} />;
  }

  // Ready state - show main app
  return <MainApp />;
};

/**
 * Main app with tab navigation
 * Tabs: Discovery, Connections, Profile
 */
const MainApp: React.FC = () => {
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<
    "discovery" | "connections" | "profile"
  >("discovery");

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16, alignItems: "flex-end" }}>
        <Button
          title="Sign Out"
          onPress={signOut}
          variant="secondary"
          size="sm"
        />
      </View>

      {activeTab === "discovery" && <DiscoveryIntro />}
      {activeTab === "connections" && <ConnectionsList />}
      {/* Profile tab would be implemented similarly */}

      {/* Tab bar would go here - implementation depends on navigation setup */}
    </View>
  );
};

export default RootNavigator;
