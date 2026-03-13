import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

interface LimitModalProps {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  title: string;
  message: string;
}

export function LimitModal({
  visible,
  onClose,
  onUpgrade,
  title,
  message,
}: LimitModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}>
        <View style={styles.card} onStartShouldSetResponder={() => true}>
          <Text style={styles.icon}>✨</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity style={styles.upgradeBtn} onPress={onUpgrade}>
            <Text style={styles.upgradeBtnText}>
              {t('errors.upgradeButton')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.laterBtn} onPress={onClose}>
            <Text style={styles.laterBtnText}>{t('errors.later')}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  icon: {
    fontSize: 40,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#616161',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  upgradeBtn: {
    backgroundColor: '#FF9800',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  upgradeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  laterBtn: {
    paddingVertical: 8,
  },
  laterBtnText: {
    color: '#9E9E9E',
    fontSize: 14,
  },
});
