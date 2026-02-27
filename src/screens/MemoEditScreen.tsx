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
  ScrollView,
} from 'react-native';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import {
  useNavigation,
  useRoute,
  RouteProp,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useMemoStore } from '../store/memoStore';
import { useSettingsStore } from '../store/memoStore';
import { useInterstitialAd } from '../hooks/useInterstitialAd';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from 'react-i18next';
import { RootStackParamList, ShoppingItem } from '../types';
import TutorialTooltip from '../components/TutorialTooltip';
import { useTutorial } from '../hooks/useTutorial';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'MemoEdit'>;

export default function MemoEditScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const memoId = route.params?.memoId;

  const existingMemo = useMemoStore(s => (memoId ? s.getMemoById(memoId) : undefined));
  const addMemo = useMemoStore(s => s.addMemo);
  const updateMemo = useMemoStore(s => s.updateMemo);
  const addItem = useMemoStore(s => s.addItem);
  const deleteItem = useMemoStore(s => s.deleteItem);
  const updateItem = useMemoStore(s => s.updateItem);
  const reorderItems = useMemoStore(s => s.reorderItems);

  const totalMemoRegistrations = useSettingsStore(s => s.totalMemoRegistrations);
  const incrementMemoRegistrations = useSettingsStore(s => s.incrementMemoRegistrations);
  const { showIfReady } = useInterstitialAd();

  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  /** handleDone 実行中フラグ。onBlur の handleSaveTitle との二重保存を防ぐ */
  const isSavingRef = useRef(false);
  const [title, setTitle] = useState(existingMemo?.title ?? '');
  const [newItemName, setNewItemName] = useState('');
  const [savedMemoId, setSavedMemoId] = useState<string | undefined>(memoId);

  // チュートリアル用 refs
  const titleInputRef = useRef<View>(null);
  const addRowRef = useRef<View>(null);
  const doneBtnRef = useRef<View>(null);
  const { step: tutStep, isActive: tutActive, targetLayout: tutLayout, advance: tutAdvance, skip: tutSkip } =
    useTutorial('memoEdit', 3, [titleInputRef, addRowRef, doneBtnRef]);

  const currentItems = useMemoStore(
    useShallow((s): ShoppingItem[] => {
      if (!savedMemoId) return [];
      return s.memos.find(m => m.id === savedMemoId)?.items ?? [];
    }),
  );

  useEffect(() => {
    if (existingMemo) setTitle(existingMemo.title);
  }, [existingMemo]);

  // 未保存の変更がある場合、戻るときに確認ダイアログを表示
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
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
  }, [newItemName, savedMemoId, title, addMemo, addItem]);

  const renderItem = useCallback(({ item, drag, isActive }: RenderItemParams<ShoppingItem>) => (
    <ScaleDecorator>
      <View style={[styles.itemRow, isActive && styles.itemRowActive]}>
        <TouchableOpacity onLongPress={drag} delayLongPress={150}>
          <Icon name="drag-handle" size={20} color="#BDBDBD" />
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
    if (savedMemoId) {
      updateMemo(savedMemoId, { title: title.trim() });
    } else {
      const newMemo = addMemo(title.trim());
      targetId = newMemo.id;
    }
    if (!targetId) {
      navigation.goBack();
      return;
    }
    const finalId = targetId;
    const doNavigate = () => navigation.replace('MemoDetail', { memoId: finalId });
    if (isNew) {
      incrementMemoRegistrations();
      // totalMemoRegistrations は increment 前の値。
      // 5回目 (index 4) 以降からインタースティシャルを表示する
      if (totalMemoRegistrations >= 4) {
        showIfReady(doNavigate) || doNavigate();
        return;
      }
    }
    doNavigate();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'android' ? 80 : 0}>
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          // アイテム追加でリストが伸びたら最下部へ追従
          if (newItemName === '') {
            scrollRef.current?.scrollToEnd({ animated: true });
          }
        }}>
        {/* タイトル: ラベル＋入力欄をセットで spotlight */}
        <View ref={titleInputRef} collapsable={false}>
          <Text style={styles.label}>{t('memoEdit.titleLabel')}</Text>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder={t('memoEdit.titlePlaceholder')}
            placeholderTextColor="#BDBDBD"
            onBlur={handleSaveTitle}
            returnKeyType="done"
          />
        </View>

        {/* アイテム: ラベル＋リスト＋入力行をセットで spotlight */}
        <View ref={addRowRef} collapsable={false}>
          <Text style={styles.label}>{t('memoEdit.itemsLabel')}</Text>
          {currentItems.length > 0 && (
            <DraggableFlatList
              data={currentItems}
              keyExtractor={i => i.id}
              renderItem={renderItem}
              onDragEnd={({ data }) => {
                if (savedMemoId) reorderItems(savedMemoId, data);
              }}
              scrollEnabled={false}
            />
          )}

          {/* アイテム入力 */}
          <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            value={newItemName}
            onChangeText={setNewItemName}
            placeholder={t('memoEdit.addItemPlaceholder')}
            placeholderTextColor="#9E9E9E"
            onSubmitEditing={handleAddItem}
            returnKeyType="done"
            blurOnSubmit={false}
            maxLength={50}
            onFocus={() => {
              // キーボードが開ききってから末尾にスクロール
              setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 400);
            }}
          />
          {newItemName.trim().length > 0 && (
            <TouchableOpacity onPress={handleAddItem} style={styles.addButton}>
              <Icon name="add" size={20} color="#4CAF50" />
            </TouchableOpacity>
          )}
          </View>{/* /addRow */}
        </View>{/* /addRowRef wrapper */}
      </ScrollView>

      {/* 確認する */}
      <View ref={doneBtnRef} collapsable={false}>
        <TouchableOpacity style={[styles.doneBtn, { marginBottom: Math.max(insets.bottom, 16) }]} onPress={handleDone}>
          <Text style={styles.doneBtnText}>{t('memoEdit.doneButton')}</Text>
        </TouchableOpacity>
      </View>
      <TutorialTooltip
        visible={tutActive}
        targetLayout={tutLayout}
        text={[t('tutorial.memoEdit.step1'), t('tutorial.memoEdit.step2'), t('tutorial.memoEdit.step3')][tutStep] ?? ''}
        stepLabel={`STEP ${tutStep + 1} / 3`}
        isLast={tutStep === 2}
        nextLabel={tutStep === 2 ? t('tutorial.ok') : t('tutorial.next')}
        skipLabel={t('tutorial.skip')}
        onNext={tutAdvance}
        onSkip={tutSkip}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F5F5F5' },
  container: { flex: 1, padding: 16 },
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
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 4,
  },
  itemRowActive: {
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
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
});
