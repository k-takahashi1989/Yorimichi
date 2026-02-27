import { useEffect, useRef } from 'react';
import {
  InterstitialAd,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import Config from 'react-native-config';

// 広告を表示するには false → true に変更してください
const ADS_ENABLED = false;

const AD_UNIT_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : (Config.ADMOB_INTERSTITIAL_ID || TestIds.INTERSTITIAL);

/**
 * インタースティシャル広告フック
 * showIfReady(callback?) を呼ぶと広告を表示し、閉じたあとに callback を実行する。
 * 広告がロードされていない場合は即座に callback を実行して false を返す。
 */
export function useInterstitialAd() {
  // Hooks は常に同じ順序で呼ぶ必要があるため、ADS_ENABLED に関係なく宣言する
  const adRef = useRef<InterstitialAd | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    // 広告を有効にするには ADS_ENABLED を true にしてください
    if (!ADS_ENABLED) return;

    const ad = InterstitialAd.createForAdRequest(AD_UNIT_ID);
    adRef.current = ad;

    const unsubLoad = ad.addAdEventListener(AdEventType.LOADED, () => {
      loadedRef.current = true;
    });
    const unsubClose = ad.addAdEventListener(AdEventType.CLOSED, () => {
      loadedRef.current = false;
      ad.load(); // 次回用にプリロード
    });

    ad.load();

    return () => {
      unsubLoad();
      unsubClose();
    };
  }, []);

  /**
   * 広告が準備できていれば表示する。
   * @param callback 広告を閉じた後（または広告なしの場合は即座）に実行
   * @returns 広告を表示した場合 true、ロード未完了の場合 false
   */
  const showIfReady = (callback?: () => void): boolean => {
    // 広告無効時は即座に callback を実行して終了
    if (!ADS_ENABLED) {
      callback?.();
      return false;
    }
    if (loadedRef.current && adRef.current) {
      if (callback) {
        const unsub = adRef.current.addAdEventListener(AdEventType.CLOSED, () => {
          unsub();
          callback();
        });
      }
      adRef.current.show();
      return true;
    }
    callback?.();
    return false;
  };

  return { showIfReady };
}
