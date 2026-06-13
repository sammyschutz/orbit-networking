import { ProfileCard } from "@components/Card";
import { ExtendHandButton } from "@components/ExtendHandButton";
import { HandshakeOverlay } from "@components/HandshakeOverlay";
import { NotificationsBanner } from "@components/NotificationsBanner";
import {
  borderRadius,
  gradients,
  spacing,
  typography,
  useThemeColors,
} from "@constants/theme";
import { Feather } from "@expo/vector-icons";
import { NEARBY_RADIUS_OPTIONS, Profile } from "@services/supabase";
import { useAppStore } from "@store/appStore";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInUp, FadeOut } from "react-native-reanimated";

interface DiscoveryIntroProps {
  onNoMoreCards?: () => void;
}

interface PendingHandshake {
  candidate: Profile;
  connectionId: string | null;
}

/**
 * Discover as an introduction (handshake spec §3, Option A): one profile at a
 * time, button-driven — "Extend a hand" or "Maybe later" — with a crossfade
 * to the next person. No drag gesture, no stamps, no fling.
 */
export const DiscoveryIntro: React.FC<DiscoveryIntroProps> = ({
  onNoMoreCards,
}) => {
  const colors = useThemeColors();
  const router = useRouter();

  const {
    candidates,
    fetchCandidates,
    currentProfile,
    submitSwipe,
    myInterestIds,
    myCity,
    discoverySettings,
    fetchAlgorithm,
    updateDiscoverySettings,
  } = useAppStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [handshake, setHandshake] = useState<PendingHandshake | null>(null);
  const [stageHeight, setStageHeight] = useState(0);

  // The swipe fires when the button is pressed so it runs while the hand
  // animation plays; the result is consumed once the animation settles.
  const pendingSwipeRef = useRef<ReturnType<typeof submitSwipe> | null>(null);
  const pendingCandidateRef = useRef<Profile | null>(null);
  const confirmationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Refetch on focus, not just mount — expo-router keeps tab screens mounted,
  // so a connection (or swipe) made elsewhere must drop the person from the
  // deck when returning here. The server RPC already excludes connected/
  // swiped/blocked users; the bug was the client trusting a stale cached list.
  // The full-screen spinner only shows on a cold deck (render gates on
  // `!candidates.length && loading`), so this refresh is silent when cards
  // are already on screen.
  useFocusEffect(
    useCallback(() => {
      if (!currentProfile?.user_id) return;
      let active = true;
      setLoading(true);
      fetchCandidates().finally(() => {
        if (!active) return;
        setCurrentIndex(0);
        setLoading(false);
      });
      fetchAlgorithm();
      return () => {
        active = false;
      };
    }, [currentProfile?.user_id, fetchCandidates, fetchAlgorithm]),
  );

  // The store's candidate list can shrink underneath us (e.g. responding to
  // someone from their full profile refetches it) — keep the index in range.
  useEffect(() => {
    if (currentIndex > 0 && currentIndex >= candidates.length) {
      setCurrentIndex(0);
    }
  }, [candidates.length, currentIndex]);

  useEffect(
    () => () => {
      if (confirmationTimerRef.current) {
        clearTimeout(confirmationTimerRef.current);
      }
    },
    [],
  );

  const showConfirmation = (text: string, duration: number) => {
    if (confirmationTimerRef.current) {
      clearTimeout(confirmationTimerRef.current);
    }
    setConfirmation(text);
    confirmationTimerRef.current = setTimeout(
      () => setConfirmation(null),
      duration,
    );
  };

  const advance = async () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= candidates.length) {
      setLoading(true);
      const refreshed = await fetchCandidates();
      setCurrentIndex(0);
      setLoading(false);
      if (!refreshed.length) onNoMoreCards?.();
    } else {
      setCurrentIndex(nextIndex);
    }
  };

  const beginExtend = () => {
    const candidate = candidates[currentIndex];
    if (!candidate || busy) return;
    setBusy(true);
    pendingCandidateRef.current = candidate;
    const swipe = submitSwipe(candidate.user_id, "like");
    // The promise isn't awaited until the animation settles ~700 ms later;
    // absorb an early rejection so it can't surface as unhandled meanwhile.
    swipe.catch(() => {});
    pendingSwipeRef.current = swipe;
  };

  const finishExtend = async () => {
    const candidate = pendingCandidateRef.current;
    try {
      const result = await pendingSwipeRef.current;
      if (candidate && result?.is_match) {
        setHandshake({
          candidate,
          connectionId: result.connection_id ?? null,
        });
      } else if (candidate) {
        showConfirmation(`Hand extended to ${candidate.display_name} 👋`, 1600);
      }
      await advance();
    } catch (err) {
      console.error("Extend hand failed:", err);
      showConfirmation("Something went wrong — try again.", 2000);
    } finally {
      pendingSwipeRef.current = null;
      pendingCandidateRef.current = null;
      setBusy(false);
    }
  };

  const handlePass = async () => {
    const candidate = candidates[currentIndex];
    if (!candidate || busy) return;
    setBusy(true);
    try {
      await submitSwipe(candidate.user_id, "pass");
      await advance();
    } catch (err) {
      console.error("Pass failed:", err);
      showConfirmation("Something went wrong — try again.", 2000);
    } finally {
      setBusy(false);
    }
  };

  const handleSayHello = () => {
    if (!handshake) return;
    const { candidate, connectionId } = handshake;
    setHandshake(null);
    router.push({
      pathname: "/chat/[id]",
      params: {
        id: "new",
        recipientId: candidate.user_id,
        connectionId: connectionId ?? "",
        name: candidate.display_name,
        photo: candidate.photo_url ?? "",
      },
    });
  };

  // Nearby-only drained the queue: recover in one tap without leaving
  // Discover (spec §7). Widening writes discovery_settings, then refetches.
  const handleWidenRadius = async () => {
    const current = discoverySettings?.nearby_radius_miles ?? 25;
    const next = NEARBY_RADIUS_OPTIONS.find((miles) => miles > current);
    if (!next) return;
    setLoading(true);
    await updateDiscoverySettings({ nearby_radius_miles: next });
    await fetchCandidates();
    setCurrentIndex(0);
    setLoading(false);
  };

  const handleShowEverywhere = async () => {
    setLoading(true);
    await updateDiscoverySettings({ nearby_only: false });
    await fetchCandidates();
    setCurrentIndex(0);
    setLoading(false);
  };

  const hasTunedAlgorithm = myInterestIds.length > 0 || !!myCity;
  const nearbyOnlyActive = !!discoverySettings?.nearby_only && !!myCity;
  const canWidenRadius =
    (discoverySettings?.nearby_radius_miles ?? 25) <
    NEARBY_RADIUS_OPTIONS[NEARBY_RADIUS_OPTIONS.length - 1];

  // Manual pull-to-refresh, for convenience — same fresh, server-filtered
  // fetch as focus, but with the pull spinner instead of the cold-deck one.
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await fetchCandidates();
      await fetchAlgorithm();
      setCurrentIndex(0);
    } finally {
      setRefreshing(false);
    }
  };

  const currentCandidate = candidates[currentIndex];

  return (
    <LinearGradient
      colors={
        (colors.surfaceBg === "#FFFFFF"
          ? ["#FFFFFF", "#F5F3FF", "#FDF2F8"]
          : ["#0F172A", "#1E1B4B", "#0F172A"]) as readonly [
          string,
          string,
          ...string[],
        ]
      }
      style={styles.flex}
    >
      <SafeAreaView style={styles.flex}>
        <View style={styles.container}>
          <NotificationsBanner />

          {/* Header */}
          <View style={styles.header}>
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.logoBadge}
            >
              <Feather name="zap" size={18} color="#FFFFFF" />
            </LinearGradient>
            <View style={styles.headerText}>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                Discover
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open my algorithm"
                onPress={() => router.push("/my-algorithm")}
                hitSlop={6}
              >
                <Text style={[styles.headerHint, { color: colors.primary }]}>
                  {hasTunedAlgorithm
                    ? "Tuned by your algorithm ›"
                    : "Build your algorithm ›"}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Introduction stage */}
          <ScrollView
            style={styles.stage}
            contentContainerStyle={styles.stageContent}
            onLayout={(e) => setStageHeight(e.nativeEvent.layout.height)}
            showsVerticalScrollIndicator={false}
            alwaysBounceVertical
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          >
            {!candidates.length && loading ? (
              <View style={styles.centerContent}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text
                  style={[
                    typography.body,
                    { color: colors.textSecondary, marginTop: spacing.md },
                  ]}
                >
                  Finding people for you…
                </Text>
              </View>
            ) : !currentCandidate ? (
              <View style={styles.centerContent}>
                <LinearGradient
                  colors={gradients.brandSoft}
                  style={styles.emptyIcon}
                >
                  <Feather
                    name={nearbyOnlyActive ? "map-pin" : "coffee"}
                    size={32}
                    color="#FFFFFF"
                  />
                </LinearGradient>
                <Text
                  style={[
                    typography.title,
                    {
                      color: colors.textPrimary,
                      marginTop: spacing.lg,
                      marginBottom: spacing.sm,
                      textAlign: "center",
                    },
                  ]}
                >
                  {nearbyOnlyActive
                    ? `Your algorithm ran out of people near ${myCity?.name}.`
                    : "You're all caught up"}
                </Text>
                <Text
                  style={[
                    typography.body,
                    { color: colors.textSecondary, textAlign: "center" },
                  ]}
                >
                  {nearbyOnlyActive
                    ? "Loosen it a little — you can tighten it back any time."
                    : "Check back soon — new people join every day."}
                </Text>
                {nearbyOnlyActive ? (
                  <View style={styles.emptyActions}>
                    {canWidenRadius ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={handleWidenRadius}
                        style={({ pressed }) => [
                          styles.emptyAction,
                          {
                            backgroundColor: colors.primary,
                            opacity: pressed ? 0.85 : 1,
                          },
                        ]}
                      >
                        <Text style={styles.emptyActionText}>Widen radius</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      onPress={handleShowEverywhere}
                      style={({ pressed }) => [
                        styles.emptyAction,
                        {
                          backgroundColor: colors.surfaceCard,
                          borderColor: colors.border,
                          borderWidth: 1,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.emptyActionText,
                          { color: colors.textPrimary },
                        ]}
                      >
                        Show people everywhere
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : (
              <Animated.View
                key={currentCandidate.user_id}
                entering={FadeInUp.duration(260)}
                exiting={FadeOut.duration(160)}
              >
                <ProfileCard
                  image={currentCandidate.photo_url}
                  name={currentCandidate.display_name}
                  title={currentCandidate.role_title}
                  industry={currentCandidate.industry}
                  bio={currentCandidate.bio}
                  prompt={currentCandidate.ask_me_about ?? undefined}
                  experience={currentCandidate.experience_level}
                  sharedInterests={currentCandidate.shared_interests}
                  distanceMiles={currentCandidate.distance_miles}
                  isNearby={currentCandidate.is_nearby}
                  isSameCity={currentCandidate.is_same_city}
                  onPress={() =>
                    router.push({
                      pathname: "/public-profile/[userId]",
                      params: { userId: currentCandidate.user_id },
                    })
                  }
                />
              </Animated.View>
            )}
          </ScrollView>

          {/* Actions — or the inline confirmation where they sit */}
          {confirmation ? (
            <Animated.View
              entering={FadeInUp.duration(180)}
              exiting={FadeOut.duration(140)}
              style={[
                styles.confirmation,
                {
                  backgroundColor: colors.surfaceCard,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[typography.label, { color: colors.textPrimary }]}>
                {confirmation}
              </Text>
            </Animated.View>
          ) : currentCandidate ? (
            <View style={styles.actions}>
              <ExtendHandButton
                onExtend={beginExtend}
                onSettled={finishExtend}
                disabled={busy}
                flightDistance={stageHeight ? Math.max(stageHeight - 48, 160) : 280}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Maybe later"
                disabled={busy}
                onPress={handlePass}
                style={({ pressed }) => [
                  styles.maybeLater,
                  { opacity: busy ? 0.5 : pressed ? 0.7 : 1 },
                ]}
              >
                <Text
                  style={[styles.maybeLaterText, { color: colors.textSecondary }]}
                >
                  Maybe later
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </SafeAreaView>

      <HandshakeOverlay
        visible={!!handshake}
        myName={currentProfile?.display_name ?? "You"}
        myPhoto={currentProfile?.photo_url}
        theirName={handshake?.candidate.display_name ?? ""}
        theirPhoto={handshake?.candidate.photo_url}
        onSayHello={handleSayHello}
        onDismiss={() => setHandshake(null)}
        dismissLabel="Keep discovering"
      />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  logoBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    gap: 1,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerHint: {
    fontSize: 13,
    fontWeight: "600",
  },
  emptyActions: {
    marginTop: spacing.xl,
    gap: spacing.sm,
    alignSelf: "stretch",
  },
  emptyAction: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: borderRadius.md,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  emptyActionText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  stage: {
    flex: 1,
    marginVertical: spacing.md,
  },
  // flexGrow lets the centered loading/empty states fill the scroll viewport,
  // and lets the pull gesture register even when a single card doesn't overflow.
  stageContent: {
    flexGrow: 1,
  },
  confirmation: {
    alignItems: "center",
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    minHeight: 110,
    justifyContent: "center",
    padding: spacing.lg,
  },
  actions: {
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  maybeLater: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  maybeLaterText: {
    ...typography.label,
    fontSize: 15,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
});
