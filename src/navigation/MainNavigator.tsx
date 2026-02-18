import React from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { hapticLight } from '../utils/haptics';

// Main tab screens
import { DashboardScreen } from '../screens/main/DashboardScreen';
import { ProfileScreen } from '../screens/main/ProfileScreen';
import { HistoryScreen } from '../screens/main/HistoryScreen';

// Game screens
import { CreateGameScreen } from '../screens/game/CreateGameScreen';
import { GameLobbyScreen } from '../screens/game/GameLobbyScreen';
import { ScorecardScreen } from '../screens/game/ScorecardScreen';
import { SettlementScreen } from '../screens/game/SettlementScreen';
import { GameDetailScreen } from '../screens/game/GameDetailScreen';

// Profile screens
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { FriendsListScreen } from '../screens/profile/FriendsListScreen';
import { AddFriendScreen } from '../screens/profile/AddFriendScreen';

import type {
  MainTabParamList,
  HomeStackParamList,
  NewGameStackParamList,
  HistoryStackParamList,
  ProfileStackParamList,
} from './types';

// ─── Stack Navigators ─────────────────────────────────────────

const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const NewGameStack = createNativeStackNavigator<NewGameStackParamList>();
const HistoryStack = createNativeStackNavigator<HistoryStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Dashboard" component={DashboardScreen} />
      <HomeStack.Screen name="GameLobby" component={GameLobbyScreen} />
      <HomeStack.Screen name="Scorecard" component={ScorecardScreen} />
      <HomeStack.Screen name="Settlement" component={SettlementScreen} />
      <HomeStack.Screen name="GameDetail" component={GameDetailScreen} />
    </HomeStack.Navigator>
  );
}

function NewGameStackNavigator() {
  return (
    <NewGameStack.Navigator screenOptions={{ headerShown: false }}>
      <NewGameStack.Screen name="CreateGame" component={CreateGameScreen} />
      <NewGameStack.Screen name="GameLobby" component={GameLobbyScreen as any} />
      <NewGameStack.Screen name="Scorecard" component={ScorecardScreen as any} />
      <NewGameStack.Screen name="Settlement" component={SettlementScreen as any} />
      <NewGameStack.Screen name="FriendsList" component={FriendsListScreen} />
      <NewGameStack.Screen name="AddFriend" component={AddFriendScreen} />
    </NewGameStack.Navigator>
  );
}

function HistoryStackNavigator() {
  return (
    <HistoryStack.Navigator screenOptions={{ headerShown: false }}>
      <HistoryStack.Screen name="HistoryList" component={HistoryScreen} />
      <HistoryStack.Screen name="GameDetail" component={GameDetailScreen as any} />
    </HistoryStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} />
      <ProfileStack.Screen name="FriendsList" component={FriendsListScreen} />
      <ProfileStack.Screen name="AddFriend" component={AddFriendScreen} />
    </ProfileStack.Navigator>
  );
}

// ─── Tab Icons ────────────────────────────────────────────────

function TabIcon({ name, color }: { name: React.ComponentProps<typeof Feather>['name']; focused: boolean; color: string }) {
  return (
    <View style={tabStyles.iconContainer}>
      <Feather name={name} size={22} color={color} />
    </View>
  );
}

const tabStyles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ─── Main Tab Navigator ───────────────────────────────────────

export function MainNavigator() {
  const theme = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.semantic.surface,
          borderTopColor: theme.semantic.border,
          borderTopWidth: 0.5,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: theme.colors.teal[500],
        tabBarInactiveTintColor: theme.colors.gray[500],
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.2,
        },
      }}
      screenListeners={{
        tabPress: () => {
          hapticLight();
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="home" focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="NewGameTab"
        component={NewGameStackNavigator}
        options={{
          tabBarLabel: 'New Game',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="plus-circle" focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryStackNavigator}
        options={{
          tabBarLabel: 'History',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="clock" focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name="user" focused={focused} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
