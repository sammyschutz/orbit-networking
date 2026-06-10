import { Avatar } from "@components/Avatar";
import {
  avatarGradient,
  borderRadius,
  elevation,
  gradients,
  spacing,
  typography,
  useThemeColors,
} from "@constants/theme";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
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
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Full-bleed profile card for the discovery deck.
 * Photo fills the whole card with a gradient scrim; details sit over the
 * bottom of the image. Falls back to a colorful gradient + initial when the
 * photo is missing or fails to load.
 */
export const ProfileCard: React.FC<ProfileCardProps> = ({
  image,
  name,
  title,
  industry,
  bio,
  prompt,
  experience,
  style,
  testID,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !!image && !imgFailed;
  const [from, to] = avatarGradient(name);

  return (
    <View style={[styles.profileCard, style]} testID={testID}>
      {showImage ? (
        <Image
          source={{ uri: image }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={250}
          onError={() => setImgFailed(true)}
          testID={testID ? `${testID}:image` : undefined}
        />
      ) : (
        <LinearGradient
          colors={[from, to]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.fallback]}
        >
          <Text style={styles.fallbackInitial}>
            {(name?.charAt(0) || "?").toUpperCase()}
          </Text>
        </LinearGradient>
      )}

      {/* Legibility scrim */}
      <LinearGradient
        colors={gradients.photoScrim}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Experience pill */}
      {experience && (
        <View style={styles.pill}>
          <Feather name="award" size={12} color="#FFFFFF" />
          <Text style={styles.pillText}>
            {EXPERIENCE_LABELS[experience] ?? experience}
          </Text>
        </View>
      )}

      {/* Bottom info */}
      <View style={styles.profileInfo}>
        <Text style={styles.profileName} numberOfLines={1}>
          {name}
        </Text>

        <View style={styles.metaRow}>
          <Feather name="briefcase" size={13} color="rgba(255,255,255,0.9)" />
          <Text style={styles.profileTitle} numberOfLines={1}>
            {title}
            {industry ? `  ·  ${industry}` : ""}
          </Text>
        </View>

        {bio ? (
          <Text style={styles.profileBio} numberOfLines={2}>
            {bio}
          </Text>
        ) : null}

        {prompt ? (
          <View style={styles.promptChip}>
            <Feather name="message-circle" size={13} color="#FFFFFF" />
            <Text style={styles.promptText} numberOfLines={2}>
              {prompt}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
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
    height: "100%",
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#1E293B",
    ...elevation.xl,
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackInitial: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 140,
    fontWeight: "800",
  },
  pill: {
    position: "absolute",
    top: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    backgroundColor: "rgba(15,23,42,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  pillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  profileInfo: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  profileName: {
    fontSize: 30,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  profileTitle: {
    ...typography.body,
    color: "rgba(255,255,255,0.92)",
    flexShrink: 1,
    fontWeight: "600",
  },
  profileBio: {
    ...typography.body,
    color: "rgba(255,255,255,0.82)",
    lineHeight: 21,
  },
  promptChip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  promptText: {
    ...typography.caption,
    color: "#FFFFFF",
    flex: 1,
    fontWeight: "500",
    lineHeight: 17,
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
