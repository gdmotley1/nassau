# RevenueCat Integration Plan — Ace Premium Subscription

## Critical Context

### Expo Go Limitation
RevenueCat's `react-native-purchases` contains native iOS modules that **cannot run in Expo Go**. However, the SDK includes a **Preview API Mode** that auto-detects Expo Go and replaces native calls with JS mocks — so the app won't crash, but real purchases won't work.

**Development workflow change**: After this integration, you'll need to run an **EAS development build** on your physical iPhone to test actual purchases. Your `eas.json` already has a `development` profile configured. You'll run:
```
npx eas-cli build --profile development --platform ios
```
This builds a custom dev client (like Expo Go but with native modules included). Install it on your iPhone and use it instead of Expo Go for testing purchases. Everything else (hot reload, etc.) still works the same.

For day-to-day UI development, Expo Go still works fine — RevenueCat will just run in mock/preview mode.

---

## What Needs to Happen Outside Code (You Do This)

Before I write any code, you'll need to set up accounts:

1. **RevenueCat Dashboard** (https://app.revenuecat.com)
   - Create a free account
   - Create a new project called "Nassau"
   - Add an "Apple App Store" app with bundle ID `com.nassau.app`
   - Copy the **Apple API Key** (we'll put it in code)

2. **App Store Connect** (https://appstoreconnect.apple.com)
   - Create an In-App Purchase product:
     - Type: **Auto-Renewable Subscription**
     - Reference Name: "Ace Premium"
     - Product ID: `ace_premium_monthly` (monthly) and/or `ace_premium_annual` (annual)
     - Price: Your choice (e.g., $4.99/mo, $39.99/yr)
   - Create a **Subscription Group** called "Ace"

3. **RevenueCat Dashboard — Products & Entitlements**
   - Import the App Store products into RevenueCat
   - Create an **Entitlement** called `ace_premium`
   - Attach the subscription products to this entitlement
   - Create a **Default Offering** with the packages (monthly/annual)

4. **App Store Connect — Shared Secret**
   - Generate an App-Specific Shared Secret
   - Paste it into RevenueCat's Apple App Store configuration

---

## Code Implementation Plan

### Step 1: Install SDK + Config Plugin
- `npx expo install react-native-purchases`
- Add `"react-native-purchases"` to `app.json` plugins array
- No `react-native-purchases-ui` needed — we'll build our own paywall (matches Robinhood aesthetic)

### Step 2: Create Subscription Service (`src/services/subscriptionService.ts`)
New service following existing pattern (like `aceService.ts`):

```
initializeRevenueCat()       — Configure SDK with Apple API key, identify user
checkEntitlement()           — Returns boolean: is user "ace_premium" entitled?
fetchOfferings()             — Get available packages (monthly/annual) with prices
purchasePackage(pkg)         — Execute purchase, return updated customer info
restoreTransactions()        — Restore previous purchases
syncSubscriptionStatus()     — Update user's subscription_status in Supabase
```

**Key detail**: After any purchase/restore, we sync the status back to Supabase:
```ts
await supabase.from('users').update({
  subscription_status: isPremium ? 'premium' : 'free',
  subscription_id: customerInfo.originalAppUserId,
}).eq('id', userId);
```

### Step 3: Create Subscription Store (`src/stores/subscriptionStore.ts`)
New Zustand store following existing pattern:

```
State:
  isPremium: boolean
  offerings: Package[] | null
  isLoading: boolean

Actions:
  initialize()          — Called on app start, configures RC + checks entitlement
  checkPremiumStatus()  — Refresh entitlement check
  purchase(pkg)         — Buy a package, update isPremium
  restore()             — Restore transactions, update isPremium
```

**Cross-store access**: Uses `useAuthStore.getState()` for user ID (same pattern as friendStore/gameStore).

**Initialization**: Called in `authStore.initialize()` after user is loaded (fire-and-forget, same as push notifications).

### Step 4: Create Paywall Screen (`src/screens/profile/PaywallScreen.tsx`)
Full-screen paywall in Robinhood style:

- **Hero section**: "Ace" branding with teal gradient, tagline "Your AI Betting Edge"
- **Feature list**: 4-5 bullet points showing what Ace includes (press advisor, matchup reports, post-round analysis, scoring trends, course intelligence)
- **Package selector**: Toggle between Monthly ($X.XX/mo) and Annual ($X.XX/yr, "Save X%")
- **Subscribe CTA**: Big teal RHButton "Start Free Trial" or "Subscribe"
- **Restore link**: Small text link "Restore Purchases" at bottom
- **Close/back**: X button or back nav
- **Spring animations**: FadeInDown cascade, pressScale on buttons

Navigation: Added to `ProfileStackParamList` as `Paywall: undefined`

### Step 5: Gate Ace Features (4 screens)
Instead of hiding Ace features entirely, we show a **teaser + upgrade CTA**. This is better for conversion — users see what they're missing.

**Pattern for each screen**:
```tsx
const isPremium = useSubscriptionStore((s) => s.isPremium);

// If premium: load and show Ace data as today
// If free: show a locked AceInsightCard with "Upgrade to Ace" CTA
//          that navigates to PaywallScreen
```

**Specific changes per screen**:

| Screen | Current Ace Feature | Free User Sees |
|--------|-------------------|----------------|
| **DashboardScreen** | Scoring trends (form badge), rival insight card | Form badge hidden, rival card replaced with "Unlock Ace" teaser card |
| **GameLobbyScreen** | H2H matchup insight cards | Blurred/locked matchup card with "Upgrade" CTA |
| **ScorecardScreen** | Press advisor (win rate insight) | Press buttons still work, but Ace insight card shows "Upgrade to see press analytics" |
| **SettlementScreen** | Post-round analysis card | Locked card with "See your full analysis" CTA → Paywall |

### Step 6: Profile Screen — Subscription Management
Add to ProfileScreen settings section:
- **If free**: "Upgrade to Ace" row → navigates to Paywall
- **If premium**: "Ace Premium" row with green checkmark, "Manage Subscription" → opens iOS subscription settings via `Linking.openURL('https://apps.apple.com/account/subscriptions')`

### Step 7: Update Navigation Types
- Add `Paywall: undefined` to `ProfileStackParamList`
- Register `PaywallScreen` in `MainNavigator.tsx` ProfileStack
- Also add to `HomeStackParamList` and `NewGameStackParamList` so any screen can navigate to paywall

### Step 8: Update Exports
- Add `subscriptionService` exports to `src/services/index.ts`
- Add `useSubscriptionStore` to `src/stores/index.ts`
- Add `Paywall` screen to navigation

---

## Files to Create (3)
1. `src/services/subscriptionService.ts` — RevenueCat wrapper
2. `src/stores/subscriptionStore.ts` — Subscription state management
3. `src/screens/profile/PaywallScreen.tsx` — Paywall UI

## Files to Modify (9)
1. `app.json` — Add `react-native-purchases` plugin
2. `src/stores/authStore.ts` — Initialize RevenueCat after auth
3. `src/stores/index.ts` — Export subscriptionStore
4. `src/services/index.ts` — Export subscriptionService
5. `src/navigation/types.ts` — Add Paywall to param lists
6. `src/navigation/MainNavigator.tsx` — Register PaywallScreen
7. `src/screens/main/DashboardScreen.tsx` — Gate Ace features
8. `src/screens/game/GameLobbyScreen.tsx` — Gate Ace features
9. `src/screens/game/ScorecardScreen.tsx` — Gate Ace features
10. `src/screens/game/SettlementScreen.tsx` — Gate Ace features
11. `src/screens/main/ProfileScreen.tsx` — Add subscription management row

## No Database Changes Needed
`subscription_status` and `subscription_id` already exist on the `users` table.
