import { Button } from "@components/Button";
import {
    createStyles,
    gradients,
    spacing,
    typography,
    useThemeColors,
} from "@constants/theme";
import { Feather } from "@expo/vector-icons";
import { Profile, supabase } from "@services/supabase";
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
    submitSwipe,
    markNotificationRead,
    fetchCandidates,
    fetchConnections,
  } = useAppStore();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<"like" | "pass" | null>(
    null,
  );
  const [resultText, setResultText] = useState<string | null>(null);

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

  const handleSwipe = async (direction: "like" | "pass") => {
    if (!profile || actionLoading) return;

    setActionLoading(direction);
    setResultText(null);

    try {
      const result = await submitSwipe(profile.user_id, direction);
      if (notificationId) {
        await markNotificationRead(notificationId);
      }

      await fetchCandidates();

      if (direction === "like" && result?.is_match) {
        await fetchConnections();
        setResultText(`You and ${profile.display_name} are connected.`);
      } else if (direction === "like") {
        setResultText("Interest sent.");
      } else {
        setResultText("Profile passed.");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to save this action.";
      setResultText(message);
    } finally {
      setActionLoading(null);
    }
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
          <View style={localStyles.interestBadge}>
            <Feather name="heart" size={12} color="#FFFFFF" />
            <Text style={localStyles.interestBadgeText}>Wants to connect</Text>
          </View>
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

        {resultText?.includes("connected") ? (
          <Button
            title="View connections"
            onPress={() => router.replace("/(tabs)/connections")}
          />
        ) : (
          <View style={localStyles.actions}>
            <Button
              title="Pass"
              variant="danger"
              onPress={() => handleSwipe("pass")}
              loading={actionLoading === "pass"}
              disabled={!!actionLoading}
              style={localStyles.actionButton}
            />
            <Button
              title="Like"
              onPress={() => handleSwipe("like")}
              loading={actionLoading === "like"}
              disabled={!!actionLoading}
              style={localStyles.actionButton}
            />
          </View>
        )}
      </ScrollView>
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
  interestBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
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
