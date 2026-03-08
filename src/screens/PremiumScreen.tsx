import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTranslation } from 'react-i18next';
import { useSettingsStore, selectEffectivePremium } from '../store/memoStore';
import { isTrialActive, trialDaysRemaining } from '../utils/trialUtils';

// ── 比較テーブルの行データ ──────────────────────────────────
const FEATURE_ROWS: Array<{
  icon: string;
  label: string;
  freeVal: string;
  premiumVal: string;
}> = [
  { icon: 'note',           label: 'featureMemos',         freeVal: 'freeVal',             premiumVal: 'premiumVal' },
  { icon: 'list',           label: 'featureItems',         freeVal: 'freeValItems',        premiumVal: 'premiumVal' },
  { icon: 'place',          label: 'featureLocations',     freeVal: 'freeValLocations',    premiumVal: 'premiumValLocations' },
  { icon: 'people',         label: 'featureCollaborators', freeVal: 'freeValCollaborators',premiumVal: 'premiumVal' },
  { icon: 'notifications',  label: 'featureAlarm',         freeVal: 'freeValAlarm',        premiumVal: 'premiumValAlarm' },
  { icon: 'ads-click',      label: 'featureAds',           freeVal: 'freeValAds',          premiumVal: 'premiumValAds' },
];

export default function PremiumScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const isPremium = useSettingsStore(selectEffectivePremium);
  const isRealPremium = useSettingsStore(s => s.isPremium);
  const setIsPremium = useSettingsStore(s => s.setIsPremium);
  const trialStartDate = useSettingsStore(s => s.trialStartDate);
  const hasUsedTrial = useSettingsStore(s => s.hasUsedTrial);
  const startTrial = useSettingsStore(s => s.startTrial);

  const isTrialCurrentlyActive = isTrialActive(trialStartDate);
  const daysLeft = trialDaysRemaining(trialStartDate);

  const handleUpgrade = () => {
    Alert.alert(
      t('premium.upgradeButton'),
      t('premium.comingSoon'),
    );
  };

  const handleStartTrial = () => {
    Alert.alert(
      t('premium.startTrialButton'),
      t('premium.startTrialConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.confirm'), onPress: () => startTrial() },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* 現在のプランバッジ */}
      <View style={[styles.planBadge, isPremium ? styles.planBadgePremium : styles.planBadgeFree]}>
        <Icon
          name={isPremium ? 'star' : 'star-border'}
          size={18}
          color={isPremium ? '#FFF' : '#757575'}
        />
        <Text style={[styles.planBadgeText, isPremium ? styles.planBadgeTextPremium : styles.planBadgeTextFree]}>
          {isPremium ? t('premium.currentPremium') : t('premium.currentFree')}
        </Text>
      </View>

      {/* 比較テーブルヘッダー */}
      <View style={styles.tableHeader}>
        <View style={styles.tableHeaderFeature} />
        <View style={[styles.tableHeaderCol, styles.tableHeaderFree]}>
          <Text style={styles.tableHeaderFreeText}>{t('premium.freePlan')}</Text>
        </View>
        <View style={[styles.tableHeaderCol, styles.tableHeaderPremium]}>
          <Icon name="star" size={14} color="#FFF" />
          <Text style={styles.tableHeaderPremiumText}>{t('premium.premiumPlan')}</Text>
        </View>
      </View>

      {/* 比較テーブル本体 */}
      <View style={styles.tableBody}>
        {FEATURE_ROWS.map((row, idx) => (
          <View
            key={row.label}
            style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}>
            {/* 機能名 */}
            <View style={styles.tableFeatureCell}>
              <Icon name={row.icon} size={18} color="#4CAF50" style={styles.featureIcon} />
              <Text style={styles.tableFeatureText}>
                {t(('premium.' + row.label) as any)}
              </Text>
            </View>
            {/* 無料プラン値 */}
            <View style={styles.tableValCell}>
              <Text style={[styles.tableValText, styles.tableValFree]}>
                {t(('premium.' + row.freeVal) as any)}
              </Text>
            </View>
            {/* プレミアム値 */}
            <View style={styles.tableValCell}>
              <Text style={[styles.tableValText, styles.tableValPremium]}>
                {t(('premium.' + row.premiumVal) as any)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* 現在選択中の列をハイライト */}
      <View style={styles.currentPlanRow}>
        <View style={styles.currentPlanSpacer} />
        <View style={[styles.currentPlanCol, !isPremium && styles.currentPlanColActive]}>
          {!isPremium && (
            <Text style={styles.currentPlanLabel}>▲ {t('premium.freePlan')}</Text>
          )}
        </View>
        <View style={[styles.currentPlanCol, isPremium && styles.currentPlanColActive]}>
          {isPremium && (
            <Text style={[styles.currentPlanLabel, styles.currentPlanLabelPremium]}>
              ▲ {t('premium.premiumPlan')}
            </Text>
          )}
        </View>
      </View>

      {/* CTAボタン / お試しセクション */}
      {isPremium ? (
        <View style={styles.alreadyPremiumRow}>
          <Icon name="check-circle" size={20} color="#4CAF50" />
          <Text style={styles.alreadyPremiumText}>{t('premium.alreadyPremium')}</Text>
        </View>
      ) : (
        <>
          {/* プレミアムお試し（課金プレミアムでない場合のみ表示） */}
          {!isRealPremium && (
            <View style={styles.trialContainer}>
              {!hasUsedTrial ? (
                <TouchableOpacity style={styles.trialBtn} onPress={handleStartTrial}>
                  <Icon name="card-giftcard" size={20} color="#FFF" />
                  <Text style={styles.trialBtnText}>{t('premium.startTrialButton')}</Text>
                </TouchableOpacity>
              ) : isTrialCurrentlyActive ? (
                <View style={styles.trialActiveBadge}>
                  <Icon name="timer" size={16} color="#FFA000" />
                  <Text style={styles.trialActiveText}>
                    {t('premium.trialActive', { days: daysLeft })}
                  </Text>
                </View>
              ) : (
                <Text style={styles.trialExpiredText}>{t('premium.trialExpiredMsg')}</Text>
              )}
            </View>
          )}

          {/* アップグレードCTA */}
          <TouchableOpacity style={styles.upgradeBtn} onPress={handleUpgrade}>
            <Icon name="star" size={20} color="#FFF" />
            <Text style={styles.upgradeBtnText}>
              {t('premium.upgradeButton')}
              {'  '}
              <Text style={styles.comingSoonText}>{t('premium.comingSoon')}</Text>
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* DEV用トグル（本番ビルドには出ない） */}
      {__DEV__ && (
        <TouchableOpacity
          style={styles.devToggleBtn}
          onPress={() => setIsPremium(!isRealPremium)}>
          <Text style={styles.devToggleText}>
            {isRealPremium ? t('premium.devToggleOn') : t('premium.devToggleOff')}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const COL_FREE_WIDTH = 90;
const COL_PREMIUM_WIDTH = 90;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { padding: 16, paddingBottom: 40 },

  // プランバッジ
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 24,
    gap: 6,
  },
  planBadgeFree: { backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E0E0E0' },
  planBadgePremium: { backgroundColor: '#FF8F00' },
  planBadgeText: { fontSize: 14, fontWeight: '600' },
  planBadgeTextFree: { color: '#757575' },
  planBadgeTextPremium: { color: '#FFF' },

  // テーブルヘッダー
  tableHeader: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  tableHeaderFeature: { flex: 1 },
  tableHeaderCol: {
    width: COL_FREE_WIDTH,
    alignItems: 'center',
    paddingVertical: 10,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  tableHeaderFree: { backgroundColor: '#EEEEEE' },
  tableHeaderPremium: { backgroundColor: '#FF8F00', marginLeft: 2 },
  tableHeaderFreeText: { fontSize: 13, fontWeight: '700', color: '#616161' },
  tableHeaderPremiumText: { fontSize: 13, fontWeight: '700', color: '#FFF' },

  // テーブル本体
  tableBody: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 1,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
  },
  tableRowAlt: { backgroundColor: '#FAFAFA' },

  // 機能名セル
  tableFeatureCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureIcon: { marginRight: 2 },
  tableFeatureText: { fontSize: 14, color: '#424242', flexShrink: 1 },

  // 値セル
  tableValCell: {
    width: COL_FREE_WIDTH,
    alignItems: 'center',
  },
  tableValText: { fontSize: 13, fontWeight: '600' },
  tableValFree: { color: '#9E9E9E' },
  tableValPremium: { color: '#E65100' },

  // 現在選択中表示
  currentPlanRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  currentPlanSpacer: { flex: 1 },
  currentPlanCol: {
    width: COL_FREE_WIDTH,
    alignItems: 'center',
    paddingTop: 4,
  },
  currentPlanColActive: {},
  currentPlanLabel: { fontSize: 12, color: '#616161', fontWeight: '600' },
  currentPlanLabelPremium: { color: '#E65100' },

  // CTAボタン
  upgradeBtn: {
    backgroundColor: '#E65100',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 2,
  },
  upgradeBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  comingSoonText: { fontSize: 12, fontWeight: '400', color: 'rgba(255,255,255,0.8)' },

  // プレミアムお試し
  trialContainer: {
    marginBottom: 12,
  },
  trialBtn: {
    backgroundColor: '#00897B',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    elevation: 2,
  },
  trialBtnText: { fontSize: 15, fontWeight: '700' as const, color: '#FFF' },
  trialActiveBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 12,
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  trialActiveText: { fontSize: 14, fontWeight: '600' as const, color: '#E65100' },
  trialExpiredText: {
    textAlign: 'center' as const,
    fontSize: 13,
    color: '#9E9E9E',
    paddingVertical: 12,
  },

  // プレミアム済み表示
  alreadyPremiumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
  },
  alreadyPremiumText: { fontSize: 15, fontWeight: '600', color: '#2E7D32' },

  // DEVトグル
  devToggleBtn: {
    marginTop: 24,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#263238',
    borderRadius: 8,
  },
  devToggleText: { fontSize: 12, color: '#80CBC4' },
});
