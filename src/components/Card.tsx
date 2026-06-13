import { Avatar } from "@components/Avatar";
import {
  borderRadius,
  elevation,
  gradients,
  spacing,
  typography,
  useThemeColors,
} from "@constants/theme";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

interface CardProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Base Card component with design system elevation and styling
 */
export const Card: React.FC<CardProps> = ({ children, style, testID }) => {
  const colors = useThemeColors();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surfaceCard,
          ...elevation.md,
        },
        style,
      ]}
      testID={testID}
    >
      {children}
    </View>
  );
};

const EXPERIENCE_LABELS: Record<string, string> = {
  student: "Student",
  early: "Early career",
  mid: "Mid-career",
  senior: "Senior",
  founder: "Founder",
};

interface ProfileCardProps {
  image?: string;
  name: string;
  title: string;
  industry: string;
  bio?: string;
  prompt?: string;
  experience?: string;
  // "Why you're seeing them" transparency payload (discover-algorithm spec §7).
  sharedInterests?: string[] | null;
  distanceMiles?: number | null;
  isNearby?: boolean;
  isSameCity?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Info-first profile card for Discover (handshake revamp §5).
 * The person's role, bio, and conversation prompt lead; the photo is a
 * 72px avatar beside the name. Tapping the card opens the full profile,
 * where the larger photo lives.
 */
export const ProfileCard: React.FC<ProfileCardProps> = ({
  image,
  name,
  title,
  industry,
  bio,
  prompt,
  experience,
  sharedInterests,
  distanceMiles,
  isNearby,
  isSameCity,
  onPress,
  style,
  testID,
}) => {
  const colors = useThemeColors();
  const experienceLabel = experience
    ? EXPERIENCE_LABELS[experience] ?? experience
    : null;

  // At most one line of "why" chips, overlap first; nothing renders without a
  // real signal — fake reasons would break trust in the whole conceit.
  const overlap = (sharedInterests ?? []).slice(0, 2);
  const locality = isSameCity
    ? "Same city"
    : isNearby && distanceMiles != null
      ? `~${Math.max(1, Math.round(distanceMiles))} mi away`
      : null;
  const hasWhy = overlap.length > 0 || locality != null;

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={onPress ? `View ${name}'s full profile` : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.profileCard,
        { backgroundColor: colors.surfaceCard },
        pressed && onPress ? { opacity: 0.96 } : null,
        style,
      ]}
      testID={testID}
    >
      {/* Header: avatar beside identity */}
      <View style={styles.profileHeader}>
        <Avatar uri={image} name={name} size={72} radius={24} />
        <View style={styles.profileIdentity}>
          <Text
            style={[styles.profileName, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {name}
          </Text>
          <Text
            style={[styles.profileTitle, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <View style={styles.metaRow}>
            {industry ? (
              <Text
                style={[typography.caption, { color: colors.textTertiary }]}
                numberOfLines={1}
              >
                {industry}
              </Text>
            ) : null}
            {experienceLabel ? (
              <View
                style={[styles.pill, { backgroundColor: colors.surfaceInput }]}
              >
                <Feather name="award" size={11} color={colors.textSecondary} />
                <Text style={[styles.pillText, { color: colors.textSecondary }]}>
                  {experienceLabel}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Why you're seeing them — your algorithm, visibly obeying */}
      {hasWhy ? (
        <View style={styles.whyRow}>
          {overlap.length > 0 ? (
            <View
              style={[styles.whyChip, { backgroundColor: colors.primary + "1A" }]}
            >
              <Text style={[styles.whyChipText, { color: colors.primary }]}>
                ✦ You both: {overlap.join(" · ")}
              </Text>
            </View>
          ) : null}
          {locality ? (
            <View
              style={[styles.whyChip, { backgroundColor: colors.surfaceInput }]}
            >
              <Text
                style={[styles.whyChipText, { color: colors.textSecondary }]}
              >
                ◦ {locality}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Bio is the hero text */}
      {bio ? (
        <Text
          style={[styles.profileBio, { color: colors.textPrimary }]}
          numberOfLines={5}
        >
          {bio}
        </Text>
      ) : null}

      {/* Conversation starter — the largest element after the name */}
      {prompt ? (
        <View style={styles.promptBlock}>
          <View style={styles.promptLabelRow}>
            <Feather
              name="message-circle"
              size={14}
              color={colors.textSecondary}
            />
            <Text style={[typography.label, { color: colors.textSecondary }]}>
              Ask me about…
            </Text>
          </View>
          <View
            style={[
              styles.promptChip,
              {
                backgroundColor: colors.surfaceInput,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[styles.promptText, { color: colors.textPrimary }]}
              numberOfLines={3}
            >
              {prompt}
            </Text>
          </View>
        </View>
      ) : null}

      {onPress ? (
        <View style={styles.moreRow}>
          <Text style={[typography.caption, { color: colors.textTertiary }]}>
            View full profile
          </Text>
          <Feather name="chevron-right" size={14} color={colors.textTertiary} />
        </View>
      ) : null}
    </Pressable>
  );
};

interface ConnectionCardProps {
  image?: string;
  name: string;
  title: string;
  industry: string;
  matchedDate?: string;
  isNew?: boolean;
  onPress?: () => void;
  testID?: string;
}

/**
 * Connection card for the connections list. Compact tile with avatar,
 * gradient "new" badge, and a chevron affordance.
 */
export const ConnectionCard: React.FC<ConnectionCardProps> = ({
  image,
  name,
  title,
  industry,
  matchedDate,
  isNew = false,
  testID,
}) => {
  const colors = useThemeColors();

  return (
    <View
      style={[
        styles.connectionCard,
        { backgroundColor: colors.surfaceCard, ...elevation.md },
      ]}
      testID={testID}
    >
      <Avatar uri={image} name={name} size={60} radius={18} />

      <View style={styles.connectionInfo}>
        <View style={styles.connectionNameRow}>
          <Text
            style={[styles.connectionName, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {name}
          </Text>
          {isNew && (
            <LinearGradient
              colors={gradients.like}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.newBadge}
            >
              <Text style={styles.newBadgeText}>NEW</Text>
            </LinearGradient>
          )}
        </View>

        <Text
          style={[styles.connectionTitle, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {title}
          {industry ? `  ·  ${industry}` : ""}
        </Text>

        {matchedDate ? (
          <Text
            style={[styles.connectionDate, { color: colors.textTertiary }]}
            numberOfLines={1}
          >
            {matchedDate}
          </Text>
        ) : null}
      </View>

      <Feather name="chevron-right" size={22} color={colors.textTertiary} />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    overflow: "hidden",
  },
  profileCard: {
    width: "100%",
    borderRadius: 28,
    overflow: "hidden",
    padding: spacing.xl,
    ...elevation.xl,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  profileIdentity: {
    flex: 1,
    gap: 2,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.lg,
  },
  whyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  whyChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
  },
  whyChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  profileName: {
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  profileTitle: {
    ...typography.body,
    fontWeight: "600",
  },
  profileBio: {
    ...typography.body,
    lineHeight: 24,
  },
  promptBlock: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  promptLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  promptChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  promptText: {
    ...typography.body,
    fontWeight: "600",
    lineHeight: 23,
  },
  moreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
    marginTop: spacing.lg,
  },
  connectionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 22,
  },
  connectionInfo: {
    flex: 1,
  },
  connectionNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: 3,
  },
  connectionName: {
    ...typography.title,
    fontSize: 18,
    flexShrink: 1,
  },
  newBadge: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  newBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  connectionTitle: {
    ...typography.body,
    fontSize: 14,
    marginBottom: 2,
  },
  connectionDate: {
    ...typography.caption,
  },
});
