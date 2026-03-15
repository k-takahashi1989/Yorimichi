/**
 * アプリ全体のカラーパレット
 * ハードコードされたカラーコードを集約し、ダークモード対応の準備とする。
 */

export const Colors = {
  // ブランドカラー
  primary: '#4CAF50',
  primaryDark: '#2E7D32',
  primaryLight: '#E8F5E9',
  primaryLighter: '#A5D6A7',

  // アクセント
  accent: '#2196F3',
  accentLight: '#BBDEFB',

  // セマンティックカラー
  error: '#EF5350',
  warning: '#FF9800',
  warningDark: '#F57C00',
  success: '#66BB6A',

  // テキスト
  textPrimary: '#212121',
  textSecondary: '#757575',
  textHint: '#9E9E9E',
  textDisabled: '#BDBDBD',

  // 背景
  background: '#F5F5F5',
  surface: '#FFFFFF',
  surfaceVariant: '#FAFAFA',

  // ボーダー
  border: '#E0E0E0',
  divider: '#F0F0F0',

  // その他
  overlay: 'rgba(0,0,0,0.45)',
  white: '#FFFFFF',
  transparent: 'transparent',

  // 共有メモ
  collaborator: '#6A1B9A',
  collaboratorLight: '#EDE7F6',

  // ノート
  noteBackground: '#FFFDE7',
} as const;
