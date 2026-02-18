import React, { useEffect } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../stores';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { SplashScreen } from '../screens/auth/SplashScreen';
import { AcePaywallScreen } from '../screens/subscription/AcePaywallScreen';
import { useTheme } from '../hooks/useTheme';
import type { Theme as NavTheme } from '@react-navigation/native';
import type { RootStackParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();

function handleNotificationNavigation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  navigationRef: any,
  data: { type?: string; gameId?: string },
) {
  if (!data?.gameId || !navigationRef.isReady()) return;

  if (data.type === 'game_invite') {
    navigationRef.navigate('Main', {
      screen: 'HomeTab',
      params: { screen: 'GameLobby', params: { gameId: data.gameId } },
    });
  } else if (data.type === 'settlement_ready') {
    navigationRef.navigate('Main', {
      screen: 'HomeTab',
      params: { screen: 'Settlement', params: { gameId: data.gameId } },
    });
  }
}

export function RootNavigator() {
  const theme = useTheme();
  const { user, isInitialized } = useAuthStore();
  const navigationRef = useNavigationContainerRef();

  // Listen for notification taps (app in background)
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as {
          type?: string;
          gameId?: string;
        };
        handleNotificationNavigation(navigationRef, data);
      },
    );

    return () => subscription.remove();
  }, []);

  // Handle cold-start notification tap (app was killed)
  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data as {
        type?: string;
        gameId?: string;
      };
      // Delay to ensure navigation container is ready
      setTimeout(() => {
        handleNotificationNavigation(navigationRef, data);
      }, 500);
    });
  }, []);

  const navigationTheme: NavTheme = {
    dark: theme.isDark,
    colors: {
      primary: theme.colors.teal[500],
      background: theme.semantic.surface,
      card: theme.semantic.surface,
      text: theme.semantic.textPrimary,
      border: theme.semantic.border,
      notification: theme.colors.red[500],
    },
    fonts: {
      regular: { fontFamily: 'System', fontWeight: '400' },
      medium: { fontFamily: 'System', fontWeight: '500' },
      bold: { fontFamily: 'System', fontWeight: '700' },
      heavy: { fontFamily: 'System', fontWeight: '900' },
    },
  };

  // Show splash while initializing
  if (!isInitialized) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme}>
      {user ? (
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="Main" component={MainNavigator} />
          <RootStack.Group screenOptions={{ presentation: 'modal' }}>
            <RootStack.Screen name="AcePaywall" component={AcePaywallScreen} />
          </RootStack.Group>
        </RootStack.Navigator>
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}
