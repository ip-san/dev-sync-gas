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
