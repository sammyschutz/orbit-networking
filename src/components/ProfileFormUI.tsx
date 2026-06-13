import {
  borderRadius,
  elevation,
  gradients,
  spacing,
  typography,
  type ColorScheme,
} from "@constants/theme";
import { Feather } from "@expo/vector-icons";
import { Profile } from "@services/supabase";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Shared profile-form building blocks, so the Edit Profile screen and the
 * onboarding flow look and behave identically.
 */

export const EXPERIENCE_OPTIONS: {
  value: Profile["experience_level"];
  label: string;
}[] = [
  { value: "student", label: "Student" },
  { value: "early", label: "Early career" },
  { value: "mid", label: "Mid-career" },
  { value: "senior", label: "Senior" },
  { value: "founder", label: "Founder" },
];

interface AvatarHeroProps {
  colors: ColorScheme;
  uri: string | null;
  initial: string;
  name: string;
  meta: string;
  hint?: string;
  onPress: () => void;
  onImageError?: () => void;
}

/** Brand-gradient header with a tappable circular avatar + live identity. */
export const AvatarHero: React.FC<AvatarHeroProps> = ({
  colors,
  uri,
  initial,
  name,
  meta,
  hint,
  onPress,
  onImageError,
}) => (
  <LinearGradient
    colors={gradients.brand}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={styles.hero}
  >
    <Pressable
      onPress={onPress}
      accessibilityLabel="Change profile photo"
      accessibilityRole="button"
      style={styles.avatarWrap}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.avatar}
          resizeMode="cover"
          onError={onImageError}
        />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Text style={styles.avatarInitial}>{initial}</Text>
        </View>
      )}
      <View
        style={[
          styles.cameraBadge,
          { backgroundColor: colors.primary, borderColor: "#FFFFFF" },
        ]}
      >
        <Feather name="camera" size={14} color="#FFFFFF" />
      </View>
    </Pressable>

    <Text style={styles.heroName} numberOfLines={1}>
      {name}
    </Text>
    <Text style={styles.heroMeta} numberOfLines={1}>
      {meta}
    </Text>
    {hint ? <Text style={styles.heroHint}>{hint}</Text> : null}
  </LinearGradient>
);

interface SectionCardProps {
  colors: ColorScheme;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/**
 * Elevated card with an icon + title header. Module-level (not defined inside a
 * screen's render) so it never remounts its children and drops input focus.
 */
export const SectionCard: React.FC<SectionCardProps> = ({
  colors,
  icon,
  title,
  subtitle,
  children,
}) => (
  <View
    style={[
      styles.section,
      { backgroundColor: colors.surfaceCard, ...elevation.sm },
    ]}
  >
    <View style={styles.sectionHeader}>
      <View
        style={[styles.sectionIcon, { backgroundColor: colors.primary + "1F" }]}
      >
        <Feather name={icon} size={15} color={colors.primary} />
      </View>
      <View style={styles.flex1}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
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

interface ExperienceChipsProps {
  colors: ColorScheme;
  value: Profile["experience_level"];
  onChange: (value: Profile["experience_level"]) => void;
}

/** Pill-style single-select for experience level. */
export const ExperienceChips: React.FC<ExperienceChipsProps> = ({
  colors,
  value,
  onChange,
}) => (
  <View style={styles.chipRow}>
    {EXPERIENCE_OPTIONS.map(({ value: level, label }) => {
      const isSelected = value === level;
      return (
        <Pressable
          key={level}
          style={[
            styles.chip,
            {
              backgroundColor: isSelected ? colors.primary : colors.surfaceInput,
              borderColor: isSelected ? colors.primary : colors.border,
            },
          ]}
          onPress={() => onChange(level)}
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
          accessibilityLabel={`Select ${label} experience level`}
        >
          <Text
            style={[
              styles.chipText,
              { color: isSelected ? "#FFFFFF" : colors.textPrimary },
            ]}
          >
            {label}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  flex1: { flex: 1 },
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
});
