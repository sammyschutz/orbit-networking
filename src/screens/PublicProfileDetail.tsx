import { Button } from "@components/Button";
import {
    createStyles,
    spacing,
    typography,
    useThemeColors,
} from "@constants/theme";
import { Profile, supabase } from "@services/supabase";
import { useAppStore } from "@store/appStore";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
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
        {profile.photo_url ? (
          <Image
            source={{ uri: profile.photo_url }}
            style={localStyles.heroImage}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              localStyles.heroImage,
              localStyles.imagePlaceholder,
              { backgroundColor: colors.surfaceCard },
            ]}
          >
            <Text style={[typography.display, { color: colors.textSecondary }]}>
              {profile.display_name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <Text style={[typography.headline, { color: colors.textPrimary }]}>
          {profile.display_name}
        </Text>
        <Text
          style={[
            typography.body,
            { color: colors.textSecondary, marginTop: spacing.xs },
          ]}
        >
          {profile.role_title}
        </Text>
        <Text
          style={[
            typography.caption,
            { color: colors.textTertiary, marginTop: spacing.xs },
          ]}
        >
          {profile.industry} · {formatExperience(profile.experience_level)}
        </Text>

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
  heroImage: {
    aspectRatio: 2 / 3,
    borderRadius: 16,
    marginBottom: spacing.xl,
    width: "100%",
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
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
