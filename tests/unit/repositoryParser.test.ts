/**
 * リポジトリパーサーのテスト
 */

import { describe, it, expect } from 'bun:test';
import {
  parseRepository,
  parseRepositorySafe,
  isValidRepositoryFullName,
} from '../../src/utils/repositoryParser';
import { ValidationError } from '../../src/utils/errors';

describe('repositoryParser', () => {
  describe('parseRepository', () => {
    it('正常系: 正しいリポジトリ名をパースする', () => {
      const result = parseRepository('octocat/Hello-World');

      expect(result.owner).toBe('octocat');
      expect(result.repo).toBe('Hello-World');
      expect(result.fullName).toBe('octocat/Hello-World');
    });

    it('組織名も正しくパースする', () => {
      const result = parseRepository('facebook/react');

      expect(result.owner).toBe('facebook');
      expect(result.repo).toBe('react');
      expect(result.fullName).toBe('facebook/react');
    });

    it('ドットを含むリポジトリ名をパースする', () => {
      const result = parseRepository('nodejs/node.js');

      expect(result.owner).toBe('nodejs');
      expect(result.repo).toBe('node.js');
    });

    it('アンダースコアを含むリポジトリ名をパースする', () => {
      const result = parseRepository('user/my_repo');

      expect(result.owner).toBe('user');
      expect(result.repo).toBe('my_repo');
    });

    it('数字を含むリポジトリ名をパースする', () => {
      const result = parseRepository('user123/repo456');

      expect(result.owner).toBe('user123');
      expect(result.repo).toBe('repo456');
    });

    it('異常系: 空文字列の場合はエラーをスロー', () => {
      expect(() => parseRepository('')).toThrow(ValidationError);
    });

    it('異常系: スラッシュがない場合はエラーをスロー', () => {
      expect(() => parseRepository('invalid-repo')).toThrow(ValidationError);
    });

    it('異常系: スラッシュが複数ある場合はエラーをスロー', () => {
      expect(() => parseRepository('owner/repo/extra')).toThrow(ValidationError);
    });

    it('異常系: オーナー名が空の場合はエラーをスロー', () => {
      expect(() => parseRepository('/repo')).toThrow(ValidationError);
    });

    it('異常系: リポジトリ名が空の場合はエラーをスロー', () => {
      expect(() => parseRepository('owner/')).toThrow(ValidationError);
    });

    it('異常系: 不正な文字を含む場合はエラーをスロー', () => {
      expect(() => parseRepository('owner/repo with spaces')).toThrow(ValidationError);
    });

    it('異常系: ハイフンで始まるオーナー名はエラーをスロー', () => {
      expect(() => parseRepository('-owner/repo')).toThrow(ValidationError);
    });

    it('異常系: 連続するハイフンを含むオーナー名はエラーをスロー', () => {
      expect(() => parseRepository('owner--name/repo')).toThrow(ValidationError);
    });

    it('異常系: オーナー名が40文字以上の場合はエラーをスロー', () => {
      const longOwner = 'a'.repeat(40);
      expect(() => parseRepository(`${longOwner}/repo`)).toThrow(ValidationError);
    });

    it('異常系: リポジトリ名が101文字以上の場合はエラーをスロー', () => {
      const longRepo = 'a'.repeat(101);
      expect(() => parseRepository(`owner/${longRepo}`)).toThrow(ValidationError);
    });
  });

  describe('parseRepositorySafe', () => {
    it('正常系: 正しいリポジトリ名をパースする', () => {
      const result = parseRepositorySafe('octocat/Hello-World');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.owner).toBe('octocat');
        expect(result.data.repo).toBe('Hello-World');
        expect(result.data.fullName).toBe('octocat/Hello-World');
      }
    });

    it('異常系: 空文字列の場合はエラーを返す', () => {
      const result = parseRepositorySafe('');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeTruthy();
      }
    });

    it('異常系: スラッシュがない場合はエラーを返す', () => {
      const result = parseRepositorySafe('invalid-repo');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Expected "owner/repo"');
      }
    });

    it('異常系: 不正な文字を含む場合はエラーを返す', () => {
      const result = parseRepositorySafe('owner/repo with spaces');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid repository name');
      }
    });

    it('前後の空白をトリミングする', () => {
      const result = parseRepositorySafe('  octocat/Hello-World  ');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.owner).toBe('octocat');
        expect(result.data.repo).toBe('Hello-World');
      }
    });

    it('異常系: nullの場合はエラーを返す', () => {
      const result = parseRepositorySafe(null as unknown as string);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('required and must be a string');
      }
    });

    it('異常系: undefinedの場合はエラーを返す', () => {
      const result = parseRepositorySafe(undefined as unknown as string);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('required and must be a string');
      }
    });
  });

  describe('isValidRepositoryFullName', () => {
    it('正常系: 正しいリポジトリ名はtrueを返す', () => {
      expect(isValidRepositoryFullName('octocat/Hello-World')).toBe(true);
      expect(isValidRepositoryFullName('facebook/react')).toBe(true);
      expect(isValidRepositoryFullName('nodejs/node.js')).toBe(true);
      expect(isValidRepositoryFullName('user/my_repo')).toBe(true);
    });

    it('異常系: 不正なリポジトリ名はfalseを返す', () => {
      expect(isValidRepositoryFullName('')).toBe(false);
      expect(isValidRepositoryFullName('invalid-repo')).toBe(false);
      expect(isValidRepositoryFullName('owner/repo/extra')).toBe(false);
      expect(isValidRepositoryFullName('/repo')).toBe(false);
      expect(isValidRepositoryFullName('owner/')).toBe(false);
      expect(isValidRepositoryFullName('owner/repo with spaces')).toBe(false);
    });
  });
});
