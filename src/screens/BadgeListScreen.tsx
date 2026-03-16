/**
 * バッジ一覧画面
 *
 * カテゴリタブ＋グリッド表示。
 * 未解除バッジはグレーアウト、隠しバッジは「???」表示。
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { StarSvg } from '../assets/icons';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../store/memoStore';
import {
  BADGE_DEFINITIONS,
  BADGE_CATEGORIES,
  BadgeCategory,
} from '../config/badgeDefinitions';

export default function BadgeListScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const unlockedBadges = useSettingsStore(s => s.unlockedBadges);
  const [selectedCategory, setSelectedCategory] = useState<BadgeCategory>('visit');

  const filteredBadges = BADGE_DEFINITIONS.filter(b => b.category === selectedCategory);
  const totalUnlocked = unlockedBadges.length;
  const totalBadges = BADGE_DEFINITIONS.length;

  return (
    <View style={styles.container}>
      {/* 進捗サマリー */}
      <View style={styles.summary}>
        <StarSvg width={28} height={28} />
        <Text style={styles.summaryText}>
          {t('badges.progress', { unlocked: totalUnlocked, total: totalBadges })}
        </Text>
      </View>

      {/* カテゴリタブ */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
        <View style={styles.tabRow}>
          {BADGE_CATEGORIES.map(cat => (
            <TouchableOpacity
              testID={`badge-tab-${cat.key}`}
              key={cat.key}
              style={[styles.tab, selectedCategory === cat.key && styles.tabActive]}
              onPress={() => setSelectedCategory(cat.key)}>
              <Text style={[styles.tabText, selectedCategory === cat.key && styles.tabTextActive]}>
                {t(cat.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* バッジグリッド */}
      <ScrollView contentContainerStyle={styles.grid}>
        {filteredBadges.map(badge => {
          const isUnlocked = unlockedBadges.includes(badge.id);
          const isHiddenLocked = badge.hidden && !isUnlocked;
          return (
            <View key={badge.id} style={[styles.badgeCard, !isUnlocked && styles.badgeCardLocked]}>
              <View style={[styles.badgeIcon, !isUnlocked && styles.badgeIconLocked]}>
                {isHiddenLocked ? (
                  <Icon name="lock" size={28} color="#BDBDBD" />
                ) : (
                  <Icon
                    name={badge.iconName}
                    size={28}
                    color={isUnlocked ? '#FFC107' : '#BDBDBD'}
                  />
                )}
              </View>
              <Text style={[styles.badgeName, !isUnlocked && styles.badgeNameLocked]} numberOfLines={1}>
                {isHiddenLocked ? '???' : t(badge.nameKey)}
              </Text>
              <Text style={styles.badgeDesc} numberOfLines={2}>
                {isHiddenLocked ? '???' : t(badge.descriptionKey)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: '#fff',
    elevation: 1,
  },
  summaryText: { fontSize: 16, fontWeight: '700', color: '#424242' },
  tabScroll: { maxHeight: 48, backgroundColor: '#fff' },
  tabRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 8, alignItems: 'center', height: 48 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
  },
  tabActive: { backgroundColor: '#FFC107' },
  tabText: { fontSize: 13, color: '#757575', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 10,
  },
  badgeCard: {
    width: '30.5%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    elevation: 1,
  },
  badgeCardLocked: { opacity: 0.5 },
  badgeIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFF8E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeIconLocked: { backgroundColor: '#F5F5F5' },
  badgeName: { fontSize: 12, fontWeight: '700', color: '#424242', textAlign: 'center', marginBottom: 4 },
  badgeNameLocked: { color: '#BDBDBD' },
  badgeDesc: { fontSize: 10, color: '#9E9E9E', textAlign: 'center', lineHeight: 14 },
});
