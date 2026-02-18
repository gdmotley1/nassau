import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// ─── Root Stack (wraps Main + modals) ────────────────────────

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList>;
  AcePaywall: undefined;
};

// ─── Home Stack ───────────────────────────────────────────────

export type HomeStackParamList = {
  Dashboard: undefined;
  GameLobby: { gameId: string };
  Scorecard: { gameId: string };
  Settlement: { gameId: string };
  GameDetail: { gameId: string };
};

// ─── New Game Stack ───────────────────────────────────────────

export type NewGameStackParamList = {
  CreateGame: undefined;
  GameLobby: { gameId: string };
  Scorecard: { gameId: string };
  Settlement: { gameId: string };
  FriendsList: undefined;
  AddFriend: undefined;
};

// ─── History Stack ────────────────────────────────────────────

export type HistoryStackParamList = {
  HistoryList: undefined;
  GameDetail: { gameId: string };
};

// ─── Profile Stack ───────────────────────────────────────────

export type ProfileStackParamList = {
  ProfileMain: undefined;
  EditProfile: undefined;
  FriendsList: undefined;
  AddFriend: undefined;
};

// ─── Tab Navigator ────────────────────────────────────────────

export type MainTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  NewGameTab: NavigatorScreenParams<NewGameStackParamList>;
  HistoryTab: NavigatorScreenParams<HistoryStackParamList>;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
};

// ─── Screen Props Helpers ─────────────────────────────────────

export type HomeStackScreenProps<T extends keyof HomeStackParamList> =
  NativeStackScreenProps<HomeStackParamList, T>;

export type NewGameStackScreenProps<T extends keyof NewGameStackParamList> =
  NativeStackScreenProps<NewGameStackParamList, T>;

export type HistoryStackScreenProps<T extends keyof HistoryStackParamList> =
  NativeStackScreenProps<HistoryStackParamList, T>;

export type ProfileStackScreenProps<T extends keyof ProfileStackParamList> =
  NativeStackScreenProps<ProfileStackParamList, T>;
