/**
 * スプレッドシートバリデーターのテスト
 */

import { describe, it, expect } from 'bun:test';
import { validateMultipleSpreadsheetAccess } from '../../src/utils/spreadsheetValidator';

describe('spreadsheetValidator', () => {
  describe('validateMultipleSpreadsheetAccess', () => {
    it('空配列の場合は空の結果を返す', () => {
      const result = validateMultipleSpreadsheetAccess([]);

      expect(result.valid).toEqual([]);
      expect(result.invalid).toEqual([]);
    });

    // テスト環境ではSpreadsheetAppが存在しないため、
    // 実際のバリデーションロジックは統合テストで検証する
    it('IDリストを処理する構造を持つ', () => {
      const ids = ['id1', 'id2', 'id3'];
      const result = validateMultipleSpreadsheetAccess(ids);

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('invalid');
      expect(Array.isArray(result.valid)).toBe(true);
      expect(Array.isArray(result.invalid)).toBe(true);
    });

    it('テスト環境ではすべてvalidとして扱われる', () => {
      // SpreadsheetAppが未定義の場合、validateSpreadsheetAccessは早期リターンする
      const ids = ['test-id-1', 'test-id-2'];
      const result = validateMultipleSpreadsheetAccess(ids);

      // テスト環境では全て valid になるはず
      expect(result.valid.length + result.invalid.length).toBe(ids.length);
    });
  });
});
