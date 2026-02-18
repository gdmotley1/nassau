import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../hooks/useTheme';
import { useFriendStore } from '../../stores/friendStore';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { lookupUserByFriendCode } from '../../services/friendService';
import { RHInput, RHButton } from '../../components';
import { hapticSuccess, hapticError, hapticLight } from '../../utils/haptics';
import { formatHandicap, formatFriendCode } from '../../utils/format';
import type { ProfileStackScreenProps } from '../../navigation/types';

interface PreviewUser {
  id: string;
  name: string;
  handicap: number | null;
  friendCode: string;
}

export function AddFriendScreen({ navigation }: ProfileStackScreenProps<'AddFriend'>) {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const addFriend = useFriendStore((s) => s.addFriend);
  const showToast = useUIStore((s) => s.showToast);

  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<PreviewUser | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [isLooking, setIsLooking] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Auto-lookup when 6 chars entered
  useEffect(() => {
    setPreview(null);
    setLookupError('');

    if (code.length !== 6) return;

    // Don't look up own code
    if (user?.friend_code && code.toUpperCase() === user.friend_code.toUpperCase()) {
      setLookupError('That\'s your own code');
      return;
    }

    let cancelled = false;
    setIsLooking(true);

    lookupUserByFriendCode(code).then((result) => {
      if (cancelled) return;
      setIsLooking(false);

      if (result.error) {
        setLookupError(result.error);
      } else if (result.user) {
        setPreview(result.user);
        hapticLight();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [code, user?.friend_code]);

  const handleCodeChange = (text: string) => {
    // Only allow alphanumeric, auto-uppercase, max 6
    const cleaned = text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
    setCode(cleaned);
  };

  const handleAddFriend = async () => {
    if (!preview) return;

    setIsAdding(true);
    const result = await addFriend(code);
    setIsAdding(false);

    if (result.error) {
      hapticError();
      showToast(result.error, 'error');
      return;
    }

    hapticSuccess();
    showToast(`${result.friendName ?? preview.name} added as friend`, 'success');
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.semantic.surface }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.content}>
          {/* Header */}
          <Animated.View entering={FadeInDown.duration(400)}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
              <Text style={[styles.backText, { color: theme.colors.teal[500] }]}>
                Back
              </Text>
            </Pressable>
            <Text style={[styles.title, { color: theme.semantic.textPrimary }]}>
              Add Friend
            </Text>
            <Text style={[styles.subtitle, { color: theme.semantic.textSecondary }]}>
              Enter your friend's 6-character code
            </Text>
          </Animated.View>

          {/* Code Input */}
          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.inputSection}>
            <RHInput
              label="Friend Code"
              value={code}
              onChangeText={handleCodeChange}
              placeholder="e.g. NAS4K7"
              autoCapitalize="characters"
              error={lookupError}
            />
          </Animated.View>

          {/* Loading indicator */}
          {isLooking && (
            <View style={styles.lookupLoading}>
              <ActivityIndicator size="small" color={theme.colors.teal[500]} />
              <Text style={[styles.lookupText, { color: theme.semantic.textSecondary }]}>
                Looking up...
              </Text>
            </View>
          )}

          {/* Preview Card */}
          {preview && (
            <Animated.View
              entering={FadeInDown.duration(300)}
              style={[
                styles.previewCard,
                {
                  backgroundColor: theme.semantic.card,
                  borderColor: theme.colors.green[500] + '40',
                },
              ]}
            >
              <View
                style={[
                  styles.previewAvatar,
                  { backgroundColor: theme.colors.teal[500] },
                ]}
              >
                <Text style={styles.previewAvatarText}>
                  {preview.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.previewInfo}>
                <Text style={[styles.previewName, { color: theme.semantic.textPrimary }]}>
                  {preview.name}
                </Text>
                <Text style={[styles.previewDetail, { color: theme.semantic.textSecondary }]}>
                  {preview.handicap !== null ? `${formatHandicap(preview.handicap)} hcp` : 'No handicap set'}
                  {'  '}
                  {formatFriendCode(preview.friendCode)}
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Add Button */}
          {preview && (
            <Animated.View entering={FadeInDown.duration(300).delay(100)} style={styles.addButton}>
              <RHButton
                title={`Add ${preview.name}`}
                onPress={handleAddFriend}
                loading={isAdding}
              />
            </Animated.View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: 20 },
  backText: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: 15, marginBottom: 24 },
  inputSection: { marginBottom: 16 },
  lookupLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  lookupText: { fontSize: 13, fontWeight: '500' },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  previewAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewAvatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  previewInfo: { flex: 1, marginLeft: 12 },
  previewName: { fontSize: 17, fontWeight: '600' },
  previewDetail: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  addButton: { marginTop: 8 },
});
