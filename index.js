/**
 * @format
 * @build-cache-bust 20260301
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { registerBackgroundNotificationHandler } from './src/services/notificationService';
import { backgroundTask } from './src/services/geofenceService';
import { storage } from './src/storage/mmkvStorage';

// react-native-background-actions は Android でタスクキーに "1" を付加する
// AppRegistry に先行登録しないと "No task registered for key YorimichiGeofence1" エラーになる
AppRegistry.registerHeadlessTask('YorimichiGeofence1', () => backgroundTask);

// バックグラウンドで通知をタップしたときの処理
// 起動前なのでナビゲーションは使えない → MMKV に memoId を保存し、起動後に AppNavigator.onReady で処理する
registerBackgroundNotificationHandler((memoId) => {
  if (memoId) {
    storage.set('pendingNotificationMemoId', memoId);
  }
});

AppRegistry.registerComponent(appName, () => App);