import { ProfileCard } from "@components/Card";
import { NotificationsBanner } from "@components/NotificationsBanner";
import {
    createStyles,
    spacing,
    timing,
    typography,
    useThemeColors,
} from "@constants/theme";
import { Feather } from "@expo/vector-icons";
import { useAppStore } from "@store/appStore";
import React, { useEffect, useRef, useState } from "react";
import {
    Animated,
    Dimensions,
    PanResponder,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from "react-native";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = 0.3 * SCREEN_WIDTH; // 30% of screen width

interface SwipeDeckProps {
  onNoMoreCards?: () => void;
}

/**
 * Swipe deck for profile discovery
 * - Card follows finger in real-time
 * - Snap to side on swipe threshold (30%)
 * - Like/pass animations with spring easing
 * - Loads next cards on demand
 */
export const DiscoverySwipeDeck: React.FC<SwipeDeckProps> = ({
  onNoMoreCards,
}) => {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  const { candidates, fetchCandidates, currentProfile, submitSwipe } =
    useAppStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [swiping, setSwiping] = useState(false);
  const [matchMessage, setMatchMessage] = useState<string | null>(null);

  const pan = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  // Initialize pan responder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !swiping,
      onMoveShouldSetPanResponder: () => !swiping,

      onPanResponderMove: (_, { dx, dy }) => {
        pan.x.setValue(dx);
        pan.y.setValue(dy);

        // Subtle rotate based on swipe direction
        const rotation = (dx / SCREEN_WIDTH) * 15;
        rotate.setValue(rotation);

        // Scale slightly on drag
        const dragScale = 1 - Math.abs(dx) / (SCREEN_WIDTH * 2);
        scale.setValue(Math.max(0.95, dragScale));
      },

      onPanResponderRelease: (_, { dx, vx }) => {
        const shouldSwipe =
          Math.abs(dx) > SWIPE_THRESHOLD || Math.abs(vx) > 0.5;
        const direction = dx > 0 ? "like" : "pass";

        if (shouldSwipe) {
          // Animate card out
          Animated.parallel([
            Animated.timing(pan.x, {
              toValue:
                direction === "like" ? SCREEN_WIDTH * 1.2 : -SCREEN_WIDTH * 1.2,
              duration: timing.snap,
              useNativeDriver: false,
            }),
            Animated.timing(rotate, {
              toValue: direction === "like" ? 20 : -20,
              duration: timing.snap,
              useNativeDriver: false,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: timing.snap,
              useNativeDriver: false,
            }),
          ]).start(() => {
            handleSwipe(direction);
          });
        } else {
          // Snap back
          Animated.parallel([
            Animated.spring(pan, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: false,
            }),
            Animated.timing(rotate, {
              toValue: 0,
              duration: timing.transition,
              useNativeDriver: false,
            }),
            Animated.timing(scale, {
              toValue: 1,
              duration: timing.transition,
              useNativeDriver: false,
            }),
          ]).start();
        }
      },
    }),
  ).current;

  // Load candidates on mount
  useEffect(() => {
    if (!candidates.length && currentProfile?.user_id) {
      setLoading(true);
      fetchCandidates().finally(() => {
        setCurrentIndex(0);
        setLoading(false);
      });
    }
  }, [currentProfile?.user_id, candidates.length, fetchCandidates]);

  const resetCardAnimation = () => {
    pan.setValue({ x: 0, y: 0 });
    scale.setValue(1);
    rotate.setValue(0);
    opacity.setValue(1);
  };

  const handleSwipe = async (direction: "like" | "pass") => {
    const candidate = candidates[currentIndex];
    if (!candidate || !currentProfile?.user_id || swiping) return;

    setSwiping(true);

    try {
      const result = await submitSwipe(candidate.user_id, direction);

      if (result?.is_match) {
        setMatchMessage(`You and ${candidate.display_name} are connected.`);
        setTimeout(() => setMatchMessage(null), 3200);
      }

      const nextIndex = currentIndex + 1;
      if (nextIndex >= candidates.length) {
        setLoading(true);
        const refreshed = await fetchCandidates();
        setCurrentIndex(0);
        if (!refreshed.length) {
          onNoMoreCards?.();
        }
      } else {
        setCurrentIndex(nextIndex);
      }
    } catch (err) {
      console.error("Swipe failed:", err);
    } finally {
      resetCardAnimation();
      setLoading(false);
      setSwiping(false);
    }
  };

  const currentCandidate = candidates[currentIndex];
  const hasMoreCards = currentIndex < candidates.length - 1;

  if (!candidates.length && loading) {
    return (
      <SafeAreaView
        style={[styles.screen, { backgroundColor: colors.surfaceBg }]}
      >
        <View style={localStyles.centerContent}>
          <Text style={[typography.headline, { color: colors.textSecondary }]}>
            Loading profiles...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentCandidate) {
    return (
      <SafeAreaView
        style={[styles.screen, { backgroundColor: colors.surfaceBg }]}
      >
        <View style={localStyles.centerContent}>
          <Text
            style={[
              typography.headline,
              { color: colors.textSecondary, marginBottom: spacing.lg },
            ]}
          >
            No more profiles
          </Text>
          <Text
            style={[
              typography.body,
              { color: colors.textTertiary, textAlign: "center" },
            ]}
          >
            Check back later for new connections!
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: colors.surfaceBg }]}
    >
      <View style={styles.container}>
        <NotificationsBanner />

        {/* Header */}
        <View style={localStyles.header}>
          <Text style={[typography.title, { color: colors.textPrimary }]}>
            Discover
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            {currentIndex + 1} of {candidates.length}
          </Text>
        </View>

        {/* Swipe area */}
        <View style={localStyles.deckContainer}>
          {/* Stacked next cards (visual depth) */}
          {[2, 1].map((offset) => {
            const nextCandidate = candidates[currentIndex + offset];
            if (!nextCandidate) return null;

            return (
              <View
                key={`${nextCandidate.id}-${offset}`}
                style={[
                  localStyles.card,
                  {
                    transform: [
                      { translateY: offset * 8 },
                      { scale: 1 - offset * 0.02 },
                    ],
                  },
                ]}
              >
                <ProfileCard
                  image={nextCandidate.photo_url}
                  name={nextCandidate.display_name}
                  title={nextCandidate.role_title}
                  industry={nextCandidate.industry}
                  bio={nextCandidate.bio}
                  prompt={nextCandidate.ask_me_about}
                  style={localStyles.cardFill}
                />
              </View>
            );
          })}

          {/* Active card with pan responder */}
          <Animated.View
            style={[
              localStyles.card,
              localStyles.activeCard,
              {
                transform: [
                  { translateX: pan.x },
                  { translateY: pan.y },
                  { scale },
                  {
                    rotateZ: rotate.interpolate({
                      inputRange: [-20, 0, 20],
                      outputRange: ["-20deg", "0deg", "20deg"],
                    }),
                  },
                ],
              },
              { opacity },
            ]}
            {...panResponder.panHandlers}
          >
            <ProfileCard
              image={currentCandidate.photo_url}
              name={currentCandidate.display_name}
              title={currentCandidate.role_title}
              industry={currentCandidate.industry}
              bio={currentCandidate.bio}
              prompt={currentCandidate.ask_me_about}
              style={localStyles.cardFill}
            />
          </Animated.View>
        </View>

        {matchMessage && (
          <View
            style={[
              localStyles.matchToast,
              {
                backgroundColor: colors.success,
              },
            ]}
            accessibilityRole="alert"
          >
            <Feather name="zap" size={16} color="#FFFFFF" />
            <Text style={[typography.label, localStyles.matchToastText]}>
              {matchMessage}
            </Text>
          </View>
        )}

        {/* Action buttons */}
        <View style={localStyles.actions}>
          <SwipeActionButton
            label="Pass"
            icon="x"
            color={colors.error}
            disabled={!currentCandidate || swiping}
            onPress={() => handleSwipe("pass")}
          />
          <SwipeActionButton
            label="Like"
            icon="heart"
            color={colors.success}
            disabled={!currentCandidate || swiping}
            onPress={() => handleSwipe("like")}
          />
        </View>

        {/* Helper text */}
        {hasMoreCards && (
          <Text
            style={[
              typography.caption,
              {
                color: colors.textTertiary,
                textAlign: "center",
                marginTop: spacing.md,
              },
            ]}
          >
            Swipe left to pass, right to like
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
};

interface SwipeActionButtonProps {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  disabled: boolean;
  onPress: () => void;
}

const SwipeActionButton: React.FC<SwipeActionButtonProps> = ({
  label,
  icon,
  color,
  disabled,
  onPress,
}) => {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        localStyles.actionButton,
        {
          borderColor: color,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
          transform: [{ scale: pressed && !disabled ? 0.97 : 1 }],
        },
      ]}
    >
      <Feather name={icon} size={20} color={color} />
      <Text style={[typography.label, { color }]}>{label}</Text>
    </Pressable>
  );
};

const localStyles = StyleSheet.create({
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  header: {
    marginBottom: spacing.lg,
  },
  deckContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  card: {
    position: "absolute",
    width: SCREEN_WIDTH - 32, // 16pt padding each side
    height: "70%",
    maxHeight: 600,
  },
  cardFill: {
    height: "100%",
  },
  activeCard: {
    zIndex: 100,
  },
  matchToast: {
    alignItems: "center",
    borderRadius: 16,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginTop: spacing.md,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  matchToastText: {
    color: "#FFFFFF",
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    paddingTop: spacing.lg,
  },
  actionButton: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
