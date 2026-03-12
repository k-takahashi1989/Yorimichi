import React, { useRef, useEffect } from 'react';
import { Alert, Linking } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialIcons';
import notifee from '@notifee/react-native';
import { useInterstitialAd } from '../hooks/useInterstitialAd';
import { useSettingsStore } from '../store/memoStore';
import { useMemoStore } from '../store/memoStore';
import { useTranslation } from 'react-i18next';
import { useForegroundNotificationHandler } from '../services/notificationService';
import { joinSharedMemo } from '../services/shareService';
import { getDeviceId } from '../utils/deviceId';
import { storage } from '../storage/mmkvStorage';

import { RootStackParamList, MainTabParamList } from '../types';
import MemoListScreen from '../screens/MemoListScreen';
import MemoDetailScreen from '../screens/MemoDetailScreen';
import MemoEditScreen from '../screens/MemoEditScreen';
import LocationPickerScreen from '../screens/LocationPickerScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PremiumScreen from '../screens/PremiumScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs(): React.JSX.Element {
  const { t } = useTranslation();
  const { showIfReady } = useInterstitialAd();
  const totalMemoRegistrations = useSettingsStore(s => s.totalMemoRegistrations);

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
            if (totalMemoRegistrations >= 5) {
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

  // 共有リンクを処理するハンドラ
  const handleSharedUrl = async (url: string | null) => {
    if (!url) return;
    try {
      // new URL() はカスタムスキームで失敗することがある → 正規表現でパース
      const match = url.match(/[?&]shareId=([^&]+)/);
      const shareId = match ? match[1] : null;
      if (!shareId) return;
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
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[handleSharedUrl] error:', msg);
    }
  };

  // フォアグラウンドで通知をタップしたとき MemoDetail へ遷移
  useEffect(() => {
    useForegroundNotificationHandler((memoId: string) => {
      navigationRef.current?.navigate('MemoDetail', { memoId });
    });
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
        useSettingsStore.getState().syncPurchaseStatus().catch(() => {});
      }}
      onReady={() => {
        // killed 状態から通知タップで起動した場合: getInitialNotification で memoId を取得し遷移
        notifee.getInitialNotification().then(initial => {
          const memoId = initial?.notification?.data?.memoId as string | undefined;
          if (memoId) {
            navigationRef.current?.navigate('MemoDetail', { memoId });
          }
        }).catch(() => {});

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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
