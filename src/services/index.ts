export { supabase } from './supabase';
export {
  createNassauGame,
  loadGame,
  startGame,
  completeGame,
  cancelGame,
  createPressBet,
  addLatePlayer,
  fetchUserGames,
  type CreatePlayerInput,
} from './gameService';
export { upsertScore, fetchScores, fetchHoleScores } from './scoreService';
export {
  createSettlements,
  markSettlementPaid,
  fetchSettlements,
  buildVenmoDeepLink,
  openVenmoPayment,
} from './settlementService';
export {
  subscribeToGame,
  unsubscribeFromGame,
  type GameRealtimeCallbacks,
} from './realtimeService';
export {
  fetchFriends,
  addFriendByCode,
  removeFriend,
  lookupUserByFriendCode,
} from './friendService';
export {
  configureNotificationHandler,
  registerForPushNotifications,
  clearPushToken,
} from './notificationService';
export {
  getHeadToHeadRecord,
  getAllMatchupRecords,
  getCoursePerformance,
  getPressAnalytics,
  getScoringTrends,
  getPressAdvice,
  getPostRoundAnalysis,
  logAceInteraction,
  logPressSuggestion,
  updatePressSuggestion,
  type PressAdvice,
  type PostRoundAnalysis,
} from './aceService';
export {
  searchCourses,
  getCourseWithHoles,
  findCourseByName,
  saveOrUpdateCourse,
  linkGameToCourse,
  getRecentCourses,
  type CourseWithHoles,
} from './courseService';
export {
  configureRevenueCat,
  identifyUser,
  logOutRevenueCat,
  checkEntitlement,
  getCustomerInfo,
  getOfferings,
  purchasePackage,
  restorePurchases,
  presentPaywall,
  presentCustomerCenter,
  syncSubscriptionToSupabase,
  onCustomerInfoUpdated,
  ENTITLEMENT_ID,
  DEV_PREMIUM_OVERRIDE,
} from './subscriptionService';
