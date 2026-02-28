import { storage } from '../storage/mmkvStorage';
import { generateId } from './helpers';

const DEVICE_ID_KEY = 'device_id';

/**
 * このデバイス固有の匿名IDを返す。
 * 初回呼び出し時に UUID を生成して MMKV に永続化する。
 */
export function getDeviceId(): string {
  const existing = storage.getString(DEVICE_ID_KEY);
  if (existing) return existing;
  const newId = generateId();
  storage.set(DEVICE_ID_KEY, newId);
  return newId;
}
