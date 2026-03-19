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
import { seedDevMemos } from './src/utils/devSeed';
import ReviewPromptModal from './src/components/ReviewPromptModal';
import { shouldShowPremiumPromo } from './src/utils/premiumPromoUtils';
import { showPremiumPromo } from './src/components/PremiumPromoModal';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  useEffect(() => {
    // Crashlytics 初期化（__DEV__ 時は収集無効）
    initCrashlytics();

    // DEV: メモが空なら テストデータを自動投入
    seedDevMemos();

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

      // プレミアムプロモ: 無料ユーザーに10日周期で提案
      const promoSettings = useSettingsStore.getState();
      const isEffectivePremiumForPromo = selectEffectivePremium(promoSettings);
      if (!isEffectivePremiumForPromo) {
        const promoDays = shouldShowPremiumPromo(
          promoSettings.firstLaunchDate,
          promoSettings.lastPremiumPromoAt,
        );
        if (promoDays != null) {
          // バッジ演出と被らないよう少し遅延
          setTimeout(() => {
            showPremiumPromo(promoDays);
            useSettingsStore.getState().setLastPremiumPromoAt(Date.now());
          }, newBadges.length > 0 ? 2000 : 0);
        }
      }
    });

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

    // 権限リクエスト: オンボーディング完了後に実行
    // 既存ユーザーは即時実行、新規ユーザーはオンボーディング完了を待つ
    const hasSeenOnboarding = useSettingsStore.getState().seenTutorials.includes('onboarding');
    if (hasSeenOnboarding) {
      scheduleWhenIdle(() => initPermissions());
    } else {
      const unsub = useSettingsStore.subscribe((state) => {
        if (state.seenTutorials.includes('onboarding')) {
          unsub();
          scheduleWhenIdle(() => initPermissions());
        }
      });
      // クリーンアップ用に返却（useEffect の return で解除）
      return () => unsub();
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <AppNavigator />
        <BadgeUnlockModal />
        <ReviewPromptModal />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
