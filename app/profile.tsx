import { Button } from "@components/Button";
import { TextInput } from "@components/TextInput";
import {
    borderRadius,
    createStyles,
    elevation,
    gradients,
    spacing,
    typography,
    useThemeColors,
    type ColorScheme,
} from "@constants/theme";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@hooks/useAuth";
import { Profile, supabase, SUPABASE_BUCKET } from "@services/supabase";
import { useAppStore } from "@store/appStore";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    Alert,
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

const EXPERIENCE_OPTIONS: {
  value: Profile["experience_level"];
  label: string;
}[] = [
  { value: "student", label: "Student" },
  { value: "early", label: "Early career" },
  { value: "mid", label: "Mid-career" },
  { value: "senior", label: "Senior" },
  { value: "founder", label: "Founder" },
];

// Module-level so it isn't recreated on every render (that would remount its
// children and drop TextInput focus mid-keystroke).
const SectionCard: React.FC<{
  colors: ColorScheme;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ colors, icon, title, subtitle, children }) => (
  <View
    style={[
      localStyles.section,
      { backgroundColor: colors.surfaceCard, ...elevation.sm },
    ]}
  >
    <View style={localStyles.sectionHeader}>
      <View
        style={[localStyles.sectionIcon, { backgroundColor: colors.primary + "1F" }]}
      >
        <Feather name={icon} size={15} color={colors.primary} />
      </View>
      <View style={localStyles.flex1}>
        <Text style={[localStyles.sectionTitle, { color: colors.textPrimary }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[typography.caption, { color: colors.textTertiary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
    {children}
  </View>
);

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
          <LinearGradient
            colors={gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={localStyles.hero}
          >
            <Pressable
              onPress={handlePickImage}
              accessibilityLabel="Change profile photo"
              accessibilityRole="button"
              style={localStyles.avatarWrap}
            >
              {resolvedPhotoUri ? (
                <Image
                  source={{ uri: resolvedPhotoUri }}
                  style={localStyles.avatar}
                  resizeMode="cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <View style={[localStyles.avatar, localStyles.avatarPlaceholder]}>
                  <Text style={localStyles.avatarInitial}>{initial}</Text>
                </View>
              )}
              <View
                style={[
                  localStyles.cameraBadge,
                  { backgroundColor: colors.primary, borderColor: "#FFFFFF" },
                ]}
              >
                <Feather name="camera" size={14} color="#FFFFFF" />
              </View>
            </Pressable>

            <Text style={localStyles.heroName} numberOfLines={1}>
              {displayName.trim() || "Your name"}
            </Text>
            <Text style={localStyles.heroMeta} numberOfLines={1}>
              {metaPreview || "Add your role & industry"}
            </Text>
            <Text style={localStyles.heroHint}>Tap the photo to change it</Text>
          </LinearGradient>

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
            <View style={localStyles.chipRow}>
              {EXPERIENCE_OPTIONS.map(({ value, label }) => {
                const isSelected = experienceLevel === value;
                return (
                  <Pressable
                    key={value}
                    style={[
                      localStyles.chip,
                      {
                        backgroundColor: isSelected
                          ? colors.primary
                          : colors.surfaceInput,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setExperienceLevel(value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Select ${label} experience level`}
                  >
                    <Text
                      style={[
                        localStyles.chipText,
                        { color: isSelected ? "#FFFFFF" : colors.textPrimary },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
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
  hero: {
    alignItems: "center",
    borderRadius: 28,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    ...elevation.lg,
  },
  avatarWrap: {
    width: 112,
    height: 112,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.7)",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#FFFFFF",
    fontSize: 44,
    fontWeight: "800",
  },
  cameraBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    ...elevation.sm,
  },
  heroName: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  heroMeta: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 2,
  },
  heroHint: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    marginTop: spacing.sm,
  },
  section: {
    borderRadius: 22,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sectionIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  fieldLabel: {
    ...typography.label,
    marginBottom: spacing.md,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    minHeight: 36,
    justifyContent: "center",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
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
