import React, { useRef, useEffect } from 'react';
import { Alert, Linking } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialIcons';
import notifee from '@notifee/react-native';
import { useInterstitialAd } from '../hooks/useInterstitialAd';
import { useSettingsStore, selectEffectivePremium } from '../store/memoStore';
import { useMemoStore } from '../store/memoStore';
import { useTranslation } from 'react-i18next';
import { handleForegroundNotification } from '../services/notificationService';
import { registerFcmToken, listenTokenRefresh, onForegroundMessage } from '../services/fcmService';
import { onGeofenceVisit } from '../services/badgeService';
import { showBadgeUnlock } from '../components/BadgeUnlockModal';
import { joinSharedMemo } from '../services/shareService';
import { getDeviceId } from '../utils/deviceId';
import { storage } from '../storage/mmkvStorage';
import { recordError } from '../services/crashlyticsService';
import PremiumPromoModal, { setPremiumPromoNavigator } from '../components/PremiumPromoModal';
import { shouldTriggerOnVisit } from '../utils/reviewPromptUtils';
import { showReviewPrompt } from '../components/ReviewPromptModal';

import { RootStackParamList, MainTabParamList } from '../types';
import MemoListScreen from '../screens/MemoListScreen';
import MemoDetailScreen from '../screens/MemoDetailScreen';
import MemoEditScreen from '../screens/MemoEditScreen';
import LocationPickerScreen from '../screens/LocationPickerScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PremiumScreen from '../screens/PremiumScreen';
import BadgeListScreen from '../screens/BadgeListScreen';
import OnboardingScreen from '../screens/OnboardingScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs(): React.JSX.Element {
  const { t } = useTranslation();
  const { showIfReady } = useInterstitialAd();
  const totalMemoRegistrations = useSettingsStore(s => s.totalMemoRegistrations);
  const isPremium = useSettingsStore(selectEffectivePremium);

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: '#9E9E9E',
        headerShown: false,
      }}>
      <Tab.Screen
        name="MemoList"
        component={MemoListScreen}
        options={{
          tabBarLabel: t('nav.tabList'),
          tabBarIcon: ({ color, size }) => (
            <Icon name="alt-route" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        listeners={{
          tabPress: () => {
            if (!isPremium && totalMemoRegistrations >= 5) {
              showIfReady();
            }
          },
        }}
        options={{
          tabBarLabel: t('nav.tabSettings'),
          tabBarIcon: ({ color, size }) => (
            <Icon name="settings" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator(): React.JSX.Element {
  const { t } = useTranslation();
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const importSharedMemo = useMemoStore(s => s.importSharedMemo);
  const seenTutorials = useSettingsStore(s => s.seenTutorials);
  const hasSeenOnboarding = seenTutorials.includes('onboarding');

  // ディープリンクを処理するハンドラ（共有 / ウィジェット）
  const handleSharedUrl = async (url: string | null) => {
    if (!url) return;
    try {
      // ウィジェット / 通知タップからのメモ詳細遷移
      const memoIdMatch = url.match(/[?&]memoId=([^&]+)/);
      if (memoIdMatch) {
        navigationRef.current?.navigate('MemoDetail', { memoId: memoIdMatch[1] });
        return;
      }

      // ウィジェットからの新規メモ作成 → 場所選択フローへ
      if (url.includes('newMemo=true')) {
        navigationRef.current?.navigate('LocationPicker', {});
        return;
      }

      // new URL() はカスタムスキームで失敗することがある → 正規表現でパース
      const match = url.match(/[?&]shareId=([^&]+)/);
      const shareId = match ? match[1] : null;
      if (!shareId) {
        Alert.alert(t('common.error'), t('share.invalidLink'));
        return;
      }
      const deviceId = getDeviceId();
      const doc = await joinSharedMemo(shareId, deviceId);
      if (!doc) {
        Alert.alert(t('common.error'), t('share.notFound'));
        return;
      }
      // joinSharedMemo 内で ensureSignedIn() が呼ばれ匿名アカウントが確定するため、
      // このタイミングで FCM トークンを再登録し通知を受け取れる状態にする。
      registerFcmToken().catch(e => recordError(e, '[AppNavigator] registerFcmToken after join'));
      Alert.alert(
        t('share.importTitle'),
        t('share.importMessage', { title: doc.title }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('share.importConfirm'),
            onPress: () => {
              const memo = importSharedMemo(
                { title: doc.title, items: doc.items, locations: doc.locations, dueDate: doc.dueDate, note: doc.note },
                shareId,
              );
              // navigationRef がまだ準備できていない場合は少し待つ
              setTimeout(() => {
                navigationRef.current?.navigate('MemoDetail', { memoId: memo.id });
              }, 300);
            },
          },
        ],
      );
    } catch (e: unknown) {
      recordError(e, '[AppNavigator] handleSharedUrl');
      Alert.alert(t('common.error'), t('share.importError'));
    }
  };

  // フォアグラウンドで通知をタップしたとき MemoDetail へ遷移
  useEffect(() => {
    handleForegroundNotification((memoId: string) => {
      // ジオフェンス通知タップ = 訪問とみなしてバッジ判定
      const newBadges = onGeofenceVisit(memoId);
      if (newBadges.length > 0) showBadgeUnlock(newBadges);
      // レビュー依頼: 通知タップ3回目で条件を満たしていれば表示
      const settings = useSettingsStore.getState();
      if (shouldTriggerOnVisit(settings.totalVisitCount, settings.lastReviewPromptAt)) {
        setTimeout(() => showReviewPrompt(), 1500);
      }
      navigationRef.current?.navigate('MemoDetail', { memoId });
    });
  }, []);

  // FCM: トークン登録 + フォアグラウンドメッセージリスナー
  useEffect(() => {
    console.log('[FCM_DEBUG] AppNavigator: calling registerFcmToken');
    registerFcmToken().catch(e => recordError(e, '[AppNavigator] registerFcmToken'));
    const unsubRefresh = listenTokenRefresh();
    const unsubMessage = onForegroundMessage((data) => {
      // フォアグラウンドで共有メモ更新通知を受信した場合
      // notification フィールド付きで送信しているため、Android は自動的にヘッドアップ通知を表示する。
      // 追加のローカル通知生成は不要。
      // 必要に応じて shareId を使って画面リフレッシュも可能。
      if (data.type === 'memo_updated' && data.shareId) {
        // オプトアウトチェックはAndroid通知チャンネル側で制御
        // 現在のメモ詳細画面を自動リフレッシュすることも将来的に検討
      }
    });
    return () => {
      unsubRefresh();
      unsubMessage();
    };
  }, []);

  // アプリ起動時のディープリンク処理
  // 注: getInitialURL は onReady 内でも呼ぶ（killed 状態からの通知タップ時、
  // useEffect の setTimeout(300ms) ではナビゲーターが未準備の場合があるため）
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => handleSharedUrl(url));
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <NavigationContainer
      ref={navigationRef}
      onStateChange={() => {
        useSettingsStore.getState().syncPurchaseStatus().catch(e => recordError(e, '[AppNavigator] syncPurchaseStatus'));
      }}
      onReady={() => {
        // プレミアムプロモモーダルからPremium画面への遷移を登録
        setPremiumPromoNavigator(() => {
          navigationRef.current?.navigate('Premium');
        });

        // killed 状態から通知タップで起動した場合:
        // 1. notifee 経由の通知（期限通知など）は getInitialNotification で取得
        // 2. ネイティブ通知（ジオフェンス）は Linking.getInitialURL 経由でディープリンクから取得
        // 3. MMKV 経由のフォールバック
        notifee.getInitialNotification().then(initial => {
          const memoId = initial?.notification?.data?.memoId as string | undefined;
          if (memoId) {
            navigationRef.current?.navigate('MemoDetail', { memoId });
          }
        }).catch(e => recordError(e, '[AppNavigator] getInitialNotification'));

        // ネイティブ通知タップ → MainActivity でディープリンク化 → Linking で取得
        Linking.getInitialURL().then(handleSharedUrl)
          .catch(e => recordError(e, '[AppNavigator] getInitialURL'));

        // MMKV 経由のブックマーク（バックグラウンドからのフォールバック）
        const pending = storage.getString('pendingNotificationMemoId');
        if (pending) {
          storage.remove('pendingNotificationMemoId');
          navigationRef.current?.navigate('MemoDetail', { memoId: pending });
        }
      }}>
      <Stack.Navigator
        initialRouteName={hasSeenOnboarding ? 'MainTabs' : 'Onboarding'}
        screenOptions={{
          headerTintColor: '#4CAF50',
          headerBackTitle: t('nav.backButton'),
        }}>
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="MemoDetail"
          component={MemoDetailScreen}
          options={{ title: t('nav.memoDetail') }}
        />
        <Stack.Screen
          name="MemoEdit"
          component={MemoEditScreen}
          options={({ route }) => ({
            title: route.params?.memoId ? t('nav.memoEditExisting') : t('nav.memoEditNew'),
          })}
        />
        <Stack.Screen
          name="LocationPicker"
          component={LocationPickerScreen}
          options={{ title: t('nav.locationPicker') }}
        />
        <Stack.Screen
          name="Premium"
          component={PremiumScreen}
          options={{ title: t('premium.screenTitle') }}
        />
        <Stack.Screen
          name="BadgeList"
          component={BadgeListScreen}
          options={{ title: t('badges.screenTitle') }}
        />
      </Stack.Navigator>
      <PremiumPromoModal />
    </NavigationContainer>
  );
}
