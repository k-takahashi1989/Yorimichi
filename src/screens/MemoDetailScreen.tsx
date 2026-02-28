import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Share,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useShallow } from 'zustand/react/shallow';
import Icon from 'react-native-vector-icons/MaterialIcons';
import BackgroundService from 'react-native-background-actions';
import AdBanner from '../components/AdBanner';
import Snackbar from '../components/Snackbar';
import TutorialTooltip from '../components/TutorialTooltip';
import { useTranslation } from 'react-i18next';
import { useMemoStore, useSettingsStore } from '../store/memoStore';
import { useTutorial } from '../hooks/useTutorial';
import { RootStackParamList, ShoppingItem, MemoLocation, SharePresence } from '../types';
import { getDeviceId } from '../utils/deviceId';
import {
  uploadSharedMemo,
  syncSharedMemo,
  subscribePresence,
  isPresenceActive,
} from '../services/shareService';

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
  const isPremium = useSettingsStore(s => s.isPremium);
  const sharedMemoIds = useSettingsStore(s => s.sharedMemoIds);
  const addSharedMemoId = useSettingsStore(s => s.addSharedMemoId);

  const bellRef = useRef<View>(null);
  const { step: tutStep, isActive: tutActive, targetLayout: tutLayout, advance: tutAdvance, skip: tutSkip } =
    useTutorial('memoDetail', 1, [bellRef], 800);

  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [undoTarget, setUndoTarget] = useState<ShoppingItem | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(BackgroundService.isRunning());
  const [presence, setPresence] = useState<SharePresence | null>(null);
  const [isSharingLoading, setIsSharingLoading] = useState(false);

  // 共有メモの場合: 画面マウント時に同期＋プレゼンス監視
  useEffect(() => {
    if (!memo?.shareId) return;
    const shareId = memo.shareId;
    // Pull-on-open: Firestore から最新内容を取得
    syncSharedMemo(shareId).then(doc => {
      if (!doc) return;
      updateMemo(memoId, { title: doc.title });
    }).catch(() => {});
    // プレゼンスをリアルタイム監視
    const unsubscribe = subscribePresence(shareId, setPresence);
    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memo?.shareId]);

  // フォアグラウンド復帰時に監視状態を再チェック
  useEffect(() => {
    const id = setInterval(() => {
      setIsMonitoring(BackgroundService.isRunning());
    }, 3000);
    return () => clearInterval(id);
  }, []);

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
    if (!isPremium && sharedMemoIds.length >= 1 && !memo.shareId) {
      Alert.alert(t('share.limitReached'), t('share.limitReachedMsg'));
      return;
    }
    setIsSharingLoading(true);
    try {
      const deviceId = getDeviceId();
      const shareId = await uploadSharedMemo(memo, deviceId);
      if (!memo.shareId) {
        setMemoShareId(memoId, shareId, true);
        addSharedMemoId(shareId);
      }
      const url = `yorimichi://open?shareId=${shareId}`;
      await Share.share({
        message: `${t('share.shareMessage')}\n${url}`,
        title: t('share.shareTitle'),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[handleShare] error:', msg);
      Alert.alert(t('common.error'), t('share.uploadError'));
    } finally {
      setIsSharingLoading(false);
    }
  };

  const handleDeleteLocation = (loc: MemoLocation) => {
    Alert.alert(t('memoDetail.deleteLocTitle'), t('memoDetail.deleteLocMessage', { label: loc.label }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => deleteLocation(memoId, loc.id),
      },
    ]);
  };

  const handleToggleItem = useCallback((item: ShoppingItem) => {
    toggleItem(memoId, item.id);
    if (item.isChecked) {
      // チェック解除時: 即座に実行して Snackbar で元に戻せる
      setUndoTarget(item);
      setSnackbarVisible(true);
    }
  }, [memoId, toggleItem]);

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
        <View ref={bellRef} collapsable={false}>
          <TouchableOpacity
            onPress={handleToggleNotification}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.headerIcon}>
            <Icon
              name={memo.notificationEnabled ? 'notifications' : 'notifications-off'}
              size={22}
              color={
                !memo.notificationEnabled ? '#9E9E9E'
                : isMonitoring ? '#4CAF50'
                : '#FF9800'
              }
            />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={handleShare}
          disabled={isSharingLoading}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.headerIcon}>
          <Icon
            name={memo.shareId ? 'people' : 'share'}
            size={22}
            color={memo.shareId ? '#4CAF50' : '#757575'}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate('MemoEdit', { memoId })}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.pencilBtn}>
          <Icon name="edit" size={22} color="#757575" />
        </TouchableOpacity>
      </View>

      {/* プレゼンスバナー（他ユーザーが編集中）*/}
      {isPresenceActive(presence) && (
        <View style={styles.presenceBanner}>
          <Icon name="edit" size={14} color="#757575" />
          <Text style={styles.presenceBannerText}>{t('share.presenceBanner')}</Text>
        </View>
      )}

      {/* 監視停止警告 */}
      {memo.notificationEnabled && !isMonitoring && (
        <Text style={styles.monitoringWarning}>{t('memoDetailExtra.monitoringStopped')}</Text>
      )}

      {/* 場所セクション */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t('memoDetail.locationSection', { count: memo.locations.length })}
          </Text>
          {memo.locations.length < 3 && (
            <TouchableOpacity
              onPress={() => navigation.navigate('LocationPicker', { memoId })}
              style={styles.addLocBtn}>
              <Icon name="add-location" size={18} color="#4CAF50" />
              <Text style={styles.addLocText}>{t('memoDetail.addLocation')}</Text>
            </TouchableOpacity>
          )}
        </View>
        {memo.locations.length === 0 ? (
          <Text style={styles.noLocText}>
            {t('memoDetail.locationEmpty')}
          </Text>
        ) : (
          memo.locations.map(loc => (
            <View key={loc.id} style={styles.locChip}>
              <View style={styles.locChipBody}>
                <Text style={styles.locChipLabel}>{loc.label}</Text>
                {loc.address ? (
                  <Text style={styles.locChipAddress}>{loc.address}</Text>
                ) : null}
                <Text style={styles.locChipRadius}>{t('memoDetail.radiusLabel', { radius: loc.radius })}</Text>
              </View>
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
            </View>
          ))
        )}
      </View>

      {/* 買い物アイテムリスト */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('memoDetail.itemSection')}</Text>
        {memo.items.length === 0 ? (
          <Text style={styles.noLocText}>
            {t('memoDetail.itemEmpty')}
          </Text>
        ) : (
          memo.items.map(renderShoppingItem)
        )}
      </View>

      </ScrollView>

      <View style={styles.bottomBar}>
        <AdBanner />
      </View>
      <TutorialTooltip
        visible={tutActive}
        targetLayout={tutLayout}
        text={t('tutorial.memoDetail.step1')}
        stepLabel={`STEP 1 / 1`}
        isLast
        nextLabel={t('tutorial.ok')}
        skipLabel={t('tutorial.skip')}
        onNext={tutAdvance}
        onSkip={tutSkip}
      />
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
  monitoringWarning: {
    fontSize: 12,
    color: '#FF9800',
    marginBottom: 8,
    paddingHorizontal: 4,
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
  noLocText: { fontSize: 13, color: '#9E9E9E', textAlign: 'center', paddingVertical: 8 },
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
});
