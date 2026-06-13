import { Button } from "@components/Button";
import { HandshakeOverlay } from "@components/HandshakeOverlay";
import {
    createStyles,
    gradients,
    spacing,
    typography,
    useThemeColors,
} from "@constants/theme";
import { Interest, Profile, supabase } from "@services/supabase";
import { useAppStore } from "@store/appStore";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

interface PublicProfileDetailProps {
  userId: string;
  notificationId?: string;
}

export const PublicProfileDetail: React.FC<PublicProfileDetailProps> = ({
  userId,
  notificationId,
}) => {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const router = useRouter();
  const {
    currentProfile,
    submitSwipe,
    fetchCandidates,
    fetchConnections,
    myInterestIds,
    fetchAlgorithm,
  } = useAppStore();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [theirInterests, setTheirInterests] = useState<Interest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<"like" | "pass" | null>(
    null,
  );
  const [resultText, setResultText] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [handshake, setHandshake] = useState<{
    connectionId: string | null;
  } | null>(null);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .eq("is_complete", true)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.error("Failed to load public profile:", error);
        setProfile(null);
      } else {
        setProfile((data as Profile | null) ?? null);
      }

      setLoading(false);
    };

    loadProfile();

    return () => {
      active = false;
    };
  }, [userId]);

  // Their interest chips, with the viewer's selections for shared-highlighting
  // (interests are public — discover-algorithm spec §11-D).
  useEffect(() => {
    let active = true;

    supabase
      .from("user_interests")
      .select("interests(*)")
      .eq("user_id", userId)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("Failed to load interests:", error);
          return;
        }
        const interests = ((data as any[]) ?? [])
          .map((row) => row.interests as Interest | null)
          .filter((i): i is Interest => !!i)
          .sort((a, b) => a.name.localeCompare(b.name));
        setTheirInterests(interests);
      });

    if (currentProfile?.user_id) fetchAlgorithm();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleSwipe = async (direction: "like" | "pass") => {
    if (!profile || actionLoading) return;

    setActionLoading(direction);
    setResultText(null);

    try {
      // submit_swipe marks the pending incoming_interest notification read on
      // both responses, so no client-side dismissal is needed.
      const result = await submitSwipe(profile.user_id, direction);

      await fetchCandidates();

      if (direction === "like" && result?.is_match) {
        await fetchConnections();
        setConnected(true);
        setHandshake({ connectionId: result.connection_id ?? null });
        setResultText(`You and ${profile.display_name} shook hands.`);
      } else if (direction === "like") {
        setResultText(`You extended a hand to ${profile.display_name} 👋`);
      } else {
        setResultText("Maybe later — they may cross your path again.");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to save this action.";
      setResultText(message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSayHello = () => {
    if (!profile) return;
    const connectionId = handshake?.connectionId;
    setHandshake(null);
    router.push({
      pathname: "/chat/[id]",
      params: {
        id: "new",
        recipientId: profile.user_id,
        connectionId: connectionId ?? "",
        name: profile.display_name,
        photo: profile.photo_url ?? "",
      },
    });
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.screen, { backgroundColor: colors.surfaceBg }]}
      >
        <View style={localStyles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            style={[
              typography.body,
              { color: colors.textSecondary, marginTop: spacing.md },
            ]}
          >
            Loading profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView
        style={[styles.screen, { backgroundColor: colors.surfaceBg }]}
      >
        <View style={localStyles.centerContent}>
          <Text style={[typography.headline, { color: colors.textPrimary }]}>
            Profile not available
          </Text>
          <Text
            style={[
              typography.body,
              {
                color: colors.textSecondary,
                marginTop: spacing.sm,
                textAlign: "center",
              },
            ]}
          >
            This profile may have been removed or is not complete.
          </Text>
          <Button
            title="Back"
            onPress={() => router.back()}
            variant="secondary"
            style={localStyles.singleAction}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.surfaceBg }]}>
      <ScrollView
        contentContainerStyle={localStyles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={localStyles.heroWrap}>
          {profile.photo_url ? (
            <Image
              source={{ uri: profile.photo_url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={250}
            />
          ) : (
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, localStyles.imagePlaceholder]}
            >
              <Text style={localStyles.heroInitial}>
                {profile.display_name.charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
          )}
          <LinearGradient
            colors={gradients.photoScrim}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {notificationId ? (
            <View style={localStyles.interestBadge}>
              <Text style={localStyles.interestBadgeEmoji}>👋</Text>
              <Text style={localStyles.interestBadgeText}>
                Extended a hand to you
              </Text>
            </View>
          ) : null}
          <View style={localStyles.heroInfo}>
            <Text style={localStyles.heroName} numberOfLines={1}>
              {profile.display_name}
            </Text>
            <Text style={localStyles.heroMeta} numberOfLines={1}>
              {profile.role_title} · {profile.industry}
            </Text>
            <Text style={localStyles.heroSub}>
              {formatExperience(profile.experience_level)}
            </Text>
          </View>
        </View>

        <Text
          style={[
            typography.body,
            {
              color: colors.textPrimary,
              lineHeight: 24,
              marginTop: spacing.xl,
            },
          ]}
        >
          {profile.bio}
        </Text>

        {theirInterests.length > 0 ? (
          <View style={localStyles.interestsBlock}>
            <Text
              style={[
                typography.label,
                { color: colors.textPrimary, marginBottom: spacing.sm },
              ]}
            >
              Into
            </Text>
            <View style={localStyles.interestChipWrap}>
              {theirInterests.map((interest) => {
                const shared = myInterestIds.includes(interest.id);
                return (
                  <View
                    key={interest.id}
                    style={[
                      localStyles.interestChip,
                      {
                        backgroundColor: shared
                          ? colors.primary
                          : colors.surfaceInput,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        localStyles.interestChipText,
                        { color: shared ? "#FFFFFF" : colors.textPrimary },
                      ]}
                    >
                      {shared ? "✦ " : ""}
                      {interest.name}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={localStyles.prompts}>
          <PromptRow label="Ask me about" value={profile.ask_me_about} />
          <PromptRow label="Learning about" value={profile.learning_about} />
          <PromptRow label="Side project" value={profile.side_project} />
        </View>

        {resultText && (
          <View
            style={[
              localStyles.result,
              {
                backgroundColor: colors.surfaceCard,
                borderColor: colors.border,
              },
            ]}
            accessibilityRole="alert"
          >
            <Text style={[typography.label, { color: colors.textPrimary }]}>
              {resultText}
            </Text>
          </View>
        )}

        {connected ? (
          <Button
            title="View connections"
            onPress={() => router.replace("/(tabs)/connections")}
          />
        ) : (
          <View style={localStyles.actions}>
            <Button
              title="Maybe later"
              variant="secondary"
              onPress={() => handleSwipe("pass")}
              loading={actionLoading === "pass"}
              disabled={!!actionLoading}
              style={localStyles.actionButton}
            />
            <Button
              title={notificationId ? "Shake hands" : "Extend a hand"}
              onPress={() => handleSwipe("like")}
              loading={actionLoading === "like"}
              disabled={!!actionLoading}
              style={localStyles.actionButton}
            />
          </View>
        )}
      </ScrollView>

      <HandshakeOverlay
        visible={!!handshake}
        myName={currentProfile?.display_name ?? "You"}
        myPhoto={currentProfile?.photo_url}
        theirName={profile.display_name}
        theirPhoto={profile.photo_url}
        onSayHello={handleSayHello}
        onDismiss={() => setHandshake(null)}
        dismissLabel="Keep discovering"
      />
    </SafeAreaView>
  );
};

interface PromptRowProps {
  label: string;
  value?: string | null;
}

const PromptRow: React.FC<PromptRowProps> = ({ label, value }) => {
  const colors = useThemeColors();
  if (!value) return null;

  return (
    <View style={[localStyles.promptRow, { borderColor: colors.border }]}>
      <Text
        style={[
          typography.label,
          { color: colors.textPrimary, marginBottom: spacing.xs },
        ]}
      >
        {label}
      </Text>
      <Text style={[typography.body, { color: colors.textSecondary }]}>
        {value}
      </Text>
    </View>
  );
};

const formatExperience = (level: Profile["experience_level"]) => {
  const labels: Record<Profile["experience_level"], string> = {
    student: "Student",
    early: "Early career",
    mid: "Mid career",
    senior: "Senior",
    founder: "Founder",
  };

  return labels[level];
};

const localStyles = StyleSheet.create({
  centerContent: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  content: {
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  heroWrap: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 28,
    overflow: "hidden",
    marginBottom: spacing.lg,
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  heroInitial: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 120,
    fontWeight: "800",
  },
  heroInfo: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
  },
  heroName: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  heroMeta: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 2,
  },
  heroSub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    marginTop: 2,
  },
  interestBadge: {
    position: "absolute",
    top: spacing.lg,
    left: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(236,72,153,0.92)",
  },
  interestBadgeEmoji: {
    fontSize: 13,
  },
  interestBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  interestsBlock: {
    marginTop: spacing.xl,
  },
  interestChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  interestChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
  },
  interestChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  prompts: {
    marginTop: spacing.xl,
  },
  promptRow: {
    borderBottomWidth: 1,
    paddingBottom: spacing.lg,
    marginBottom: spacing.lg,
  },
  result: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  singleAction: {
    marginTop: spacing.xl,
    minWidth: 160,
  },
});
