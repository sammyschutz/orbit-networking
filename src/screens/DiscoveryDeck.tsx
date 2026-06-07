import { Button } from "@components/Button";
import { ProfileCard } from "@components/Card";
import {
    createStyles,
    spacing,
    timing,
    typography,
    useThemeColors,
} from "@constants/theme";
import { supabase } from "@services/supabase";
import { useAppStore } from "@store/appStore";
import React, { useEffect, useRef, useState } from "react";
import {
    Animated,
    Dimensions,
    PanResponder,
    SafeAreaView,
    StyleSheet,
    Text,
    useColorScheme,
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
  const scheme = useColorScheme();

  const { candidates, fetchCandidates, currentProfile } = useAppStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [swiping, setSwiping] = useState(false);

  const pan = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  // Initialize pan responder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderMove: (_, { dx, dy }) => {
        pan.x.setValue(dx);
        pan.y.setValue(dy);

        // Subtle rotate based on swipe direction
        const rotation = (dx / SCREEN_WIDTH) * 15;
        rotate.x.setValue(rotation);

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
            Animated.timing(rotate.x, {
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
            Animated.timing(rotate.x, {
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
      fetchCandidates().finally(() => setLoading(false));
    }
  }, [currentProfile?.user_id, candidates.length]);

  // Preload next cards
  useEffect(() => {
    if (
      candidates.length - currentIndex < 5 &&
      !loading &&
      candidates.length > 0
    ) {
      // Trigger fetch for more candidates
      fetchCandidates();
    }
  }, [currentIndex, candidates.length, loading]);

  const handleSwipe = async (direction: "like" | "pass") => {
    const candidate = candidates[currentIndex];
    if (!candidate || !currentProfile?.user_id) return;

    setSwiping(true);

    try {
      // Create swipe record
      const { error } = await supabase.from("swipes").insert({
        from_user_id: currentProfile.user_id,
        to_user_id: candidate.user_id,
        direction,
      });

      if (error) throw error;

      // Handle like: create incoming_interest notification for target user
      if (direction === "like") {
        // Check for reciprocal like (connection)
        const { data: reciprocal } = await supabase
          .from("swipes")
          .select("id")
          .eq("from_user_id", candidate.user_id)
          .eq("to_user_id", currentProfile.user_id)
          .eq("direction", "like")
          .single();

        if (reciprocal) {
          // Match! Create connection
          await supabase.from("connections").insert({
            user_a_id: currentProfile.user_id,
            user_b_id: candidate.user_id,
            status: "connected",
          });

          // Create match notifications for both users
          await Promise.all([
            supabase.from("notifications").insert({
              user_id: currentProfile.user_id,
              type: "match",
              source_user_id: candidate.user_id,
              payload: { connection_id: candidate.id },
            }),
            supabase.from("notifications").insert({
              user_id: candidate.user_id,
              type: "match",
              source_user_id: currentProfile.user_id,
              payload: { connection_id: candidate.id },
            }),
          ]);

          console.log("🎉 Match found!");
        } else {
          // One-way like: create incoming_interest notification for target user
          await supabase.from("notifications").insert({
            user_id: candidate.user_id,
            type: "incoming_interest",
            source_user_id: currentProfile.user_id,
          });
        }
      }

      // Move to next card
      setCurrentIndex(currentIndex + 1);

      // Reset animations
      pan.setValue({ x: 0, y: 0 });
      scale.setValue(1);
      rotate.x.setValue(0);
      opacity.setValue(1);
    } catch (err) {
      console.error("Swipe failed:", err);
    } finally {
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
                    rotateZ: rotate.x.interpolate({
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
            />
          </Animated.View>
        </View>

        {/* Action buttons */}
        <View style={localStyles.actions}>
          <Button
            title="Pass"
            variant="secondary"
            onPress={() => handleSwipe("pass")}
            disabled={!currentCandidate || swiping}
          />
          <Button
            title="Like"
            variant="secondary"
            onPress={() => handleSwipe("like")}
            disabled={!currentCandidate || swiping}
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

const localStyles = StyleSheet.create({
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
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
  activeCard: {
    zIndex: 100,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    paddingTop: spacing.lg,
  },
});
