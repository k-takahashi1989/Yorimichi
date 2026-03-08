/**
 * trialUtils ユニットテスト
 * isTrialActive / trialDaysRemaining
 */
import { isTrialActive, trialDaysRemaining, TRIAL_DURATION_MS } from '../src/utils/trialUtils';

const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// ============================================================
// isTrialActive
// ============================================================
describe('isTrialActive', () => {
  it('trialStartDate が null のとき false を返す', () => {
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    expect(isTrialActive(null)).toBe(false);
  });

  it('開始直後（0ms経過）は true を返す', () => {
    const now = new Date('2026-01-01T00:00:00Z').getTime();
    jest.setSystemTime(now);
    expect(isTrialActive(now)).toBe(true);
  });

  it('7日未満（6日23時間）は true を返す', () => {
    const start = new Date('2026-01-01T00:00:00Z').getTime();
    jest.setSystemTime(start + 7 * DAY_MS - 1);
    expect(isTrialActive(start)).toBe(true);
  });

  it('ちょうど7日（= TRIAL_DURATION_MS 経過）は false を返す', () => {
    const start = new Date('2026-01-01T00:00:00Z').getTime();
    jest.setSystemTime(start + TRIAL_DURATION_MS);
    expect(isTrialActive(start)).toBe(false);
  });

  it('7日を超えた（8日経過）は false を返す', () => {
    const start = new Date('2026-01-01T00:00:00Z').getTime();
    jest.setSystemTime(start + 8 * DAY_MS);
    expect(isTrialActive(start)).toBe(false);
  });

  it('未来の開始日（時刻が巻き戻された端末）でも true を返す', () => {
    const start = new Date('2026-01-10T00:00:00Z').getTime(); // 未来
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z').getTime()); // 現在は過去
    // now - start が負 → TRIAL_DURATION_MS より小さいので true
    expect(isTrialActive(start)).toBe(true);
  });
});

// ============================================================
// trialDaysRemaining
// ============================================================
describe('trialDaysRemaining', () => {
  it('trialStartDate が null のとき 0 を返す', () => {
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    expect(trialDaysRemaining(null)).toBe(0);
  });

  it('開始直後は 7 を返す（7日まるまる残っている）', () => {
    const now = new Date('2026-01-01T00:00:00Z').getTime();
    jest.setSystemTime(now);
    expect(trialDaysRemaining(now)).toBe(7);
  });

  it('1日経過後は 6 を返す', () => {
    const start = new Date('2026-01-01T00:00:00Z').getTime();
    jest.setSystemTime(start + 1 * DAY_MS);
    expect(trialDaysRemaining(start)).toBe(6);
  });

  it('6日23時間経過後は 1 を返す（切り上げ）', () => {
    const start = new Date('2026-01-01T00:00:00Z').getTime();
    jest.setSystemTime(start + 6 * DAY_MS + 23 * 60 * 60 * 1000);
    expect(trialDaysRemaining(start)).toBe(1);
  });

  it('ちょうど7日経過後は 0 を返す', () => {
    const start = new Date('2026-01-01T00:00:00Z').getTime();
    jest.setSystemTime(start + TRIAL_DURATION_MS);
    expect(trialDaysRemaining(start)).toBe(0);
  });

  it('8日経過後は 0 を返す（負にならない）', () => {
    const start = new Date('2026-01-01T00:00:00Z').getTime();
    jest.setSystemTime(start + 8 * DAY_MS);
    expect(trialDaysRemaining(start)).toBe(0);
  });
});
