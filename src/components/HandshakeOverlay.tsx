import { Avatar } from "@components/Avatar";
import { borderRadius, spacing, typography } from "@constants/theme";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const SCREEN_WIDTH = Dimensions.get("window").width;

// Timeline (§6.2): backdrop + avatars settle, hands meet center at CONTACT_MS
// (haptic + spark burst), joined hands shake, then copy + CTAs (~1.6 s).
const BACKDROP_MS = 300;
const HANDS_START_MS = 250;
const HANDS_FLY_MS = 500;
const CONTACT_MS = HANDS_START_MS + HANDS_FLY_MS;
const SHAKE_CYCLE_MS = 110;
const CONTENT_MS = 1600;

const SPARKS = [
  { x: -52, y: -34 },
  { x: 52, y: -34 },
  { x: -64, y: 10 },
  { x: 64, y: 10 },
  { x: -30, y: -58 },
  { x: 30, y: -58 },
];

interface HandshakeOverlayProps {
  visible: boolean;
  myName: string;
  myPhoto?: string | null;
  theirName: string;
  theirPhoto?: string | null;
  onSayHello: () => void;
  onDismiss: () => void;
  /** Secondary CTA label — "Keep discovering" on Discover. */
  dismissLabel?: string;
}

/**
 * Full-screen connect moment (handshake spec §6.2) replacing the match toast:
 * avatars settle top-center, two hands meet in the middle (medium haptic +
 * spark burst), the joined hands shake, then "You shook hands!" + CTAs.
 * Renders as a static card under OS reduced motion.
 */
export const HandshakeOverlay: React.FC<HandshakeOverlayProps> = ({
  visible,
  myName,
  myPhoto,
  theirName,
  theirPhoto,
  onSayHello,
  onDismiss,
  dismissLabel = "Keep discovering",
}) => {
  const reducedMotion = useReducedMotion();

  const backdrop = useSharedValue(0);
  const myAvatarX = useSharedValue(-SCREEN_WIDTH * 0.4);
  const theirAvatarX = useSharedValue(SCREEN_WIDTH * 0.4);
  const handLeftX = useSharedValue(-SCREEN_WIDTH * 0.6);
  const handRightX = useSharedValue(SCREEN_WIDTH * 0.6);
  const handsOpacity = useSharedValue(0);
  const shakeOpacity = useSharedValue(0);
  const shakeRotation = useSharedValue(0);
  const sparkProgress = useSharedValue(0);
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      backdrop.value = 0;
      myAvatarX.value = -SCREEN_WIDTH * 0.4;
      theirAvatarX.value = SCREEN_WIDTH * 0.4;
      handLeftX.value = -SCREEN_WIDTH * 0.6;
      handRightX.value = SCREEN_WIDTH * 0.6;
      handsOpacity.value = 0;
      shakeOpacity.value = 0;
      shakeRotation.value = 0;
      sparkProgress.value = 0;
      contentOpacity.value = 0;
      return;
    }

    if (reducedMotion) {
      backdrop.value = 1;
      myAvatarX.value = 0;
      theirAvatarX.value = 0;
      handsOpacity.value = 0;
      shakeOpacity.value = 1;
      contentOpacity.value = 1;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      return;
    }

    backdrop.value = withTiming(1, { duration: BACKDROP_MS });

    // Avatars settle top-center from opposite sides.
    myAvatarX.value = withSpring(0, { damping: 16, stiffness: 110 });
    theirAvatarX.value = withSpring(0, { damping: 16, stiffness: 110 });

    // Hands fly in from the edges and meet in the center.
    handsOpacity.value = withDelay(HANDS_START_MS, withTiming(1, { duration: 80 }));
    handLeftX.value = withDelay(
      HANDS_START_MS,
      withTiming(-14, { duration: HANDS_FLY_MS, easing: Easing.out(Easing.cubic) }),
    );
    handRightX.value = withDelay(
      HANDS_START_MS,
      withTiming(14, { duration: HANDS_FLY_MS, easing: Easing.out(Easing.cubic) }),
    );

    // Contact: hands swap for the joined 🤝, sparks burst, shake cycles.
    handsOpacity.value = withDelay(
      CONTACT_MS,
      withTiming(0, { duration: 60 }),
    );
    sparkProgress.value = withDelay(
      CONTACT_MS,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) }),
    );
    shakeOpacity.value = withDelay(CONTACT_MS, withTiming(1, { duration: 60 }));
    shakeRotation.value = withDelay(
      CONTACT_MS,
      withSequence(
        withTiming(-8, { duration: SHAKE_CYCLE_MS }),
        withTiming(8, { duration: SHAKE_CYCLE_MS }),
        withTiming(-8, { duration: SHAKE_CYCLE_MS }),
        withTiming(8, { duration: SHAKE_CYCLE_MS }),
        withTiming(-6, { duration: SHAKE_CYCLE_MS }),
        withTiming(0, { duration: SHAKE_CYCLE_MS }),
      ),
    );

    contentOpacity.value = withDelay(
      CONTENT_MS,
      withTiming(1, { duration: 250 }),
    );

    const hapticTimer = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }, CONTACT_MS);

    return () => clearTimeout(hapticTimer);
  }, [visible, reducedMotion]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value,
  }));
  const myAvatarStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: myAvatarX.value }],
  }));
  const theirAvatarStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: theirAvatarX.value }],
  }));
  const handLeftStyle = useAnimatedStyle(() => ({
    opacity: handsOpacity.value,
    transform: [{ translateX: handLeftX.value }],
  }));
  const handRightStyle = useAnimatedStyle(() => ({
    opacity: handsOpacity.value,
    transform: [{ translateX: handRightX.value }, { scaleX: -1 }],
  }));
  const shakeStyle = useAnimatedStyle(() => ({
    opacity: shakeOpacity.value,
    transform: [{ rotate: `${shakeRotation.value}deg` }],
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  if (!visible) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <LinearGradient
          colors={["#312E81", "#6D28D9", "#9D174D"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, styles.dim]} />
      </Animated.View>

      <View style={styles.stage}>
        {/* Both people, settled top-center */}
        <View style={styles.avatarRow}>
          <Animated.View style={myAvatarStyle}>
            <Avatar uri={myPhoto} name={myName} size={84} radius={28} />
          </Animated.View>
          <Animated.View style={theirAvatarStyle}>
            <Avatar uri={theirPhoto} name={theirName} size={84} radius={28} />
          </Animated.View>
        </View>

        {/* The handshake */}
        <View style={styles.handshakeStage}>
          <Animated.Text style={[styles.hand, handLeftStyle]}>👋</Animated.Text>
          <Animated.Text style={[styles.hand, handRightStyle]}>👋</Animated.Text>
          <Animated.Text style={[styles.joinedHands, shakeStyle]}>
            🤝
          </Animated.Text>
          {SPARKS.map((spark, i) => (
            <Spark key={i} x={spark.x} y={spark.y} progress={sparkProgress} />
          ))}
        </View>

        <Animated.View style={[styles.content, contentStyle]}>
          <Text style={styles.headline}>You shook hands!</Text>
          <Text style={styles.subline}>
            You and {theirName} are now connected
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={onSayHello}
            style={({ pressed }) => [
              styles.primaryCta,
              { opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Text style={styles.primaryCtaText}>Say hello</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={onDismiss}
            style={({ pressed }) => [
              styles.secondaryCta,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={styles.secondaryCtaText}>{dismissLabel}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
};

interface SparkProps {
  x: number;
  y: number;
  progress: SharedValue<number>;
}

/** Decorative spark flung outward from the contact point, fading as it goes. */
const Spark: React.FC<SparkProps> = ({ x, y, progress }) => {
  const style = useAnimatedStyle(() => ({
    opacity: progress.value === 0 ? 0 : 1 - progress.value,
    transform: [
      { translateX: x * progress.value },
      { translateY: y * progress.value },
      { scale: 0.5 + progress.value * 0.6 },
    ],
  }));

  return (
    <Animated.Text pointerEvents="none" style={[styles.spark, style]}>
      ⚡
    </Animated.Text>
  );
};

const styles = StyleSheet.create({
  dim: {
    backgroundColor: "rgba(15,23,42,0.35)",
  },
  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  avatarRow: {
    flexDirection: "row",
    gap: spacing.lg,
    marginBottom: spacing.xxl,
  },
  handshakeStage: {
    height: 110,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },
  hand: {
    position: "absolute",
    fontSize: 52,
  },
  joinedHands: {
    fontSize: 72,
  },
  spark: {
    position: "absolute",
    fontSize: 18,
  },
  content: {
    alignItems: "center",
    marginTop: spacing.xxl,
    alignSelf: "stretch",
  },
  headline: {
    ...typography.display,
    color: "#FFFFFF",
    fontWeight: "800",
    textAlign: "center",
  },
  subline: {
    ...typography.body,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  primaryCta: {
    alignSelf: "stretch",
    backgroundColor: "#FFFFFF",
    borderRadius: borderRadius.full,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  primaryCtaText: {
    ...typography.label,
    fontSize: 17,
    color: "#4F46E5",
    fontWeight: "800",
  },
  secondaryCta: {
    paddingVertical: spacing.lg,
  },
  secondaryCtaText: {
    ...typography.label,
    fontSize: 15,
    color: "rgba(255,255,255,0.85)",
  },
});
