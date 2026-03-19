import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import {
  useNavigation,
  useRoute,
  RouteProp,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { CalendarSvg, ChecklistSvg } from '../assets/icons';
import { useMemoStore, useSettingsStore, selectEffectivePremium } from '../store/memoStore';
import { useInterstitialAd } from '../hooks/useInterstitialAd';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from 'react-i18next';
import { RootStackParamList, ShoppingItem } from '../types';
import { getDeviceId } from '../utils/deviceId';
import { setPresence, clearPresence, uploadSharedMemo } from '../services/shareService';
import { LIMITS_ENABLED, FREE_LIMITS, getItemsLimit } from '../config/planLimits';
import { LimitModal } from '../components/LimitModal';
import { recordError } from '../services/crashlyticsService';
import { onMemoCreate, onShareMemo } from '../services/badgeService';
import { showBadgeUnlock } from '../components/BadgeUnlockModal';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'MemoEdit'>;

export default function MemoEditScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const memoId = route.params?.memoId;
  const pickedLocation = route.params?.pickedLocation;

  const existingMemo = useMemoStore(s => (memoId ? s.getMemoById(memoId) : undefined));
  const memoCount = useMemoStore(s => s.memos.length);
  const addMemo = useMemoStore(s => s.addMemo);
  const updateMemo = useMemoStore(s => s.updateMemo);
  const getMemoById = useMemoStore(s => s.getMemoById);
  const addItem = useMemoStore(s => s.addItem);
  const addLocation = useMemoStore(s => s.addLocation);
  const deleteItem = useMemoStore(s => s.deleteItem);
  const updateItem = useMemoStore(s => s.updateItem);
  const reorderItems = useMemoStore(s => s.reorderItems);

  const totalMemoRegistrations = useSettingsStore(s => s.totalMemoRegistrations);
  const incrementMemoRegistrations = useSettingsStore(s => s.incrementMemoRegistrations);
  const isPremium = useSettingsStore(selectEffectivePremium);
  const { showIfReady } = useInterstitialAd();

  const insets = useSafeAreaInsets();
  /** handleDone 実行中フラグ。onBlur の handleSaveTitle との二重保存を防ぐ */
  const isSavingRef = useRef(false);
  // タイトル自動生成: 場所名ベース or 連番
  const generateAutoTitle = () => {
    if (existingMemo) return existingMemo.title;
    if (pickedLocation) return t('memoEdit.autoTitleWithLocation', { label: pickedLocation.label });
    if (!memoId) return t('memoEdit.autoTitleDefault', { number: memoCount + 1 });
    return '';
  };
  const [title, setTitle] = useState(generateAutoTitle);
  const [newItemName, setNewItemName] = useState('');
  const [savedMemoId, setSavedMemoId] = useState<string | undefined>(memoId);
  const [note, setNote] = useState(existingMemo?.note ?? '');
  const [dueDate, setDueDate] = useState<number | undefined>(existingMemo?.dueDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [limitModal, setLimitModal] = useState<{title: string; message: string} | null>(null);

  const currentItems = useMemoStore(
    useShallow((s): ShoppingItem[] => {
      if (!savedMemoId) return [];
      return s.memos.find(m => m.id === savedMemoId)?.items ?? [];
    }),
  );

  // 共有メモの場合: プレゼンスを記録（アンマウント時に自動クリア）
  useEffect(() => {
    const shareId = existingMemo?.shareId;
    if (!shareId) return;
    const deviceId = getDeviceId();
    setPresence(shareId, deviceId).catch(e => recordError(e, '[MemoEdit] shareSync'));
    return () => {
      clearPresence(shareId, deviceId).catch(e => recordError(e, '[MemoEdit] shareSync'));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- shareId が変わったときだけプレゼンスを設定/クリアする。deviceId は安定値
  }, [existingMemo?.shareId]);

  useEffect(() => {
    if (existingMemo) setTitle(existingMemo.title);
  }, [existingMemo]);

  // 未保存の変更がある場合、戻るときに確認ダイアログを表示
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // 確認ボタンによる保存済み遷移はスキップ
      if (isSavingRef.current) return;
      // 新規作成でまだ何も入力していない場合はスキップ
      if (!memoId && !title.trim() && currentItems.length === 0) return;
      // MemoDetail への replace 遷移時はスキップ
      if (e.data.action.type === 'REPLACE') return;

      e.preventDefault();
      Alert.alert(
        t('memoEdit.unsavedTitle'),
        t('memoEdit.unsavedMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('memoEdit.unsavedDiscard'),
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ],
      );
    });
    return unsubscribe;
  }, [navigation, memoId, title, currentItems.length, t]);

  const handleSaveTitle = useCallback(() => {
    if (isSavingRef.current) return; // handleDone が先に確定した場合はスキップ
    if (!title.trim()) {
      Alert.alert(t('memoEdit.errorTitle'), t('memoEdit.errorEmptyTitle'));
      return;
    }
    if (savedMemoId) {
      updateMemo(savedMemoId, { title: title.trim() });
    } else {
      const memo = addMemo(title.trim());
      setSavedMemoId(memo.id);
    }
  }, [title, savedMemoId, addMemo, updateMemo]);

  const handleAddItem = useCallback(() => {
    if (!newItemName.trim()) return;
    // アイテム上限チェック
    if (LIMITS_ENABLED && !isPremium && currentItems.length >= getItemsLimit(isPremium)) {
      setLimitModal({
        title: t('errors.itemLimitTitle'),
        message: t('errors.itemLimitMsg', { count: FREE_LIMITS.itemsPerMemo }),
      });
      return;
    }
    if (!savedMemoId) {
      // メモ未保存なら先に保存する
      if (!title.trim()) {
        Alert.alert(t('memoEdit.errorNeedTitleFirst'), t('memoEdit.errorNeedTitleFirstMsg'));
        return;
      }
      const memo = addMemo(title.trim());
      setSavedMemoId(memo.id);
      addItem(memo.id, newItemName.trim());
    } else {
      addItem(savedMemoId, newItemName.trim());
    }
    setNewItemName('');
  }, [newItemName, savedMemoId, title, addMemo, addItem, isPremium, currentItems.length, t]);

  const renderDraggableItem = useCallback(({ item, drag, isActive }: RenderItemParams<ShoppingItem>) => (
    <ScaleDecorator>
      <View style={[styles.itemRow, isActive && styles.itemRowDragging]}>
        <TouchableOpacity
          onLongPress={drag}
          delayLongPress={150}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.dragHandle}>
          <Icon name="drag-indicator" size={20} color={isActive ? '#4CAF50' : '#BDBDBD'} />
        </TouchableOpacity>
        <TextInput
          style={styles.itemInput}
          value={item.name}
          onChangeText={text => updateItem(savedMemoId!, item.id, { name: text })}
          multiline={false}
          maxLength={50}
        />
        <TouchableOpacity
          onPress={() => deleteItem(savedMemoId!, item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="close" size={20} color="#EF5350" />
        </TouchableOpacity>
      </View>
    </ScaleDecorator>
  ), [savedMemoId, updateItem, deleteItem]);

  const handleDone = () => {
    isSavingRef.current = true;
    if (!title.trim()) {
      Alert.alert(t('memoEdit.errorTitle'), t('memoEdit.errorEmptyTitle'));
      isSavingRef.current = false;
      return;
    }
    if (newItemName.trim()) {
      handleAddItem();
    }
    const isNew = !memoId; // ルートパラメータがない → 新規作成
    let targetId: string | undefined = savedMemoId;
    const trimmedNote = note.trim() || undefined;
    if (savedMemoId) {
      updateMemo(savedMemoId, { title: title.trim(), dueDate, note: trimmedNote });
    } else {
      const newMemo = addMemo(title.trim(), dueDate);
      targetId = newMemo.id;
      if (trimmedNote) updateMemo(newMemo.id, { note: trimmedNote });
    }
    if (!targetId) {
      navigation.goBack();
      return;
    }
    const finalId = targetId;
    // 場所選択フローから渡された場所を登録
    if (pickedLocation && isNew) {
      addLocation(finalId, pickedLocation);
    }
    // 共有メモの場合: Firestore に変更をアップロード
    const savedMemo = getMemoById(finalId);
    if (savedMemo?.shareId) {
      const deviceId = getDeviceId();
      uploadSharedMemo(savedMemo, deviceId).catch(e => recordError(e, '[MemoEdit] shareSync'));
    }
    // MemoDetail から編集した場合は replace ではなく goBack
    // (replace を使うと MemoDetail がスタックに重複して積まれ、戻るボタンが余分に必要になる)
    const prevRouteName = navigation.getState().routes.slice(-2)[0]?.name;
    const doNavigate = () => {
      if (!isNew && prevRouteName === 'MemoDetail') {
        navigation.goBack();
      } else {
        navigation.replace('MemoDetail', { memoId: finalId });
      }
    };
    if (isNew) {
      incrementMemoRegistrations();
      const newBadges = onMemoCreate();
      if (newBadges.length > 0) showBadgeUnlock(newBadges);
      // totalMemoRegistrations は increment 前の値。
      // 5回目 (index 4) 以降からインタースティシャルを表示する（プレミアムユーザーには表示しない）
      if (!isPremium && totalMemoRegistrations >= 4) {
        showIfReady(doNavigate) || doNavigate();
        return;
      }
    }
    doNavigate();
  };

  const listHeader = (
    <>
      <Text style={styles.label}>{t('memoEdit.titleLabel')}</Text>
      <TextInput
        testID="memo-title-input"
        style={styles.titleInput}
        value={title}
        onChangeText={setTitle}
        placeholder={t('memoEdit.titlePlaceholder')}
        placeholderTextColor="#BDBDBD"
        onBlur={handleSaveTitle}
        returnKeyType="done"
      />

      {/* 期限設定 */}
      <View style={styles.dueDateRow}>
        <TouchableOpacity
          style={styles.dueDateBtn}
          onPress={() => setShowDatePicker(true)}>
          <CalendarSvg width={18} height={18} />
          <Text style={[styles.dueDateText, dueDate != null && styles.dueDateTextSet]}>
            {dueDate
              ? `${new Date(dueDate).getFullYear()}/${new Date(dueDate).getMonth() + 1}/${new Date(dueDate).getDate()}`
              : t('memoEdit.dueDateLabel')}
          </Text>
        </TouchableOpacity>
        {dueDate != null && (
          <TouchableOpacity onPress={() => setDueDate(undefined)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="close" size={18} color="#9E9E9E" />
          </TouchableOpacity>
        )}
      </View>
      {showDatePicker && (
        <DateTimePicker
          value={dueDate ? new Date(dueDate) : new Date()}
          mode="date"
          minimumDate={new Date()}
          onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
            setShowDatePicker(false);
            if (event.type === 'set' && selectedDate) {
              setDueDate(selectedDate.getTime());
            }
          }}
        />
      )}

      {/* ノート欄 */}
      <Text style={styles.label}>{t('memoEdit.noteLabel')}</Text>
      <TextInput
        testID="memo-note-input"
        style={styles.noteInput}
        value={note}
        onChangeText={setNote}
        placeholder={t('memoEdit.notePlaceholder')}
        placeholderTextColor="#BDBDBD"
        multiline
        maxLength={500}
        textAlignVertical="top"
      />

      <View style={styles.labelRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <ChecklistSvg width={16} height={16} />
          <Text style={styles.label}>{t('memoEdit.itemsLabel')}</Text>
        </View>
        {LIMITS_ENABLED && !isPremium && savedMemoId && (
          <Text style={[
            styles.limitCounter,
            currentItems.length >= FREE_LIMITS.itemsPerMemo && styles.limitCounterFull,
          ]}>
            {currentItems.length} / {FREE_LIMITS.itemsPerMemo}
          </Text>
        )}
      </View>
    </>
  );

  const listFooter = (
    <View style={styles.addRow}>
      <TextInput
        testID="memo-item-input"
        style={styles.addInput}
        value={newItemName}
        onChangeText={setNewItemName}
        placeholder={t('memoEdit.addItemPlaceholder')}
        placeholderTextColor="#9E9E9E"
        onSubmitEditing={handleAddItem}
        returnKeyType="done"
        blurOnSubmit={false}
        maxLength={50}
      />
      {newItemName.trim().length > 0 && (
        <TouchableOpacity testID="memo-item-add-button" onPress={handleAddItem} style={styles.addButton}>
          <Icon name="add" size={20} color="#4CAF50" />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'android' ? 80 : 0}>
      <DraggableFlatList
        data={currentItems}
        keyExtractor={item => item.id}
        renderItem={renderDraggableItem}
        onDragEnd={({ data }) => {
          if (savedMemoId) reorderItems(savedMemoId, data);
        }}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      />

      {/* 確認する */}
      <TouchableOpacity testID="memo-done-button" style={[styles.doneBtn, { marginBottom: Math.max(insets.bottom, 16) }]} onPress={handleDone}>
        <Text style={styles.doneBtnText}>{t('memoEdit.doneButton')}</Text>
      </TouchableOpacity>
      <LimitModal
        visible={!!limitModal}
        title={limitModal?.title ?? ''}
        message={limitModal?.message ?? ''}
        onClose={() => setLimitModal(null)}
        onUpgrade={() => { setLimitModal(null); navigation.navigate('Premium'); }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F5F5F5' },
  container: { flex: 1, padding: 16 },
  dueDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 8,
  },
  dueDateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dueDateText: { fontSize: 14, color: '#9E9E9E' },
  dueDateTextSet: { color: '#212121' },
  scrollContent: { paddingBottom: 80 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#757575',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 6,
  },
  titleInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    elevation: 1,
  },
  noteInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    fontSize: 14,
    color: '#212121',
    elevation: 1,
    minHeight: 60,
    maxHeight: 120,
    marginBottom: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 4,
  },
  itemRowDragging: {
    backgroundColor: '#E8F5E9',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  dragHandle: {
    padding: 4,
  },
  itemInput: {
    flex: 1,
    fontSize: 15,
    color: '#212121',
    padding: 0,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginTop: 4,
    elevation: 1,
  },
  addInput: {
    flex: 1,
    fontSize: 15,
    color: '#212121',
    paddingVertical: 12,
  },
  addButton: {
    padding: 6,
  },
  doneBtn: {
    margin: 16,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  limitCounter: { fontSize: 12, color: '#9E9E9E' },
  limitCounterFull: { color: '#FF9800', fontWeight: '600' as const },
});
