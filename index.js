/**
 * @format
 * @build-cache-bust 20260301
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { registerBackgroundNotificationHandler } from './src/services/notificationService';
import { storage } from './src/storage/mmkvStorage';

// バックグラウンドで通知をタップしたときの処理
// 起動前なのでナビゲーションは使えない → MMKV に memoId を保存し、起動後に AppNavigator.onReady で処理する
registerBackgroundNotificationHandler((memoId) => {
  if (memoId) {
    storage.set('pendingNotificationMemoId', memoId);
  }
});

AppRegistry.registerComponent(appName, () => App);