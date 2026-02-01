/**
 * GraphQLパーサーのテスト
 */

import { describe, it, expect } from 'bun:test';
import {
  parseGraphQLNodeId,
  parseGraphQLNodeIdSafe,
  parseGraphQLNodeIdOrZero,
  parseGraphQLDateTime,
  parseGraphQLBoolean,
  parseGraphQLInt,
  parseGraphQLString,
} from '../../src/utils/graphqlParser';

describe('graphqlParser', () => {
  describe('parseGraphQLNodeId', () => {
    it('数字を含むIDから数値を抽出する', () => {
      // 実装は数字のみを抽出して結合する
      expect(parseGraphQLNodeId('Issue123')).toBe(123);
      expect(parseGraphQLNodeId('PR_kwDOABCDEFGHI1234567890')).toBe(1234567890);
    });

    it('数字のみのIDを正しく処理する', () => {
      expect(parseGraphQLNodeId('12345')).toBe(12345);
    });

    it('nullまたはundefinedの場合はnullを返す', () => {
      expect(parseGraphQLNodeId(null)).toBeNull();
      expect(parseGraphQLNodeId(undefined)).toBeNull();
    });

    it('空文字列の場合はnullを返す', () => {
      expect(parseGraphQLNodeId('')).toBeNull();
    });

    it('数字を含まない文字列の場合はnullを返す', () => {
      expect(parseGraphQLNodeId('abc')).toBeNull();
    });

    it('複数の数字部分がある場合は結合して解析する', () => {
      expect(parseGraphQLNodeId('PR123_Issue456')).toBe(123456);
    });

    it('非常に大きな数値も処理できる', () => {
      const largeNumber = parseGraphQLNodeId('9999999999999');
      expect(largeNumber).toBe(9999999999999);
      expect(typeof largeNumber).toBe('number');
    });
  });

  describe('parseGraphQLNodeIdSafe', () => {
    it('成功時はsuccessフラグとデータを返す', () => {
      const result = parseGraphQLNodeIdSafe('PR123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(123);
      }
    });

    it('失敗時はsuccessフラグとエラーメッセージを返す', () => {
      const result = parseGraphQLNodeIdSafe('invalid');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Failed to parse GraphQL');
      }
    });

    it('カスタムフィールド名をエラーメッセージに含める', () => {
      const result = parseGraphQLNodeIdSafe('invalid', 'prId');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('prId');
      }
    });

    it('nullの場合はエラーを返す', () => {
      const result = parseGraphQLNodeIdSafe(null);
      expect(result.success).toBe(false);
    });
  });

  describe('parseGraphQLNodeIdOrZero', () => {
    it('正常な場合は数値を返す', () => {
      expect(parseGraphQLNodeIdOrZero('PR123')).toBe(123);
    });

    it('パースできない場合は0を返す', () => {
      expect(parseGraphQLNodeIdOrZero('invalid')).toBe(0);
      expect(parseGraphQLNodeIdOrZero(null)).toBe(0);
      expect(parseGraphQLNodeIdOrZero(undefined)).toBe(0);
      expect(parseGraphQLNodeIdOrZero('')).toBe(0);
    });
  });

  describe('parseGraphQLDateTime', () => {
    it('正しいISO 8601文字列をDateオブジェクトに変換する', () => {
      const date = parseGraphQLDateTime('2024-01-15T10:30:00Z');

      expect(date).toBeInstanceOf(Date);
      expect(date?.toISOString()).toBe('2024-01-15T10:30:00.000Z');
    });

    it('タイムゾーン付きの日時文字列を処理する', () => {
      const date = parseGraphQLDateTime('2024-01-15T10:30:00+09:00');

      expect(date).toBeInstanceOf(Date);
      expect(date?.getTime()).toBeGreaterThan(0);
    });

    it('nullまたはundefinedの場合はnullを返す', () => {
      expect(parseGraphQLDateTime(null)).toBeNull();
      expect(parseGraphQLDateTime(undefined)).toBeNull();
    });

    it('不正な日時文字列の場合はnullを返す', () => {
      expect(parseGraphQLDateTime('invalid-date')).toBeNull();
      expect(parseGraphQLDateTime('2024-13-99')).toBeNull();
    });

    it('空文字列の場合はnullを返す', () => {
      expect(parseGraphQLDateTime('')).toBeNull();
    });
  });

  describe('parseGraphQLBoolean', () => {
    it('trueを正しく変換する', () => {
      expect(parseGraphQLBoolean(true)).toBe(true);
    });

    it('falseを正しく変換する', () => {
      expect(parseGraphQLBoolean(false)).toBe(false);
    });

    it('nullの場合はデフォルト値を返す', () => {
      expect(parseGraphQLBoolean(null)).toBe(false);
      expect(parseGraphQLBoolean(null, true)).toBe(true);
    });

    it('undefinedの場合はデフォルト値を返す', () => {
      expect(parseGraphQLBoolean(undefined)).toBe(false);
      expect(parseGraphQLBoolean(undefined, true)).toBe(true);
    });

    it('デフォルト値未指定の場合はfalseを返す', () => {
      expect(parseGraphQLBoolean(null)).toBe(false);
      expect(parseGraphQLBoolean(undefined)).toBe(false);
    });
  });

  describe('parseGraphQLInt', () => {
    it('整数を正しく変換する', () => {
      expect(parseGraphQLInt(123)).toBe(123);
      expect(parseGraphQLInt(0)).toBe(0);
      expect(parseGraphQLInt(-456)).toBe(-456);
    });

    it('小数を整数に切り捨てる', () => {
      expect(parseGraphQLInt(123.7)).toBe(123);
      expect(parseGraphQLInt(-456.3)).toBe(-457); // Math.floor(-456.3) = -457
    });

    it('nullの場合はデフォルト値を返す', () => {
      expect(parseGraphQLInt(null)).toBe(0);
      expect(parseGraphQLInt(null, 999)).toBe(999);
    });

    it('undefinedの場合はデフォルト値を返す', () => {
      expect(parseGraphQLInt(undefined)).toBe(0);
      expect(parseGraphQLInt(undefined, 999)).toBe(999);
    });

    it('NaNの場合はデフォルト値を返す', () => {
      expect(parseGraphQLInt(NaN)).toBe(0);
      expect(parseGraphQLInt(NaN, 999)).toBe(999);
    });

    it('Infinityの場合はデフォルト値を返す', () => {
      expect(parseGraphQLInt(Infinity)).toBe(0);
      expect(parseGraphQLInt(-Infinity, 999)).toBe(999);
    });

    it('非数値型の場合はデフォルト値を返す', () => {
      expect(parseGraphQLInt('123' as any)).toBe(0);
      expect(parseGraphQLInt({} as any, 999)).toBe(999);
    });
  });

  describe('parseGraphQLString', () => {
    it('文字列をそのまま返す', () => {
      expect(parseGraphQLString('hello')).toBe('hello');
      expect(parseGraphQLString('')).toBe('');
    });

    it('nullの場合はデフォルト値を返す', () => {
      expect(parseGraphQLString(null)).toBe('');
      expect(parseGraphQLString(null, 'default')).toBe('default');
    });

    it('undefinedの場合はデフォルト値を返す', () => {
      expect(parseGraphQLString(undefined)).toBe('');
      expect(parseGraphQLString(undefined, 'default')).toBe('default');
    });

    it('非文字列型の場合はデフォルト値を返す', () => {
      expect(parseGraphQLString(123 as any)).toBe('');
      expect(parseGraphQLString({} as any, 'default')).toBe('default');
    });

    it('空文字列はそのまま返す（デフォルト値に置換しない）', () => {
      expect(parseGraphQLString('', 'default')).toBe('');
    });
  });
});
