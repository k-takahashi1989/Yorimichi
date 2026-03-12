import React from 'react';
import { Platform } from 'react-native';
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from 'react-native-google-mobile-ads';
import Config from 'react-native-config';
import { useSettingsStore, selectEffectivePremium } from '../store/memoStore';

// 本番で広告IDが未設定の場合はテストIDを使わず無効化する（AdMobポリシー違反防止）
const AD_UNIT_ID = __DEV__
  ? TestIds.ADAPTIVE_BANNER
  : Config.ADMOB_BANNER_ID || null;

const ADS_ENABLED = AD_UNIT_ID != null;

export default function AdBanner(): React.JSX.Element | null {
  const isPremium = useSettingsStore(selectEffectivePremium);

  // 広告無効時・プレミアムユーザーは非表示
  if (!ADS_ENABLED || isPremium) return null;

  if (Platform.OS !== 'android') return null;
  return (
    <BannerAd
      unitId={AD_UNIT_ID!}
      size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      onAdFailedToLoad={(error) => __DEV__ && console.warn('AdBanner failed:', error)}
    />
  );
}
