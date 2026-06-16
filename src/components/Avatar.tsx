import { avatarGradient, typography } from "@constants/theme";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Photo avatar with a deterministic gradient + initial fallback.
 * Uses expo-image (caching + graceful load) and swaps to the gradient
 * fallback whenever the photo is missing or fails to load.
 */
export const Avatar: React.FC<AvatarProps> = ({
  uri,
  name,
  size = 56,
  radius,
  style,
}) => {
  const [failed, setFailed] = useState(false);
  const resolvedRadius = radius ?? size / 2;
  const initial = (name?.trim()?.charAt(0) || "?").toUpperCase();
  const showImage = !!uri && !failed;

  const base: ViewStyle = {
    width: size,
    height: size,
    borderRadius: resolvedRadius,
    overflow: "hidden",
  };

  if (showImage) {
    return (
      <Image
        source={{ uri }}
        style={[base, style] as any}
        contentFit="cover"
        transition={250}
        onError={() => setFailed(true)}
      />
    );
  }

  const [from, to] = avatarGradient(name || uri || "");

  return (
    <LinearGradient
      colors={[from, to]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[base, styles.center, style]}
    >
      <View style={styles.center}>
        <Text
          style={[
            typography.title,
            styles.initial,
            { fontSize: size * 0.42 },
          ]}
        >
          {initial}
        </Text>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  // NB: no `flex: 1` here. The gradient already has a fixed width/height; a
  // flex on it would collapse its basis and make the avatar grow to fill a row
  // parent (e.g. the Settings banner), squeezing and clipping the name/meta.
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    color: "#FFFFFF",
    fontWeight: "700",
    includeFontPadding: false,
  },
});
