/**
 * 共通ヘルパー関数モジュール
 *
 * コンテナ初期化、日付計算など、複数の関数から共通で使用するユーティリティ。
 */

import { initializeContainer, isContainerInitialized } from '../container';
import { createGasAdapters } from '../adapters/gas';

/**
 * GAS環境でコンテナを初期化
 * 既に初期化済みの場合は何もしない
 */
export function ensureContainerInitialized(): void {
  if (!isContainerInitialized()) {
    initializeContainer(createGasAdapters());
  }
}

/**
 * 期間文字列を生成
 * @param days - 日数
 * @returns { startDateStr, endDateStr, period }
 */
export function createDateRange(days: number): {
  startDate: Date;
  endDate: Date;
  startDateStr: string;
  endDateStr: string;
  period: string;
} {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];
  const period = `${startDateStr}〜${endDateStr}`;

  return { startDate, endDate, startDateStr, endDateStr, period };
}

/**
 * 認証チェック
 * @returns 認証が設定されている場合true
 */
export function checkAuthConfigured(authMode: string): boolean {
  if (authMode === 'none') {
    Logger.log(
      '⚠️ GitHub authentication is not configured. Set githubToken in setup() or configure GitHub App'
    );
    return false;
  }
  return true;
}

/**
 * リポジトリチェック
 * @returns リポジトリが登録されている場合true
 */
export function checkRepositoriesConfigured(count: number): boolean {
  if (count === 0) {
    Logger.log('⚠️ No repositories configured. Add repositories with addRepo()');
    return false;
  }
  return true;
}
