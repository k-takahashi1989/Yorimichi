/**
 * バッジ解除演出モーダル
 *
 * 新しいバッジが解除されたとき、スケールアニメーションで表示する。
 * 複数同時解除時はキューで1枚ずつ表示。
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
import { getBadgeById } from '../config/badgeDefinitions';

// グローバルキュー: どの画面からでもバッジ解除演出を発火できるように
let _enqueueBadge: ((badgeId: string) => void) | null = null;

export function showBadgeUnlock(badgeIds: string[]): void {
  if (!_enqueueBadge) return;
  badgeIds.forEach(id => _enqueueBadge!(id));
}

export default function BadgeUnlockModal(): React.JSX.Element {
  const { t } = useTranslation();
  const [queue, setQueue] = useState<string[]>([]);
  const [currentBadgeId, setCurrentBadgeId] = useState<string | null>(null);
  const scaleAnim = useRef(new Animated.Value(0)).current;

  // グローバルキュー登録
  useEffect(() => {
    _enqueueBadge = (id: string) => setQueue(q => [...q, id]);
    return () => { _enqueueBadge = null; };
  }, []);

  // キューから1つ取り出して表示
  useEffect(() => {
    if (currentBadgeId || queue.length === 0) return;
    const [next, ...rest] = queue;
    setCurrentBadgeId(next);
    setQueue(rest);
    scaleAnim.setValue(0);
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 80,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [queue, currentBadgeId, scaleAnim]);

  const handleDismiss = useCallback(() => {
    setCurrentBadgeId(null);
  }, []);

  if (!currentBadgeId) return <></>;

  const badge = getBadgeById(currentBadgeId);
  if (!badge) return <></>;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleDismiss}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleDismiss}>
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.iconWrap}>
            <Icon name={badge.iconName} size={48} color="#FFC107" />
          </View>
          <Text style={styles.unlockLabel}>{t('badges.unlocked')}</Text>
          <Text style={styles.badgeName}>{t(badge.nameKey)}</Text>
          <Text style={styles.badgeDesc}>{t(badge.descriptionKey)}</Text>
          <TouchableOpacity style={styles.dismissBtn} onPress={handleDismiss}>
            <Text style={styles.dismissText}>{t('badges.great')}</Text>
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
    padding: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    elevation: 10,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFF8E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  unlockLabel: {
    fontSize: 13,
    color: '#FF9800',
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
  },
  badgeName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 8,
    textAlign: 'center',
  },
  badgeDesc: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  dismissBtn: {
    backgroundColor: '#FFC107',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  dismissText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
