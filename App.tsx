import 'react-native-reanimated';
import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootNavigator } from './src/navigation';
import { Toast } from './src/components/Toast';
import { useUIStore, useAuthStore, useSubscriptionStore } from './src/stores';
import { configureNotificationHandler } from './src/services/notificationService';

// Configure notification display before component mounts
configureNotificationHandler();

export default function App() {
  const toast = useUIStore((s) => s.toast);
  const hideToast = useUIStore((s) => s.hideToast);
  const initialize = useAuthStore((s) => s.initialize);
  const initializeSubscriptions = useSubscriptionStore((s) => s.initialize);

  useEffect(() => {
    initialize().then(() => {
      initializeSubscriptions();
    });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <RootNavigator />
        <Toast
          message={toast.message}
          type={toast.type}
          visible={toast.visible}
          onDismiss={hideToast}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
