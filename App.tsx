/**
 * Yorimichi - メインエントリコンポーネント
 * @format
 */

import React, { useEffect } from 'react';
import { Alert, Linking, PermissionsAndroid, Platform, StatusBar, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { createNotificationChannel } from './src/services/notificationService';
import { startGeofenceMonitoring, setNotifWindowNative } from './src/services/geofenceService';
import { useSettingsStore, useMemoStore, selectEffectivePremium } from './src/store/memoStore';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import './src/i18n'; // i18n 初期化
import i18n from './src/i18n';
import { initPurchases } from './src/services/purchaseService';
import { backupAllMemos, shouldAutoBackup } from './src/services/backupService';
import { getDeviceId } from './src/utils/deviceId';
import { initCrashlytics, recordError } from './src/services/crashlyticsService';
import { onAppLaunch } from './src/services/badgeService';
import { showBadgeUnlock } from './src/components/BadgeUnlockModal';
import BadgeUnlockModal from './src/components/BadgeUnlockModal';

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
    // 少し遅延して実行（起動直後の負荷を避ける）
    setTimeout(() => runAutoBackup(), 3000);

    // バッジ: アプリ起動時の判定
    setTimeout(() => {
      const newBadges = onAppLaunch();
      if (newBadges.length > 0) showBadgeUnlock(newBadges);
    }, 2000);

    // 位置情報権限チェック → 必要なら起動時にリクエスト
    const initPermissions = async () => {
      const androidVersion = Platform.Version as number;

      // 1. 前景位置情報
      const fineStatus = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
      if (fineStatus === RESULTS.BLOCKED) {
        Alert.alert(
          i18n.t('appPermission.fineLocationTitle'),
          i18n.t('appPermission.fineLocationMessage'),
          [
            { text: i18n.t('appPermission.later'), style: 'cancel' },
            { text: i18n.t('appPermission.openSettings'), onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }
      if (fineStatus === RESULTS.DENIED) {
        const result = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
        if (result !== RESULTS.GRANTED) return;
      }

      // 前景許可取得済み → ジオフェンス開始
      startGeofenceMonitoring();

      // 2. バックグラウンド位置情報 (Android 10+ / API 29+)
      if (androidVersion >= 29) {
        const bgStatus = await check(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
        if (bgStatus === RESULTS.DENIED) {
          await request(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
        }
      }

      // 3. プッシュ通知 (Android 13+ / API 33+)
      if (androidVersion >= 33) {
        const notifGranted = await PermissionsAndroid.check(
          'android.permission.POST_NOTIFICATIONS' as any,
        );
        if (!notifGranted) {
          await PermissionsAndroid.request(
            'android.permission.POST_NOTIFICATIONS' as any,
          );
        }
      }
    };

    // レンダリング後に少し遅らせてダイアログを表示
    setTimeout(() => initPermissions(), 500);
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
