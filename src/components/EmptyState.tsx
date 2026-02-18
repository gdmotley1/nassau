import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { RHButton } from './RHButton';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionTitle?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionTitle,
  onAction,
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {icon ? (
        <View style={styles.iconWrapper}>{icon}</View>
      ) : (
        <View
          style={[
            styles.defaultIcon,
            { backgroundColor: theme.colors.teal[500] + '15' },
          ]}
        >
          <View
            style={[
              styles.defaultIconInner,
              { backgroundColor: theme.colors.teal[500] + '30' },
            ]}
          />
        </View>
      )}
      <Text style={[styles.title, { color: theme.semantic.textPrimary }]}>
        {title}
      </Text>
      <Text
        style={[styles.description, { color: theme.semantic.textSecondary }]}
      >
        {description}
      </Text>
      {actionTitle && onAction && (
        <View style={styles.buttonWrapper}>
          <RHButton
            title={actionTitle}
            onPress={onAction}
            fullWidth={false}
            style={{ paddingHorizontal: 32 }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  iconWrapper: {
    marginBottom: 16,
  },
  defaultIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  defaultIconInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonWrapper: {
    marginTop: 24,
  },
});
