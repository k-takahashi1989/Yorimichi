/**
 * レビュー依頼モーダル (B→A 方式)
 *
 * 自前モーダルで「楽しんでいますか？」と聞き、
 * Yes → In-App Review API を呼ぶ
 * No  → フィードバック用の連絡先へ誘導
 *
 * PremiumPromoModal と同じグローバルキュー方式。
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Linking,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../store/memoStore';

// グローバル表示関数
let _showReviewPrompt: (() => void) | null = null;

export function showReviewPrompt(): void {
  _showReviewPrompt?.();
}

// In-App Review API を動的にインポート（未インストール時はフォールバック）
async function requestInAppReview(): Promise<void> {
  try {
    const InAppReview = require('react-native-in-app-review');
    if (InAppReview.isAvailable()) {
      await InAppReview.RequestInAppReview();
    }
  } catch {
    // ライブラリ未インストール時はストアページへフォールバック
    const storeUrl = Platform.select({
      android: 'https://play.google.com/store/apps/details?id=com.yorimichi',
      ios: 'https://apps.apple.com/app/idXXXXXXXXXX',
    });
    if (storeUrl) Linking.openURL(storeUrl);
  }
}

export default function ReviewPromptModal(): React.JSX.Element {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    _showReviewPrompt = () => {
      setVisible(true);
      scaleAnim.setValue(0);
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }).start();
    };
    return () => { _showReviewPrompt = null; };
  }, [scaleAnim]);

  const recordShown = useCallback(() => {
    useSettingsStore.getState().setLastReviewPromptAt(Date.now());
  }, []);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    recordShown();
  }, [recordShown]);

  const handleYes = useCallback(() => {
    setVisible(false);
    recordShown();
    requestInAppReview();
  }, [recordShown]);

  const handleNo = useCallback(() => {
    setVisible(false);
    recordShown();
    // フィードバック用の連絡先を開く
    Linking.openURL('mailto:support@yorimichi.app?subject=Feedback');
  }, [recordShown]);

  if (!visible) return <></>;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleDismiss}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleDismiss}>
        <Animated.View
          style={[styles.card, { transform: [{ scale: scaleAnim }] }]}
          onStartShouldSetResponder={() => true}>
          <View style={styles.iconWrap}>
            <Icon name="rate-review" size={48} color="#4CAF50" />
          </View>
          <Text style={styles.title}>
            {t('reviewPrompt.title')}
          </Text>
          <Text style={styles.message}>
            {t('reviewPrompt.message')}
          </Text>
          <TouchableOpacity style={styles.yesBtn} onPress={handleYes}>
            <Text style={styles.yesBtnText}>
              {t('reviewPrompt.yes')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.noBtn} onPress={handleNo}>
            <Text style={styles.noBtnText}>
              {t('reviewPrompt.no')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.laterBtn} onPress={handleDismiss}>
            <Text style={styles.laterBtnText}>{t('reviewPrompt.later')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#616161',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  yesBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  yesBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  noBtn: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  noBtnText: {
    color: '#616161',
    fontSize: 16,
    fontWeight: '600',
  },
  laterBtn: {
    paddingVertical: 8,
  },
  laterBtnText: {
    color: '#9E9E9E',
    fontSize: 14,
  },
});
