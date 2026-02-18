import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore, useUIStore } from '../../stores';
import { RHInput } from '../../components/RHInput';
import { RHButton } from '../../components/RHButton';
import { hapticError, hapticSuccess, hapticLight } from '../../utils/haptics';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export function SignUpScreen({ navigation }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const signUp = useAuthStore((s) => s.signUp);
  const isLoading = useAuthStore((s) => s.isLoading);
  const showToast = useUIStore((s) => s.showToast);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!email.includes('@')) newErrors.email = 'Enter a valid email';
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 8)
      newErrors.password = 'Password must be at least 8 characters';
    if (!ageConfirmed) newErrors.age = 'You must be 21 or older to use Nassau';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignUp = async () => {
    if (!validate()) {
      hapticError();
      return;
    }

    const { error } = await signUp(
      email.trim().toLowerCase(),
      password,
      name.trim()
    );

    if (error) {
      hapticError();
      showToast(error, 'error');
    } else {
      hapticSuccess();
      navigation.navigate('ProfileSetup');
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
          Create account
        </Text>
        <Text
          style={[styles.subtitle, { color: theme.semantic.textSecondary }]}
        >
          Start tracking golf bets with friends
        </Text>

        <View style={styles.form}>
          <RHInput
            label="Full Name"
            value={name}
            onChangeText={setName}
            placeholder="Mike Johnson"
            autoCapitalize="words"
            autoComplete="name"
            error={errors.name}
          />

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
            placeholder="8+ characters"
            secureTextEntry
            autoComplete="password"
            error={errors.password}
          />

          {/* Age verification */}
          <View style={styles.ageRow}>
            <Switch
              value={ageConfirmed}
              onValueChange={(val) => {
                setAgeConfirmed(val);
                hapticLight();
              }}
              trackColor={{
                false: theme.colors.gray[300],
                true: theme.colors.teal[500],
              }}
              thumbColor={theme.colors.white}
            />
            <Text
              style={[
                styles.ageText,
                { color: theme.semantic.textPrimary },
              ]}
            >
              I am 21 years or older
            </Text>
          </View>
          {errors.age && (
            <Text style={[styles.ageError, { color: theme.colors.red[500] }]}>
              {errors.age}
            </Text>
          )}

          <RHButton
            title="Create Account"
            onPress={handleSignUp}
            loading={isLoading}
            style={{ marginTop: 24 }}
          />

          <Text style={[styles.terms, { color: theme.semantic.textSecondary }]}>
            By creating an account, you agree to our Terms of Service and
            Privacy Policy. This app is for entertainment purposes only.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text
            style={[styles.footerText, { color: theme.semantic.textSecondary }]}
          >
            Already have an account?{' '}
          </Text>
          <Pressable onPress={() => navigation.navigate('Login')} hitSlop={12}>
            <Text
              style={[styles.footerLink, { color: theme.colors.teal[500] }]}
            >
              Log In
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
  ageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  ageText: {
    fontSize: 15,
    fontWeight: '500',
  },
  ageError: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    marginLeft: 52,
  },
  terms: {
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
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
