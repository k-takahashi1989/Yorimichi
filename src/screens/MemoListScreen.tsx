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
import { Swipeable } from 'react-native-gesture-handler';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useMemoStore, useSettingsStore } from '../store/memoStore';
import { Memo, RootStackParamList } from '../types';
import AdBanner from '../components/AdBanner';
import Snackbar from '../components/Snackbar';
import { joinSharedMemo } from '../services/shareService';
import { getDeviceId } from '../utils/deviceId';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function MemoListScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const memos = useMemoStore(s => s.memos);
  const deleteMemo = useMemoStore(s => s.deleteMemo);
  const restoreMemo = useMemoStore(s => s.restoreMemo);
  const importSharedMemo = useMemoStore(s => s.importSharedMemo);
  const addSharedMemoId = useSettingsStore(s => s.addSharedMemoId);
  const insets = useSafeAreaInsets();

  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importCode, setImportCode] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [deletedMemo, setDeletedMemo] = useState<Memo | null>(null);
  const [deleteSnackbarVisible, setDeleteSnackbarVisible] = useState(false);

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
      Alert.alert(
        t('share.importTitle'),
        t('share.importMessage', { title: doc.title }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('share.importConfirm'),
            onPress: () => {
              const memo = importSharedMemo(
                { title: doc.title, items: doc.items, locations: doc.locations },
                code,
              );
              addSharedMemoId(code);
              setImportModalVisible(false);
              setImportCode('');
              navigation.navigate('MemoDetail', { memoId: memo.id });
            },
          },
        ],
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[importByCode] error:', msg);
      Alert.alert(t('common.error'), t('share.importError'));
    } finally {
      setImportLoading(false);
    }
  }, [importCode, importSharedMemo, addSharedMemoId, navigation, t]);

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

    const handleSwipeDelete = () => {
      setDeletedMemo(item);
      deleteMemo(item.id);
      setDeleteSnackbarVisible(true);
    };

    const renderRightActions = () => (
      <View style={styles.swipeDeleteAction}>
        <Icon name="delete" size={24} color="#fff" />
        <Text style={styles.swipeDeleteText}>{t('memoList.deleteSwipe')}</Text>
      </View>
    );

    return (
      <Swipeable
        renderRightActions={renderRightActions}
        onSwipeableOpen={handleSwipeDelete}
        friction={2}
        rightThreshold={60}>
        <TouchableOpacity
          style={[styles.card, isCompleted && styles.cardCompleted]}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('MemoDetail', { memoId: item.id })}>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>
              {item.title}
            </Text>
            <Text style={styles.cardSub}>
              {total > 0 ? t('memoList.itemsLeft', { unchecked, total }) : t('memoList.noItems')}
            </Text>
            {item.locations.length > 0 && (
              <Text style={styles.cardLoc}>
                📍 {item.locations.map(l => l.label).join(' / ')}
              </Text>
            )}
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity
              onPress={() => navigation.navigate('MemoEdit', { memoId: item.id })}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="edit" size={22} color="#757575" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDelete(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.deleteBtn}>
              <Icon name="delete" size={22} color="#EF5350" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  }, [navigation, handleDelete, deleteMemo, t]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>{t('memoList.headerTitle')}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => { setImportCode(''); setImportModalVisible(true); }}>
            <Icon name="group-add" size={26} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('MemoEdit', {})}>
            <Icon name="add" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {memos.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="alt-route" size={64} color="#E0E0E0" />
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
  cardCompleted: { opacity: 0.6 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#212121', marginBottom: 4 },
  cardSub: { fontSize: 13, color: '#757575' },
  cardLoc: { fontSize: 12, color: '#4CAF50', marginTop: 4 },
  cardActions: { flexDirection: 'row', gap: 8, marginLeft: 8 },
  deleteBtn: { marginLeft: 4 },
  swipeDeleteAction: {
    backgroundColor: '#EF5350',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginVertical: 0,
  },
  swipeDeleteText: { color: '#fff', fontWeight: '700', fontSize: 14 },
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
});
