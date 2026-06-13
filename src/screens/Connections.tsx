import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
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
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import {
  useThemeColors,
  typography,
  spacing,
  borderRadius,
  gradients,
  createStyles,
} from '@constants/theme';
import { ConnectionCard } from '@components/Card';
import { Button } from '@components/Button';
import { SafetyMenu } from '@components/SafetyMenu';
import { useAppStore } from '@store/appStore';
import { supabase, getOtherUserId, Connection, Profile } from '@services/supabase';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';

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
  const router = useRouter();

  const { connections, connectionsLoading, fetchConnections, currentProfile } = useAppStore();
  const [connectionsWithProfiles, setConnectionsWithProfiles] = useState<ConnectionWithProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Refresh on focus, not just mount — expo-router keeps tab screens mounted,
  // so a handshake completed elsewhere must show up when returning here.
  useFocusEffect(
    useCallback(() => {
      if (currentProfile?.user_id) {
        loadConnections();
      }
    }, [currentProfile?.user_id]),
  );

  const loadConnections = async () => {
    setLoading(true);
    try {
      const freshConnections = await fetchConnections();

      if (!freshConnections.length || !currentProfile?.user_id) {
        setConnectionsWithProfiles([]);
        return;
      }

      const otherUserIds = freshConnections.map((conn) =>
        getOtherUserId(conn, currentProfile.user_id),
      );

      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', otherUserIds);

      if (error) throw error;

      const profilesByUserId = new Map(
        ((profiles as Profile[]) ?? []).map((profile) => [
          profile.user_id,
          profile,
        ]),
      );

      const connectionsData = freshConnections.map((conn) => {
        const otherUserId = getOtherUserId(conn, currentProfile.user_id);

        return {
          ...conn,
          profile: profilesByUserId.get(otherUserId),
        };
      });

      setConnectionsWithProfiles(connectionsData);
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
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  const handleConnectionPress = (connection: ConnectionWithProfile) => {
    router.push({
      pathname: '/connection/[id]',
      params: { id: connection.id },
    });
  };

  const isNewConnection = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    return now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000;
  };

  if ((loading || connectionsLoading) && !connectionsWithProfiles.length) {
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
          <LinearGradient
            colors={gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={localStyles.emptyIcon}
          >
            <Feather name="users" size={32} color="#FFFFFF" />
          </LinearGradient>
          <Text
            style={[
              typography.title,
              {
                color: colors.textPrimary,
                marginTop: spacing.lg,
                marginBottom: spacing.sm,
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
                color: colors.textSecondary,
                textAlign: 'center',
                lineHeight: 24,
              },
            ]}
          >
            Extend a hand to people you'd like to meet — everyone you shake
            hands with shows up here.
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
          <Text style={[localStyles.headerTitle, { color: colors.textPrimary }]}>
            Connections
          </Text>
          <View style={[localStyles.countPill, { backgroundColor: colors.surfaceInput }]}>
            <Feather name="zap" size={12} color={colors.primary} />
            <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '700' }]}>
              {connectionsWithProfiles.length} connected
            </Text>
          </View>
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
                matchedDate={`Shook hands ${formatMatchDate(item.created_at).toLowerCase()}`}
                isNew={isNewConnection(item.created_at)}
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
  const router = useRouter();
  const navigation = useNavigation();
  const { currentProfile } = useAppStore();

  const [connection, setConnection] = useState<ConnectionWithProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);

  const otherUserId =
    connection && currentProfile?.user_id
      ? getOtherUserId(connection, currentProfile.user_id)
      : undefined;

  // Header overflow menu (Block / Report / Remove connection).
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        otherUserId ? (
          <Pressable
            onPress={() => setMenuVisible(true)}
            hitSlop={12}
            style={{ paddingHorizontal: spacing.sm }}
          >
            <Feather name="more-horizontal" size={22} color={colors.textPrimary} />
          </Pressable>
        ) : null,
    });
  }, [navigation, otherUserId, colors.textPrimary]);

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
          if (!currentProfile?.user_id) {
            setConnection(conn);
            return;
          }

          const otherUserId = getOtherUserId(conn, currentProfile.user_id);

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
  }, [connectionId, currentProfile?.user_id]);

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
      <ScrollView contentContainerStyle={localStyles.scrollContent}>
        {/* Close button would be in header navigation */}
        <View style={localStyles.profileDetail}>
          {/* Profile image with name overlay */}
          <View style={localStyles.heroWrap}>
            {profile.photo_url ? (
              <Image
                source={{ uri: profile.photo_url }}
                style={localStyles.profileImage}
                contentFit="cover"
                transition={250}
              />
            ) : (
              <LinearGradient
                colors={gradients.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[localStyles.profileImage, localStyles.profileImagePlaceholder]}
              >
                <Text style={localStyles.heroInitial}>
                  {profile.display_name.charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
            )}
            <LinearGradient
              colors={gradients.photoScrim}
              style={localStyles.heroScrim}
              pointerEvents="none"
            />
            <View style={localStyles.connectedBadge}>
              <Feather name="zap" size={12} color="#FFFFFF" />
              <Text style={localStyles.connectedBadgeText}>Connected</Text>
            </View>
            <Text style={localStyles.heroName} numberOfLines={1}>
              {profile.display_name}
            </Text>
          </View>

          {/* Profile info */}

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

          {/* Message CTA — opens (or creates) the conversation */}
          {otherUserId ? (
            <Button
              title="Message"
              onPress={() =>
                router.push({
                  pathname: '/chat/[id]',
                  params: {
                    id: 'new',
                    recipientId: otherUserId,
                    connectionId: connection.id,
                    name: profile.display_name,
                    photo: profile.photo_url ?? '',
                  },
                })
              }
              style={{ marginBottom: spacing.lg }}
            />
          ) : null}

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

      {otherUserId ? (
        <SafetyMenu
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          otherUserId={otherUserId}
          otherName={profile.display_name}
          connectionId={connection.id}
          onRelationshipEnded={() => router.back()}
        />
      ) : null}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  // NB: the ScrollView content container must NOT use `flex: 1` (the shared
  // styles.container) — that pins content to the viewport height and stops
  // the ScrollView from scrolling, so a tall profile snaps back to the top.
  // flexGrow keeps short profiles filling the screen without breaking scroll.
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  profileDetail: {
    paddingVertical: spacing.lg,
  },
  heroWrap: {
    width: '100%',
    height: 360,
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profileImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInitial: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 120,
    fontWeight: '800',
  },
  heroScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroName: {
    position: 'absolute',
    left: spacing.lg,
    bottom: spacing.lg,
    right: spacing.lg,
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  connectedBadge: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.92)',
  },
  connectedBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  promptItem: {
    marginBottom: spacing.xl,
    paddingBottom: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
});
