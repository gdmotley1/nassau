import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useSubscriptionStore, useUIStore } from '../../stores';
import { GolfBackground } from '../../components/backgrounds';
import { springs } from '../../utils/animations';
import { hapticSuccess, hapticMedium, hapticLight } from '../../utils/haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'AcePaywall'>;

const SCREEN_WIDTH = Dimensions.get('window').width;

const FEATURES = [
  {
    icon: 'trending-up' as const,
    title: 'Press Advisor',
    desc: 'Know exactly when to press with historical win rate data',
  },
  {
    icon: 'users' as const,
    title: 'Matchup Intel',
    desc: 'Head-to-head records and opponent tendencies',
  },
  {
    icon: 'bar-chart-2' as const,
    title: 'Round Analysis',
    desc: 'Post-round breakdown and missed press opportunities',
  },
  {
    icon: 'zap' as const,
    title: 'Form Tracker',
    desc: 'Scoring trends, streaks, and handicap trajectory',
  },
];

type PackageType = 'monthly' | 'annual' | 'lifetime';

/** Sort and label packages from RevenueCat offerings */
function getPackageList(offering: any): {
  pkg: any;
  type: PackageType;
  label: string;
  sublabel: string;
  badge?: string;
}[] {
  if (!offering) return [];

  const list: { pkg: any; type: PackageType; label: string; sublabel: string; badge?: string }[] = [];

  if (offering.annual) {
    const price = offering.annual.product?.priceString ?? '--';
    const monthlyEquiv = offering.annual.product?.price
      ? `$${(offering.annual.product.price / 12).toFixed(2)}/mo`
      : '';
    list.push({
      pkg: offering.annual,
      type: 'annual',
      label: 'Yearly',
      sublabel: monthlyEquiv || `${price}/year`,
      badge: 'Best Value',
    });
  }
  if (offering.monthly) {
    const price = offering.monthly.product?.priceString ?? '--';
    list.push({
      pkg: offering.monthly,
      type: 'monthly',
      label: 'Monthly',
      sublabel: `${price}/month`,
    });
  }
  if (offering.lifetime) {
    list.push({
      pkg: offering.lifetime,
      type: 'lifetime',
      label: 'Lifetime',
      sublabel: 'Pay once, keep forever',
      badge: 'One Time',
    });
  }

  // Fallback: show whatever is available
  if (list.length === 0 && offering.availablePackages?.length > 0) {
    offering.availablePackages.forEach((p: any, i: number) => {
      list.push({
        pkg: p,
        type: 'monthly',
        label: p.identifier ?? `Plan ${i + 1}`,
        sublabel: p.product?.priceString ?? '--',
      });
    });
  }

  return list;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function AcePaywallScreen({ navigation }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const showToast = useUIStore((s) => s.showToast);
  const {
    offerings,
    isLoading,
    fetchOfferings,
    purchasePackage,
    restorePurchases,
  } = useSubscriptionStore();

  const [selectedType, setSelectedType] = useState<PackageType>('annual');

  useEffect(() => {
    fetchOfferings();
  }, []);

  const currentOffering = offerings?.current;
  const packages = getPackageList(currentOffering);

  // Auto-select first available if preferred isn't available
  useEffect(() => {
    if (packages.length > 0 && !packages.find((p) => p.type === selectedType)) {
      setSelectedType(packages[0].type);
    }
  }, [packages.length]);

  const selectedPkg = packages.find((p) => p.type === selectedType);

  const handlePurchase = async () => {
    if (!selectedPkg) {
      showToast('No subscription available yet', 'info');
      return;
    }
    hapticMedium();
    const result = await purchasePackage(selectedPkg.pkg);
    if (result.error === 'cancelled') return;
    if (result.error) {
      showToast(result.error, 'error');
      return;
    }
    hapticSuccess();
    showToast('Welcome to Nassau Pro!', 'success');
    navigation.goBack();
  };

  const handleRestore = async () => {
    hapticMedium();
    const result = await restorePurchases();
    if (result.error) {
      showToast(result.error, 'error');
      return;
    }
    const isPremium = useSubscriptionStore.getState().isPremium;
    if (isPremium) {
      hapticSuccess();
      showToast('Subscription restored!', 'success');
      navigation.goBack();
    } else {
      showToast('No active subscription found', 'info');
    }
  };

  // CTA button text based on selected package
  const ctaText = selectedPkg
    ? `Continue with ${selectedPkg.pkg.product?.priceString ?? selectedPkg.label}`
    : 'Subscribe to Nassau Pro';

  return (
    <View style={[styles.outerContainer, { backgroundColor: theme.colors.gray[900] }]}>
      <GolfBackground variant="combined" intensity="subtle" />
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Close Button */}
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.closeButton}
          hitSlop={16}
        >
          <Feather name="x" size={24} color={theme.colors.gray[500]} />
        </Pressable>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 200 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Section */}
          <Animated.View
            entering={FadeIn.duration(600)}
            style={styles.heroSection}
          >
            {/* Glowing teal orb behind badge */}
            <View style={styles.orbContainer}>
              <LinearGradient
                colors={[theme.colors.teal[500] + '30', theme.colors.teal[500] + '00']}
                style={styles.orb}
              />
            </View>

            <Animated.View
              entering={FadeInDown.duration(500).delay(100)}
              style={[
                styles.proBadge,
                { backgroundColor: theme.colors.teal[500] + '18' },
              ]}
            >
              <Text
                style={[styles.proBadgeText, { color: theme.colors.teal[500] }]}
              >
                NASSAU PRO
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(500).delay(200)}>
              <Text style={[styles.headline, { color: theme.colors.gray[50] }]}>
                Your betting{'\n'}edge
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(500).delay(300)}>
              <Text style={[styles.subheadline, { color: theme.colors.gray[500] }]}>
                AI-powered insights that help you win more bets
              </Text>
            </Animated.View>
          </Animated.View>

          {/* Features */}
          <Animated.View
            entering={FadeInDown.duration(500).delay(400)}
            style={[
              styles.featuresCard,
              {
                backgroundColor: theme.colors.gray[900],
                borderColor: theme.colors.gray[700] + '60',
              },
            ]}
          >
            {FEATURES.map((feature, i) => (
              <View
                key={feature.title}
                style={[
                  styles.featureRow,
                  i < FEATURES.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: theme.colors.gray[700] + '40',
                  },
                ]}
              >
                <View
                  style={[
                    styles.featureIcon,
                    { backgroundColor: theme.colors.teal[500] + '12' },
                  ]}
                >
                  <Feather
                    name={feature.icon}
                    size={18}
                    color={theme.colors.teal[500]}
                  />
                </View>
                <View style={styles.featureText}>
                  <Text
                    style={[styles.featureTitle, { color: theme.colors.gray[50] }]}
                  >
                    {feature.title}
                  </Text>
                  <Text
                    style={[styles.featureDesc, { color: theme.colors.gray[500] }]}
                  >
                    {feature.desc}
                  </Text>
                </View>
                <Feather name="check" size={16} color={theme.colors.teal[500]} />
              </View>
            ))}
          </Animated.View>

          {/* Package Selector */}
          <Animated.View
            entering={FadeInDown.duration(500).delay(550)}
            style={styles.packagesSection}
          >
            <Text style={[styles.sectionLabel, { color: theme.colors.gray[500] }]}>
              Choose your plan
            </Text>
            {packages.length > 0 ? (
              packages.map((p) => (
                <PackageOption
                  key={p.type}
                  label={p.label}
                  priceString={p.pkg.product?.priceString ?? '--'}
                  sublabel={p.sublabel}
                  badge={p.badge}
                  selected={selectedType === p.type}
                  onSelect={() => {
                    hapticLight();
                    setSelectedType(p.type);
                  }}
                  theme={theme}
                />
              ))
            ) : (
              <View style={styles.placeholderPrice}>
                <Text
                  style={[styles.placeholderText, { color: theme.colors.gray[500] }]}
                >
                  Pricing will appear once configured
                </Text>
              </View>
            )}
          </Animated.View>
        </ScrollView>

        {/* Sticky CTA Area */}
        <Animated.View
          entering={FadeInDown.duration(500).delay(650)}
          style={[
            styles.ctaArea,
            {
              paddingBottom: Math.max(insets.bottom, 16) + 8,
              borderTopColor: theme.colors.gray[700] + '30',
            },
          ]}
        >
          <LinearGradient
            colors={[theme.colors.gray[900] + '00', theme.colors.gray[900]]}
            style={styles.ctaGradient}
            pointerEvents="none"
          />
          <CTAButton
            title={ctaText}
            onPress={handlePurchase}
            loading={isLoading}
            theme={theme}
          />
          <Pressable onPress={handleRestore} style={styles.restoreButton}>
            <Text
              style={[styles.restoreText, { color: theme.colors.gray[500] }]}
            >
              Restore Purchases
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

// ─── CTA Button (teal, matching RHButton style) ─────────────────────

function CTAButton({
  title,
  onPress,
  loading,
  theme,
}: {
  title: string;
  onPress: () => void;
  loading: boolean;
  theme: any;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={() => {
        scale.value = withSpring(0.97, springs.snappy);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, springs.bouncy);
      }}
      onPress={() => {
        if (!loading) {
          hapticLight();
          onPress();
        }
      }}
      disabled={loading}
      style={[
        styles.ctaButton,
        { backgroundColor: theme.colors.teal[500] },
        animatedStyle,
      ]}
    >
      {loading ? (
        <Text style={styles.ctaButtonText}>...</Text>
      ) : (
        <Text style={styles.ctaButtonText}>{title}</Text>
      )}
    </AnimatedPressable>
  );
}

// ─── Package Option Card ─────────────────────────────────────────────

function PackageOption({
  label,
  priceString,
  sublabel,
  badge,
  selected,
  onSelect,
  theme,
}: {
  label: string;
  priceString: string;
  sublabel: string;
  badge?: string;
  selected: boolean;
  onSelect: () => void;
  theme: any;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={() => {
        scale.value = withSpring(0.97, springs.snappy);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, springs.bouncy);
      }}
      onPress={onSelect}
      style={[
        styles.packageCard,
        {
          backgroundColor: selected
            ? theme.colors.teal[500] + '10'
            : 'transparent',
          borderColor: selected
            ? theme.colors.teal[500]
            : theme.colors.gray[700] + '60',
        },
        animatedStyle,
      ]}
    >
      {/* Radio */}
      <View
        style={[
          styles.radioOuter,
          {
            borderColor: selected
              ? theme.colors.teal[500]
              : theme.colors.gray[700],
          },
        ]}
      >
        {selected && (
          <View
            style={[
              styles.radioInner,
              { backgroundColor: theme.colors.teal[500] },
            ]}
          />
        )}
      </View>

      {/* Label + Sublabel */}
      <View style={styles.packageInfo}>
        <View style={styles.packageLabelRow}>
          <Text
            style={[styles.packageLabel, { color: theme.colors.gray[50] }]}
          >
            {label}
          </Text>
          {badge && (
            <View
              style={[
                styles.packageBadge,
                {
                  backgroundColor:
                    badge === 'Best Value'
                      ? theme.colors.green[500] + '20'
                      : theme.colors.teal[500] + '20',
                },
              ]}
            >
              <Text
                style={[
                  styles.packageBadgeText,
                  {
                    color:
                      badge === 'Best Value'
                        ? theme.colors.green[500]
                        : theme.colors.teal[500],
                  },
                ]}
              >
                {badge}
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.packageSublabel, { color: theme.colors.gray[500] }]}>
          {sublabel}
        </Text>
      </View>

      {/* Price */}
      <Text
        style={[
          styles.packagePrice,
          {
            color: selected ? theme.colors.gray[50] : theme.colors.gray[300],
          },
        ]}
      >
        {priceString}
      </Text>
    </AnimatedPressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  outerContainer: { flex: 1 },
  container: { flex: 1 },
  closeButton: {
    position: 'absolute',
    top: 56,
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 60,
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  orbContainer: {
    position: 'absolute',
    top: -40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  proBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 20,
  },
  proBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2.5,
  },
  headline: {
    fontSize: 40,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -1,
    lineHeight: 44,
  },
  subheadline: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
  },

  // Features
  featuresCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 28,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: { flex: 1 },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  featureDesc: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2,
    lineHeight: 17,
  },

  // Packages
  packagesSection: {
    gap: 10,
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  packageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  packageInfo: {
    flex: 1,
  },
  packageLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  packageLabel: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  packageBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  packageBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  packageSublabel: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2,
  },
  packagePrice: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  placeholderPrice: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },

  // CTA
  ctaArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 10,
  },
  ctaGradient: {
    position: 'absolute',
    top: -40,
    left: 0,
    right: 0,
    height: 40,
  },
  ctaButton: {
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  restoreText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
