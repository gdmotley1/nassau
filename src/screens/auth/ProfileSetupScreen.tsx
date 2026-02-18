import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore, useUIStore } from '../../stores';
import { RHInput } from '../../components/RHInput';
import { RHButton } from '../../components/RHButton';
import { hapticSuccess } from '../../utils/haptics';

export function ProfileSetupScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const showToast = useUIStore((s) => s.showToast);

  const [venmo, setVenmo] = useState('');
  const [handicap, setHandicap] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);

    const updates: Record<string, any> = {};
    if (venmo.trim()) {
      updates.venmo_username = venmo.startsWith('@') ? venmo : `@${venmo}`;
    }
    if (handicap.trim()) {
      const parsed = parseFloat(handicap);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 54) {
        updates.handicap = parsed;
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await updateProfile(updates);
      if (error) {
        showToast(error, 'error');
        setLoading(false);
        return;
      }
    }

    hapticSuccess();
    setLoading(false);
    // Navigation handled by auth state change -> nav switches to main stack
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            backgroundColor: theme.semantic.surface,
            paddingTop: insets.top + 60,
            paddingBottom: insets.bottom + 20,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: theme.semantic.textPrimary }]}>
          Set up your profile
        </Text>
        <Text
          style={[styles.subtitle, { color: theme.semantic.textSecondary }]}
        >
          These help with settlements and handicap calculations. You can always
          change them later.
        </Text>

        <View style={styles.form}>
          <RHInput
            label="Venmo Username"
            value={venmo}
            onChangeText={setVenmo}
            placeholder="@yourusername"
            prefix="@"
            autoCapitalize="none"
          />

          <RHInput
            label="Golf Handicap"
            value={handicap}
            onChangeText={setHandicap}
            placeholder="e.g. 12.4"
            keyboardType="decimal-pad"
          />

          <RHButton
            title="Get Started"
            onPress={handleSave}
            loading={loading}
            style={{ marginTop: 24 }}
          />

          <Pressable onPress={handleSave} style={styles.skipButton}>
            <Text
              style={[styles.skipText, { color: theme.semantic.textSecondary }]}
            >
              Skip for now
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 40,
    lineHeight: 22,
  },
  form: {
    flex: 1,
  },
  skipButton: {
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
