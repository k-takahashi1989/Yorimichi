import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { StarSvg } from '../assets/icons';
import { useTranslation } from 'react-i18next';
import { useSettingsStore, useMemoStore, selectEffectivePremium } from '../store/memoStore';
import { isTrialActive, trialDaysRemaining } from '../utils/trialUtils';
import {
  getPremiumOffering,
  purchasePackage,
  restorePurchases,
  PremiumOffering,
} from '../services/purchaseService';
import { backupAllMemos, restoreFromBackup } from '../services/backupService';
import { getDeviceId } from '../utils/deviceId';

// ── 比較テーブルの行データ ──────────────────────────────────
const FEATURE_ROWS: Array<{
  icon: string;
  label: string;
  freeVal: string;
  premiumVal: string;
  comingSoon?: boolean;
}> = [
  { icon: 'note',           label: 'featureMemos',         freeVal: 'freeVal',             premiumVal: 'premiumVal' },
  { icon: 'list',           label: 'featureItems',         freeVal: 'freeValItems',        premiumVal: 'premiumVal' },
  { icon: 'place',          label: 'featureLocations',     freeVal: 'freeValLocations',    premiumVal: 'premiumValLocations' },
  { icon: 'people',         label: 'featureCollaborators', freeVal: 'freeValCollaborators',premiumVal: 'premiumValCollaborators' },
  { icon: 'notifications',  label: 'featureAlarm',         freeVal: 'freeValAlarm',        premiumVal: 'premiumValAlarm',       comingSoon: true },
  { icon: 'sync',            label: 'featureRealtimeSync',  freeVal: 'freeValRealtimeSync',  premiumVal: 'premiumValRealtimeSync' },
  { icon: 'cloud-upload',    label: 'featureCloudBackup',   freeVal: 'freeValCloudBackup',   premiumVal: 'premiumValCloudBackup' },
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
  const couponExpiry = useSettingsStore(s => s.couponExpiry);
  const redeemCoupon = useSettingsStore(s => s.redeemCoupon);

  const lastCloudBackupAt = useSettingsStore(s => s.lastCloudBackupAt);
  const setLastCloudBackupAt = useSettingsStore(s => s.setLastCloudBackupAt);
  const memos = useMemoStore(s => s.memos);
  const restoreMemo = useMemoStore(s => s.restoreMemo);

  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreCloudLoading, setRestoreCloudLoading] = useState(false);

  // サブスクオファリング
  const [offering, setOffering] = useState<PremiumOffering | null>(null);
  const [offeringLoading, setOfferingLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    getPremiumOffering().then(o => {
      setOffering(o);
      setOfferingLoading(false);
    });
  }, []);

  const isTrialCurrentlyActive = isTrialActive(trialStartDate);
  const daysLeft = trialDaysRemaining(trialStartDate);
  const isCouponActive = couponExpiry != null && Date.now() < couponExpiry;

  const couponExpiryDate = couponExpiry
    ? new Date(couponExpiry).toLocaleDateString()
    : null;

  const handleUpgrade = async () => {
    const pkg = selectedPlan === 'monthly' ? offering?.monthly : offering?.annual;
    if (!pkg) {
      Alert.alert(t('premium.purchaseErrorTitle'), t('premium.purchaseUnavailable'));
      return;
    }
    setPurchasing(true);
    const result = await purchasePackage(pkg);
    setPurchasing(false);
    if (result.success) {
      // 購入レスポンスの customerInfo から直接フラグを設定（getCustomerInfo のキャッシュ遅延を回避）
      if (result.hasPremium) {
        useSettingsStore.getState().setIsPremium(true);
      } else {
        // フォールバック: customerInfo に反映されていない場合は従来の同期
        await useSettingsStore.getState().syncPurchaseStatus();
      }
      Alert.alert(t('premium.purchaseSuccessTitle'), t('premium.purchaseSuccessMsg'));
    } else if (!result.cancelled) {
      Alert.alert(t('premium.purchaseErrorTitle'), result.error);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    const result = await restorePurchases();
    setRestoring(false);
    if (result.success) {
      await useSettingsStore.getState().syncPurchaseStatus();
      if (result.hasPremium) {
        Alert.alert(t('premium.restoreSuccessTitle'), t('premium.restoreSuccessMsg'));
      } else {
        Alert.alert(t('premium.restoreNoneTitle'), t('premium.restoreNoneMsg'));
      }
    } else {
      Alert.alert(t('premium.purchaseErrorTitle'), result.error);
    }
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

  // ── クラウドバックアップ ──────────────────────────────────────────
  const handleBackupNow = async () => {
    setBackupLoading(true);
    try {
      const deviceId = getDeviceId();
      const ts = await backupAllMemos(memos, deviceId);
      setLastCloudBackupAt(ts);
      Alert.alert(t('premium.backupSuccess'), t('premium.backupSuccessMsg'));
    } catch {
      Alert.alert(t('premium.backupError'), t('premium.backupErrorMsg'));
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreFromCloud = () => {
    Alert.alert(
      t('premium.restoreFromCloud'),
      t('premium.restoreCloudConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: async () => {
            setRestoreCloudLoading(true);
            try {
              const deviceId = getDeviceId();
              const backup = await restoreFromBackup(deviceId);
              if (!backup) {
                Alert.alert(t('premium.restoreCloudNone'), t('premium.restoreCloudNoneMsg'));
                return;
              }
              const existingIds = new Set(memos.map(m => m.id));
              let imported = 0;
              for (const m of backup.memos) {
                if (!existingIds.has(m.id)) {
                  restoreMemo(m);
                  imported++;
                }
              }
              Alert.alert(
                t('premium.restoreCloudSuccess'),
                t('premium.restoreCloudSuccessMsg', { count: imported }),
              );
            } catch {
              Alert.alert(t('premium.backupError'), t('premium.backupErrorMsg'));
            } finally {
              setRestoreCloudLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleRedeemCoupon = async () => {
    const trimmed = couponCode.trim();
    if (!trimmed) {
      Alert.alert(t('premium.couponErrorTitle'), t('premium.couponEmpty'));
      return;
    }
    setCouponLoading(true);
    const result = await redeemCoupon(trimmed);
    setCouponLoading(false);
    if (result === 'ok') {
      setCouponCode('');
      Alert.alert(t('premium.couponSuccess'), t('premium.couponSuccessMsg'));
    } else if (result === 'already_used') {
      Alert.alert(t('premium.couponErrorTitle'), t('premium.couponAlreadyUsed'));
    } else if (result === 'network') {
      Alert.alert(t('premium.couponErrorTitle'), t('premium.couponNetworkError'));
    } else {
      const code = trimmed.toUpperCase();
      Alert.alert(
        t('premium.couponErrorTitle'),
        `${t('premium.couponInvalid')}\n\n${t('premium.couponInvalidDetail', { code })}`,
      );
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* 現在のプランバッジ */}
      <View style={[styles.planBadge, isPremium ? styles.planBadgePremium : styles.planBadgeFree]}>
        <StarSvg width={18} height={18} />
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
            style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt, row.comingSoon && styles.tableRowComingSoon]}>
            {/* 機能名 */}
            <View style={styles.tableFeatureCell}>
              <Icon name={row.icon} size={18} color={row.comingSoon ? '#BDBDBD' : '#4CAF50'} style={styles.featureIcon} />
              <Text style={[styles.tableFeatureText, row.comingSoon && styles.tableFeatureTextDimmed]}>
                {t(('premium.' + row.label) as any)}
              </Text>
            </View>
            {/* 無料プラン値 */}
            <View style={styles.tableValCell}>
              <Text style={[styles.tableValText, row.comingSoon ? styles.tableValDimmed : styles.tableValFree]}>
                {row.comingSoon ? '-' : t(('premium.' + row.freeVal) as any)}
              </Text>
            </View>
            {/* プレミアム値 */}
            <View style={styles.tableValCell}>
              {row.comingSoon ? (
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonText}>{t('premium.comingSoonApril')}</Text>
                </View>
              ) : (
                <Text style={[styles.tableValText, styles.tableValPremium]}>
                  {t(('premium.' + row.premiumVal) as any)}
                </Text>
              )}
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
        <>
          <View style={styles.alreadyPremiumRow}>
            <Icon name="check-circle" size={20} color="#4CAF50" />
            <Text style={styles.alreadyPremiumText}>{t('premium.alreadyPremium')}</Text>
          </View>

          {/* クラウドバックアップセクション（プレミアムのみ） */}
          <View style={styles.backupSection}>
            <View style={styles.backupHeader}>
              <Icon name="cloud-upload" size={20} color="#1565C0" />
              <Text style={styles.backupTitle}>{t('premium.backupTitle')}</Text>
            </View>

            <Text style={styles.backupStatus}>
              {lastCloudBackupAt
                ? t('premium.lastBackup', {
                    date: new Date(lastCloudBackupAt).toLocaleString(),
                  })
                : t('premium.noBackupYet')}
            </Text>

            <View style={styles.backupBtnRow}>
              <TouchableOpacity
                style={[styles.backupBtn, backupLoading && styles.backupBtnDisabled]}
                onPress={handleBackupNow}
                disabled={backupLoading || restoreCloudLoading}>
                {backupLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Icon name="backup" size={18} color="#FFF" />
                )}
                <Text style={styles.backupBtnText}>{t('premium.backupNow')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.restoreCloudBtn,
                  restoreCloudLoading && styles.backupBtnDisabled,
                ]}
                onPress={handleRestoreFromCloud}
                disabled={backupLoading || restoreCloudLoading}>
                {restoreCloudLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Icon name="cloud-download" size={18} color="#FFF" />
                )}
                <Text style={styles.backupBtnText}>{t('premium.restoreFromCloud')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
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

          {/* クーポンコード入力セクション */}
          {isCouponActive ? (
            <View style={styles.couponActiveBadge}>
              <Icon name="card-membership" size={16} color="#1565C0" />
              <Text style={styles.couponActiveText}>
                {t('premium.couponActive', { date: couponExpiryDate })}
              </Text>
            </View>
          ) : (
            <View style={styles.couponContainer}>
              <Text style={styles.couponLabel}>{t('premium.couponLabel')}</Text>
              <View style={styles.couponRow}>
                <TextInput
                  style={styles.couponInput}
                  value={couponCode}
                  onChangeText={setCouponCode}
                  placeholder={t('premium.couponPlaceholder')}
                  placeholderTextColor="#BDBDBD"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!couponLoading}
                />
                <TouchableOpacity
                  style={[styles.couponBtn, (!couponCode.trim() || couponLoading) && styles.couponBtnDisabled]}
                  onPress={handleRedeemCoupon}
                  disabled={!couponCode.trim() || couponLoading}>
                  {couponLoading
                    ? <ActivityIndicator size="small" color="#FFF" />
                    : <Text style={styles.couponBtnText}>{t('premium.couponApply')}</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* プラン選択カード */}
          <View style={styles.planCardsRow}>
            {/* 月額プラン */}
            <TouchableOpacity
              style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardSelected]}
              onPress={() => setSelectedPlan('monthly')}
              disabled={purchasing}>
              <Text style={styles.planCardTitle}>{t('premium.planMonthly')}</Text>
              {offeringLoading ? (
                <ActivityIndicator size="small" color="#E65100" />
              ) : (
                <Text style={styles.planCardPrice}>
                  {offering?.monthly?.product.priceString ?? t('premium.planPriceUnavailable')}
                </Text>
              )}
              <Text style={styles.planCardPer}>{t('premium.planPerMonth')}</Text>
            </TouchableOpacity>

            {/* 年額プラン */}
            <TouchableOpacity
              style={[styles.planCard, styles.planCardAnnual, selectedPlan === 'annual' && styles.planCardSelected]}
              onPress={() => setSelectedPlan('annual')}
              disabled={purchasing}>
              <View style={styles.planCardBestBadge}>
                <Text style={styles.planCardBestText}>{t('premium.planBestValue')}</Text>
              </View>
              <Text style={styles.planCardTitle}>{t('premium.planAnnual')}</Text>
              {offeringLoading ? (
                <ActivityIndicator size="small" color="#E65100" />
              ) : (
                <Text style={styles.planCardPrice}>
                  {offering?.annual?.product.priceString ?? t('premium.planPriceUnavailable')}
                </Text>
              )}
              <Text style={styles.planCardPer}>{t('premium.planPerYear')}</Text>
            </TouchableOpacity>
          </View>

          {/* アップグレードCTA */}
          <TouchableOpacity
            testID="purchase-button"
            style={[styles.upgradeBtn, purchasing && styles.upgradeBtnDisabled]}
            onPress={handleUpgrade}
            disabled={purchasing || offeringLoading}>
            {purchasing
              ? <ActivityIndicator size="small" color="#FFF" />
              : <Icon name="star" size={20} color="#FFF" />}
            <Text style={styles.upgradeBtnText}>{t('premium.upgradeButton')}</Text>
          </TouchableOpacity>

          {/* 購入を復元 */}
          <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore} disabled={restoring}>
            {restoring
              ? <ActivityIndicator size="small" color="#9E9E9E" />
              : <Text style={styles.restoreBtnText}>{t('premium.restoreButton')}</Text>
            }
          </TouchableOpacity>
        </>
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
  tableRowComingSoon: { opacity: 0.55 },

  // 機能名セル
  tableFeatureCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureIcon: { marginRight: 2 },
  tableFeatureText: { fontSize: 14, color: '#424242', flexShrink: 1 },
  tableFeatureTextDimmed: { color: '#9E9E9E' },

  // 値セル
  tableValCell: {
    width: COL_FREE_WIDTH,
    alignItems: 'center',
  },
  tableValText: { fontSize: 13, fontWeight: '600' },
  tableValFree: { color: '#9E9E9E' },
  tableValPremium: { color: '#E65100' },
  tableValDimmed: { color: '#BDBDBD', fontWeight: '400' as const },

  // Coming Soon バッジ
  comingSoonBadge: {
    backgroundColor: '#F3E5F5',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  comingSoonText: { fontSize: 11, fontWeight: '700' as const, color: '#7B1FA2' },

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

  // プラン選択カード
  planCardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  planCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    elevation: 1,
    position: 'relative',
  },
  planCardAnnual: {},
  planCardSelected: {
    borderColor: '#E65100',
    backgroundColor: '#FFF8F5',
  },
  planCardTitle: { fontSize: 13, fontWeight: '700', color: '#424242', marginBottom: 4 },
  planCardPrice: { fontSize: 20, fontWeight: '800', color: '#E65100', marginBottom: 2 },
  planCardPer: { fontSize: 11, color: '#9E9E9E' },
  planCardBestBadge: {
    position: 'absolute',
    top: -10,
    backgroundColor: '#E65100',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  planCardBestText: { fontSize: 10, fontWeight: '700', color: '#FFF' },

  // アップグレードボタン無効状態
  upgradeBtnDisabled: { backgroundColor: '#BDBDBD', elevation: 0 },

  // 復元ボタン
  restoreBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  restoreBtnText: { fontSize: 13, color: '#9E9E9E', textDecorationLine: 'underline' },

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

  // クーポンコード
  couponContainer: {
    marginBottom: 12,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    elevation: 1,
  },
  couponLabel: {
    fontSize: 13,
    color: '#757575',
    marginBottom: 8,
  },
  couponRow: {
    flexDirection: 'row',
    gap: 8,
  },
  couponInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#212121',
    backgroundColor: '#FAFAFA',
    letterSpacing: 1,
  },
  couponBtn: {
    backgroundColor: '#1565C0',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 64,
  },
  couponBtnDisabled: {
    backgroundColor: '#BDBDBD',
  },
  couponBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  couponActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#90CAF9',
    marginBottom: 12,
  },
  couponActiveText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1565C0',
  },

  // クラウドバックアップセクション
  backupSection: {
    marginTop: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    elevation: 1,
  },
  backupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  backupTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1565C0',
  },
  backupStatus: {
    fontSize: 13,
    color: '#757575',
    marginBottom: 12,
  },
  backupBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  backupBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1565C0',
    borderRadius: 10,
    paddingVertical: 12,
    elevation: 1,
  },
  restoreCloudBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#00897B',
    borderRadius: 10,
    paddingVertical: 12,
    elevation: 1,
  },
  backupBtnDisabled: {
    backgroundColor: '#BDBDBD',
    elevation: 0,
  },
  backupBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
});
