/**
 * 日時フォーマットユーティリティのテスト
 */

import { describe, expect, test } from 'bun:test';
import { formatDateTimeForDisplay, formatDateForDisplay } from '../../src/utils/dateFormat';

describe('dateFormat', () => {
  describe('formatDateTimeForDisplay', () => {
    test('ISO形式の日時を読みやすい形式に変換', () => {
      const result = formatDateTimeForDisplay('2026-01-09T00:42:33Z');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    test('タイムゾーン付きISO形式を変換', () => {
      const result = formatDateTimeForDisplay('2026-01-09T00:42:33+09:00');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    test('無効な日付の場合は元の文字列を返す', () => {
      const invalidDate = 'invalid-date';
      const result = formatDateTimeForDisplay(invalidDate);
      expect(result).toBe(invalidDate);
    });

    test('空文字列の場合は元の文字列を返す', () => {
      const emptyString = '';
      const result = formatDateTimeForDisplay(emptyString);
      expect(result).toBe(emptyString);
    });

    test('フォーマットが正しい（ゼロパディング）', () => {
      const result = formatDateTimeForDisplay('2026-01-09T03:05:07Z');
      // 時刻部分にゼロパディングが含まれることを確認
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });
  });

  describe('formatDateForDisplay', () => {
    test('Date オブジェクトを読みやすい形式に変換', () => {
      const date = new Date('2026-01-09T00:42:33Z');
      const result = formatDateForDisplay(date);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    test('Date オブジェクトの年月日が正しく変換される', () => {
      const date = new Date('2026-03-15T12:30:45Z');
      const result = formatDateForDisplay(date);
      expect(result).toContain('2026-03-15');
    });
  });
});
