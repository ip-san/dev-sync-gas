/**
 * GitHub APIモード設定
 *
 * REST API / GraphQL API の切り替え管理
 */

import { getContainer } from '../container';
import { CONFIG_KEYS } from './propertyKeys';

/** GitHub APIモード */
export type GitHubApiMode = 'rest' | 'graphql';

/**
 * GitHub APIモードを取得
 * @returns "graphql" | "rest"（デフォルト: "graphql"）
 */
export function getGitHubApiMode(): GitHubApiMode {
  const { storageClient } = getContainer();
  const mode = storageClient.getProperty(CONFIG_KEYS.GITHUB_API.API_MODE);
  return mode === 'rest' ? 'rest' : 'graphql';
}

/**
 * GitHub APIモードを設定
 * @param mode - "graphql" または "rest"
 */
export function setGitHubApiMode(mode: GitHubApiMode): void {
  const { storageClient } = getContainer();
  storageClient.setProperty(CONFIG_KEYS.GITHUB_API.API_MODE, mode);
}

/**
 * GitHub APIモードをリセット（デフォルトのgraphqlに戻す）
 */
export function resetGitHubApiMode(): void {
  const { storageClient } = getContainer();
  storageClient.deleteProperty(CONFIG_KEYS.GITHUB_API.API_MODE);
}
