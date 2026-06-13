import {
  borderRadius,
  gradients,
  spacing,
  timing,
  typography,
} from "@constants/theme";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const FLIGHT_MS = 450;
const HOLD_MS = 150;
const FADE_MS = 120;

interface ExtendHandButtonProps {
  /** Fired on press — submit the swipe here so it runs while the hand flies. */
  onExtend: () => void;
  /** Fired once the animation settles (immediately under reduced motion). */
  onSettled: () => void;
  /** How far (px) the hand flies up toward the card's avatar. */
  flightDistance?: number;
  disabled?: boolean;
}

/**
 * Primary Discover CTA (handshake spec §6.1): the button compresses and a 👋
 * springs from it toward the profile card's avatar with a gradient streak,
 * holds a beat, and fades — ~700 ms total. Honors OS reduced motion.
 */
export const ExtendHandButton: React.FC<ExtendHandButtonProps> = ({
  onExtend,
  onSettled,
  flightDistance = 280,
  disabled = false,
}) => {
  const reducedMotion = useReducedMotion();

  const buttonScale = useSharedValue(1);
  const handX = useSharedValue(0);
  const handY = useSharedValue(0);
  const handScale = useSharedValue(0.6);
  const handOpacity = useSharedValue(0);
  const streakOpacity = useSharedValue(0);

  const handlePress = () => {
    if (disabled) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onExtend();

    if (reducedMotion) {
      onSettled();
      return;
    }

    buttonScale.value = withSequence(
      withTiming(0.95, { duration: timing.micro }),
      withTiming(1, { duration: 140 }),
    );

    handX.value = 0;
    handY.value = 0;
    handScale.value = 0.6;
    handOpacity.value = 1;

    handScale.value = withSpring(1.2, { damping: 14, stiffness: 140 });
    // Slight arc toward the avatar sitting at the card's top left.
    handX.value = withTiming(-36, {
      duration: FLIGHT_MS,
      easing: Easing.out(Easing.quad),
    });
    handY.value = withSpring(-flightDistance, { damping: 18, stiffness: 90 });

    streakOpacity.value = withSequence(
      withTiming(0.4, { duration: 160 }),
      withDelay(FLIGHT_MS - 160, withTiming(0, { duration: FADE_MS })),
    );

    handOpacity.value = withDelay(
      FLIGHT_MS + HOLD_MS,
      withTiming(0, { duration: FADE_MS }, (finished) => {
        if (finished) runOnJS(onSettled)();
      }),
    );
  };

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handStyle = useAnimatedStyle(() => ({
    opacity: handOpacity.value,
    transform: [
      { translateX: handX.value },
      { translateY: handY.value },
      { scale: handScale.value },
    ],
  }));

  const streakStyle = useAnimatedStyle(() => ({
    opacity: streakOpacity.value,
  }));

  return (
    <View style={styles.wrap}>
      {/* Gradient streak the hand trails on its way to the avatar */}
      <Animated.View
        pointerEvents="none"
        style={[styles.streak, { height: flightDistance }, streakStyle]}
      >
        <LinearGradient
          colors={["transparent", ...gradients.brand]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.streakFill}
        />
      </Animated.View>

      {/* The flying hand */}
      <Animated.Text pointerEvents="none" style={[styles.hand, handStyle]}>
        👋
      </Animated.Text>

      <Animated.View style={buttonStyle}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Extend a hand"
          disabled={disabled}
          onPress={handlePress}
          style={({ pressed }) => [
            styles.shadow,
            { opacity: disabled ? 0.55 : pressed ? 0.92 : 1 },
          ]}
        >
          <LinearGradient
            colors={gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.pill}
          >
            <Text style={styles.pillEmoji}>👋</Text>
            <Text style={styles.pillLabel}>Extend a hand</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "stretch",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    minHeight: 56,
  },
  pillEmoji: {
    fontSize: 20,
  },
  pillLabel: {
    ...typography.label,
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  hand: {
    position: "absolute",
    top: 8,
    alignSelf: "center",
    fontSize: 34,
    zIndex: 2,
  },
  streak: {
    position: "absolute",
    bottom: 28,
    alignSelf: "center",
    width: 5,
    borderRadius: 3,
    overflow: "hidden",
  },
  streakFill: {
    flex: 1,
  },
  shadow: {
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    borderRadius: borderRadius.full,
  },
});
