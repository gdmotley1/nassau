import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../stores/authStore';
import { useFriendStore } from '../../stores/friendStore';
import { useUIStore } from '../../stores/uiStore';
import { RHButton, RHPlayerCard, EmptyState } from '../../components';
import { hapticLight, hapticSuccess } from '../../utils/haptics';
import { formatFriendCode } from '../../utils/format';
import type { ProfileStackScreenProps } from '../../navigation/types';

export function FriendsListScreen({ navigation }: ProfileStackScreenProps<'FriendsList'>) {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const { friends, isLoading, fetchFriends, removeFriend } = useFriendStore();
  const showToast = useUIStore((s) => s.showToast);

  useFocusEffect(
    useCallback(() => {
      fetchFriends();
    }, []),
  );

  const handleCopyCode = async () => {
    if (!user?.friend_code) return;
    hapticLight();
    await Clipboard.setStringAsync(user.friend_code);
    showToast('Friend code copied', 'success');
    hapticSuccess();
  };

  const handleRemoveFriend = (friendUserId: string, friendName: string) => {
    Alert.alert(
      'Remove Friend',
      `Remove ${friendName} from your friends list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const result = await removeFriend(friendUserId);
            if (result.error) {
              showToast(result.error, 'error');
            } else {
              showToast(`${friendName} removed`, 'info');
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.semantic.surface }]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.duration(400)}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
              <Text style={[styles.backText, { color: theme.colors.teal[500] }]}>
                Back
              </Text>
            </Pressable>
            <Text style={[styles.title, { color: theme.semantic.textPrimary }]}>
              Friends
            </Text>
          </Animated.View>

          {/* Your Code Card */}
          <Animated.View entering={FadeInDown.duration(400).delay(100)}>
            <Pressable onPress={handleCopyCode}>
              <View
                style={[
                  styles.codeCard,
                  {
                    backgroundColor: theme.semantic.card,
                    borderColor: theme.colors.teal[500] + '30',
                  },
                ]}
              >
                <Text style={[styles.codeLabel, { color: theme.semantic.textSecondary }]}>
                  YOUR FRIEND CODE
                </Text>
                <Text style={[styles.codeValue, { color: theme.colors.teal[500] }]}>
                  {user?.friend_code ? formatFriendCode(user.friend_code) : '------'}
                </Text>
                <Text style={[styles.codeTap, { color: theme.semantic.textSecondary }]}>
                  Tap to copy
                </Text>
              </View>
            </Pressable>
          </Animated.View>

          {/* Friends List */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.teal[500]} />
            </View>
          ) : friends.length === 0 ? (
            <Animated.View entering={FadeInDown.duration(400).delay(200)}>
              <EmptyState
                title="No Friends Yet"
                description="Share your friend code or enter theirs to connect."
                actionTitle="Add Friend"
                onAction={() => navigation.navigate('AddFriend')}
              />
            </Animated.View>
          ) : (
            <>
              <Animated.View entering={FadeInDown.duration(400).delay(200)}>
                <Text style={[styles.sectionLabel, { color: theme.semantic.textSecondary }]}>
                  {friends.length} FRIEND{friends.length !== 1 ? 'S' : ''}
                </Text>
              </Animated.View>

              {friends.map((friend, i) => (
                <Animated.View
                  key={friend.userId}
                  entering={FadeInDown.duration(300).delay(250 + i * 50)}
                >
                  <RHPlayerCard
                    name={friend.name}
                    handicap={friend.handicap}
                    onRemove={() => handleRemoveFriend(friend.userId, friend.name)}
                  />
                </Animated.View>
              ))}
            </>
          )}

          {/* Add Friend Button */}
          <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.addButton}>
            <RHButton
              title="Add Friend"
              onPress={() => {
                hapticLight();
                navigation.navigate('AddFriend');
              }}
            />
          </Animated.View>
        </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  backText: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 20 },
  codeCard: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  codeLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8 },
  codeValue: { fontSize: 32, fontWeight: '900', letterSpacing: 4 },
  codeTap: { fontSize: 12, fontWeight: '500', marginTop: 8 },
  loadingContainer: { paddingVertical: 40, alignItems: 'center' },
  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 12 },
  addButton: { marginTop: 16 },
});
