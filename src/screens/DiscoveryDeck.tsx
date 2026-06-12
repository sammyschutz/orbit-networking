import { ProfileCard } from "@components/Card";
import { NotificationsBanner } from "@components/NotificationsBanner";
import {
  borderRadius,
  gradients,
  spacing,
  timing,
  typography,
  useThemeColors,
} from "@constants/theme";
import { Feather } from "@expo/vector-icons";
import { useAppStore } from "@store/appStore";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
const SWIPE_THRESHOLD = 0.28 * SCREEN_WIDTH;

interface SwipeDeckProps {
  onNoMoreCards?: () => void;
}

/**
 * Swipe deck for profile discovery.
 * - Card follows finger, rotates, and reveals LIKE / NOPE stamps while dragging
 * - Snaps off-screen past the threshold; gradient action buttons mirror gestures
 */
export const DiscoverySwipeDeck: React.FC<SwipeDeckProps> = ({
  onNoMoreCards,
}) => {
  const colors = useThemeColors();

  const { candidates, fetchCandidates, currentProfile, submitSwipe } =
    useAppStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [swiping, setSwiping] = useState(false);
  const [matchMessage, setMatchMessage] = useState<string | null>(null);

  const pan = useRef(new Animated.ValueXY()).current;

  const rotate = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ["-12deg", "0deg", "12deg"],
  });
  const likeOpacity = pan.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const nopeOpacity = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const swipingRef = useRef(false);
  swipingRef.current = swiping;

  // The panResponder is created once, so its release closure would otherwise
  // freeze the first render's handleSwipe (and its stale currentIndex). Route
  // gestures through a ref that always points at the latest handler.
  const handleSwipeRef = useRef<(direction: "like" | "pass") => void>(
    () => {},
  );

  const animateOut = (direction: "like" | "pass", cb: () => void) => {
    Animated.timing(pan, {
      toValue: {
        x: direction === "like" ? SCREEN_WIDTH * 1.4 : -SCREEN_WIDTH * 1.4,
        y: 0,
      },
      duration: timing.snap,
      useNativeDriver: false,
    }).start(cb);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !swipingRef.current,
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        !swipingRef.current && Math.abs(dx) > Math.abs(dy) * 1.2,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, { dx, vx }) => {
        const shouldSwipe =
          Math.abs(dx) > SWIPE_THRESHOLD || Math.abs(vx) > 0.5;
        if (shouldSwipe) {
          const direction = dx > 0 ? "like" : "pass";
          animateOut(direction, () => handleSwipeRef.current(direction));
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 6,
            useNativeDriver: false,
          }).start();
        }
      },
    }),
  ).current;

  useEffect(() => {
    if (!candidates.length && currentProfile?.user_id) {
      setLoading(true);
      fetchCandidates().finally(() => {
        setCurrentIndex(0);
        setLoading(false);
      });
    }
  }, [currentProfile?.user_id, candidates.length, fetchCandidates]);

  const resetCard = () => pan.setValue({ x: 0, y: 0 });

  const handleSwipe = async (direction: "like" | "pass") => {
    const candidate = candidates[currentIndex];
    if (!candidate || !currentProfile?.user_id || swiping) {
      resetCard();
      return;
    }

    setSwiping(true);

    try {
      const result = await submitSwipe(candidate.user_id, direction);

      if (result?.is_match) {
        setMatchMessage(`It's a match! You and ${candidate.display_name} are connected.`);
        setTimeout(() => setMatchMessage(null), 3400);
      }

      const nextIndex = currentIndex + 1;
      if (nextIndex >= candidates.length) {
        setLoading(true);
        const refreshed = await fetchCandidates();
        setCurrentIndex(0);
        if (!refreshed.length) onNoMoreCards?.();
      } else {
        setCurrentIndex(nextIndex);
      }
    } catch (err) {
      console.error("Swipe failed:", err);
    } finally {
      resetCard();
      setLoading(false);
      setSwiping(false);
    }
  };

  // Keep the gesture handler pointed at the freshest closure every render.
  handleSwipeRef.current = handleSwipe;

  const triggerButton = (direction: "like" | "pass") => {
    if (swiping || !candidates[currentIndex]) return;
    setSwiping(true);
    animateOut(direction, () => {
      setSwiping(false);
      handleSwipe(direction);
    });
  };

  const currentCandidate = candidates[currentIndex];

  return (
    <LinearGradient
      colors={
        (colors.surfaceBg === "#FFFFFF"
          ? ["#FFFFFF", "#F5F3FF", "#FDF2F8"]
          : ["#0F172A", "#1E1B4B", "#0F172A"]) as readonly [
          string,
          string,
          ...string[],
        ]
      }
      style={styles.flex}
    >
      <SafeAreaView style={styles.flex}>
        <View style={styles.container}>
          <NotificationsBanner />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <LinearGradient
                colors={gradients.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.logoBadge}
              >
                <Feather name="zap" size={18} color="#FFFFFF" />
              </LinearGradient>
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                Discover
              </Text>
              {!!candidates.length && currentCandidate && (
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  {currentIndex + 1} of {candidates.length} nearby
                </Text>
              )}
            </View>
          </View>

          {/* Deck */}
          <View style={styles.deckContainer}>
            {!candidates.length && loading ? (
              <View style={styles.centerContent}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text
                  style={[
                    typography.body,
                    { color: colors.textSecondary, marginTop: spacing.md },
                  ]}
                >
                  Finding people for you…
                </Text>
              </View>
            ) : !currentCandidate ? (
              <View style={styles.centerContent}>
                <LinearGradient
                  colors={gradients.brandSoft}
                  style={styles.emptyIcon}
                >
                  <Feather name="coffee" size={32} color="#FFFFFF" />
                </LinearGradient>
                <Text
                  style={[
                    typography.title,
                    {
                      color: colors.textPrimary,
                      marginTop: spacing.lg,
                      marginBottom: spacing.sm,
                    },
                  ]}
                >
                  You're all caught up
                </Text>
                <Text
                  style={[
                    typography.body,
                    { color: colors.textSecondary, textAlign: "center" },
                  ]}
                >
                  Check back soon — new people join every day.
                </Text>
              </View>
            ) : (
              <>
                {/* Stacked depth cards */}
                {[2, 1].map((offset) => {
                  const next = candidates[currentIndex + offset];
                  if (!next) return null;
                  return (
                    <View
                      key={`${next.id}-${offset}`}
                      style={[
                        styles.card,
                        {
                          transform: [
                            { translateY: offset * 14 },
                            { scale: 1 - offset * 0.05 },
                          ],
                          opacity: 1 - offset * 0.25,
                        },
                      ]}
                    >
                      <ProfileCard
                        image={next.photo_url}
                        name={next.display_name}
                        title={next.role_title}
                        industry={next.industry}
                        bio={next.bio}
                        prompt={next.ask_me_about ?? undefined}
                        experience={next.experience_level}
                      />
                    </View>
                  );
                })}

                {/* Active card */}
                <Animated.View
                  style={[
                    styles.card,
                    {
                      transform: [
                        { translateX: pan.x },
                        { translateY: pan.y },
                        { rotate },
                      ],
                    },
                  ]}
                  {...panResponder.panHandlers}
                >
                  <ProfileCard
                    image={currentCandidate.photo_url}
                    name={currentCandidate.display_name}
                    title={currentCandidate.role_title}
                    industry={currentCandidate.industry}
                    bio={currentCandidate.bio}
                    prompt={currentCandidate.ask_me_about ?? undefined}
                    experience={currentCandidate.experience_level}
                  />

                  {/* LIKE stamp */}
                  <Animated.View
                    style={[
                      styles.stamp,
                      styles.likeStamp,
                      { opacity: likeOpacity },
                    ]}
                  >
                    <Text style={[styles.stampText, { color: "#10B981" }]}>
                      LIKE
                    </Text>
                  </Animated.View>

                  {/* NOPE stamp */}
                  <Animated.View
                    style={[
                      styles.stamp,
                      styles.nopeStamp,
                      { opacity: nopeOpacity },
                    ]}
                  >
                    <Text style={[styles.stampText, { color: "#F43F5E" }]}>
                      NOPE
                    </Text>
                  </Animated.View>
                </Animated.View>
              </>
            )}
          </View>

          {/* Match toast */}
          {matchMessage && (
            <LinearGradient
              colors={gradients.like}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.matchToast}
            >
              <Feather name="zap" size={16} color="#FFFFFF" />
              <Text style={styles.matchToastText}>{matchMessage}</Text>
            </LinearGradient>
          )}

          {/* Action buttons */}
          {!!currentCandidate && (
            <View style={styles.actions}>
              <ActionButton
                icon="x"
                colors={gradients.nope}
                disabled={swiping}
                onPress={() => triggerButton("pass")}
              />
              <ActionButton
                icon="heart"
                size={72}
                colors={gradients.like}
                disabled={swiping}
                onPress={() => triggerButton("like")}
              />
            </View>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

interface ActionButtonProps {
  icon: keyof typeof Feather.glyphMap;
  colors: readonly [string, string, ...string[]];
  disabled: boolean;
  onPress: () => void;
  size?: number;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  icon,
  colors,
  disabled,
  onPress,
  size = 60,
}) => (
  <Pressable
    accessibilityRole="button"
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => ({
      opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      transform: [{ scale: pressed && !disabled ? 0.92 : 1 }],
    })}
  >
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.actionButton,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Feather name={icon} size={size * 0.42} color="#FFFFFF" />
    </LinearGradient>
  </Pressable>
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  logoBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  deckContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: spacing.md,
  },
  card: {
    position: "absolute",
    width: SCREEN_WIDTH - spacing.lg * 2,
    height: "100%",
  },
  stamp: {
    position: "absolute",
    top: 40,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderWidth: 4,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  likeStamp: {
    left: 28,
    borderColor: "#10B981",
    transform: [{ rotate: "-16deg" }],
  },
  nopeStamp: {
    right: 28,
    borderColor: "#F43F5E",
    transform: [{ rotate: "16deg" }],
  },
  stampText: {
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 2,
  },
  matchToast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: 16,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  matchToastText: {
    color: "#FFFFFF",
    flex: 1,
    fontWeight: "700",
    fontSize: 14,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  actionButton: {
    alignItems: "center",
    justifyContent: "center",
    ...{
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 6,
    },
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
});
