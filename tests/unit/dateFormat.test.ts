/**
 * 日時フォーマットユーティリティのテスト
 */

import { describe, expect, test } from 'bun:test';
import {
  formatDateTimeForDisplay,
  formatDateForDisplay,
  formatCellValue,
  formatRowsForSheet,
} from '../../src/utils/dateFormat';

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

  describe('formatCellValue', () => {
    test('ISO形式の日時文字列を自動的にフォーマット', () => {
      const result = formatCellValue('2026-01-09T00:42:33Z');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    test('数値はそのまま返す', () => {
      expect(formatCellValue(123)).toBe(123);
      expect(formatCellValue(0)).toBe(0);
      expect(formatCellValue(-456)).toBe(-456);
    });

    test('nullとundefinedはそのまま返す', () => {
      expect(formatCellValue(null)).toBe(null);
      expect(formatCellValue(undefined)).toBe(undefined);
    });

    test('通常の文字列はそのまま返す', () => {
      expect(formatCellValue('Hello')).toBe('Hello');
      expect(formatCellValue('N/A')).toBe('N/A');
      expect(formatCellValue('Not merged')).toBe('Not merged');
    });

    test('ISO形式でない日付文字列はそのまま返す', () => {
      expect(formatCellValue('2026-01-09')).toBe('2026-01-09');
      expect(formatCellValue('09/01/2026')).toBe('09/01/2026');
    });
  });

  describe('formatRowsForSheet', () => {
    test('行データの日時文字列を自動的にフォーマット', () => {
      const rows = [
        [123, 'Title 1', '2026-01-09T00:42:33Z', 456],
        [789, 'Title 2', '2026-01-10T01:23:45Z', 123],
      ];
      const result = formatRowsForSheet(rows);

      expect(result[0][0]).toBe(123);
      expect(result[0][1]).toBe('Title 1');
      expect(result[0][2]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      expect(result[0][3]).toBe(456);

      expect(result[1][0]).toBe(789);
      expect(result[1][1]).toBe('Title 2');
      expect(result[1][2]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      expect(result[1][3]).toBe(123);
    });

    test('複数の日時フィールドを含む行を処理', () => {
      const rows = [
        [
          123,
          'Title',
          '2026-01-09T00:00:00Z',
          '2026-01-09T01:00:00Z',
          '2026-01-09T02:00:00Z',
          'N/A',
        ],
      ];
      const result = formatRowsForSheet(rows);

      expect(result[0][0]).toBe(123);
      expect(result[0][1]).toBe('Title');
      expect(result[0][2]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      expect(result[0][3]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      expect(result[0][4]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      expect(result[0][5]).toBe('N/A');
    });

    test('空配列を処理', () => {
      const result = formatRowsForSheet([]);
      expect(result).toEqual([]);
    });

    test('日時以外のデータはそのまま保持', () => {
      const rows = [[123, 'Text', null, undefined, 'N/A', 456.78]];
      const result = formatRowsForSheet(rows);

      expect(result[0]).toEqual([123, 'Text', null, undefined, 'N/A', 456.78]);
    });
  });
});
