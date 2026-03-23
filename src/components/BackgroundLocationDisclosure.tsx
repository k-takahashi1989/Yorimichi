/**
 * バックグラウンド位置情報の認識しやすい開示（Prominent Disclosure）モーダル
 *
 * Google Play ポリシー準拠:
 * ACCESS_BACKGROUND_LOCATION をリクエストする前に、
 * データ収集の目的・範囲をユーザーに明示し、同意を得る。
 */
import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTranslation } from 'react-i18next';

interface Props {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export default function BackgroundLocationDisclosure({
  visible,
  onAccept,
  onDecline,
}: Props): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDecline}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Icon name="location-on" size={48} color="#4CAF50" />
          </View>

          <Text style={styles.title}>
            {t('backgroundDisclosure.title')}
          </Text>

          <ScrollView style={styles.scrollBody} bounces={false}>
            <Text style={styles.body}>
              {t('backgroundDisclosure.body')}
            </Text>
          </ScrollView>

          <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
            <Text style={styles.acceptBtnText}>
              {t('backgroundDisclosure.accept')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.declineBtn} onPress={onDecline}>
            <Text style={styles.declineBtnText}>
              {t('backgroundDisclosure.decline')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
    textAlign: 'center',
    marginBottom: 12,
  },
  scrollBody: {
    maxHeight: 240,
    marginBottom: 20,
  },
  body: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 22,
    textAlign: 'left',
  },
  acceptBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  acceptBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  declineBtn: {
    paddingVertical: 8,
  },
  declineBtnText: {
    color: '#9E9E9E',
    fontSize: 14,
  },
});
