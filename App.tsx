/**
 * Yorimichi - メインエントリコンポーネント
 * @format
 */

import React, { useEffect } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { createNotificationChannel } from './src/services/notificationService';
import { setNotifWindowNative } from './src/services/geofenceService';
import { useSettingsStore, useMemoStore, selectEffectivePremium } from './src/store/memoStore';
import './src/i18n'; // i18n 初期化
import { initPurchases } from './src/services/purchaseService';
import { backupAllMemos, shouldAutoBackup } from './src/services/backupService';
import { getDeviceId } from './src/utils/deviceId';
import { initCrashlytics, recordError } from './src/services/crashlyticsService';
import { onAppLaunch } from './src/services/badgeService';
import { showBadgeUnlock } from './src/components/BadgeUnlockModal';
import BadgeUnlockModal from './src/components/BadgeUnlockModal';
import { initPermissions } from './src/services/permissionService';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  useEffect(() => {
    // Crashlytics 初期化（__DEV__ 時は収集無効）
    initCrashlytics();

    // RevenueCat 初期化 → 起動時にエンタイトルメントを同期
    initPurchases();
    useSettingsStore.getState().syncPurchaseStatus().catch(e => {
      recordError(e, '[App] syncPurchaseStatus');
    });

    // 通知チャンネルの作成 (Android 必須)
    createNotificationChannel();

    // 起動時: notifWindow 設定を Android SharedPreferences に同期
    // （アプリ再インストール後のズレや stale 値を防ぐ）
    const { notifWindowEnabled, notifWindowStart, notifWindowEnd } =
      useSettingsStore.getState();
    setNotifWindowNative(notifWindowEnabled, notifWindowStart, notifWindowEnd);

    // プレミアム日次クラウドバックアップ（起動時に自動実行）
    const runAutoBackup = async () => {
      const settings = useSettingsStore.getState();
      const isEffectivePremium = selectEffectivePremium(settings);
      if (!isEffectivePremium) return;
      if (!shouldAutoBackup(settings.lastCloudBackupAt)) return;
      try {
        const memos = useMemoStore.getState().memos;
        const deviceId = getDeviceId();
        const ts = await backupAllMemos(memos, deviceId);
        useSettingsStore.getState().setLastCloudBackupAt(ts);
        if (__DEV__) console.log('[App] auto cloud backup completed');
      } catch (e) {
        recordError(e, '[App] autoCloudBackup');
      }
    };
    // UI がアイドル状態になってから遅延タスクを実行
    // requestIdleCallback が利用可能な場合はそちらを使い、なければ setTimeout にフォールバック
    const scheduleWhenIdle = (fn: () => void) => {
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(() => fn());
      } else {
        setTimeout(fn, 2000);
      }
    };
    scheduleWhenIdle(() => {
      runAutoBackup();

      // バッジ: アプリ起動時の判定
      const newBadges = onAppLaunch();
      if (newBadges.length > 0) showBadgeUnlock(newBadges);
    });

    // 既にオンボーディング済みのユーザーのみ起動時に権限をリクエスト
    // （初回ユーザーはオンボーディング完了後にリクエストする）
    const hasSeenOnboarding = useSettingsStore.getState().seenTutorials.includes('onboarding');
    if (hasSeenOnboarding) {
      scheduleWhenIdle(() => initPermissions());
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <AppNavigator />
        <BadgeUnlockModal />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
