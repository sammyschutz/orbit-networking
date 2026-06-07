import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  SafeAreaView,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useThemeColors, typography, spacing, createStyles } from '@constants/theme';
import { ConnectionCard } from '@components/Card';
import { useAppStore } from '@store/appStore';
import { supabase, Connection, Profile } from '@services/supabase';

interface ConnectionWithProfile extends Connection {
  profile?: Profile;
}

/**
 * Connections list screen
 * Shows all connected users with their profile info
 * Displays match date and allows tapping to view profile details
 */
export const ConnectionsList: React.FC = () => {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  const { connections, connectionsLoading, fetchConnections, currentProfile } = useAppStore();
  const [connectionsWithProfiles, setConnectionsWithProfiles] = useState<ConnectionWithProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch connections and their profiles on mount
  useEffect(() => {
    if (currentProfile?.user_id) {
      loadConnections();
    }
  }, [currentProfile?.user_id]);

  const loadConnections = async () => {
    setLoading(true);
    try {
      await fetchConnections();
      
      // For each connection, fetch the other user's profile
      if (connections.length > 0 && currentProfile?.user_id) {
        const connectionsData = await Promise.all(
          connections.map(async (conn) => {
            const otherUserId = conn.user_a_id === currentProfile.user_id
              ? conn.user_b_id
              : conn.user_a_id;

            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('user_id', otherUserId)
              .single();

            return {
              ...conn,
              profile: profile as Profile,
            };
          })
        );

        setConnectionsWithProfiles(connectionsData);
      }
    } catch (err) {
      console.error('Failed to load connections:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadConnections();
    } finally {
      setRefreshing(false);
    }
  };

  const formatMatchDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  const handleConnectionPress = (connection: ConnectionWithProfile) => {
    // Navigate to profile detail screen
    // Implementation depends on navigation setup
    console.log('View profile:', connection.profile?.display_name);
  };

  if (loading && !connections.length) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.surfaceBg }]}>
        <View style={localStyles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            style={[
              typography.body,
              {
                color: colors.textSecondary,
                marginTop: spacing.md,
              },
            ]}
          >
            Loading connections...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!connectionsWithProfiles.length) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.surfaceBg }]}>
        <View style={[styles.container, localStyles.emptyState]}>
          <Text
            style={[
              typography.headline,
              {
                color: colors.textSecondary,
                marginBottom: spacing.lg,
                textAlign: 'center',
              },
            ]}
          >
            No connections yet
          </Text>
          <Text
            style={[
              typography.body,
              {
                color: colors.textTertiary,
                textAlign: 'center',
                lineHeight: 24,
              },
            ]}
          >
            Start swiping and matching with professionals to build your network.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.surfaceBg }]}>
      <View style={styles.container}>
        {/* Header */}
        <View style={localStyles.header}>
          <Text style={[typography.headline, { color: colors.textPrimary }]}>
            Connections
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            {connectionsWithProfiles.length} connected
          </Text>
        </View>

        {/* Connections list */}
        <FlatList
          data={connectionsWithProfiles}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleConnectionPress(item)}
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <ConnectionCard
                image={item.profile?.photo_url}
                name={item.profile?.display_name ?? 'Unknown'}
                title={item.profile?.role_title ?? ''}
                industry={item.profile?.industry ?? ''}
                matchedDate={`Matched ${formatMatchDate(item.created_at)}`}
                testID={`connection-${item.id}`}
              />
            </Pressable>
          )}
          scrollEnabled={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={localStyles.listContent}
        />
      </View>
    </SafeAreaView>
  );
};

/**
 * Connection detail screen
 * Shows full profile of a connected user with options to message
 */
interface ConnectionDetailProps {
  connectionId: string;
  onClose?: () => void;
}

export const ConnectionDetail: React.FC<ConnectionDetailProps> = ({ connectionId, onClose }) => {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  const [connection, setConnection] = useState<ConnectionWithProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadConnection = async () => {
      try {
        const { data } = await supabase
          .from('connections')
          .select('*')
          .eq('id', connectionId)
          .single();

        if (data) {
          const conn = data as Connection;
          const otherUserId = conn.user_a_id; // Simplified; would need current user context

          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', otherUserId)
            .single();

          setConnection({
            ...conn,
            profile: profile as Profile,
          });
        }
      } catch (err) {
        console.error('Failed to load connection detail:', err);
      } finally {
        setLoading(false);
      }
    };

    loadConnection();
  }, [connectionId]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.surfaceBg }]}>
        <View style={localStyles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!connection?.profile) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.surfaceBg }]}>
        <View style={localStyles.centerContent}>
          <Text style={[typography.body, { color: colors.textSecondary }]}>
            Connection not found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const profile = connection.profile;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.surfaceBg }]}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Close button would be in header navigation */}
        <View style={localStyles.profileDetail}>
          {/* Profile image */}
          {profile.photo_url && (
            <View
              style={[
                localStyles.profileImageContainer,
                { backgroundColor: colors.surfaceCard },
              ]}
            />
          )}

          {/* Profile info */}
          <Text
            style={[
              typography.headline,
              {
                color: colors.textPrimary,
                marginTop: spacing.xl,
                marginBottom: spacing.sm,
              },
            ]}
          >
            {profile.display_name}
          </Text>

          <Text
            style={[
              typography.body,
              {
                color: colors.textSecondary,
                marginBottom: spacing.sm,
              },
            ]}
          >
            {profile.role_title}
          </Text>

          <Text
            style={[
              typography.caption,
              {
                color: colors.textTertiary,
                marginBottom: spacing.lg,
              },
            ]}
          >
            {profile.industry}
          </Text>

          {/* Bio */}
          <Text
            style={[
              typography.body,
              {
                color: colors.textPrimary,
                marginBottom: spacing.lg,
                lineHeight: 24,
              },
            ]}
          >
            {profile.bio}
          </Text>

          {/* Prompts */}
          {profile.ask_me_about && (
            <View style={localStyles.promptItem}>
              <Text
                style={[
                  typography.label,
                  { color: colors.textPrimary, marginBottom: spacing.sm },
                ]}
              >
                Ask them about
              </Text>
              <Text
                style={[
                  typography.body,
                  { color: colors.textSecondary },
                ]}
              >
                {profile.ask_me_about}
              </Text>
            </View>
          )}

          {profile.learning_about && (
            <View style={localStyles.promptItem}>
              <Text
                style={[
                  typography.label,
                  { color: colors.textPrimary, marginBottom: spacing.sm },
                ]}
              >
                Learning about
              </Text>
              <Text
                style={[
                  typography.body,
                  { color: colors.textSecondary },
                ]}
              >
                {profile.learning_about}
              </Text>
            </View>
          )}

          {profile.side_project && (
            <View style={localStyles.promptItem}>
              <Text
                style={[
                  typography.label,
                  { color: colors.textPrimary, marginBottom: spacing.sm },
                ]}
              >
                Side project
              </Text>
              <Text
                style={[
                  typography.body,
                  { color: colors.textSecondary },
                ]}
              >
                {profile.side_project}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const localStyles = StyleSheet.create({
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: spacing.lg,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  profileDetail: {
    paddingVertical: spacing.xl,
  },
  profileImageContainer: {
    width: '100%',
    height: 300,
    borderRadius: 16,
    marginBottom: spacing.lg,
  },
  promptItem: {
    marginBottom: spacing.xl,
    paddingBottom: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
});
