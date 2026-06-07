import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  Image,
  Text,
} from 'react-native';
import { useThemeColors, elevation, spacing, borderRadius, typography } from '@constants/theme';

interface CardProps {
  children?: React.ReactNode;
  style?: ViewStyle;
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

interface ProfileCardProps {
  image?: string;
  name: string;
  title: string;
  industry: string;
  bio?: string;
  prompt?: string;
  style?: ViewStyle;
  testID?: string;
}

/**
 * Profile card for discovery deck
 * Displays user photo, name, role, industry, and optional bio/prompt
 */
export const ProfileCard: React.FC<ProfileCardProps> = ({
  image,
  name,
  title,
  industry,
  bio,
  prompt,
  style,
  testID,
}) => {
  const colors = useThemeColors();

  return (
    <Card style={[styles.profileCard, style]} testID={testID}>
      {image && (
        <Image
          source={{ uri: image }}
          style={styles.profileImage}
          testID={`${testID}:image`}
        />
      )}

      <View style={styles.profileInfo}>
        <Text
          style={[
            styles.profileName,
            {
              color: colors.textPrimary,
            },
          ]}
          numberOfLines={1}
        >
          {name}
        </Text>

        <Text
          style={[
            styles.profileTitle,
            {
              color: colors.textSecondary,
            },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>

        <Text
          style={[
            styles.profileIndustry,
            {
              color: colors.textTertiary,
            },
          ]}
          numberOfLines={1}
        >
          {industry}
        </Text>

        {bio && (
          <Text
            style={[
              styles.profileBio,
              {
                color: colors.textSecondary,
              },
            ]}
            numberOfLines={2}
          >
            {bio}
          </Text>
        )}

        {prompt && (
          <View
            style={[
              styles.promptBox,
              {
                backgroundColor: colors.surfaceInput,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.promptText,
                {
                  color: colors.textPrimary,
                },
              ]}
              numberOfLines={2}
            >
              {prompt}
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
};

interface ConnectionCardProps {
  image?: string;
  name: string;
  title: string;
  industry: string;
  matchedDate?: string;
  onPress?: () => void;
  testID?: string;
}

/**
 * Connection card for connections list
 * Compact card showing connected user info
 */
export const ConnectionCard: React.FC<ConnectionCardProps> = ({
  image,
  name,
  title,
  industry,
  matchedDate,
  testID,
}) => {
  const colors = useThemeColors();

  return (
    <Card
      style={[
        styles.connectionCard,
        {
          borderLeftWidth: 3,
          borderLeftColor: colors.success,
        },
      ]}
      testID={testID}
    >
      <View style={styles.connectionContent}>
        {image && (
          <Image
            source={{ uri: image }}
            style={styles.connectionImage}
            testID={`${testID}:image`}
          />
        )}

        <View style={styles.connectionInfo}>
          <Text
            style={[
              styles.connectionName,
              {
                color: colors.textPrimary,
              },
            ]}
            numberOfLines={1}
          >
            {name}
          </Text>

          <Text
            style={[
              styles.connectionTitle,
              {
                color: colors.textSecondary,
              },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>

          <Text
            style={[
              styles.connectionIndustry,
              {
                color: colors.textTertiary,
              },
            ]}
            numberOfLines={1}
          >
            {industry}
          </Text>

          {matchedDate && (
            <Text
              style={[
                styles.connectionDate,
                {
                  color: colors.textTertiary,
                },
              ]}
              numberOfLines={1}
            >
              {matchedDate}
            </Text>
          )}
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  profileCard: {
    height: '70%',
    maxHeight: 600,
  },
  profileImage: {
    width: '100%',
    height: '60%',
    resizeMode: 'cover',
  },
  profileInfo: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  profileName: {
    ...typography.title,
    marginBottom: spacing.xs,
  },
  profileTitle: {
    ...typography.body,
    marginBottom: spacing.xs,
  },
  profileIndustry: {
    ...typography.caption,
    marginBottom: spacing.md,
  },
  profileBio: {
    ...typography.body,
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  promptBox: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  promptText: {
    ...typography.caption,
  },
  connectionCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  connectionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionImage: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.lg,
    marginRight: spacing.lg,
  },
  connectionInfo: {
    flex: 1,
  },
  connectionName: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  connectionTitle: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  connectionIndustry: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  connectionDate: {
    ...typography.caption,
    marginTop: spacing.sm,
  },
});
