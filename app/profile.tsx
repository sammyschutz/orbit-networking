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
import { Profile, supabase, SUPABASE_BUCKET } from "@services/supabase";
import { useAppStore } from "@store/appStore";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
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

  const initial = (displayName.trim().charAt(0) || "?").toUpperCase();
  const metaPreview = [roleTitle.trim(), industry.trim()]
    .filter(Boolean)
    .join(" · ");

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.surfaceBg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={localStyles.flex1}
      >
        <ScrollView
          contentContainerStyle={localStyles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Gradient hero with the tappable avatar + a live identity preview */}
          <AvatarHero
            colors={colors}
            uri={resolvedPhotoUri}
            initial={initial}
            name={displayName.trim() || "Your name"}
            meta={metaPreview || "Add your role & industry"}
            hint="Tap the photo to change it"
            onPress={handlePickImage}
            onImageError={() => setImageError(true)}
          />

          {/* Basics */}
          <SectionCard colors={colors} icon="user" title="The basics">
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

            <Text style={[localStyles.fieldLabel, { color: colors.textPrimary }]}>
              Experience level
            </Text>
            <ExperienceChips
              colors={colors}
              value={experienceLevel}
              onChange={setExperienceLevel}
            />
          </SectionCard>

          {/* About */}
          <SectionCard
            colors={colors}
            icon="edit-3"
            title="About you"
            subtitle="A quick snapshot people see first"
          >
            <TextInput
              placeholder="Share a quick career snapshot"
              value={bio}
              onChangeText={setBio}
              multiline
            />
          </SectionCard>

          {/* Conversation starters */}
          <SectionCard
            colors={colors}
            icon="message-circle"
            title="Conversation starters"
            subtitle="Optional — give people an easy way in"
          >
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
          </SectionCard>

          {error ? (
            <View
              style={[
                localStyles.errorBanner,
                { backgroundColor: colors.error + "14", borderColor: colors.error },
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

          <View style={localStyles.buttonGroup}>
            <Button title="Save changes" loading={saving} onPress={handleSave} />
            <Pressable
              onPress={() => router.back()}
              disabled={saving}
              accessibilityRole="button"
              style={localStyles.cancelButton}
            >
              <Text style={[localStyles.cancelText, { color: colors.textSecondary }]}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  flex1: { flex: 1 },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  fieldLabel: {
    ...typography.label,
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
  buttonGroup: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  cancelButton: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  cancelText: {
    ...typography.label,
    fontSize: 15,
  },
});
