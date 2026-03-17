/**
 * プレミアムプロモーションモーダル
 *
 * 定期的に使用してくれている無料ユーザーに対し、
 * 利用日数に応じた感謝メッセージとともにプレミアムを提案する。
 * グローバルキュー方式で、どこからでも showPremiumPromo() で表示可能。
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTranslation } from 'react-i18next';

// グローバル表示関数
let _showPromo: ((days: number) => void) | null = null;
// ナビゲーションコールバック（AppNavigator 側で設定）
let _navigateToPremium: (() => void) | null = null;

export function showPremiumPromo(days: number): void {
  _showPromo?.(days);
}

export function setPremiumPromoNavigator(navigate: () => void): void {
  _navigateToPremium = navigate;
}

export default function PremiumPromoModal(): React.JSX.Element {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [days, setDays] = useState(0);
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    _showPromo = (d: number) => {
      setDays(d);
      setVisible(true);
      scaleAnim.setValue(0);
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }).start();
    };
    return () => { _showPromo = null; };
  }, [scaleAnim]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
  }, []);

  const handleUpgrade = useCallback(() => {
    setVisible(false);
    _navigateToPremium?.();
  }, []);

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
            <Icon name="celebration" size={48} color="#FF9800" />
          </View>
          <Text style={styles.title}>
            {t('premiumPromo.title', { days })}
          </Text>
          <Text style={styles.message}>
            {t('premiumPromo.message')}
          </Text>
          <TouchableOpacity style={styles.upgradeBtn} onPress={handleUpgrade}>
            <Text style={styles.upgradeBtnText}>
              {t('premiumPromo.upgradeButton')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.laterBtn} onPress={handleDismiss}>
            <Text style={styles.laterBtnText}>{t('premiumPromo.later')}</Text>
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
    backgroundColor: '#FFF3E0',
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
  upgradeBtn: {
    backgroundColor: '#FF9800',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  upgradeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  laterBtn: {
    paddingVertical: 8,
  },
  laterBtnText: {
    color: '#9E9E9E',
    fontSize: 14,
  },
});
