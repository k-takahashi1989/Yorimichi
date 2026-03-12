import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  PermissionsAndroid,
  ScrollView,
  Linking,
  Switch,
  FlatList,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import {
  check,
  request,
  PERMISSIONS,
  RESULTS,
  openSettings,
} from 'react-native-permissions';
import Slider from '@react-native-community/slider';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AdBanner from '../components/AdBanner';
import DeviceInfo from 'react-native-device-info';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { changeAndPersistLanguage } from '../i18n';
import { useSettingsStore, selectEffectivePremium } from '../store/memoStore';
import { isTrialActive, trialDaysRemaining } from '../utils/trialUtils';
import {
  startGeofenceMonitoring,
  stopGeofenceMonitoring,
  isGeofencingActive,
} from '../services/geofenceService';

type PermStatus = 'granted' | 'denied' | 'blocked' | 'unavailable' | 'limited' | 'unknown';

type SettingsNav = NativeStackNavigationProp<RootStackParamList>;

const androidVersion = Platform.Version as number;

async function checkLocationPermissions(): Promise<{
  fine: PermStatus;
  background: PermStatus;
  notification: PermStatus;
}> {
  const fine = (await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION)) as PermStatus;
  const background = (await check(
    PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION,
  )) as PermStatus;

  let notification: PermStatus = 'granted';
  if (androidVersion >= 33) {
    const result = await PermissionsAndroid.check(
      'android.permission.POST_NOTIFICATIONS' as any,
    );
    notification = result ? 'granted' : 'denied';
  }

  return { fine, background, notification };
}

export default function SettingsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const navigation = useNavigation<SettingsNav>();
  const defaultRadius = useSettingsStore(s => s.defaultRadius);
  const setDefaultRadius = useSettingsStore(s => s.setDefaultRadius);
  const maxRadius = useSettingsStore(s => s.maxRadius);
  const setMaxRadius = useSettingsStore(s => s.setMaxRadius);
  const notifWindowEnabled = useSettingsStore(s => s.notifWindowEnabled);
  const notifWindowStart   = useSettingsStore(s => s.notifWindowStart);
  const notifWindowEnd     = useSettingsStore(s => s.notifWindowEnd);
  const setNotifWindow     = useSettingsStore(s => s.setNotifWindow);
  const isPremium          = useSettingsStore(selectEffectivePremium);
  const trialStartDate     = useSettingsStore(s => s.trialStartDate);
  const isTrialOn          = isTrialActive(trialStartDate);
  const daysLeft           = trialDaysRemaining(trialStartDate);

  const [perms, setPerms] = useState<{
    fine: PermStatus;
    background: PermStatus;
    notification: PermStatus;
  }>({ fine: 'unknown', background: 'unknown', notification: 'unknown' });

  const [displayRadius, setDisplayRadius] = useState(defaultRadius);

  const [isMonitoring, setIsMonitoring] = useState(isGeofencingActive());
  const [currentLang, setCurrentLang] = useState(i18n.language);
  const [notifPickerTarget, setNotifPickerTarget] = useState<'start' | 'end' | null>(null);

  const handleChangeLang = (lang: string) => {
    changeAndPersistLanguage(lang);
    setCurrentLang(lang);
  };

  const refreshPerms = async () => {
    const p = await checkLocationPermissions();
    setPerms(p);
  };

  useEffect(() => {
    refreshPerms();
  }, []);

  const handleRequestPerms = async () => {
    // 現在の状態を確認
    const current = await checkLocationPermissions();
    setPerms(current);
    const needsBg = androidVersion >= 29;
    const needsNotif = androidVersion >= 33;
    const allAlreadyGranted =
      current.fine === 'granted' &&
      (!needsBg || current.background === 'granted') &&
      (!needsNotif || current.notification === 'granted');

    if (allAlreadyGranted) {
      Alert.alert(
        t('settings.alertPermsAlreadyGranted.title'),
        t('settings.alertPermsAlreadyGranted.message'),
      );
      return;
    }

    // 1. 前景位置情報
    const fineResult = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
    if (fineResult !== RESULTS.GRANTED) {
      Alert.alert(
        t('settings.alertFineLocation.title'),
        t('settings.alertFineLocation.message'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('settings.alertFineLocation.openSettings'), onPress: () => openSettings() },
        ],
      );
      await refreshPerms();
      return;
    }

    // 2. バックグラウンド位置情報
    if (needsBg) {
      const bgResult = await request(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
      if (bgResult !== RESULTS.GRANTED) {
        Alert.alert(
          t('settings.alertBackground.title'),
          t('settings.alertBackground.message'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('settings.alertFineLocation.openSettings'), onPress: () => openSettings() },
          ],
        );
        await refreshPerms();
        return;
      }
    }

    // 3. 通知 (Android 13+)
    if (needsNotif) {
      await PermissionsAndroid.request(
        'android.permission.POST_NOTIFICATIONS' as any,
      );
    }

    // 結果確認
    const updated = await checkLocationPermissions();
    setPerms(updated);
    const nowGranted =
      updated.fine === 'granted' &&
      (!needsBg || updated.background === 'granted') &&
      (!needsNotif || updated.notification === 'granted');
    if (nowGranted) {
      Alert.alert(
        t('settings.alertPermsSuccess.title'),
        t('settings.alertPermsSuccess.message'),
      );
    }
  };

  const handleToggleMonitoring = async () => {
    if (isMonitoring) {
      await stopGeofenceMonitoring();
      setIsMonitoring(false);
    } else {
      if (perms.fine !== 'granted') {
        Alert.alert(t('settings.alertFineLocation.title'), t('settings.alertMonitor.message'));
        return;
      }
      const ok = await startGeofenceMonitoring();
      setIsMonitoring(ok);
      if (!ok) {
        Alert.alert(t('common.error'), t('settings.alertMonitor.message'));
      }
    }
  };

  const statusIcon = (s: PermStatus) => {
    if (s === 'granted') return <Icon name="check-circle" size={20} color="#4CAF50" />;
    if (s === 'blocked') return <Icon name="block" size={20} color="#EF5350" />;
    return <Icon name="warning" size={20} color="#FF9800" />;
  };

  const statusText = (s: PermStatus) => {
    switch (s) {
      case 'granted': return t('settings.status.on');
      case 'denied': return t('settings.status.off');
      case 'blocked': return t('settings.status.blocked');
      case 'unavailable': return t('settings.status.unavailable');
      default: return t('settings.status.checking');
    }
  };

  // 0:00 〜 23:30（30分刻み, 48件）
  const HALF_HOURS = Array.from({ length: 48 }, (_, i) => i * 0.5);
  const formatHour = (h: number) => {
    const hh = Math.floor(h);
    const mm = h % 1 === 0 ? '00' : '30';
    return `${hh}:${mm}`;
  };

  const allGranted =
    perms.fine === 'granted' &&
    (androidVersion < 29 || perms.background === 'granted') &&
    (androidVersion < 33 || perms.notification === 'granted');

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.pageTitle}>{t('settings.screenTitle')}</Text>

      {/* 権限セクション */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('settings.permCard.title')}</Text>

        <View style={styles.permRow}>
          {statusIcon(perms.fine)}
          <View style={styles.permBody}>
            <Text style={styles.permName}>{t('settings.permCard.foreground')}</Text>
            <Text style={styles.permStatus}>{statusText(perms.fine)}</Text>
          </View>
        </View>

        <View style={styles.permRow}>
          {statusIcon(perms.background)}
          <View style={styles.permBody}>
            <Text style={styles.permName}>{t('settings.permCard.background')}</Text>
            <Text style={styles.permStatus}>{statusText(perms.background)}</Text>
          </View>
        </View>

        <View style={styles.permRow}>
          {statusIcon(perms.notification)}
          <View style={styles.permBody}>
            <Text style={styles.permName}>{t('settings.permCard.notification')}</Text>
            <Text style={styles.permStatus}>{statusText(perms.notification)}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.permBtn, allGranted && styles.permBtnGranted]}
          onPress={handleRequestPerms}>
          <Icon name={allGranted ? 'check-circle' : 'lock-open'} size={18} color="#fff" />
          <Text style={styles.permBtnText}>
            {allGranted ? t('settings.permCard.grantedButton') : t('settings.permCard.enableButton')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 監視の ON/OFF */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('settings.monitorCard.title')}</Text>
        <Text style={styles.cardDesc}>
          {t('settings.monitorCard.description')}
        </Text>
        <TouchableOpacity
          style={[styles.monitorBtn, isMonitoring && styles.monitorBtnStop]}
          onPress={handleToggleMonitoring}>
          <Icon name={isMonitoring ? 'stop' : 'play-arrow'} size={20} color="#fff" />
          <Text style={styles.monitorBtnText}>
            {isMonitoring ? t('settings.monitorCard.stopButton') : t('settings.monitorCard.startButton')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* デフォルト半径 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('settings.defaultRadius.title')}</Text>
        <Text style={styles.radiusValue}>{displayRadius} m</Text>
        <Slider
          style={styles.slider}
          minimumValue={100}
          maximumValue={maxRadius}
          step={10}
          value={defaultRadius}
          onValueChange={setDisplayRadius}
          onSlidingComplete={setDefaultRadius}
          minimumTrackTintColor="#4CAF50"
          maximumTrackTintColor="#E0E0E0"
          thumbTintColor="#4CAF50"
        />
        <View style={styles.sliderLabels}>
          <Text style={styles.sliderLabel}>100m</Text>
          <Text style={styles.sliderLabel}>{maxRadius}m</Text>
        </View>
      </View>

      {/* 半径拡大オプション */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('settings.maxRadius.title')}</Text>
        <Text style={styles.infoText}>{t('settings.maxRadius.description')}</Text>
        <View style={styles.maxRadiusRow}>
          {[200, 400, 600, 800, 1000].map(val => (
            <TouchableOpacity
              key={val}
              style={[styles.maxRadiusBtn, maxRadius === val && styles.maxRadiusBtnActive]}
              onPress={() => setMaxRadius(val)}>
              <Text style={[styles.maxRadiusBtnText, maxRadius === val && styles.maxRadiusBtnTextActive]}>{val}m</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 表示言語 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('settings.langCard.title')}</Text>
        <View style={styles.langRow}>
          <TouchableOpacity
            style={[styles.langBtn, currentLang === 'ja' && styles.langBtnActive]}
            onPress={() => handleChangeLang('ja')}>
            <Text style={[styles.langBtnText, currentLang === 'ja' && styles.langBtnTextActive]}>🇯🇵 日本語</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.langBtn, currentLang === 'en' && styles.langBtnActive]}
            onPress={() => handleChangeLang('en')}>
            <Text style={[styles.langBtnText, currentLang === 'en' && styles.langBtnTextActive]}>🇺🇸 English</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 通知時間帯 */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Icon name="schedule" size={18} color="#4CAF50" />
          <Text style={[styles.cardTitle, styles.cardTitleInRow]}>
            {t('settings.notifWindow.sectionTitle')}
          </Text>
        </View>
        <Text style={styles.cardDesc}>
          {t('settings.notifWindow.description')}
        </Text>
        <View style={styles.notifWindowRow}>
          <Text style={styles.notifWindowLabel}>{t('settings.notifWindow.enableToggle')}</Text>
          <Switch
            value={notifWindowEnabled}
            onValueChange={v => setNotifWindow(v, notifWindowStart, notifWindowEnd)}
            trackColor={{ false: '#E0E0E0', true: '#A5D6A7' }}
            thumbColor={notifWindowEnabled ? '#4CAF50' : '#F5F5F5'}
          />
        </View>
        {notifWindowEnabled && (
          <View style={styles.notifTimesRow}>
            <TouchableOpacity
              style={styles.notifTimeBtn}
              onPress={() => setNotifPickerTarget('start')}>
              <Text style={styles.notifTimeBtnLabel}>{t('settings.notifWindow.startLabel')}</Text>
              <Text style={styles.notifTimeBtnValue}>{formatHour(notifWindowStart)}</Text>
            </TouchableOpacity>
            <Icon name="arrow-forward" size={16} color="#9E9E9E" />
            <TouchableOpacity
              style={styles.notifTimeBtn}
              onPress={() => setNotifPickerTarget('end')}>
              <Text style={styles.notifTimeBtnLabel}>{t('settings.notifWindow.endLabel')}</Text>
              <Text style={styles.notifTimeBtnValue}>{formatHour(notifWindowEnd)}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* プレミアムプランカード */}
      <TouchableOpacity
        style={styles.premiumCard}
        onPress={() => navigation.navigate('Premium')}
        activeOpacity={0.85}>
        <View style={styles.premiumCardLeft}>
          <Text style={styles.premiumCardIcon}>✨</Text>
          <View>
            <Text style={styles.premiumCardTitle}>{t('premium.screenTitle')}</Text>
            <Text style={styles.premiumCardSub}>
              {isPremium
                ? t('premium.currentPremium')
                : isTrialOn
                ? t('premium.trialActive', { days: daysLeft })
                : t('premium.upgradeButton')}
            </Text>
          </View>
        </View>
        <Icon name="chevron-right" size={24} color="#FFF" />
      </TouchableOpacity>

      {/* アプリ情報 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('settings.appInfo.title')}</Text>
        <Text style={styles.infoText}>{t('settings.appInfo.version', { version: DeviceInfo.getVersion() })}</Text>
        <Text style={styles.infoText}>{t('settings.appInfo.name')}</Text>
        <TouchableOpacity
          style={styles.privacyPolicyRow}
          onPress={() => Linking.openURL('https://k-takahashi1989.github.io/Yorimichi/privacy.html')}>
          <Icon name="privacy-tip" size={16} color="#4CAF50" />
          <Text style={styles.privacyPolicyText}>{t('settings.appInfo.privacyPolicy')}</Text>
          <Icon name="open-in-new" size={14} color="#9E9E9E" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.privacyPolicyRow}
          onPress={() => Linking.openURL('https://k-takahashi1989.github.io/Yorimichi/')}>
          <Icon name="mail-outline" size={16} color="#4CAF50" />
          <Text style={styles.privacyPolicyText}>{t('settings.appInfo.contact')}</Text>
          <Icon name="open-in-new" size={14} color="#9E9E9E" />
        </TouchableOpacity>
      </View>
      <AdBanner />

      {/* 通知時間帯 時刻ピッカーモーダル */}
      <Modal
        visible={notifPickerTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setNotifPickerTarget(null)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerSheetTitle}>
              {notifPickerTarget === 'start'
                ? t('settings.notifWindow.startLabel')
                : t('settings.notifWindow.endLabel')}
            </Text>
            <FlatList
              data={HALF_HOURS}
              keyExtractor={item => String(item)}
              style={styles.pickerList}
              getItemLayout={(_, index) => ({ length: 48, offset: 48 * index, index })}
              initialScrollIndex={Math.max(
                0,
                HALF_HOURS.indexOf(
                  notifPickerTarget === 'start' ? notifWindowStart : notifWindowEnd,
                ) - 3,
              )}
              renderItem={({ item }) => {
                const isSelected =
                  item ===
                  (notifPickerTarget === 'start' ? notifWindowStart : notifWindowEnd);
                return (
                  <TouchableOpacity
                    style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                    onPress={() => {
                      if (notifPickerTarget === 'start') {
                        setNotifWindow(notifWindowEnabled, item, notifWindowEnd);
                      } else {
                        setNotifWindow(notifWindowEnabled, notifWindowStart, item);
                      }
                      setNotifPickerTarget(null);
                    }}>
                    <Text
                      style={[
                        styles.pickerItemText,
                        isSelected && styles.pickerItemTextSel,
                      ]}>
                      {formatHour(item)}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity
              style={styles.pickerCancelBtn}
              onPress={() => setNotifPickerTarget(null)}>
              <Text style={styles.pickerCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  premiumCard: {
    backgroundColor: '#E65100',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
  },
  premiumCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  premiumCardIcon: { fontSize: 28 },
  premiumCardTitle: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  premiumCardSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  container: { flex: 1, backgroundColor: '#F5F5F5', padding: 16 },
  pageTitle: { fontSize: 20, fontWeight: 'bold', color: '#212121', marginBottom: 16, marginTop: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    elevation: 1,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#424242', marginBottom: 12 },
  cardDesc: { fontSize: 13, color: '#757575', marginBottom: 12, lineHeight: 20 },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  permBody: { flex: 1 },
  permName: { fontSize: 14, color: '#212121', fontWeight: '500' },
  permStatus: { fontSize: 12, color: '#9E9E9E', marginTop: 2 },
  permBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 12,
    marginTop: 14,
  },
  permBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  permBtnGranted: { backgroundColor: '#757575' },
  monitorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 12,
  },
  monitorBtnStop: { backgroundColor: '#EF5350' },
  monitorBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  radiusValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
    textAlign: 'center',
    marginBottom: 8,
  },
  slider: { width: '100%', height: 40 },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
  },
  sliderLabel: { fontSize: 11, color: '#9E9E9E' },
  maxRadiusRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  maxRadiusBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  maxRadiusBtnActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E9',
  },
  maxRadiusBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#9E9E9E',
  },
  maxRadiusBtnTextActive: {
    color: '#4CAF50',
  },
  infoText: { fontSize: 13, color: '#757575', marginBottom: 4 },
  privacyPolicyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  privacyPolicyText: { flex: 1, fontSize: 13, color: '#4CAF50', fontWeight: '600' },
  langRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  langBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  langBtnActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E9',
  },
  langBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9E9E9E',
  },
  langBtnTextActive: {
    color: '#4CAF50',
  },

  // ── 通知時間帯カード ────────────────────────────────────
  cardLocked: { opacity: 0.75 },
  cardTitleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, marginBottom: 10 },
  cardTitleInRow: { marginBottom: 0, marginLeft: 6, flex: 1 },
  cardTitleDimmed: { color: '#BDBDBD' },
  lockBadge: { marginLeft: 4 },
  textDimmed: { color: '#BDBDBD' },
  notifWindowRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 8,
  },
  notifWindowLabel: { fontSize: 14, color: '#424242', flex: 1 },
  notifTimesRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 12,
    paddingTop: 8,
  },
  notifTimeBtn: {
    alignItems: 'center' as const,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  notifTimeBtnLabel: { fontSize: 11, color: '#9E9E9E', marginBottom: 4 },
  notifTimeBtnValue: { fontSize: 22, fontWeight: '700' as const, color: '#212121' },

  // ── 時刻ピッカーモーダル ───────────────────────────────────
  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end' as const,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  pickerSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '60%',
  },
  pickerSheetTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#212121',
    textAlign: 'center' as const,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  pickerList: { maxHeight: 250 },
  pickerItem: {
    height: 48,
    justifyContent: 'center' as const,
    paddingHorizontal: 24,
  },
  pickerItemSelected: { backgroundColor: '#E8F5E9' },
  pickerItemText: { fontSize: 16, color: '#424242' },
  pickerItemTextSel: { color: '#2E7D32', fontWeight: '700' as const },
  pickerCancelBtn: {
    marginTop: 8,
    marginHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center' as const,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
  },
  pickerCancelText: { fontSize: 14, color: '#757575', fontWeight: '600' as const },
});



