import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import { useSubscriptionStore } from '../stores';

const IS_EXPO_GO = Constants.appOwnership === 'expo';

export function useAcePaywall() {
  const isPremium = useSubscriptionStore((s) => s.isPremium);
  const presentPaywall = useSubscriptionStore((s) => s.presentPaywall);
  const navigation = useNavigation<any>();

  const openPaywall = async () => {
    if (IS_EXPO_GO) {
      // Expo Go can't render RC native paywall — use custom fallback screen
      let nav: any = navigation;
      while (nav.getParent()) {
        nav = nav.getParent();
      }
      nav.navigate('AcePaywall');
      return;
    }

    // EAS Build: present RevenueCat's pre-built paywall
    await presentPaywall();
  };

  return { isPremium, openPaywall };
}
