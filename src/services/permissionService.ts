import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { startGeofenceMonitoring } from './geofenceService';
import i18n from '../i18n';

/**
 * 位置情報・通知の権限をリクエストする。
 * オンボーディング完了後、または既存ユーザーの起動時に呼び出す。
 */
export async function initPermissions(): Promise<void> {
  if (Platform.OS !== 'android') return;

  const androidVersion = Platform.Version as number;

  // 1. 前景位置情報
  const fineStatus = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
  if (fineStatus === RESULTS.BLOCKED) {
    Alert.alert(
      i18n.t('appPermission.fineLocationTitle'),
      i18n.t('appPermission.fineLocationMessage'),
      [
        { text: i18n.t('appPermission.later'), style: 'cancel' },
        { text: i18n.t('appPermission.openSettings'), onPress: () => Linking.openSettings() },
      ],
    );
    return;
  }
  if (fineStatus === RESULTS.DENIED) {
    const result = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
    if (result !== RESULTS.GRANTED) return;
  }

  // 前景許可取得済み → ジオフェンス開始
  startGeofenceMonitoring();

  // 2. バックグラウンド位置情報 (Android 10+ / API 29+)
  if (androidVersion >= 29) {
    const bgStatus = await check(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
    if (bgStatus === RESULTS.DENIED) {
      await request(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
    }
  }

  // 3. プッシュ通知 (Android 13+ / API 33+)
  if (androidVersion >= 33) {
    const notifGranted = await PermissionsAndroid.check(
      'android.permission.POST_NOTIFICATIONS' as any,
    );
    if (!notifGranted) {
      await PermissionsAndroid.request(
        'android.permission.POST_NOTIFICATIONS' as any,
      );
    }
  }
}
