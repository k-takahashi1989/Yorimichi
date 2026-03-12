/**
 * Firebase Crashlytics サービス
 * 本番環境でのクラッシュ・エラーレポートを一元管理する。
 */
import crashlytics from '@react-native-firebase/crashlytics';

/**
 * Crashlytics を初期化する。
 * __DEV__ (Metro) 環境ではクラッシュ収集を無効化する。
 */
export function initCrashlytics(): void {
  crashlytics().setCrashlyticsCollectionEnabled(!__DEV__);
}

/**
 * キャッチ済みの非致命的エラーを Crashlytics に送信する。
 * console.warn/error の代わりに使うことで、本番環境でエラーを可視化できる。
 */
export function recordError(error: unknown, context?: string): void {
  if (__DEV__) {
    console.warn(`[Crashlytics${context ? ` ${context}` : ''}]`, error);
    return;
  }
  const err = error instanceof Error ? error : new Error(String(error));
  if (context) {
    crashlytics().log(context);
  }
  crashlytics().recordError(err);
}

/**
 * Crashlytics にログメッセージを記録する（次回クラッシュ時に添付される）。
 */
export function log(message: string): void {
  if (__DEV__) {
    console.log(`[Crashlytics] ${message}`);
    return;
  }
  crashlytics().log(message);
}
