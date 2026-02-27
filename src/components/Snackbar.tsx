import React, { useEffect, useRef } from 'react';
import { Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';

interface SnackbarProps {
  visible: boolean;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  /** 自動非表示までのミリ秒 (デフォルト 3000ms) */
  duration?: number;
}

/**
 * 画面下部に表示されるスナックバー。
 * アクションボタン付きで、一定時間後に自動非表示になる。
 * 親コンポーネントは visible + onDismiss で制御する。
 */
export default function Snackbar({
  visible,
  message,
  actionLabel,
  onAction,
  onDismiss,
  duration = 3000,
}: SnackbarProps): React.JSX.Element {
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      // フェードイン
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      // 自動非表示タイマー
      timerRef.current = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => onDismiss());
      }, duration);
    } else {
      // 親が直接 visible=false にした場合（Undo後など）は即座に消す
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      opacity.setValue(0);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleAction = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onAction?.();
    Animated.timing(opacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => onDismiss());
  };

  return (
    <Animated.View
      style={[styles.container, { opacity }]}
      pointerEvents={visible ? 'box-none' : 'none'}>
      <Text style={styles.message} numberOfLines={2}>
        {message}
      </Text>
      {actionLabel && onAction && (
        <TouchableOpacity onPress={handleAction} style={styles.action}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#323232',
    borderRadius: 8,
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  message: { flex: 1, color: '#fff', fontSize: 14 },
  action: { marginLeft: 12, paddingHorizontal: 8, paddingVertical: 4 },
  actionText: { color: '#81C784', fontWeight: '700', fontSize: 14 },
});
