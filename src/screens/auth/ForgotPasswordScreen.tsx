import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore, useUIStore } from '../../stores';
import { RHInput } from '../../components/RHInput';
import { RHButton } from '../../components/RHButton';
import { hapticSuccess, hapticError } from '../../utils/haptics';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export function ForgotPasswordScreen({ navigation }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const resetPassword = useAuthStore((s) => s.resetPassword);
  const showToast = useUIStore((s) => s.showToast);

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!email.trim() || !email.includes('@')) {
      hapticError();
      showToast('Enter a valid email address', 'error');
      return;
    }

    setLoading(true);
    const { error } = await resetPassword(email.trim().toLowerCase());
    setLoading(false);

    if (error) {
      hapticError();
      showToast(error, 'error');
    } else {
      hapticSuccess();
      setSent(true);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.semantic.surface }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[styles.content, { paddingTop: insets.top + 60 }]}
      >
        <Text style={[styles.title, { color: theme.semantic.textPrimary }]}>
          Reset password
        </Text>

        {sent ? (
          <View>
            <Text
              style={[
                styles.subtitle,
                { color: theme.semantic.textSecondary },
              ]}
            >
              Check your email for a reset link. It may take a minute to arrive.
            </Text>
            <RHButton
              title="Back to Login"
              onPress={() => navigation.navigate('Login')}
              style={{ marginTop: 32 }}
            />
          </View>
        ) : (
          <View>
            <Text
              style={[
                styles.subtitle,
                { color: theme.semantic.textSecondary },
              ]}
            >
              Enter your email and we'll send you a link to reset your password.
            </Text>

            <RHInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <RHButton
              title="Send Reset Link"
              onPress={handleReset}
              loading={loading}
              style={{ marginTop: 16 }}
            />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
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
    marginBottom: 32,
    lineHeight: 22,
  },
});
