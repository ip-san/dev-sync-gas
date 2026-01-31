/**
 * リポジトリ管理
 *
 * 監視対象GitHubリポジトリの追加・削除・一覧取得
 */

import type { GitHubRepository } from '../types';
import { validateRepositoryOwner, validateRepositoryName } from '../utils/validation';
import { auditLog } from '../utils/auditLog';
import { getConfig, setConfig } from './core';

/**
 * リポジトリを追加
 *
 * @param owner - リポジトリオーナー
 * @param name - リポジトリ名
 */
export function addRepository(owner: string, name: string): void {
  // 入力検証
  validateRepositoryOwner(owner);
  validateRepositoryName(name);

  const config = getConfig();
  const newRepo: GitHubRepository = { owner, name, fullName: `${owner}/${name}` };
  const exists = config.github.repositories.some((r) => r.fullName === newRepo.fullName);

  if (!exists) {
    config.github.repositories.push(newRepo);
    setConfig({ github: config.github });

    // 監査ログ
    auditLog('repository.add', { owner, name, fullName: newRepo.fullName });
  }
}

/**
 * リポジトリを削除
 *
 * @param fullName - リポジトリのフルネーム（owner/repo形式）
 */
export function removeRepository(fullName: string): void {
  const config = getConfig();
  const beforeCount = config.github.repositories.length;
  config.github.repositories = config.github.repositories.filter((r) => r.fullName !== fullName);
  const afterCount = config.github.repositories.length;

  if (beforeCount !== afterCount) {
    setConfig({ github: config.github });

    // 監査ログ
    auditLog('repository.remove', { fullName });
  }
}

/**
 * 登録済みリポジトリ一覧を取得
 *
 * @returns リポジトリ一覧
 */
export function getRepositories(): GitHubRepository[] {
  const config = getConfig();
  return config.github.repositories;
}
