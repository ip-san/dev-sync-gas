/**
 * リポジトリ名のパース・バリデーション
 *
 * "owner/repo" 形式の文字列を安全にパースし、バリデーションする。
 */

import type { ApiResponse } from '../types';

// =============================================================================
// 型定義
// =============================================================================

/**
 * パース済みリポジトリ情報
 */
export interface ParsedRepository {
  /** リポジトリオーナー */
  owner: string;
  /** リポジトリ名 */
  repo: string;
  /** フルネーム（"owner/repo"形式） */
  fullName: string;
}

// =============================================================================
// バリデーション関数
// =============================================================================

/**
 * リポジトリ名の形式が有効かチェック
 *
 * @param name - チェック対象の文字列
 * @returns true: 有効, false: 無効
 */
function isValidRepositoryName(name: string): boolean {
  // GitHub のリポジトリ名ルール:
  // - 英数字、ハイフン、アンダースコア、ドット
  // - 先頭と末尾はドット不可
  // - 連続するドット不可
  const validPattern = /^[a-zA-Z0-9_-]+(?:[.][a-zA-Z0-9_-]+)*$/;
  return validPattern.test(name) && name.length > 0 && name.length <= 100;
}

/**
 * リポジトリオーナー名の形式が有効かチェック
 *
 * @param owner - チェック対象の文字列
 * @returns true: 有効, false: 無効
 */
function isValidOwnerName(owner: string): boolean {
  // GitHub のオーナー名ルール（ユーザー名/組織名）:
  // - 英数字、ハイフン
  // - 先頭はハイフン不可
  // - 連続するハイフン不可
  // - 39文字まで
  const validPattern = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
  return validPattern.test(owner);
}

// =============================================================================
// パース関数
// =============================================================================

/**
 * "owner/repo" 形式の文字列をパースする（エラー時は例外をスロー）
 *
 * @param fullName - "owner/repo" 形式の文字列
 * @returns パース済みリポジトリ情報
 * @throws 形式が不正な場合
 */
export function parseRepository(fullName: string): ParsedRepository {
  const result = parseRepositorySafe(fullName);

  if (!result.success) {
    throw new Error(result.error);
  }

  if (!result.data) {
    throw new Error('Unexpected error: parseRepositorySafe returned success but no data');
  }

  return result.data;
}

/**
 * "owner/repo" 形式の文字列を安全にパースする（エラー時はApiResponseで返す）
 *
 * @param fullName - "owner/repo" 形式の文字列
 * @returns パース結果（成功 or エラー）
 *
 * @example
 * ```typescript
 * const result = parseRepositorySafe("octocat/Hello-World");
 * if (result.success) {
 *   console.log(result.data.owner); // "octocat"
 *   console.log(result.data.repo);  // "Hello-World"
 * }
 * ```
 */
export function parseRepositorySafe(fullName: string): ApiResponse<ParsedRepository> {
  // 1. 基本的なバリデーション
  if (!fullName || typeof fullName !== 'string') {
    return {
      success: false,
      error: 'Repository name is required and must be a string',
    };
  }

  const trimmed = fullName.trim();

  if (trimmed.length === 0) {
    return {
      success: false,
      error: 'Repository name cannot be empty',
    };
  }

  // 2. スラッシュで分割
  const parts = trimmed.split('/');

  // 正確に2つのパートが必要（owner / repo）
  if (parts.length !== 2) {
    return {
      success: false,
      error: `Invalid repository format: "${fullName}". Expected "owner/repo"`,
    };
  }

  const [owner, repo] = parts;

  // 3. オーナー名のバリデーション
  if (!owner || owner.trim().length === 0) {
    return {
      success: false,
      error: `Owner name is missing in: "${fullName}"`,
    };
  }

  if (!isValidOwnerName(owner)) {
    return {
      success: false,
      error: `Invalid owner name: "${owner}". Must be alphanumeric with hyphens, max 39 chars`,
    };
  }

  // 4. リポジトリ名のバリデーション
  if (!repo || repo.trim().length === 0) {
    return {
      success: false,
      error: `Repository name is missing in: "${fullName}"`,
    };
  }

  if (!isValidRepositoryName(repo)) {
    return {
      success: false,
      error: `Invalid repository name: "${repo}". Must be alphanumeric with hyphens/underscores/dots, max 100 chars`,
    };
  }

  // 5. 成功
  return {
    success: true,
    data: {
      owner,
      repo,
      fullName: `${owner}/${repo}`,
    },
  };
}

/**
 * リポジトリ名が有効かチェック（バリデーションのみ）
 *
 * @param fullName - "owner/repo" 形式の文字列
 * @returns true: 有効, false: 無効
 */
export function isValidRepositoryFullName(fullName: string): boolean {
  const result = parseRepositorySafe(fullName);
  return result.success;
}
