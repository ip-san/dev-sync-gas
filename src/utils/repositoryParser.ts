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
 * 基本的な入力バリデーション
 */
function validateBasicInput(fullName: string): string | null {
  if (!fullName || typeof fullName !== 'string') {
    return 'Repository name is required and must be a string';
  }

  const trimmed = fullName.trim();
  if (trimmed.length === 0) {
    return 'Repository name cannot be empty';
  }

  return null;
}

/**
 * リポジトリフォーマットの検証（スラッシュ分割）
 */
function validateRepositoryFormat(
  fullName: string
): { error: string } | { owner: string; repo: string } {
  const trimmed = fullName.trim();
  const parts = trimmed.split('/');

  if (parts.length !== 2) {
    return {
      error: `Invalid repository format: "${fullName}". Expected "owner/repo"`,
    };
  }

  const [owner, repo] = parts;
  return { owner, repo };
}

/**
 * オーナー名とリポジトリ名の個別検証
 */
function validateOwnerAndRepo(owner: string, repo: string, fullName: string): string | null {
  // オーナー名チェック
  if (!owner || owner.trim().length === 0) {
    return `Owner name is missing in: "${fullName}"`;
  }

  if (!isValidOwnerName(owner)) {
    return `Invalid owner name: "${owner}". Must be alphanumeric with hyphens, max 39 chars`;
  }

  // リポジトリ名チェック
  if (!repo || repo.trim().length === 0) {
    return `Repository name is missing in: "${fullName}"`;
  }

  if (!isValidRepositoryName(repo)) {
    return `Invalid repository name: "${repo}". Must be alphanumeric with hyphens/underscores/dots, max 100 chars`;
  }

  return null;
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
  // 1. 基本的な入力チェック
  const basicError = validateBasicInput(fullName);
  if (basicError) {
    return { success: false, error: basicError };
  }

  // 2. フォーマット検証（スラッシュ分割）
  const formatResult = validateRepositoryFormat(fullName);
  if ('error' in formatResult) {
    return { success: false, error: formatResult.error };
  }

  const { owner, repo } = formatResult;

  // 3. オーナー名・リポジトリ名の個別検証
  const validationError = validateOwnerAndRepo(owner, repo, fullName);
  if (validationError) {
    return { success: false, error: validationError };
  }

  // 4. 成功
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
