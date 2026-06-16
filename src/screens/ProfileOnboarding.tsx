import { CityTypeahead, InterestChips } from "@components/AlgorithmInputs";
import { Button } from "@components/Button";
import {
    AvatarHero,
    ExperienceChips,
    SectionCard,
} from "@components/ProfileFormUI";
import { TextInput } from "@components/TextInput";
import {
    borderRadius,
    createStyles,
    spacing,
    typography,
    useThemeColors,
} from "@constants/theme";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@hooks/useAuth";
import {
    City,
    Interest,
    MAX_INTERESTS,
    Profile,
    supabase,
    SUPABASE_BUCKET,
} from "@services/supabase";
import { useAppStore } from "@store/appStore";
import { normalizeLinkedInUrl } from "@utils/linkedin";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

interface ProfileOnboardingProps {
  onComplete?: () => void;
}

const ONBOARDING_STEPS = ["basic", "algorithm", "photo", "prompts"] as const;
type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/**
 * Profile onboarding flow
 * 1. Basic info (name, role, industry, experience level, bio)
 * 2. Build your algorithm (interests + city — skippable)
 * 3. Photo upload
 * 4. Optional prompts (ask_me_about, learning_about, side_project)
 */
export const ProfileOnboarding: React.FC<ProfileOnboardingProps> = ({
  onComplete,
}) => {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const { currentProfile, updateProfile, profileLoading } = useAppStore();

  const [step, setStep] = useState<OnboardingStep>("basic");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // "Build your algorithm" step — held locally and written on completion,
  // since the profile row doesn't exist until the final save.
  const [curatedInterests, setCuratedInterests] = useState<Interest[]>([]);
  const [selectedInterestIds, setSelectedInterestIds] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);

  useEffect(() => {
    supabase
      .from("interests")
      .select("*")
      .eq("curated", true)
      .order("name")
      .then(({ data }) => setCuratedInterests((data as Interest[]) ?? []));
  }, []);

  const toggleOnboardingInterest = (interest: Interest) => {
    setSelectedInterestIds((ids) =>
      ids.includes(interest.id)
        ? ids.filter((id) => id !== interest.id)
        : ids.length >= MAX_INTERESTS
          ? ids
          : [...ids, interest.id],
    );
  };

  // Basic info
  const [displayName, setDisplayName] = useState(
    currentProfile?.display_name ?? "",
  );
  const [roleTitle, setRoleTitle] = useState(currentProfile?.role_title ?? "");
  const [industry, setIndustry] = useState(currentProfile?.industry ?? "");
  const [experienceLevel, setExperienceLevel] = useState<
    Profile["experience_level"]
  >(currentProfile?.experience_level ?? "early");
  const [bio, setBio] = useState(currentProfile?.bio ?? "");

  // Photo
  const [photoUri, setPhotoUri] = useState<string | null>(
    currentProfile?.photo_url ?? null,
  );

  // Prompts
  const [askMeAbout, setAskMeAbout] = useState(
    currentProfile?.ask_me_about ?? "",
  );
  const [learningAbout, setLearningAbout] = useState(
    currentProfile?.learning_about ?? "",
  );
  const [sideProject, setSideProject] = useState(
    currentProfile?.side_project ?? "",
  );
  const [linkedinUrl, setLinkedinUrl] = useState(
    currentProfile?.linkedin_url ?? "",
  );

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [2, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri: string): Promise<string | null> => {
    if (!user) return null;

    try {
      const extension = uri.split(".").pop()?.split("?")[0] ?? "jpg";
      const basename = `${user.id}-profile-${Date.now()}.${extension}`;
      const filename = `${user.id}/${basename}`;
      const response = await fetch(uri);
      const buffer = await response.arrayBuffer();
      const fileData = new Uint8Array(buffer);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(filename, fileData, {
          cacheControl: "3600",
          upsert: true,
          contentType: `image/${extension}`,
        });

      if (uploadError || !uploadData) {
        throw uploadError ?? new Error("Upload failed");
      }

      const { data: publicUrlData } = supabase.storage
        .from(SUPABASE_BUCKET)
        .getPublicUrl(filename);

      if (!publicUrlData?.publicUrl) {
        throw new Error("Failed to generate public URL");
      }

      return publicUrlData.publicUrl;
    } catch (err) {
      console.error("Photo upload failed:", err);
      return null;
    }
  };

  const handleContinue = async () => {
    if (step === "basic") {
      if (!displayName || !roleTitle || !industry || !bio) {
        setError("Please fill in all fields");
        return;
      }
      setError("");
      setStep("algorithm");
      return;
    }

    if (step === "algorithm") {
      // Skippable by design — the algorithm works untuned.
      setError("");
      setStep("photo");
      return;
    }

    if (step === "photo") {
      // A photo is optional — every avatar falls back to initials without one.
      setError("");
      setStep("prompts");
      return;
    }

    if (step === "prompts") {
      if (authLoading) {
        setError("Still checking authentication. Please wait a moment.");
        return;
      }
      if (!user) {
        setError("Unable to complete profile: no authenticated user found.");
        return;
      }

      // LinkedIn is optional, but anything entered must be a valid profile URL
      // so the connection-screen Connect button never opens a broken link.
      const trimmedLinkedin = linkedinUrl.trim();
      const normalizedLinkedin = trimmedLinkedin
        ? normalizeLinkedInUrl(trimmedLinkedin)
        : null;
      if (trimmedLinkedin && !normalizedLinkedin) {
        setError(
          "Enter a valid LinkedIn profile URL, e.g. linkedin.com/in/your-name",
        );
        return;
      }

      setError("");
      setLoading(true);

      try {
        let uploadedPhotoUrl = photoUri;
        if (photoUri && !photoUri.startsWith("http")) {
          const uploadedUrl = await uploadPhoto(photoUri);
          if (!uploadedUrl) {
            throw new Error("Photo upload failed. Please try again.");
          }
          uploadedPhotoUrl = uploadedUrl;
        }

        const updates = {
          display_name: displayName,
          role_title: roleTitle,
          industry,
          experience_level: experienceLevel as Profile["experience_level"],
          bio,
          // Optional — stored as "" when skipped (the column is NOT NULL).
          photo_url: uploadedPhotoUrl ?? "",
          ask_me_about: askMeAbout || null,
          learning_about: learningAbout || null,
          side_project: sideProject || null,
          linkedin_url: normalizedLinkedin,
          city_id: selectedCity?.id ?? null,
          is_complete: true,
        };

        await updateProfile(updates);

        // Interest selections from the algorithm step. Non-fatal: the profile
        // is complete either way, and they can re-pick in My Algorithm.
        if (selectedInterestIds.length > 0) {
          const { error: interestsError } = await supabase
            .from("user_interests")
            .upsert(
              selectedInterestIds.map((interest_id) => ({
                user_id: user.id,
                interest_id,
              })),
              { onConflict: "user_id,interest_id", ignoreDuplicates: true },
            );
          if (interestsError) {
            console.error("Failed to save interests:", interestsError);
          }
        }

        onComplete?.();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to save profile";
        console.error("Profile onboarding save failed:", message, err);
        setError(message);
      } finally {
        setLoading(false);
      }
      return;
    }
  };

  const handleBack = () => {
    const index = ONBOARDING_STEPS.indexOf(step);
    if (index > 0) setStep(ONBOARDING_STEPS[index - 1]);
  };

  // Escape hatch: onboarding is otherwise a dead-end if you land here by
  // mistake (wrong account, a stale session that looks incomplete). Signing
  // out returns to the login screen; _layout's auth listener handles the nav,
  // and we replace explicitly as a fallback.
  const handleSignOut = () => {
    Alert.alert("Sign out?", "You'll return to the login screen.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut();
            router.replace("/auth");
          } catch (err: any) {
            Alert.alert("Error", err?.message || "Failed to sign out");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: colors.surfaceBg }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={localStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Escape hatch — onboarding has no tabs/Settings to reach. */}
          <View style={localStyles.topBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              onPress={handleSignOut}
              hitSlop={8}
            >
              <Text style={[typography.label, { color: colors.textSecondary }]}>
                Sign out
              </Text>
            </Pressable>
          </View>

          {/* Progress indicator */}
          <View style={localStyles.progressContainer}>
            {ONBOARDING_STEPS.map((s, idx) => (
              <View
                key={s}
                style={[
                  localStyles.progressStep,
                  {
                    backgroundColor:
                      step === s || ONBOARDING_STEPS.indexOf(step) > idx
                        ? colors.primary
                        : colors.surfaceInput,
                  },
                ]}
              />
            ))}
          </View>

          {/* Basic info step */}
          {step === "basic" && (
            <View style={localStyles.stepContent}>
              <Text style={[localStyles.stepTitle, { color: colors.textPrimary }]}>
                Build your profile
              </Text>
              <Text
                style={[localStyles.stepSubtitle, { color: colors.textSecondary }]}
              >
                This is what others see when you cross paths.
              </Text>

              <SectionCard colors={colors} icon="user" title="The basics">
                <TextInput
                  label="Your name"
                  placeholder="Jane Doe"
                  value={displayName}
                  onChangeText={setDisplayName}
                />
                <TextInput
                  label="Current role / title"
                  placeholder="e.g., Product Manager, Engineer"
                  value={roleTitle}
                  onChangeText={setRoleTitle}
                />
                <TextInput
                  label="Industry / field"
                  placeholder="e.g., Tech, Design, Finance"
                  value={industry}
                  onChangeText={setIndustry}
                />
                <Text
                  style={[localStyles.fieldLabel, { color: colors.textPrimary }]}
                >
                  Experience level
                </Text>
                <ExperienceChips
                  colors={colors}
                  value={experienceLevel}
                  onChange={setExperienceLevel}
                />
              </SectionCard>

              <SectionCard
                colors={colors}
                icon="edit-3"
                title="About you"
                subtitle="A quick snapshot people see first"
              >
                <TextInput
                  placeholder="Tell us a bit about yourself..."
                  value={bio}
                  onChangeText={setBio}
                  multiline
                />
              </SectionCard>
            </View>
          )}

          {/* Build your algorithm step (skippable) */}
          {step === "algorithm" && (
            <View style={localStyles.stepContent}>
              <Text style={[localStyles.stepTitle, { color: colors.textPrimary }]}>
                Build your algorithm
              </Text>
              <Text
                style={[localStyles.stepSubtitle, { color: colors.textSecondary }]}
              >
                Pick what you're into and where you are — Discover puts people
                who match first. You can tune this any time.
              </Text>

              <SectionCard
                colors={colors}
                icon="hash"
                title="Your interests"
                subtitle={`${selectedInterestIds.length} of ${MAX_INTERESTS} selected`}
              >
                <InterestChips
                  interests={curatedInterests}
                  selectedIds={selectedInterestIds}
                  onToggle={toggleOnboardingInterest}
                />
              </SectionCard>

              <SectionCard
                colors={colors}
                icon="map-pin"
                title="Where you are"
                subtitle="We only know the city you tell us — never your location"
              >
                <CityTypeahead value={selectedCity} onSelect={setSelectedCity} />
              </SectionCard>
            </View>
          )}

          {/* Photo step */}
          {step === "photo" && (
            <View style={localStyles.stepContent}>
              <Text style={[localStyles.stepTitle, { color: colors.textPrimary }]}>
                Add a photo
              </Text>
              <Text
                style={[localStyles.stepSubtitle, { color: colors.textSecondary }]}
              >
                Optional — a clear portrait helps people connect a face to your
                name, but you can add one later.
              </Text>

              <AvatarHero
                colors={colors}
                uri={photoUri}
                initial={(displayName.trim().charAt(0) || "?").toUpperCase()}
                name={displayName.trim() || "Your name"}
                meta={
                  [roleTitle.trim(), industry.trim()].filter(Boolean).join(" · ") ||
                  "Add your role & industry"
                }
                hint={photoUri ? "Tap the photo to change it" : "Tap to add your photo"}
                onPress={handlePickImage}
              />
            </View>
          )}

          {/* Prompts step */}
          {step === "prompts" && (
            <View style={localStyles.stepContent}>
              <Text style={[localStyles.stepTitle, { color: colors.textPrimary }]}>
                Tell us more
              </Text>
              <Text
                style={[localStyles.stepSubtitle, { color: colors.textSecondary }]}
              >
                Optional — these give people an easy way to start a conversation.
              </Text>

              <SectionCard
                colors={colors}
                icon="message-circle"
                title="Conversation starters"
              >
                <TextInput
                  label="Ask me about..."
                  placeholder="e.g., Building sustainable tech"
                  value={askMeAbout}
                  onChangeText={setAskMeAbout}
                />
                <TextInput
                  label="I'm learning about..."
                  placeholder="e.g., Product strategy, ML basics"
                  value={learningAbout}
                  onChangeText={setLearningAbout}
                />
                <TextInput
                  label="My side project"
                  placeholder="e.g., A community platform for freelancers"
                  value={sideProject}
                  onChangeText={setSideProject}
                />
                <TextInput
                  label="LinkedIn profile"
                  placeholder="linkedin.com/in/your-name"
                  helper="Shown as a Connect button once you're connected"
                  value={linkedinUrl}
                  onChangeText={setLinkedinUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </SectionCard>
            </View>
          )}

          {error ? (
            <View
              style={[
                localStyles.errorBanner,
                {
                  backgroundColor: colors.error + "14",
                  borderColor: colors.error,
                },
              ]}
            >
              <Feather name="alert-circle" size={16} color={colors.error} />
              <Text
                style={[typography.caption, localStyles.flex1, { color: colors.error }]}
              >
                {error}
              </Text>
            </View>
          ) : null}

          {/* Actions */}
          <View style={localStyles.actions}>
            {step !== "basic" && (
              <Button title="Back" onPress={handleBack} variant="secondary" />
            )}
            <Button
              title={
                step === "prompts"
                  ? "Complete profile"
                  : (step === "algorithm" &&
                      !selectedInterestIds.length &&
                      !selectedCity) ||
                    (step === "photo" && !photoUri)
                    ? "Skip for now"
                    : "Continue"
              }
              onPress={handleContinue}
              loading={loading}
              disabled={loading || profileLoading || authLoading}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const localStyles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingVertical: spacing.xl,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: spacing.lg,
  },
  progressContainer: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  progressStep: {
    flex: 1,
    height: 4,
    borderRadius: borderRadius.full,
  },
  stepContent: {
    marginBottom: spacing.xl,
  },
  stepTitle: {
    ...typography.headline,
    marginBottom: spacing.xs,
  },
  stepSubtitle: {
    ...typography.body,
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    ...typography.label,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  flex1: { flex: 1 },
  actions: {
    gap: spacing.md,
  },
});
