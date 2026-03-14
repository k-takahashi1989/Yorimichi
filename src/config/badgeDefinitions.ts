/**
 * バッジ定義（静的データ）
 *
 * 27個のバッジを5カテゴリに分類。
 * icon は将来 require('../assets/badges/xxx.png') に差し替え予定。
 * 初期実装では MaterialIcons 名を使用する。
 */

export type BadgeCategory = 'visit' | 'memo' | 'share' | 'time' | 'hidden';

export interface BadgeDefinition {
  id: string;
  category: BadgeCategory;
  nameKey: string;        // i18n キー
  descriptionKey: string; // i18n キー
  iconName: string;       // MaterialIcons アイコン名（暫定）
  hidden: boolean;        // true = 条件を「???」表示
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // ── 訪問系（7個）──────────────────────────────────────────
  { id: 'visit_first',      category: 'visit', nameKey: 'badges.visit_first',      descriptionKey: 'badges.visit_first_desc',      iconName: 'place',         hidden: false },
  { id: 'visit_10',         category: 'visit', nameKey: 'badges.visit_10',         descriptionKey: 'badges.visit_10_desc',         iconName: 'directions-walk', hidden: false },
  { id: 'visit_50',         category: 'visit', nameKey: 'badges.visit_50',         descriptionKey: 'badges.visit_50_desc',         iconName: 'shopping-cart',   hidden: false },
  { id: 'visit_100',        category: 'visit', nameKey: 'badges.visit_100',        descriptionKey: 'badges.visit_100_desc',        iconName: 'emoji-events',    hidden: false },
  { id: 'visit_places_5',   category: 'visit', nameKey: 'badges.visit_places_5',   descriptionKey: 'badges.visit_places_5_desc',   iconName: 'explore',         hidden: false },
  { id: 'visit_places_10',  category: 'visit', nameKey: 'badges.visit_places_10',  descriptionKey: 'badges.visit_places_10_desc',  iconName: 'flight',          hidden: false },
  { id: 'visit_places_20',  category: 'visit', nameKey: 'badges.visit_places_20',  descriptionKey: 'badges.visit_places_20_desc',  iconName: 'map',             hidden: false },

  // ── メモ・リスト系（6個）──────────────────────────────────
  { id: 'memo_first',            category: 'memo', nameKey: 'badges.memo_first',            descriptionKey: 'badges.memo_first_desc',            iconName: 'note-add',       hidden: false },
  { id: 'memo_5',                category: 'memo', nameKey: 'badges.memo_5',                descriptionKey: 'badges.memo_5_desc',                iconName: 'collections-bookmark', hidden: false },
  { id: 'item_complete_first',   category: 'memo', nameKey: 'badges.item_complete_first',   descriptionKey: 'badges.item_complete_first_desc',   iconName: 'check-circle',   hidden: false },
  { id: 'item_complete_50',      category: 'memo', nameKey: 'badges.item_complete_50',      descriptionKey: 'badges.item_complete_50_desc',      iconName: 'shopping-basket', hidden: false },
  { id: 'item_complete_100',     category: 'memo', nameKey: 'badges.item_complete_100',     descriptionKey: 'badges.item_complete_100_desc',     iconName: 'star',            hidden: false },
  { id: 'memo_full_list',        category: 'memo', nameKey: 'badges.memo_full_list',        descriptionKey: 'badges.memo_full_list_desc',        iconName: 'format-list-numbered', hidden: false },

  // ── 共有系（4個）──────────────────────────────────────────
  { id: 'share_first',       category: 'share', nameKey: 'badges.share_first',       descriptionKey: 'badges.share_first_desc',       iconName: 'share',           hidden: false },
  { id: 'share_collab_3',    category: 'share', nameKey: 'badges.share_collab_3',    descriptionKey: 'badges.share_collab_3_desc',    iconName: 'groups',          hidden: false },
  { id: 'share_5',           category: 'share', nameKey: 'badges.share_5',           descriptionKey: 'badges.share_5_desc',           iconName: 'people',          hidden: false },
  { id: 'share_complete_10', category: 'share', nameKey: 'badges.share_complete_10', descriptionKey: 'badges.share_complete_10_desc', iconName: 'volunteer-activism', hidden: false },

  // ── 時間系（3個）──────────────────────────────────────────
  { id: 'time_night',       category: 'time', nameKey: 'badges.time_night',       descriptionKey: 'badges.time_night_desc',       iconName: 'nightlight',      hidden: false },
  { id: 'time_morning',     category: 'time', nameKey: 'badges.time_morning',     descriptionKey: 'badges.time_morning_desc',     iconName: 'wb-sunny',        hidden: false },
  { id: 'time_weekend_10',  category: 'time', nameKey: 'badges.time_weekend_10',  descriptionKey: 'badges.time_weekend_10_desc',  iconName: 'weekend',         hidden: false },

  // ── 隠しバッジ（4個）──────────────────────────────────────
  { id: 'hidden_midnight',    category: 'hidden', nameKey: 'badges.hidden_midnight',    descriptionKey: 'badges.hidden_midnight_desc',    iconName: 'dark-mode',       hidden: true },
  { id: 'hidden_anniversary', category: 'hidden', nameKey: 'badges.hidden_anniversary', descriptionKey: 'badges.hidden_anniversary_desc', iconName: 'cake',            hidden: true },
  { id: 'hidden_streak',     category: 'hidden', nameKey: 'badges.hidden_streak',     descriptionKey: 'badges.hidden_streak_desc',     iconName: 'local-fire-department', hidden: true },
  { id: 'hidden_visit_back', category: 'hidden', nameKey: 'badges.hidden_visit_back', descriptionKey: 'badges.hidden_visit_back_desc', iconName: 'replay',          hidden: true },
];

export const BADGE_CATEGORIES: { key: BadgeCategory; labelKey: string }[] = [
  { key: 'visit',  labelKey: 'badges.categoryVisit' },
  { key: 'memo',   labelKey: 'badges.categoryMemo' },
  { key: 'share',  labelKey: 'badges.categoryShare' },
  { key: 'time',   labelKey: 'badges.categoryTime' },
  { key: 'hidden', labelKey: 'badges.categoryHidden' },
];

export function getBadgeById(id: string): BadgeDefinition | undefined {
  return BADGE_DEFINITIONS.find(b => b.id === id);
}
