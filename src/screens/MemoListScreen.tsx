import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { EditSvg, LocationPinSvg, TodoListSvg } from '../assets/icons';
import { useMemoStore, useSettingsStore, selectEffectivePremium } from '../store/memoStore';
import { Memo, RootStackParamList } from '../types';
import AdBanner from '../components/AdBanner';
import Snackbar from '../components/Snackbar';
import { LimitModal } from '../components/LimitModal';
import { joinSharedMemo, syncAllSharedMemos } from '../services/shareService';
import { registerFcmToken } from '../services/fcmService';
import { getDeviceId } from '../utils/deviceId';
import { LIMITS_ENABLED, FREE_LIMITS, getMemosLimit } from '../config/planLimits';
import { recordError } from '../services/crashlyticsService';
import { getDueDateInfo } from '../utils/helpers';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function MemoListScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const memos = useMemoStore(s => s.memos);
  const deleteMemo = useMemoStore(s => s.deleteMemo);
  const restoreMemo = useMemoStore(s => s.restoreMemo);
  const importSharedMemo = useMemoStore(s => s.importSharedMemo);
  const isPremium = useSettingsStore(selectEffectivePremium);
  const insets = useSafeAreaInsets();

  const memosLimit = getMemosLimit(isPremium);
  const memosRatio = Math.min(memos.length / memosLimit, 1);
  const memosAtLimit = memos.length >= memosLimit;
  const memosNearLimit = memos.length >= memosLimit - 1;
  const limitBarColor = memosAtLimit ? '#EF5350' : memosNearLimit ? '#FFB300' : '#66BB6A';

  // 一覧遷移時: 共有メモを一括 pull してローカルキャッシュを最新化
  useFocusEffect(
    useCallback(() => {
      const allMemos = useMemoStore.getState().memos;
      const sharedMemos = allMemos.filter(m => m.shareId);
      if (sharedMemos.length === 0) return;
      const updateMemoFn = useMemoStore.getState().updateMemo;
      syncAllSharedMemos(sharedMemos.map(m => m.shareId!))
        .then(docs => {
          sharedMemos.forEach(memo => {
            const doc = memo.shareId ? docs[memo.shareId] : undefined;
            if (!doc) return;
            // isChecked / checkedAt はローカル優先で保持しつつ title・items 構造・locations をマージ
            const mergedItems = doc.items.map(remoteItem => {
              const local = memo.items.find(li => li.id === remoteItem.id);
              return local
                ? { ...remoteItem, isChecked: local.isChecked, checkedAt: local.checkedAt }
                : remoteItem;
            });
            updateMemoFn(memo.id, { title: doc.title, items: mergedItems, locations: doc.locations });
          });
        })
        .catch(e => recordError(e, '[MemoList] syncSharedMemos'));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 画面フォーカス時に1度だけ同期する意図。依存に memos を入れるとメモ変更のたびに無限ループする
    }, []),
  );

  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importCode, setImportCode] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [deletedMemo, setDeletedMemo] = useState<Memo | null>(null);
  const [deleteSnackbarVisible, setDeleteSnackbarVisible] = useState(false);
  const [limitModal, setLimitModal] = useState<{title: string; message: string} | null>(null);

  const handleImportByCode = useCallback(async () => {
    const code = importCode.trim();
    if (!code) return;
    setImportLoading(true);
    try {
      const deviceId = getDeviceId();
      const doc = await joinSharedMemo(code, deviceId);
      if (!doc) {
        Alert.alert(t('common.error'), t('share.notFound'));
        return;
      }
      // joinSharedMemo 内で ensureSignedIn() が呼ばれ匿名アカウントが確定するため、
      // このタイミングで FCM トークンを再登録し通知を受け取れる状態にする。
      registerFcmToken().catch(e => recordError(e, '[MemoListScreen] registerFcmToken after join'));
      Alert.alert(
        t('share.importTitle'),
        t('share.importMessage', { title: doc.title }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('share.importConfirm'),
            onPress: () => {
              const memo = importSharedMemo(
                { title: doc.title, items: doc.items, locations: doc.locations, dueDate: doc.dueDate, note: doc.note },
                code,
              );
              setImportModalVisible(false);
              setImportCode('');
              navigation.navigate('MemoDetail', { memoId: memo.id });
            },
          },
        ],
      );
    } catch (e: unknown) {
      recordError(e, '[MemoList] importByCode');
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert(t('common.error'), msg || t('share.importError'));
    } finally {
      setImportLoading(false);
    }
  }, [importCode, importSharedMemo, navigation, t]);

  const handleAddNewMemo = useCallback(() => {
    if (LIMITS_ENABLED && !isPremium && memos.length >= getMemosLimit(isPremium)) {
      setLimitModal({
        title: t('errors.memoLimitTitle'),
        message: t('errors.memoLimitMsg', { count: FREE_LIMITS.memos }),
      });
      return;
    }
    navigation.navigate('LocationPicker', {});
  }, [memos.length, isPremium, navigation, t]);

  const handleDelete = useCallback(
    (memo: Memo) => {
      Alert.alert(t('memoList.deleteTitle'), t('memoList.deleteMessage', { title: memo.title }), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => deleteMemo(memo.id),
        },
      ]);
    },
    [deleteMemo, t],
  );

  const renderItem = useCallback(({ item }: { item: Memo }) => {
    const unchecked = item.items.filter(i => !i.isChecked).length;
    const total = item.items.length;
    const isCompleted = total > 0 && unchecked === 0;

    return (
        <TouchableOpacity
          testID={`memo-card-${item.id}`}
          style={[styles.card, isCompleted && styles.cardCompleted]}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('MemoDetail', { memoId: item.id })}>
          <View style={styles.cardBody}>
            {/* タイトル行: タイトル + 完了スタンプを横並び */}
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardTitle, isCompleted && styles.cardTitleCompleted]}>
                {item.title}
              </Text>
              {isCompleted && (
                <View style={styles.completedStamp} pointerEvents="none">
                  <Text style={styles.completedStampText}>{t('memoList.completed')}</Text>
                </View>
              )}
            </View>
            <Text style={styles.cardSub}>
              {total > 0 ? t('memoList.itemsLeft', { unchecked, total }) : t('memoList.noItems')}
            </Text>
            {item.locations.length > 0 && (
              <View style={styles.cardLocRow}>
                <LocationPinSvg width={14} height={14} />
                <Text style={styles.cardLoc}>
                  {item.locations.map(l => l.label).join(' / ')}
                </Text>
              </View>
            )}
            {item.dueDate != null && (() => {
              const { status, dateStr } = getDueDateInfo(item.dueDate);
              return (
                <Text style={[
                  styles.cardDueDate,
                  status === 'today' && styles.cardDueDateWarning,
                  status === 'overdue' && styles.cardDueDateOverdue,
                ]}>
                  {status === 'overdue'
                    ? t('memoDetail.dueDateOverdue', { date: dateStr })
                    : status === 'today'
                      ? t('memoDetail.dueDateToday')
                      : t('memoDetail.dueDate', { date: dateStr })}
                </Text>
              );
            })()}
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity
              testID={`memo-edit-icon-${item.id}`}
              onPress={() => navigation.navigate('MemoEdit', { memoId: item.id })}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <EditSvg width={22} height={22} />
            </TouchableOpacity>
            <TouchableOpacity
              testID={`memo-delete-icon-${item.id}`}
              onPress={() => handleDelete(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.deleteBtn}>
              <Icon name="delete" size={22} color="#EF5350" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
    );
  }, [navigation, handleDelete, t]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>{t('memoList.headerTitle')}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            testID="share-import-button"
            style={styles.headerIconBtn}
            onPress={() => { setImportCode(''); setImportModalVisible(true); }}>
            <Icon name="group-add" size={26} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            testID="memo-add-button"
            style={styles.addBtn}
            onPress={handleAddNewMemo}>
            <Icon name="add" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {LIMITS_ENABLED && !isPremium && (
        <View style={styles.limitStrip}>
          <View style={styles.limitBarTrack}>
            <View style={[styles.limitBarFill, { width: `${Math.round(memosRatio * 100)}%` as `${number}%`, backgroundColor: limitBarColor }]} />
          </View>
          <Text style={[styles.limitStripText, memosAtLimit && styles.limitStripFull]}>
            {t('memoList.memoCount', { current: memos.length, max: memosLimit })}
          </Text>
        </View>
      )}

      {memos.length === 0 ? (
        <View style={styles.empty}>
          <TodoListSvg width={64} height={64} />
          <Text style={styles.emptyText}>{t('memoList.emptyText')}</Text>
          <Text style={styles.emptySubText}>{t('memoList.emptySubText')}</Text>
        </View>
      ) : (
        <FlatList
          data={memos}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
      <AdBanner />

      {/* Import by share code modal */}
      <Modal
        visible={importModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImportModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('share.importByCode')}</Text>
            <Text style={styles.modalLabel}>{t('share.importByCodePrompt')}</Text>
            <TextInput
              style={styles.modalInput}
              value={importCode}
              onChangeText={setImportCode}
              placeholder={t('share.shareCodeLabel')}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleImportByCode}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setImportModalVisible(false)}
                disabled={importLoading}>
                <Text style={styles.modalBtnCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnConfirm, (!importCode.trim() || importLoading) && styles.modalBtnDisabled]}
                onPress={handleImportByCode}
                disabled={!importCode.trim() || importLoading}>
                {importLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.modalBtnConfirmText}>{t('share.importConfirm')}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Snackbar
        visible={deleteSnackbarVisible}
        message={t('memoList.deletedSnack', { title: deletedMemo?.title ?? '' })}
        actionLabel={t('common.undo')}
        onAction={() => {
          if (deletedMemo) restoreMemo(deletedMemo);
          setDeleteSnackbarVisible(false);
          setDeletedMemo(null);
        }}
        onDismiss={() => {
          setDeleteSnackbarVisible(false);
          setDeletedMemo(null);
        }}
      />
      <LimitModal
        visible={!!limitModal}
        title={limitModal?.title ?? ''}
        message={limitModal?.message ?? ''}
        onClose={() => setLimitModal(null)}
        onUpgrade={() => { setLimitModal(null); navigation.navigate('Premium'); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 20,
    padding: 5,
  },
  addBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 20,
    padding: 4,
  },
  list: { padding: 12, gap: 10 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  cardCompleted: { opacity: 0.72 },
  cardBody: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#212121', flexShrink: 1 },
  cardTitleCompleted: { flexShrink: 1 },
  cardSub: { fontSize: 13, color: '#757575' },
  cardLocRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  cardLoc: { fontSize: 12, color: '#4CAF50' },
  cardDueDate: { fontSize: 12, color: '#9E9E9E', marginTop: 2 },
  cardDueDateWarning: { color: '#FF9800', fontWeight: '600' as const },
  cardDueDateOverdue: { color: '#EF5350', fontWeight: '600' as const },
  completedStamp: {
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    transform: [{ rotate: '-10deg' }],
    opacity: 0.65,
  },
  completedStampText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4CAF50',
    letterSpacing: 2,
  },
  cardActions: { flexDirection: 'row', gap: 8, marginLeft: 8 },
  deleteBtn: { marginLeft: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { fontSize: 18, color: '#9E9E9E', fontWeight: '600' },
  emptySubText: { fontSize: 14, color: '#BDBDBD' },
  // Import by code modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
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
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#212121', marginBottom: 8 },
  modalLabel: { fontSize: 14, color: '#757575', marginBottom: 12 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#212121',
    backgroundColor: '#FAFAFA',
    marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  modalBtnCancel: { backgroundColor: '#F5F5F5' },
  modalBtnCancelText: { color: '#757575', fontWeight: '600' },
  modalBtnConfirm: { backgroundColor: '#4CAF50' },
  modalBtnConfirmText: { color: '#fff', fontWeight: '600' },
  modalBtnDisabled: { opacity: 0.5 },
  limitStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 7,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  limitBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#E8F5E9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  limitBarFill: {
    height: 6,
    borderRadius: 3,
  },
  limitStripText: {
    fontSize: 12,
    color: '#757575',
    minWidth: 54,
    textAlign: 'right',
  },
  limitStripFull: { color: '#EF5350', fontWeight: '600' as const },
});
