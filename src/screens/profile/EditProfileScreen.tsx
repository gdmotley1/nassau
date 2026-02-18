import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { RHInput, RHButton } from '../../components';
import type { ProfileStackScreenProps } from '../../navigation/types';

export function EditProfileScreen({ navigation }: ProfileStackScreenProps<'EditProfile'>) {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const showToast = useUIStore((s) => s.showToast);

  const [name, setName] = useState(user?.name ?? '');
  const [handicap, setHandicap] = useState(
    user?.handicap != null ? String(user.handicap) : '',
  );
  const [venmo, setVenmo] = useState(user?.venmo_username ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const [handicapError, setHandicapError] = useState('');

  const handleSave = async () => {
    // Validate
    setNameError('');
    setHandicapError('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('Name is required');
      return;
    }

    let parsedHandicap: number | null = null;
    if (handicap.trim()) {
      parsedHandicap = parseFloat(handicap.trim());
      if (isNaN(parsedHandicap) || parsedHandicap < 0 || parsedHandicap > 54) {
        setHandicapError('Enter a valid handicap (0-54)');
        return;
      }
    }

    // Strip leading @ from venmo
    const trimmedVenmo = venmo.trim().replace(/^@/, '') || null;
    const trimmedPhone = phone.trim() || null;

    setSaving(true);
    const result = await updateProfile({
      name: trimmedName,
      handicap: parsedHandicap,
      venmo_username: trimmedVenmo,
      phone: trimmedPhone,
    });
    setSaving(false);

    if (result.error) {
      showToast(result.error, 'error');
      return;
    }

    showToast('Profile updated', 'success');
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.semantic.surface }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(400)}>
            <Text style={[styles.title, { color: theme.semantic.textPrimary }]}>
              Edit Profile
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(400).delay(100)}>
            <RHInput
              label="Full Name"
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              autoCapitalize="words"
              autoComplete="name"
              error={nameError}
            />

            <RHInput
              label="Handicap Index"
              value={handicap}
              onChangeText={setHandicap}
              placeholder="e.g. 12.4"
              keyboardType="decimal-pad"
              error={handicapError}
            />

            <RHInput
              label="Venmo Username"
              value={venmo}
              onChangeText={setVenmo}
              placeholder="username"
              prefix="@"
              autoCapitalize="none"
            />

            <RHInput
              label="Phone (optional)"
              value={phone}
              onChangeText={setPhone}
              placeholder="(555) 123-4567"
              keyboardType="phone-pad"
              autoComplete="tel"
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.buttonRow}>
            <RHButton title="Save Changes" onPress={handleSave} loading={saving} />
            <RHButton
              title="Cancel"
              variant="ghost"
              onPress={() => navigation.goBack()}
            />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 24 },
  buttonRow: { marginTop: 8, gap: 8 },
});
