import { Button } from "@components/Button";
import { TextInput } from "@components/TextInput";
import {
    createStyles,
    spacing,
    typography,
    useThemeColors,
} from "@constants/theme";
import { useAuth } from "@hooks/useAuth";
import { Profile, supabase, SUPABASE_BUCKET } from "@services/supabase";
import { useAppStore } from "@store/appStore";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    Alert,
    Image,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

const EXPERIENCE_LEVELS = [
  "student",
  "early",
  "mid",
  "senior",
  "founder",
] as const;

export default function ProfileScreen() {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const router = useRouter();
  const { user } = useAuth();
  const { currentProfile, profileLoading, updateProfile } = useAppStore();

  const [displayName, setDisplayName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [industry, setIndustry] = useState("");
  const [experienceLevel, setExperienceLevel] =
    useState<Profile["experience_level"]>("early");
  const [bio, setBio] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [askMeAbout, setAskMeAbout] = useState("");
  const [learningAbout, setLearningAbout] = useState("");
  const [sideProject, setSideProject] = useState("");
  const [imageError, setImageError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentProfile) return;
    setDisplayName(currentProfile.display_name ?? "");
    setRoleTitle(currentProfile.role_title ?? "");
    setIndustry(currentProfile.industry ?? "");
    setExperienceLevel(currentProfile.experience_level ?? "early");
    setBio(currentProfile.bio ?? "");
    setPhotoUri(currentProfile.photo_url ?? null);
    setAskMeAbout(currentProfile.ask_me_about ?? "");
    setLearningAbout(currentProfile.learning_about ?? "");
    setSideProject(currentProfile.side_project ?? "");
    setImageError(false);
  }, [currentProfile]);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [2, 3],
      quality: 0.75,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setPhotoUri(result.assets[0].uri);
      setImageError(false);
    }
  };

  const extractStoragePath = (url: string) => {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname;
      const match = path.match(
        /storage\/v1\/object\/(?:public|private)\/[a-zA-Z0-9-_]+\/(.+)$/,
      );
      return match?.[1] ?? null;
    } catch {
      return null;
    }
  };

  const fetchSignedUrl = async (publicUrl: string) => {
    const objectPath = extractStoragePath(publicUrl);
    if (!objectPath) return null;

    const { data, error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .createSignedUrl(objectPath, 60);

    if (error || !data?.signedUrl) {
      console.warn("Failed to get signed url for profile photo:", error);
      return null;
    }

    return data.signedUrl;
  };

  const [resolvedPhotoUri, setResolvedPhotoUri] = useState<string | null>(null);

  useEffect(() => {
    if (!photoUri) {
      setResolvedPhotoUri(null);
      return;
    }

    if (!photoUri.startsWith("http")) {
      setResolvedPhotoUri(photoUri);
      return;
    }

    if (!imageError) {
      setResolvedPhotoUri(photoUri);
      return;
    }

    let active = true;
    const load = async () => {
      const signedUrl = await fetchSignedUrl(photoUri);
      if (active) {
        setResolvedPhotoUri(signedUrl ?? photoUri);
      }
    };
    load();

    return () => {
      active = false;
    };
  }, [photoUri, imageError]);

  const uploadPhoto = async (uri: string): Promise<string> => {
    if (!user)
      throw new Error("Unable to upload photo without an authenticated user.");

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
      throw uploadError ?? new Error("Failed to upload profile photo.");
    }

    const { data: publicUrlData } = supabase.storage
      .from(SUPABASE_BUCKET)
      .getPublicUrl(filename);

    if (!publicUrlData?.publicUrl) {
      throw new Error("Failed to generate public photo URL.");
    }

    return publicUrlData.publicUrl;
  };

  const handleSave = async () => {
    if (
      !displayName.trim() ||
      !roleTitle.trim() ||
      !industry.trim() ||
      !bio.trim()
    ) {
      setError("Please fill out your name, role, industry, and bio.");
      return;
    }
    if (!photoUri) {
      setError("Please upload a profile photo.");
      return;
    }

    setError(null);
    setSaving(true);

    try {
      let savedPhotoUrl = photoUri;
      if (photoUri && !photoUri.startsWith("http")) {
        savedPhotoUrl = await uploadPhoto(photoUri);
      }

      await updateProfile({
        display_name: displayName.trim(),
        role_title: roleTitle.trim(),
        industry: industry.trim(),
        experience_level: experienceLevel,
        bio: bio.trim(),
        photo_url: savedPhotoUrl,
        ask_me_about: askMeAbout.trim() || null,
        learning_about: learningAbout.trim() || null,
        side_project: sideProject.trim() || null,
        is_complete: true,
      });

      Alert.alert("Saved", "Your profile was updated successfully.");
      router.back();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to save profile.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (profileLoading) {
    return (
      <SafeAreaView
        style={[
          styles.screen,
          localStyles.centered,
          { backgroundColor: colors.surfaceBg },
        ]}
      >
        <Text style={[typography.body, { color: colors.textPrimary }]}>
          Loading profile…
        </Text>
      </SafeAreaView>
    );
  }

  if (!currentProfile) {
    return (
      <SafeAreaView
        style={[
          styles.screen,
          localStyles.centered,
          { backgroundColor: colors.surfaceBg },
        ]}
      >
        <Text style={[typography.body, { color: colors.textPrimary }]}>
          No profile found. Please complete onboarding first.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: colors.surfaceBg }]}
    >
      <ScrollView
        contentContainerStyle={localStyles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={[
            typography.headline,
            { color: colors.textPrimary, marginBottom: spacing.lg },
          ]}
        >
          Edit profile
        </Text>

        <Text
          style={[
            typography.label,
            { color: colors.textSecondary, marginBottom: spacing.sm },
          ]}
        >
          Profile photo
        </Text>
        <Pressable
          style={[localStyles.photoContainer, { borderColor: colors.border }]}
          onPress={handlePickImage}
          accessibilityLabel="Change profile photo"
          accessibilityRole="button"
        >
          {resolvedPhotoUri ? (
            <Image
              source={{ uri: resolvedPhotoUri }}
              style={localStyles.photo}
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={localStyles.photoPlaceholder}>
              <Text
                style={[
                  typography.body,
                  { color: colors.textSecondary, textAlign: "center" },
                ]}
              >
                Tap to add a photo
              </Text>
            </View>
          )}
        </Pressable>
        <Text
          style={[
            typography.caption,
            { color: colors.textSecondary, marginBottom: spacing.lg },
          ]}
        >
          Tap the photo to choose a new image from your library.
        </Text>

        <TextInput
          label="Name"
          placeholder="Your name"
          value={displayName}
          onChangeText={setDisplayName}
        />
        <TextInput
          label="Role / title"
          placeholder="Product designer, engineer, etc."
          value={roleTitle}
          onChangeText={setRoleTitle}
        />
        <TextInput
          label="Industry"
          placeholder="Design, finance, healthcare"
          value={industry}
          onChangeText={setIndustry}
        />

        <View style={localStyles.row}>
          {EXPERIENCE_LEVELS.map((level, index) => {
            const isSelected = experienceLevel === level;
            return (
              <Pressable
                key={level}
                style={[
                  localStyles.chip,
                  index !== EXPERIENCE_LEVELS.length - 1 &&
                    localStyles.chipSpacing,
                  {
                    backgroundColor: isSelected
                      ? colors.primary
                      : colors.surfaceInput,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setExperienceLevel(level)}
                accessibilityRole="button"
                accessibilityLabel={`Select ${level} experience level`}
              >
                <Text
                  style={{
                    ...typography.caption,
                    color: isSelected ? "#ffffff" : colors.textPrimary,
                  }}
                >
                  {level}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          label="Bio"
          placeholder="Share a quick career snapshot"
          value={bio}
          onChangeText={setBio}
          multiline
        />

        <TextInput
          label="Ask me about"
          placeholder="e.g. career transitions, building habits"
          value={askMeAbout}
          onChangeText={setAskMeAbout}
        />

        <TextInput
          label="I’m learning about"
          placeholder="e.g. product strategy, frontend"
          value={learningAbout}
          onChangeText={setLearningAbout}
        />

        <TextInput
          label="My side project"
          placeholder="Tell people what you're working on"
          value={sideProject}
          onChangeText={setSideProject}
        />

        {error ? (
          <Text style={[typography.caption, { color: colors.error, marginTop: spacing.sm }]}>
            {error}
          </Text>
        ) : null}

        <View style={localStyles.buttonGroup}>
          <View style={localStyles.actionItem}>
            <Button
              title="Save changes"
              loading={saving}
              onPress={handleSave}
            />
          </View>
          <View style={localStyles.actionItem}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => router.back()}
              disabled={saving}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  photoContainer: {
    width: 140,
    height: 140,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: spacing.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  photo: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f0f0f0",
  },
  photoPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.md,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: spacing.lg,
  },
  chip: {
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
  },
  chipSpacing: {
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  buttonGroup: {
    marginTop: spacing.lg,
    flexDirection: "column",
  },
  actionItem: {
    marginBottom: spacing.md,
  },
});
