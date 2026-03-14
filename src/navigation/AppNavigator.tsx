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

import { RootStackParamList, MainTabParamList } from '../types';
import MemoListScreen from '../screens/MemoListScreen';
import MemoDetailScreen from '../screens/MemoDetailScreen';
import MemoEditScreen from '../screens/MemoEditScreen';
import LocationPickerScreen from '../screens/LocationPickerScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PremiumScreen from '../screens/PremiumScreen';
import BadgeListScreen from '../screens/BadgeListScreen';

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

  // ディープリンクを処理するハンドラ（共有 / ウィジェット）
  const handleSharedUrl = async (url: string | null) => {
    if (!url) return;
    try {
      // ウィジェットからのメモ詳細遷移
      const memoIdMatch = url.match(/[?&]memoId=([^&]+)/);
      if (memoIdMatch) {
        setTimeout(() => {
          navigationRef.current?.navigate('MemoDetail', { memoId: memoIdMatch[1] });
        }, 300);
        return;
      }

      // ウィジェットからの新規メモ作成 → 場所選択フローへ
      if (url.includes('newMemo=true')) {
        setTimeout(() => {
          navigationRef.current?.navigate('LocationPicker', {});
        }, 300);
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
      Alert.alert(
        t('share.importTitle'),
        t('share.importMessage', { title: doc.title }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('share.importConfirm'),
            onPress: () => {
              const memo = importSharedMemo(
                { title: doc.title, items: doc.items, locations: doc.locations },
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
      navigationRef.current?.navigate('MemoDetail', { memoId });
    });
  }, []);

  // FCM: トークン登録 + フォアグラウンドメッセージリスナー
  useEffect(() => {
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
  useEffect(() => {
    Linking.getInitialURL().then(handleSharedUrl);
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
        // killed 状態から通知タップで起動した場合: getInitialNotification で memoId を取得し遷移
        notifee.getInitialNotification().then(initial => {
          const memoId = initial?.notification?.data?.memoId as string | undefined;
          if (memoId) {
            navigationRef.current?.navigate('MemoDetail', { memoId });
          }
        }).catch(e => recordError(e, '[AppNavigator] getInitialNotification'));

        // MMKV 経由のブックマーク（バックグラウンドからのフォールバック）
        const pending = storage.getString('pendingNotificationMemoId');
        if (pending) {
          storage.remove('pendingNotificationMemoId');
          navigationRef.current?.navigate('MemoDetail', { memoId: pending });
        }
      }}>
      <Stack.Navigator
        screenOptions={{
          headerTintColor: '#4CAF50',
          headerBackTitle: t('nav.backButton'),
        }}>
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
    </NavigationContainer>
  );
}
