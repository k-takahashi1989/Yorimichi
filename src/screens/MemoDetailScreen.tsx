import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Share,
  ActivityIndicator,
  BackHandler,
  Animated,
} from 'react-native';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useShallow } from 'zustand/react/shallow';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { AlertSignSvg, CalendarSvg, ChecklistSvg, CrownSvg, CycleSvg, EditSvg, GroupSvg, LocationPinSvg } from '../assets/icons';
import { isGeofencingActive } from '../services/geofenceService';
import { getLocationsLimit, getItemsLimit, LIMITS_ENABLED, FREE_LIMITS } from '../config/planLimits';
import { buildShareUrl } from '../config/sharing';
import AdBanner from '../components/AdBanner';
import Snackbar from '../components/Snackbar';
import { useTranslation } from 'react-i18next';
import { useMemoStore, useSettingsStore, selectEffectivePremium } from '../store/memoStore';
import { RootStackParamList, ShoppingItem, MemoLocation, SharePresence } from '../types';
import { getDeviceId } from '../utils/deviceId';
import {
  uploadSharedMemo,
  syncSharedMemo,
  subscribePresence,
  subscribeSharedMemo,
  isPresenceActive,
  updateSharedMemoItems,
  updateSharedMemoLocations,
} from '../services/shareService';
import { notifySharedMemoUpdate, getCooldownRemaining } from '../services/fcmService';
import { recordError } from '../services/crashlyticsService';
import { getDueDateInfo } from '../utils/helpers';
import { onItemComplete, onShareMemo } from '../services/badgeService';
import { showBadgeUnlock } from '../components/BadgeUnlockModal';
import { shouldTriggerOnAllItemsCompleted } from '../utils/reviewPromptUtils';
import { showReviewPrompt } from '../components/ReviewPromptModal';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'MemoDetail'>;

export default function MemoDetailScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { memoId } = route.params;

  const memo = useMemoStore(useShallow(s => s.memos.find(m => m.id === memoId)));
  const toggleItem = useMemoStore(s => s.toggleItem);
  const updateItem = useMemoStore(s => s.updateItem);
  const updateMemo = useMemoStore(s => s.updateMemo);
  const deleteLocation = useMemoStore(s => s.deleteLocation);
  const setMemoShareId = useMemoStore(s => s.setMemoShareId);
  const uncheckAllItems = useMemoStore(s => s.uncheckAllItems);
  const checkAllItems = useMemoStore(s => s.checkAllItems);
  const isPremium = useSettingsStore(selectEffectivePremium);


  // 初回フォーカス判定（LocationPickerScreen から戻ってきた場合のみ地点プッシュ）
  const isFirstFocus = useRef(true);

  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [undoTarget, setUndoTarget] = useState<ShoppingItem | null>(null);
  const [allCheckedSnackbarVisible, setAllCheckedSnackbarVisible] = useState(false);
  const [notifModeModalVisible, setNotifModeModalVisible] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(isGeofencingActive());
  const [presences, setPresences] = useState<Record<string, SharePresence>>({});
  const [isSharingLoading, setIsSharingLoading] = useState(false);
  const [isSyncLoading, setIsSyncLoading] = useState(false);
  const [isNotifyLoading, setIsNotifyLoading] = useState(false);
  const [notifyCooldown, setNotifyCooldown] = useState(0);
  const [hideChecked, setHideChecked] = useState(false);
  const [locationsExpanded, setLocationsExpanded] = useState(false);
  const deviceId = getDeviceId();

  // 更新通知: メモが変更されたかどうかを検知するためのベースラインスナップショット
  const memoSnapshotRef = useRef<string>('');
  const getMemoFingerprint = useCallback(() => {
    if (!memo) return '';
    return JSON.stringify({ t: memo.title, n: memo.note, i: memo.items, l: memo.locations });
  }, [memo]);
  // 初回マウント時にベースラインを設定
  useEffect(() => {
    if (memo && !memoSnapshotRef.current) {
      memoSnapshotRef.current = getMemoFingerprint();
    }
  }, [memo, getMemoFingerprint]);
  const hasLocalChanges = memo ? getMemoFingerprint() !== memoSnapshotRef.current : false;

  // 共有メモの Firestore 書き込みをデバウンス（連続チェック操作のバッチ化）
  const sharedItemsSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushSharedItemsSync = useCallback(() => {
    if (!memo?.shareId) return;
    const updatedItems = useMemoStore.getState().memos.find(m => m.id === memoId)?.items ?? [];
    updateSharedMemoItems(memo.shareId, updatedItems).catch(e => recordError(e, '[MemoDetail] shareSync'));
  }, [memoId, memo?.shareId]);
  const debouncedSharedItemsSync = useCallback(() => {
    if (sharedItemsSyncTimer.current) clearTimeout(sharedItemsSyncTimer.current);
    sharedItemsSyncTimer.current = setTimeout(flushSharedItemsSync, 800);
  }, [flushSharedItemsSync]);
  // 画面離脱時にペンディングの同期をフラッシュ
  useEffect(() => {
    return () => {
      if (sharedItemsSyncTimer.current) {
        clearTimeout(sharedItemsSyncTimer.current);
        flushSharedItemsSync();
      }
    };
  }, [flushSharedItemsSync]);

  // 共有メモ通知のクールダウンタイマー＋プログレスバー
  const cooldownProgress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!memo?.shareId) return;
    const remaining = getCooldownRemaining(memo.shareId);
    setNotifyCooldown(remaining);
    if (remaining > 0) {
      // クールダウン中：残り時間に応じたプログレスアニメーション
      const totalCooldown = 60; // 1分
      const elapsed = totalCooldown - remaining;
      cooldownProgress.setValue(elapsed / totalCooldown);
      Animated.timing(cooldownProgress, {
        toValue: 1,
        duration: remaining * 1000,
        useNativeDriver: false,
      }).start();
    } else {
      cooldownProgress.setValue(1);
    }
    const timer = setInterval(() => {
      const r = getCooldownRemaining(memo.shareId!);
      setNotifyCooldown(r);
      if (r <= 0) cooldownProgress.setValue(1);
    }, 1000);
    return () => clearInterval(timer);
  }, [memo?.shareId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 通知送信成功時にプログレスバーをリセット＆開始
  const startCooldownAnimation = useCallback(() => {
    cooldownProgress.setValue(0);
    Animated.timing(cooldownProgress, {
      toValue: 1,
      duration: 60 * 1000,
      useNativeDriver: false,
    }).start();
  }, [cooldownProgress]);

  const handleNotifyCollaborators = async () => {
    if (!memo?.shareId) return;
    setIsNotifyLoading(true);
    try {
      const result = await notifySharedMemoUpdate(memo.shareId, memo.title);
      if (result.status === 'ok') {
        memoSnapshotRef.current = getMemoFingerprint();
        startCooldownAnimation();
        Alert.alert(t('shareNotify.sentTitle'), t('shareNotify.sentMessage'));
      } else if (result.status === 'no_targets') {
        Alert.alert(t('shareNotify.sentTitle'), t('shareNotify.noTargetsMessage'));
      } else if (result.status === 'cooldown') {
        Alert.alert(t('shareNotify.cooldownTitle'), t('shareNotify.cooldownMessage'));
      } else {
        Alert.alert(t('common.error'), `${t('shareNotify.errorMessage')}\n\n[DEBUG] ${result.detail}`);
      }
    } catch (e: any) {
      Alert.alert(t('common.error'), `${t('shareNotify.errorMessage')}\n\n[DEBUG] ${e?.code ?? ''} ${e?.message ?? String(e)}`);
    } finally {
      setIsNotifyLoading(false);
    }
  };

  // ローカルのチェック状態を保持しつつ Firestore の最新データをマージするヘルパー
  // Firestore を items の存在源（追加・削除）の真実源とし、
  // isChecked / checkedAt のみローカル値を優先する。
  // ※ ローカル専有アイテムを残す実装は、リモート削除を誤って復活させるため廃止。
  const mergeSharedDoc = useCallback((doc: import('../types').SharedMemoDoc) => {
    const currentMemo = useMemoStore.getState().memos.find(m => m.id === memoId);
    if (!currentMemo) return;
    const mergedItems = doc.items.map(docItem => {
      const localItem = currentMemo.items.find(li => li.id === docItem.id);
      return localItem
        ? { ...docItem, isChecked: localItem.isChecked, checkedAt: localItem.checkedAt }
        : docItem;
    });
    // オーナーもコラボレーターも Firestore を真実源として locations, note, dueDate を取得
    updateMemo(memoId, { title: doc.title, items: mergedItems, locations: doc.locations, note: doc.note, dueDate: doc.dueDate });
  }, [memoId, updateMemo]);

  // 共有メモの場合: 画面マウント時に同期＋プレゼンス監視
  // プレミアム: onSnapshot でリアルタイム反映 / 無料: pull-on-open のみ
  useEffect(() => {
    if (!memo?.shareId) return;
    const shareId = memo.shareId;
    const unsubs: (() => void)[] = [];

    if (isPremium) {
      // プレミアム: Firestore の変更をリアルタイムで受信しマージ
      unsubs.push(subscribeSharedMemo(shareId, doc => {
        if (doc) {
          mergeSharedDoc(doc);
          setPresences(doc.presences ?? {});
        }
      }));
    } else {
      // 無料: 画面を開いたときだけ 1 回同期
      syncSharedMemo(shareId).then(doc => {
        if (doc) mergeSharedDoc(doc);
      }).catch(e => recordError(e, '[MemoDetail] shareSync'));
      // プレゼンスのみリアルタイム監視
      unsubs.push(subscribePresence(shareId, setPresences));
    }
    return () => unsubs.forEach(u => u());
  // eslint-disable-next-line react-hooks/exhaustive-deps -- マウント時と shareId/isPremium 変更時にのみ購読を設定。mergeSharedDoc は useCallback で安定化済み
  }, [memo?.shareId, isPremium]);

  // フォアグラウンド復帰時に監視状態を再チェック（フォーカス中のみ: 遷移アニメーション中の再レンダリングを防ぐ）
  useFocusEffect(
    useCallback(() => {
      setIsMonitoring(isGeofencingActive());
      const id = setInterval(() => {
        setIsMonitoring(isGeofencingActive());
      }, 3000);
      // スタック積み重なりによる「戈る」ボタンが利かない問題を防止
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        navigation.popToTop();
        return true;
      });
      // オーナーの場合: LocationPickerScreen から戻ってきたとき地点変更を Firestore に即時反映
      if (!isFirstFocus.current) {
        const currentMemo = useMemoStore.getState().memos.find(m => m.id === memoId);
        if (currentMemo?.shareId && currentMemo.isOwner) {
          updateSharedMemoLocations(currentMemo.shareId, currentMemo.locations).catch(e => recordError(e, '[MemoDetail] shareSync'));
        }
      }
      isFirstFocus.current = false;
      return () => {
        clearInterval(id);
        backHandler.remove();
      };
    }, [navigation, memoId]),
  );

  if (!memo) {
    return (
      <View style={styles.center}>
        <Text>{t('memoDetail.notFound')}</Text>
      </View>
    );
  }

  const handleToggleNotification = () => {
    updateMemo(memoId, { notificationEnabled: !memo.notificationEnabled });
  };

  const handleShare = async () => {
    if (LIMITS_ENABLED && !isPremium && !memo.shareId) {
      Alert.alert(t('share.limitReached'), t('share.limitReachedMsg'));
      return;
    }
    setIsSharingLoading(true);
    try {
      const shareId = await uploadSharedMemo(memo, deviceId);
      if (!memo.shareId) {
        setMemoShareId(memoId, shareId, true);
        const newBadges = onShareMemo();
        if (newBadges.length > 0) showBadgeUnlock(newBadges);
      }
      const shareUrl = buildShareUrl(shareId);
      await Share.share({
        message: `${t('share.shareMessage')}\n\n${shareUrl}\n\n${t('share.shareCodeFallback')}: ${shareId}`,
        title: t('share.shareTitle'),
      });
    } catch (e: unknown) {
      recordError(e, '[MemoDetail] handleShare');
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert(t('common.error'), msg || t('share.uploadError'));
    } finally {
      setIsSharingLoading(false);
    }
  };

  const handleSyncSharedMemo = async () => {
    if (!memo.shareId) return;
    setIsSyncLoading(true);
    try {
      const doc = await syncSharedMemo(memo.shareId);
      if (!doc) {
        Alert.alert(t('common.error'), t('share.notFound'));
        return;
      }
      mergeSharedDoc(doc);
      Alert.alert(t('share.syncSuccess'));
    } catch {
      Alert.alert(t('common.error'), t('share.syncError'));
    } finally {
      setIsSyncLoading(false);
    }
  };

  const handleDeleteLocation = (loc: MemoLocation) => {
    Alert.alert(t('memoDetail.deleteLocTitle'), t('memoDetail.deleteLocMessage', { label: loc.label }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          deleteLocation(memoId, loc.id);
          // 共有メモのオーナーの場合: 地点削除を Firestore に即時反映
          if (memo?.shareId && memo.isOwner) {
            const updatedLocations = useMemoStore.getState().memos.find(m => m.id === memoId)?.locations ?? [];
            updateSharedMemoLocations(memo.shareId, updatedLocations).catch(e => recordError(e, '[MemoDetail] shareSync'));
          }
        },
      },
    ]);
  };

  const handleToggleItem = useCallback((item: ShoppingItem) => {
    toggleItem(memoId, item.id);
    // 共有メモの場合: チェック状態を Firestore にデバウンス反映（連続チェック操作をバッチ化）
    if (memo?.shareId) {
      debouncedSharedItemsSync();
    }
    if (item.isChecked) {
      // チェック解除時: 即座に実行して Snackbar で元に戻せる
      setUndoTarget(item);
      setSnackbarVisible(true);
    } else {
      // チェック時: バッジ判定
      const newBadges = onItemComplete(1, !!memo?.shareId);
      if (newBadges.length > 0) showBadgeUnlock(newBadges);
      // チェック時: 全アイテムがチェックされたか確認
      const allOthersChecked = memo
        ? memo.items.filter(it => it.id !== item.id).every(it => it.isChecked)
        : false;
      if (allOthersChecked && memo && memo.items.length > 0) {
        // Alert の代わりに Snackbar で通知 → back ボタンをブロックしない
        setSnackbarVisible(false);
        setAllCheckedSnackbarVisible(true);
        // レビュー依頼: 全アイテム完了 & 条件を満たしていれば表示
        const settings = useSettingsStore.getState();
        if (shouldTriggerOnAllItemsCompleted(settings.totalItemsCompleted, settings.lastReviewPromptAt)) {
          setTimeout(() => showReviewPrompt(), 2000);
        }
      }
    }
  }, [memoId, toggleItem, memo, t, updateMemo, debouncedSharedItemsSync]);

  // checkAll/uncheckAll のハンドラ（共有メモへの Firestore 即時反映付き）
  const handleCheckAllToggle = useCallback(() => {
    if (!memo) return;
    const allChecked = memo.items.length > 0 && memo.items.every(it => it.isChecked);
    if (allChecked) {
      uncheckAllItems(memoId);
    } else {
      checkAllItems(memoId);
    }
    if (memo.shareId) {
      debouncedSharedItemsSync();
    }
  }, [memoId, memo, checkAllItems, uncheckAllItems, debouncedSharedItemsSync]);

  const handleUndo = useCallback(() => {
    if (!undoTarget) return;
    // 元のチェック状態と checkedAt を復元
    updateItem(memoId, undoTarget.id, { isChecked: true, checkedAt: undoTarget.checkedAt });
    setSnackbarVisible(false);
    setUndoTarget(null);
  }, [memoId, undoTarget, updateItem]);

  const renderShoppingItem = (item: ShoppingItem) => {
    const dateStr =
      item.isChecked && item.checkedAt
        ? new Date(item.checkedAt).toLocaleDateString()
        : null;
    return (
      <TouchableOpacity
        testID={`checklist-item-${item.id}`}
        key={item.id}
        style={styles.itemRow}
        onPress={() => handleToggleItem(item)}
        activeOpacity={0.7}>
        <Icon
          name={item.isChecked ? 'check-box' : 'check-box-outline-blank'}
          size={24}
          color={item.isChecked ? '#4CAF50' : '#9E9E9E'}
        />
        <Text style={[styles.itemText, item.isChecked && styles.itemChecked]}>
          {item.name}
        </Text>
        {dateStr !== null && (
          <Text style={styles.itemDate}>{dateStr}</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
      {/* タイトル + 通知トグル + 共有ボタン + 編集ボタン */}
      <View style={styles.titleRow}>
        <Text style={styles.title}>{memo.title}</Text>
        <TouchableOpacity
          onPress={handleToggleNotification}
          onLongPress={() => memo.notificationEnabled && setNotifModeModalVisible(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.headerIcon}>
          <Icon
            name={
              !memo.notificationEnabled ? 'notifications-off'
              : memo.notificationMode === 'silent' ? 'notifications-none'
              : 'notifications'
            }
            size={22}
            color={
              !memo.notificationEnabled ? '#9E9E9E'
              : isMonitoring ? '#4CAF50'
              : '#FF9800'
            }
          />
        </TouchableOpacity>
        <TouchableOpacity
          testID="memo-share-button"
          onPress={handleShare}
          disabled={isSharingLoading}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.headerIcon}>
          {isSharingLoading ? (
            <ActivityIndicator size={22} color="#4CAF50" />
          ) : (
            <Icon
              name={memo.shareId ? 'people' : 'share'}
              size={22}
              color={memo.shareId ? '#4CAF50' : '#757575'}
            />
          )}
        </TouchableOpacity>
        {memo.shareId && (
          <TouchableOpacity
            onPress={handleSyncSharedMemo}
            disabled={isSyncLoading}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.headerIcon}>
            {isSyncLoading ? (
              <ActivityIndicator size={22} color="#2196F3" />
            ) : (
              <CycleSvg width={22} height={22} />
            )}
          </TouchableOpacity>
        )}
          <TouchableOpacity
          testID="memo-edit-button"
          onPress={() => navigation.navigate('MemoEdit', { memoId })}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.pencilBtn}>
          <EditSvg width={22} height={22} />
        </TouchableOpacity>
      </View>

      {/* ロールバッジ（共有メモのみ）*/}
      {memo.shareId && (
        <View style={[styles.roleBadge, memo.isOwner ? styles.roleBadgeOwner : styles.roleBadgeCollaborator, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
          {memo.isOwner ? <CrownSvg width={14} height={14} /> : <GroupSvg width={14} height={14} />}
          <Text style={[styles.roleBadgeText, memo.isOwner ? styles.roleBadgeTextOwner : styles.roleBadgeTextCollaborator]}>
            {memo.isOwner ? t('share.roleOwner') : t('share.roleCollaborator')}
          </Text>
        </View>
      )}

      {/* プレゼンスバナー（他ユーザーが編集中）*/}
      {isPresenceActive(presences, deviceId) && (
        <View style={styles.presenceBanner}>
          <Icon name="edit" size={14} color="#757575" />
          <Text style={styles.presenceBannerText}>{t('share.presenceBanner')}</Text>
        </View>
      )}

      {/* 期限バッジ */}
      {memo.dueDate != null && (() => {
        const { status, dateStr } = getDueDateInfo(memo.dueDate);
        return (
          <View style={styles.dueDateRow}>
            <CalendarSvg width={16} height={16} />
            <Text style={[
              styles.dueDateBadge,
              status === 'overdue' && styles.dueDateOverdue,
              status === 'today' && styles.dueDateToday,
            ]}>
              {status === 'overdue'
                ? t('memoDetail.dueDateOverdue', { date: dateStr })
                : status === 'today'
                  ? t('memoDetail.dueDateToday')
                  : t('memoDetail.dueDate', { date: dateStr })}
            </Text>
          </View>
        );
      })()}

      {/* ノート表示 */}
      {memo.note ? (
        <View style={styles.noteSection}>
          <Icon name="sticky-note-2" size={14} color="#9E9E9E" />
          <Text style={styles.noteText}>{memo.note}</Text>
        </View>
      ) : null}

      {/* 監視停止警告 */}
      {memo.notificationEnabled && !isMonitoring && (
        <View style={styles.monitoringWarningRow}>
          <AlertSignSvg width={16} height={16} />
          <Text style={styles.monitoringWarning}>{t('memoDetailExtra.monitoringStopped')}</Text>
        </View>
      )}

      {/* 共有メモ更新通知ボタン（プレミアム限定・変更時のみ有効） */}
      {memo.shareId && isPremium && (
        <TouchableOpacity
          style={[styles.notifyBtn, (isNotifyLoading || notifyCooldown > 0 || !hasLocalChanges) && styles.notifyBtnDisabled]}
          disabled={isNotifyLoading || notifyCooldown > 0 || !hasLocalChanges}
          onPress={handleNotifyCollaborators}
          activeOpacity={0.7}>
          {/* クールダウン中のプログレスバー */}
          {notifyCooldown > 0 && (
            <Animated.View
              style={[
                styles.notifyProgressBar,
                {
                  width: cooldownProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          )}
          {isNotifyLoading ? (
            <ActivityIndicator size={16} color="#fff" />
          ) : (
            <Icon name="campaign" size={18} color="#fff" />
          )}
          <Text style={styles.notifyBtnText}>
            {notifyCooldown > 0
              ? t('shareNotify.cooldownBtn', { seconds: notifyCooldown })
              : !hasLocalChanges
                ? t('shareNotify.noChanges')
                : t('shareNotify.button')}
          </Text>
        </TouchableOpacity>
      )}

      {/* 場所セクション */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <LocationPinSvg width={18} height={18} />
            <Text style={styles.sectionTitle}>
              {t('memoDetail.locationSection', { count: memo.locations.length })}
            </Text>
          </View>
          <View style={styles.sectionHeaderRight}>
            {LIMITS_ENABLED && !isPremium && (
              <Text style={[
                styles.limitCounter,
                memo.locations.length >= FREE_LIMITS.locationsPerMemo && styles.limitCounterFull,
              ]}>
                {memo.locations.length} / {FREE_LIMITS.locationsPerMemo}
              </Text>
            )}
            {memo.isOwner !== false && memo.locations.length < getLocationsLimit(isPremium) && (
              <TouchableOpacity
                testID="location-add-button"
                onPress={() => navigation.navigate('LocationPicker', { memoId })}
                style={styles.addLocBtn}>
                <Icon name="add-location" size={18} color="#4CAF50" />
                <Text style={styles.addLocText}>{t('memoDetail.addLocation')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        {memo.locations.length === 0 ? (
          <Text style={styles.noLocText}>
            {t('memoDetail.locationEmpty')}
          </Text>
        ) : (
          <>
            {(locationsExpanded || memo.locations.length <= 3
              ? memo.locations
              : memo.locations.slice(0, 3)
            ).map(loc => (
              <View key={loc.id} style={styles.locChip}>
                <View style={styles.locChipBody}>
                  <Text style={styles.locChipLabel}>{loc.label}</Text>
                  {loc.address ? (
                    <Text style={styles.locChipAddress}>{loc.address}</Text>
                  ) : null}
                  <Text style={styles.locChipRadius}>
                    {t('memoDetail.radiusLabel', { radius: loc.radius })}
                    {' · '}
                    {loc.triggerType === 'exit' ? t('memoDetail.triggerExit') : t('memoDetail.triggerEnter')}
                  </Text>
                </View>
                {memo.isOwner !== false ? (
                  <>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('LocationPicker', { memoId, existingLocationId: loc.id })}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.locChipAction}>
                      <Icon name="edit" size={18} color="#4CAF50" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteLocation(loc)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.locChipAction}>
                      <Icon name="close" size={18} color="#9E9E9E" />
                    </TouchableOpacity>
                  </>
                ) : (
                  <Icon name="lock" size={16} color="#BDBDBD" style={styles.locChipAction} />
                )}
              </View>
            ))}
            {memo.locations.length > 3 && (
              <TouchableOpacity
                onPress={() => setLocationsExpanded(v => !v)}
                style={styles.expandLocBtn}>
                <Text style={styles.expandLocText}>
                  {locationsExpanded
                    ? t('memoDetail.collapseLocations')
                    : t('memoDetail.showMoreLocations', { count: memo.locations.length - 3 })}
                </Text>
                <Icon
                  name={locationsExpanded ? 'expand-less' : 'expand-more'}
                  size={18}
                  color="#757575"
                />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* 買い物アイテムリスト */}
      {(() => {
        const allChecked = memo.items.length > 0 && memo.items.every(it => it.isChecked);
        const hasChecked = memo.items.some(it => it.isChecked);
        const checkedCount = memo.items.filter(it => it.isChecked).length;
        const visibleItems = hideChecked ? memo.items.filter(it => !it.isChecked) : memo.items;
        return (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ChecklistSvg width={18} height={18} />
                <Text style={styles.sectionTitle}>{t('memoDetail.itemSection')}</Text>
                <Text style={[
                  styles.limitCounter,
                  LIMITS_ENABLED && !isPremium && memo.items.length >= getItemsLimit(isPremium) && styles.limitCounterFull,
                ]}>
                  {memo.items.length}件
                </Text>
              </View>
              {memo.items.length > 0 && (
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  <TouchableOpacity
                    testID="check-all-button"
                    onPress={handleCheckAllToggle}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ padding: 4 }}>
                    <Icon name={allChecked ? 'clear-all' : 'done-all'} size={22} color="#9E9E9E" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setHideChecked(v => !v)}
                    disabled={!hasChecked && !hideChecked}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={[{ padding: 4 }, !hasChecked && !hideChecked && { opacity: 0.3 }]}>
                    <Icon name={hideChecked ? 'visibility-off' : 'visibility'} size={22} color="#9E9E9E" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {memo.items.length === 0 ? (
              <Text style={styles.noLocText}>{t('memoDetail.itemEmpty')}</Text>
            ) : (
              <>
                {visibleItems.map(renderShoppingItem)}
                {hideChecked && checkedCount > 0 && (
                  <TouchableOpacity
                    onPress={() => setHideChecked(false)}
                    style={styles.hiddenItemsRow}>
                    <Icon name="visibility-off" size={15} color="#BDBDBD" />
                    <Text style={styles.hiddenItemsText}>{t('memoDetail.hiddenItems', { count: checkedCount })}</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        );
      })()}

      </ScrollView>

      <View style={styles.bottomBar}>
        <AdBanner />
      </View>
      <Snackbar
        visible={snackbarVisible}
        message={t('memoDetail.uncheckDone')}
        actionLabel={t('common.undo')}
        onAction={handleUndo}
        onDismiss={() => {
          setSnackbarVisible(false);
          setUndoTarget(null);
        }}
      />
      <Snackbar
        visible={allCheckedSnackbarVisible}
        message={t('memoDetail.allCheckedTitle')}
        actionLabel={t('memoDetail.notificationOff')}
        onAction={() => {
          updateMemo(memoId, { notificationEnabled: false, autoDisabledNotification: true });
          setAllCheckedSnackbarVisible(false);
        }}
        onDismiss={() => setAllCheckedSnackbarVisible(false)}
        duration={5000}
      />
      <Modal
        visible={notifModeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNotifModeModalVisible(false)}>
        <TouchableOpacity
          style={styles.notifModalOverlay}
          activeOpacity={1}
          onPress={() => setNotifModeModalVisible(false)}>
          <View style={styles.notifModeCard}>
            <Text style={styles.notifModeTitle}>{t('notification.modeTitle')}</Text>
            {(
              [
                { mode: 'silent', icon: '🔕', label: t('notification.modeSilent'), desc: t('notification.modeSilentDesc'), disabled: false },
                { mode: 'push',   icon: '🔔', label: t('notification.modePush'),   desc: t('notification.modePushDesc'),   disabled: false },
                { mode: 'alarm',  icon: '⏰', label: t('notification.modeAlarm'),  desc: t('notification.modeAlarmDesc'),  disabled: true  },
              ] as Array<{ mode: 'silent' | 'push' | 'alarm'; icon: string; label: string; desc: string; disabled: boolean }>
            ).map(({ mode, icon, label, desc, disabled }) => {
              const isSelected = (memo.notificationMode ?? 'push') === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  style={[styles.notifModeRow, isSelected && styles.notifModeRowSelected]}
                  onPress={() => {
                    if (disabled) {
                      Alert.alert(label, t('notification.modeAlarmComingSoon'));
                      return;
                    }
                    updateMemo(memoId, { notificationMode: mode });
                    setNotifModeModalVisible(false);
                  }}>
                  <Text style={styles.notifModeEmoji}>{icon}</Text>
                  <View style={styles.notifModeTextWrap}>
                    <View style={styles.notifModeNameRow}>
                      <Text style={[styles.notifModeName, disabled && styles.notifModeNameDisabled]}>
                        {label}
                      </Text>
                      {disabled && (
                        <Text style={styles.notifModeComingSoon}>{t('notification.comingSoon')}</Text>
                      )}
                    </View>
                    <Text style={styles.notifModeDesc}>{desc}</Text>
                  </View>
                  {isSelected && !disabled && <Icon name="check-circle" size={20} color="#4CAF50" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 8 },
  bottomBar: { paddingHorizontal: 16, paddingTop: 4, backgroundColor: '#F5F5F5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#212121', flex: 1, marginRight: 8 },
  headerIcon: { marginLeft: 8 },
  pencilBtn: { marginLeft: 16 },
  presenceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F5F5',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  presenceBannerText: { fontSize: 12, color: '#757575' },
  dueDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  dueDateBadge: {
    fontSize: 13,
    color: '#757575',
  },
  dueDateToday: { color: '#FF9800', fontWeight: '600' },
  dueDateOverdue: { color: '#EF5350', fontWeight: '600' },
  monitoringWarningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  monitoringWarning: {
    fontSize: 12,
    color: '#FF9800',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#424242' },
  addLocBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addLocText: { fontSize: 14, color: '#4CAF50', fontWeight: '600' },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  limitCounter: { fontSize: 12, color: '#9E9E9E' },
  limitCounterFull: { color: '#FF9800', fontWeight: '600' as const },
  noLocText: { fontSize: 13, color: '#9E9E9E', textAlign: 'center', paddingVertical: 8 },
  hiddenItemsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 4 },
  hiddenItemsText: { fontSize: 13, color: '#BDBDBD' },
  locChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  locChipBody: { flex: 1 },
  locChipLabel: { fontSize: 14, fontWeight: '600', color: '#2E7D32' },
  locChipAddress: { fontSize: 12, color: '#616161', marginTop: 2 },
  locChipRadius: { fontSize: 12, color: '#4CAF50', marginTop: 2 },
  locChipAction: { marginLeft: 8 },
  expandLocBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 8,
    gap: 2,
  },
  expandLocText: { fontSize: 13, color: '#757575' },
  roleBadge: {
    alignSelf: 'flex-start' as const,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 10,
  },
  roleBadgeOwner: { backgroundColor: '#E8F5E9' },
  roleBadgeCollaborator: { backgroundColor: '#EDE7F6' },
  roleBadgeText: { fontSize: 12, fontWeight: '600' as const },
  roleBadgeTextOwner: { color: '#2E7D32' },
  roleBadgeTextCollaborator: { color: '#6A1B9A' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  itemText: { fontSize: 15, color: '#212121', flex: 1 },
  itemChecked: { color: '#9E9E9E', textDecorationLine: 'line-through' },
  itemDate: { fontSize: 11, color: '#9E9E9E', marginLeft: 4 },
  notifModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  notifModeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  notifModeTitle: {
    fontSize: 16,
    fontWeight: 'bold' as const,
    color: '#212121',
    marginBottom: 16,
  },
  notifModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 12,
  },
  notifModeRowSelected: { backgroundColor: '#E8F5E9' },
  notifModeEmoji: { fontSize: 22, width: 32, textAlign: 'center' as const },
  notifModeTextWrap: { flex: 1 },
  notifModeNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notifModeName: { fontSize: 15, fontWeight: '600' as const, color: '#212121' },
  notifModeNameDisabled: { color: '#9E9E9E' },
  notifModeDesc: { fontSize: 12, color: '#757575', marginTop: 2 },
  notifModeComingSoon: { fontSize: 11, color: '#FF9800', fontWeight: '500' as const },
  noteSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#FFFDE7',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  noteText: { fontSize: 13, color: '#616161', flex: 1, lineHeight: 20 },
  notifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2196F3',
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  notifyBtnDisabled: { backgroundColor: '#B0BEC5' },
  notifyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14, zIndex: 1 },
  notifyProgressBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#2196F3',
    borderRadius: 10,
    zIndex: 0,
  },
});
