import {
  borderRadius,
  spacing,
  typography,
  useThemeColors,
} from "@constants/theme";
import { Feather } from "@expo/vector-icons";
import {
  City,
  formatCityLabel,
  Interest,
  searchCities,
} from "@services/supabase";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

interface InterestChipsProps {
  interests: Interest[];
  selectedIds: string[];
  onToggle: (interest: Interest) => void;
  disabled?: boolean;
}

/**
 * Multi-select interest chips for the "My algorithm" surface and the
 * onboarding step. Selected chips fill with the primary color; custom
 * (non-curated) tags only render once selected, so deselecting one
 * removes its chip.
 */
export const InterestChips: React.FC<InterestChipsProps> = ({
  interests,
  selectedIds,
  onToggle,
  disabled,
}) => {
  const colors = useThemeColors();

  const visible = interests.filter(
    (i) => i.curated || selectedIds.includes(i.id),
  );

  return (
    <View style={styles.chipWrap}>
      {visible.map((interest) => {
        const selected = selectedIds.includes(interest.id);
        return (
          <Pressable
            key={interest.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            disabled={disabled}
            onPress={() => onToggle(interest)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: selected ? colors.primary : colors.surfaceInput,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: selected ? "#FFFFFF" : colors.textPrimary },
              ]}
            >
              {interest.name}
            </Text>
            {selected ? <Feather name="check" size={13} color="#FFFFFF" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
};

interface CityTypeaheadProps {
  value: City | null;
  onSelect: (city: City | null) => void;
  placeholder?: string;
}

/**
 * City picker backed by the cities lookup table: prefix typeahead, biggest
 * cities first. A picked city renders as a row with a clear affordance.
 */
export const CityTypeahead: React.FC<CityTypeaheadProps> = ({
  value,
  onSelect,
  placeholder = "Your city",
}) => {
  const colors = useThemeColors();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<City[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const handleChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const found = await searchCities(text);
      setResults(found);
      setSearching(false);
    }, 250);
  };

  const handlePick = (city: City) => {
    setQuery("");
    setResults([]);
    onSelect(city);
  };

  if (value) {
    return (
      <View
        style={[
          styles.cityRow,
          { backgroundColor: colors.surfaceInput, borderColor: colors.border },
        ]}
      >
        <Feather name="map-pin" size={16} color={colors.primary} />
        <Text
          style={[typography.body, styles.cityLabel, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {formatCityLabel(value)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear city"
          onPress={() => onSelect(null)}
          hitSlop={8}
        >
          <Feather name="x" size={18} color={colors.textTertiary} />
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      <View
        style={[
          styles.cityRow,
          { backgroundColor: colors.surfaceInput, borderColor: colors.border },
        ]}
      >
        <Feather name="search" size={16} color={colors.textTertiary} />
        <TextInput
          value={query}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="words"
          autoCorrect={false}
          style={[styles.cityInput, { color: colors.textPrimary }]}
        />
        {searching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>

      {results.length > 0 ? (
        <View
          style={[
            styles.resultList,
            { backgroundColor: colors.surfaceCard, borderColor: colors.border },
          ]}
        >
          {results.map((city) => (
            <Pressable
              key={city.id}
              accessibilityRole="button"
              onPress={() => handlePick(city)}
              style={({ pressed }) => [
                styles.resultRow,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text
                style={[typography.body, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {formatCityLabel(city)}
              </Text>
              <Text style={[typography.caption, { color: colors.textTertiary }]}>
                {city.country}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    minHeight: 34,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  cityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  cityLabel: {
    flex: 1,
    fontWeight: "600",
  },
  cityInput: {
    flex: 1,
    fontSize: typography.body.fontSize,
    paddingVertical: spacing.md,
  },
  resultList: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    marginTop: spacing.xs,
    overflow: "hidden",
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
});
