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
import { hapticError } from '../../utils/haptics';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export function LoginScreen({ navigation }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const signIn = useAuthStore((s) => s.signIn);
  const isLoading = useAuthStore((s) => s.isLoading);
  const showToast = useUIStore((s) => s.showToast);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!email.includes('@')) newErrors.email = 'Enter a valid email';
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) {
      hapticError();
      return;
    }

    const { error } = await signIn(email.trim().toLowerCase(), password);
    if (error) {
      hapticError();
      showToast(error, 'error');
    }
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
          Welcome back
        </Text>
        <Text
          style={[styles.subtitle, { color: theme.semantic.textSecondary }]}
        >
          Sign in to your Nassau account
        </Text>

        <View style={styles.form}>
          <RHInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            error={errors.email}
          />

          <RHInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            secureTextEntry
            autoComplete="password"
            error={errors.password}
          />

          <Pressable
            onPress={() => navigation.navigate('ForgotPassword')}
            hitSlop={12}
          >
            <Text
              style={[styles.forgotLink, { color: theme.colors.teal[500] }]}
            >
              Forgot password?
            </Text>
          </Pressable>

          <RHButton
            title="Log In"
            onPress={handleLogin}
            loading={isLoading}
            style={{ marginTop: 24 }}
          />
        </View>

        <View style={styles.footer}>
          <Text
            style={[styles.footerText, { color: theme.semantic.textSecondary }]}
          >
            Don't have an account?{' '}
          </Text>
          <Pressable onPress={() => navigation.navigate('SignUp')} hitSlop={12}>
            <Text style={[styles.footerLink, { color: theme.colors.teal[500] }]}>
              Sign Up
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
  },
  form: {
    flex: 1,
  },
  forgotLink: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 24,
  },
  footerText: {
    fontSize: 15,
    fontWeight: '400',
  },
  footerLink: {
    fontSize: 15,
    fontWeight: '600',
  },
});
