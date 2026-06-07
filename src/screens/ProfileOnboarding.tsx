import { Button } from "@components/Button";
import { TextInput } from "@components/TextInput";
import {
    borderRadius,
    createStyles,
    spacing,
    typography,
    useThemeColors,
} from "@constants/theme";
import { useAuth } from "@hooks/useAuth";
import { Profile, supabase, SUPABASE_BUCKET } from "@services/supabase";
import { useAppStore } from "@store/appStore";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
    Image,
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

const EXPERIENCE_LEVELS = [
  "student",
  "early",
  "mid",
  "senior",
  "founder",
] as const;

/**
 * Profile onboarding flow
 * 1. Basic info (name, role, industry, experience level, bio)
 * 2. Photo upload
 * 3. Optional prompts (ask_me_about, learning_about, side_project)
 */
export const ProfileOnboarding: React.FC<ProfileOnboardingProps> = ({
  onComplete,
}) => {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  const { user, loading: authLoading } = useAuth();
  const { currentProfile, updateProfile, profileLoading } = useAppStore();

  const [step, setStep] = useState<"basic" | "photo" | "prompts">("basic");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Basic info
  const [displayName, setDisplayName] = useState(
    currentProfile?.display_name ?? "",
  );
  const [roleTitle, setRoleTitle] = useState(currentProfile?.role_title ?? "");
  const [industry, setIndustry] = useState(currentProfile?.industry ?? "");
  const [experienceLevel, setExperienceLevel] = useState<string>(
    currentProfile?.experience_level ?? "early",
  );
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

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

      const { data: publicUrlData, error: publicUrlError } = supabase.storage
        .from(SUPABASE_BUCKET)
        .getPublicUrl(filename);

      if (publicUrlError || !publicUrlData?.publicUrl) {
        throw publicUrlError ?? new Error("Failed to generate public URL");
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
      setStep("photo");
      return;
    }

    if (step === "photo") {
      if (!photoUri) {
        setError("Please upload a profile photo");
        return;
      }
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
          photo_url: uploadedPhotoUrl,
          ask_me_about: askMeAbout || null,
          learning_about: learningAbout || null,
          side_project: sideProject || null,
          is_complete: true,
        };

        await updateProfile(updates);
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
    if (step === "photo") {
      setStep("basic");
    } else if (step === "prompts") {
      setStep("photo");
    }
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
          {/* Progress indicator */}
          <View style={localStyles.progressContainer}>
            {(["basic", "photo", "prompts"] as const).map((s, idx) => (
              <View
                key={s}
                style={[
                  localStyles.progressStep,
                  {
                    backgroundColor:
                      step === s ||
                      ["basic", "photo", "prompts"].indexOf(step) > idx
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
              <Text
                style={[
                  typography.headline,
                  {
                    color: colors.textPrimary,
                    marginBottom: spacing.lg,
                  },
                ]}
              >
                Build your profile
              </Text>

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

              {/* Experience level selector */}
              <Text
                style={[
                  typography.label,
                  {
                    color: colors.textPrimary,
                    marginBottom: spacing.md,
                  },
                ]}
              >
                Experience level
              </Text>
              <View style={localStyles.levelSelector}>
                {EXPERIENCE_LEVELS.map((level) => (
                  <Pressable
                    key={level}
                    onPress={() => setExperienceLevel(level)}
                    style={[
                      localStyles.levelButton,
                      {
                        backgroundColor:
                          experienceLevel === level
                            ? colors.primary
                            : colors.surfaceInput,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typography.caption,
                        {
                          color:
                            experienceLevel === level
                              ? "#FFFFFF"
                              : colors.textPrimary,
                        },
                      ]}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                label="Bio / what you do"
                placeholder="Tell us a bit about yourself..."
                value={bio}
                onChangeText={setBio}
                multiline
              />

              {error && (
                <Text
                  style={[
                    typography.caption,
                    {
                      color: colors.error,
                      marginBottom: spacing.lg,
                    },
                  ]}
                >
                  {error}
                </Text>
              )}
            </View>
          )}

          {/* Photo step */}
          {step === "photo" && (
            <View style={localStyles.stepContent}>
              <Text
                style={[
                  typography.headline,
                  {
                    color: colors.textPrimary,
                    marginBottom: spacing.lg,
                  },
                ]}
              >
                Add a photo
              </Text>

              <Pressable
                onPress={handlePickImage}
                style={[
                  localStyles.photoUpload,
                  {
                    backgroundColor: colors.surfaceInput,
                    borderColor: colors.border,
                  },
                ]}
              >
                {photoUri ? (
                  <Image
                    source={{ uri: photoUri }}
                    style={localStyles.photoPreview}
                  />
                ) : (
                  <View style={localStyles.photoPlaceholder}>
                    <Text
                      style={[
                        typography.body,
                        {
                          color: colors.textSecondary,
                          textAlign: "center",
                        },
                      ]}
                    >
                      Tap to select a portrait photo
                    </Text>
                  </View>
                )}
              </Pressable>

              <Text
                style={[
                  typography.caption,
                  {
                    color: colors.textSecondary,
                    textAlign: "center",
                    marginTop: spacing.md,
                  },
                ]}
              >
                Use a clear portrait photo. Good lighting helps!
              </Text>

              {error && (
                <Text
                  style={[
                    typography.caption,
                    {
                      color: colors.error,
                      marginBottom: spacing.lg,
                      marginTop: spacing.lg,
                    },
                  ]}
                >
                  {error}
                </Text>
              )}
            </View>
          )}

          {/* Prompts step */}
          {step === "prompts" && (
            <View style={localStyles.stepContent}>
              <Text
                style={[
                  typography.headline,
                  {
                    color: colors.textPrimary,
                    marginBottom: spacing.lg,
                  },
                ]}
              >
                Optional: Tell us more
              </Text>

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

              <Text
                style={[
                  typography.caption,
                  {
                    color: colors.textSecondary,
                    marginTop: spacing.lg,
                  },
                ]}
              >
                These help others find topics to discuss with you. You can skip
                this and edit later.
              </Text>
            </View>
          )}

          {error ? (
            <Text
              style={[
                typography.caption,
                {
                  color: colors.error,
                  marginBottom: spacing.lg,
                },
              ]}
            >
              {error}
            </Text>
          ) : null}

          {/* Actions */}
          <View style={localStyles.actions}>
            {step !== "basic" && (
              <Button title="Back" onPress={handleBack} variant="secondary" />
            )}
            <Button
              title={step === "prompts" ? "Complete profile" : "Continue"}
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
  levelSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  levelButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    minHeight: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  photoUpload: {
    width: "100%",
    height: 300,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
    overflow: "hidden",
  },
  photoPreview: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  photoPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  actions: {
    gap: spacing.md,
  },
});
