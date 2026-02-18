import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  type ViewStyle,
  type KeyboardTypeOptions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { springs } from '../utils/animations';
import { hapticLight } from '../utils/haptics';

interface RHInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  label?: string;
  prefix?: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: 'email' | 'password' | 'name' | 'tel' | 'off';
  error?: string;
  style?: ViewStyle;
  multiline?: boolean;
}

export function RHInput({
  value,
  onChangeText,
  placeholder,
  label,
  prefix,
  keyboardType = 'default',
  secureTextEntry = false,
  autoCapitalize = 'sentences',
  autoComplete = 'off',
  error,
  style,
  multiline = false,
}: RHInputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const borderScale = useSharedValue(0);

  const animatedBorderStyle = useAnimatedStyle(() => ({
    borderColor: focused
      ? theme.colors.teal[500]
      : error
        ? theme.colors.red[500]
        : 'transparent',
    borderWidth: 1.5,
  }));

  const handleFocus = () => {
    setFocused(true);
    borderScale.value = withSpring(1, springs.snappy);
    hapticLight();
  };

  const handleBlur = () => {
    setFocused(false);
    borderScale.value = withSpring(0, springs.snappy);
  };

  return (
    <View style={[styles.wrapper, style]}>
      {label && (
        <Text
          style={[
            styles.label,
            { color: theme.semantic.textSecondary },
          ]}
        >
          {label}
        </Text>
      )}
      <Animated.View
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.semantic.inputBackground,
          },
          animatedBorderStyle,
        ]}
      >
        {prefix && (
          <Text
            style={[
              styles.prefix,
              { color: theme.semantic.textSecondary },
            ]}
          >
            {prefix}
          </Text>
        )}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.gray[500]}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          onFocus={handleFocus}
          onBlur={handleBlur}
          multiline={multiline}
          style={[
            styles.input,
            {
              color: theme.semantic.textPrimary,
            },
          ]}
        />
      </Animated.View>
      {error && (
        <Text style={[styles.error, { color: theme.colors.red[500] }]}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 48,
  },
  prefix: {
    fontSize: 16,
    fontWeight: '500',
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    height: '100%',
  },
  error: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    marginLeft: 4,
  },
});
