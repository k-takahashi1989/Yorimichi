/**
 * App スモークテスト
 * @format
 */

// ナビゲーションのネイティブ依存をモック
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
    useNavigation: jest.fn(() => ({ navigate: jest.fn(), goBack: jest.fn() })),
    useRoute: jest.fn(() => ({ params: {} })),
  };
});
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: jest.fn(() => ({
    Navigator: ({ children }: { children: React.ReactNode }) => children,
    Screen: ({ component: Comp }: { component: React.ComponentType }) => null,
  })),
}));
jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: jest.fn(() => ({
    Navigator: ({ children }: { children: React.ReactNode }) => children,
    Screen: () => null,
  })),
}));
jest.mock('react-native-screens', () => ({
  enableScreens: jest.fn(),
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => children,
  Swipeable: ({ children }: { children: React.ReactNode }) => children,
}));

// サービスのモック (副作用を防ぐ)
jest.mock('../src/services/notificationService', () => ({
  createNotificationChannel: jest.fn().mockResolvedValue(undefined),
  registerBackgroundNotificationHandler: jest.fn(),
  handleForegroundNotification: jest.fn(),
}));
jest.mock('../src/services/badgeService', () => ({
  onAppLaunch: jest.fn(() => []),
  onGeofenceVisit: jest.fn(() => []),
  onMemoCreate: jest.fn(() => []),
  onItemComplete: jest.fn(() => []),
  onShareMemo: jest.fn(() => []),
}));
jest.mock('../src/components/BadgeUnlockModal', () => {
  const React = require('react');
  const Modal = () => null;
  Modal.showBadgeUnlock = jest.fn();
  return { __esModule: true, default: Modal, showBadgeUnlock: jest.fn() };
});
jest.mock('../src/services/fcmService', () => ({
  registerFcmToken: jest.fn().mockResolvedValue(undefined),
  listenTokenRefresh: jest.fn(() => jest.fn()),
  onForegroundMessage: jest.fn(() => jest.fn()),
  setBackgroundMessageHandler: jest.fn(),
}));
jest.mock('../src/services/purchaseService', () => ({
  initPurchases: jest.fn(),
  checkEntitlementActive: jest.fn().mockResolvedValue(false),
}));
jest.mock('../src/services/backupService', () => ({
  backupAllMemos: jest.fn().mockResolvedValue(0),
  shouldAutoBackup: jest.fn(() => false),
}));
jest.mock('../src/services/crashlyticsService', () => ({
  initCrashlytics: jest.fn(),
  recordError: jest.fn(),
}));
jest.mock('../src/services/geofenceService', () => ({
  startGeofenceMonitoring: jest.fn().mockResolvedValue(undefined),
  stopGeofenceMonitoring: jest.fn().mockResolvedValue(undefined),
  clearMemoFromCache: jest.fn(),
  setNotifWindowNative: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('App が例外なくレンダーされる', async () => {
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(<App />);
  });
});
