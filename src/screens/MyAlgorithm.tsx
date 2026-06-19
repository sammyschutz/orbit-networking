import { CityTypeahead, InterestChips } from "@components/AlgorithmInputs";
import {
  borderRadius,
  elevation,
  spacing,
  typography,
  useThemeColors,
} from "@constants/theme";
import { Feather } from "@expo/vector-icons";
import { City, Interest, MAX_INTERESTS, NEARBY_RADIUS_OPTIONS } from "@services/supabase";
import { useAppStore } from "@store/appStore";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

/**
 * The "My algorithm" surface (discover-algorithm spec §3): the user reads
 * their algorithm as a live sentence and edits it in place. Every change
 * saves implicitly and clears the cached Discover queue.
 */
export const MyAlgorithm: React.FC = () => {
  const colors = useThemeColors();

  const {
    interests,
    myInterestIds,
    myCity,
    discoverySettings,
    algorithmLoading,
    fetchAlgorithm,
    toggleInterest,
    addCustomInterest,
    setCity,
    updateDiscoverySettings,
  } = useAppStore();

  const [customTag, setCustomTag] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchAlgorithm();
  }, [fetchAlgorithm]);

  useEffect(
    () => () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    },
    [],
  );

  const radius = discoverySettings?.nearby_radius_miles ?? 25;
  const nearbyOnly = !!discoverySettings?.nearby_only && !!myCity;
  const selectedInterests = interests.filter((i) =>
    myInterestIds.includes(i.id),
  );

  const showSaved = () => {
    setNote(null);
    setSaved(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaved(false), 1600);
  };

  const handleToggleInterest = async (interest: Interest) => {
    const ok = await toggleInterest(interest);
    if (ok) {
      showSaved();
    } else if (myInterestIds.length >= MAX_INTERESTS) {
      setNote(
        `Your algorithm holds ${MAX_INTERESTS} interests — remove one to add another.`,
      );
    }
  };

  const handleAddCustomTag = async () => {
    const name = customTag.trim();
    if (!name || addingTag) return;
    setAddingTag(true);
    const result = await addCustomInterest(name);
    setAddingTag(false);

    if (result.ok) {
      setCustomTag("");
      showSaved();
      return;
    }
    switch (result.reason) {
      case "length":
        setNote("Tags are 2–30 characters.");
        break;
      case "charset":
        setNote("Tags can use letters, numbers, spaces and & + - / '.");
        break;
      case "cap":
        setNote(
          `Your algorithm holds ${MAX_INTERESTS} interests — remove one to add another.`,
        );
        break;
      default:
        setNote("Couldn't add that tag — try again.");
    }
  };

  const handleSetCity = async (city: City | null) => {
    await setCity(city);
    showSaved();
  };

  const handleNearbyOnly = async (value: boolean) => {
    await updateDiscoverySettings({ nearby_only: value });
    showSaved();
  };

  const handleRadius = async (miles: number) => {
    if (miles === radius) return;
    await updateDiscoverySettings({ nearby_radius_miles: miles });
    showSaved();
  };

  // --- The live summary: the algorithm, readable -----------------------------

  const bold = (text: string, key: string) => (
    <Text key={key} style={styles.summaryBold}>
      {text}
    </Text>
  );

  const renderSummary = () => {
    const names = selectedInterests.slice(0, 3).map((i) => i.name);
    const extra = selectedInterests.length - names.length;
    const hasInterests = names.length > 0;

    // Locality only shapes Discover when the toggle is on — setting a city
    // alone is inert, so it doesn't appear in the summary.
    if (!hasInterests && !nearbyOnly) {
      return (
        <Text style={[styles.summaryText, { color: colors.textPrimary }]}>
          Your algorithm is open — pick interests
          {myCity ? ", or turn on nearby," : " or a city,"} to shape who you
          discover.
        </Text>
      );
    }

    const parts: React.ReactNode[] = ["Show me "];
    if (hasInterests) {
      parts.push("people into ");
      names.forEach((name, idx) => {
        if (idx > 0) {
          parts.push(idx === names.length - 1 ? (names.length > 2 ? ", or " : " or ") : ", ");
        }
        parts.push(bold(name, `i-${idx}`));
      });
      if (extra > 0) parts.push(` (+${extra} more)`);
    } else {
      parts.push("interesting people");
    }

    if (nearbyOnly && myCity) {
      parts.push(" — only near ");
      parts.push(bold(myCity.name, "city"));
      parts.push(` (${radius} mi).`);
    } else {
      parts.push(hasInterests ? " first." : ".");
    }

    return (
      <Text style={[styles.summaryText, { color: colors.textPrimary }]}>
        {parts}
      </Text>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.flex, { backgroundColor: colors.surfaceBg }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Live summary card — this IS the algorithm, readable */}
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: colors.surfaceCard, ...elevation.md },
          ]}
        >
          <View style={styles.summaryHeader}>
            <Feather name="sliders" size={16} color={colors.primary} />
            <Text style={[typography.label, { color: colors.textSecondary }]}>
              Your algorithm
            </Text>
          </View>
          {renderSummary()}
        </View>

        {saved ? (
          <Animated.View
            entering={FadeIn.duration(160)}
            exiting={FadeOut.duration(200)}
            style={styles.savedRow}
          >
            <Feather name="check-circle" size={13} color={colors.success} />
            <Text style={[typography.caption, { color: colors.success }]}>
              Algorithm updated
            </Text>
          </Animated.View>
        ) : null}
        {note ? (
          <Text
            style={[typography.caption, styles.noteText, { color: colors.warning }]}
          >
            {note}
          </Text>
        ) : null}

        {/* Interests */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
            YOUR INTERESTS
          </Text>
          <Text style={[typography.caption, { color: colors.textTertiary }]}>
            {myInterestIds.length} of {MAX_INTERESTS}
          </Text>
        </View>

        {algorithmLoading && !interests.length ? (
          <ActivityIndicator
            size="small"
            color={colors.primary}
            style={styles.loading}
          />
        ) : (
          <InterestChips
            interests={interests}
            selectedIds={myInterestIds}
            onToggle={handleToggleInterest}
          />
        )}

        <View
          style={[
            styles.tagInputRow,
            { backgroundColor: colors.surfaceInput, borderColor: colors.border },
          ]}
        >
          <Feather name="plus" size={16} color={colors.textTertiary} />
          <TextInput
            value={customTag}
            onChangeText={setCustomTag}
            placeholder="Add your own…"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={30}
            returnKeyType="done"
            onSubmitEditing={handleAddCustomTag}
            style={[styles.tagInput, { color: colors.textPrimary }]}
          />
          {customTag.trim().length >= 2 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add interest tag"
              disabled={addingTag}
              onPress={handleAddCustomTag}
              hitSlop={8}
            >
              {addingTag ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[typography.label, { color: colors.primary }]}>
                  Add
                </Text>
              )}
            </Pressable>
          ) : null}
        </View>

        {/* Where */}
        <Text
          style={[
            styles.sectionLabel,
            styles.whereLabel,
            { color: colors.textTertiary },
          ]}
        >
          WHERE
        </Text>

        <CityTypeahead value={myCity} onSelect={handleSetCity} />

        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={[typography.body, { color: colors.textPrimary }]}>
              Nearby only
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              {!myCity
                ? "Add your city to unlock nearby only."
                : nearbyOnly
                  ? "Only people who've added their city will appear."
                  : "Off — your city doesn't affect who you see."}
            </Text>
          </View>
          <Switch
            value={nearbyOnly}
            disabled={!myCity}
            onValueChange={handleNearbyOnly}
            trackColor={{ true: colors.primary }}
          />
        </View>

        {nearbyOnly ? (
          <View style={styles.radiusBlock}>
            <Text style={[typography.label, { color: colors.textSecondary }]}>
              Radius
            </Text>
            <View
              style={[
                styles.radiusRow,
                { backgroundColor: colors.surfaceInput },
              ]}
            >
              {NEARBY_RADIUS_OPTIONS.map((miles) => {
                const active = miles === radius;
                return (
                  <Pressable
                    key={miles}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => handleRadius(miles)}
                    style={[
                      styles.radiusOption,
                      active && {
                        backgroundColor: colors.surfaceCard,
                        ...elevation.sm,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.radiusText,
                        {
                          color: active ? colors.textPrimary : colors.textSecondary,
                        },
                      ]}
                    >
                      {miles} mi
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <Text
          style={[typography.caption, styles.footnote, { color: colors.textTertiary }]}
        >
          Updates apply the next time Discover refreshes.
        </Text>
        <Text
          style={[typography.caption, styles.attribution, { color: colors.textTertiary }]}
        >
          City data by GeoNames (geonames.org), CC BY 4.0.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  summaryCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  summaryText: {
    ...typography.body,
    fontSize: 17,
    lineHeight: 26,
  },
  summaryBold: {
    fontWeight: "800",
  },
  savedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: spacing.sm,
    marginLeft: spacing.xs,
  },
  noteText: {
    marginTop: spacing.sm,
    marginLeft: spacing.xs,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  whereLabel: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  loading: {
    marginVertical: spacing.lg,
  },
  tagInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    minHeight: 48,
  },
  tagInput: {
    flex: 1,
    fontSize: typography.body.fontSize,
    paddingVertical: spacing.md,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  toggleText: {
    flex: 1,
    gap: 2,
  },
  radiusBlock: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  radiusRow: {
    flexDirection: "row",
    borderRadius: borderRadius.md,
    padding: 3,
  },
  radiusOption: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    minHeight: 36,
  },
  radiusText: {
    fontSize: 13,
    fontWeight: "700",
  },
  footnote: {
    marginTop: spacing.xl,
    textAlign: "center",
  },
  attribution: {
    marginTop: spacing.xs,
    textAlign: "center",
  },
});
