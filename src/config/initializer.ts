/**
 * 初期化ロジック
 * init.ts の設定オブジェクトから実際の設定を適用する
 */

import { setConfig, addRepository, setExcludePRSizeBaseBranches } from './settings';
import { initializeContainer, isContainerInitialized } from '../container';
import { createGasAdapters } from '../adapters/gas';

/**
 * 設定オブジェクトの型定義
 */
export interface InitConfig {
  auth:
    | {
        type: 'token';
        token: string;
      }
    | {
        type: 'github-app';
        appId: string;
        installationId: string;
        privateKey: string;
      };
  spreadsheet: {
    id: string;
    sheetName?: string;
  };
  repositories: Array<{
    owner: string;
    name: string;
  }>;
  /** PRサイズ計算から除外するbaseブランチ（部分一致） */
  prSizeExcludeBranches?: string[];
}

/**
 * 設定オブジェクトから初期化を実行
 */
export function initializeFromConfig(config: InitConfig): void {
  // コンテナ初期化
  if (!isContainerInitialized()) {
    initializeContainer(createGasAdapters());
  }

  // 認証方式に応じて設定を保存
  if (config.auth.type === 'token') {
    // Personal Access Token認証
    setConfig({
      github: { token: config.auth.token, repositories: [] },
      spreadsheet: {
        id: config.spreadsheet.id,
        sheetName: config.spreadsheet.sheetName ?? 'DevOps Metrics',
      },
    });
    Logger.log('✅ Configuration saved (Personal Access Token auth)');
  } else {
    // GitHub Apps認証
    setConfig({
      github: {
        appConfig: {
          appId: config.auth.appId,
          privateKey: config.auth.privateKey,
          installationId: config.auth.installationId,
        },
        repositories: [],
      },
      spreadsheet: {
        id: config.spreadsheet.id,
        sheetName: config.spreadsheet.sheetName ?? 'DevOps Metrics',
      },
    });
    Logger.log('✅ Configuration saved (GitHub App auth)');
  }

  // リポジトリを追加
  for (const repo of config.repositories) {
    addRepository(repo.owner, repo.name);
    Logger.log(`✅ Added repository: ${repo.owner}/${repo.name}`);
  }

  // PRサイズ除外ブランチ設定
  if (config.prSizeExcludeBranches && config.prSizeExcludeBranches.length > 0) {
    setExcludePRSizeBaseBranches(config.prSizeExcludeBranches);
    Logger.log(
      `✅ PR size exclude branches: ${config.prSizeExcludeBranches.join(', ')} (partial match)`
    );
  }

  Logger.log('✅ 初期設定完了');
  Logger.log(
    `🔐 認証モード: ${config.auth.type === 'token' ? 'Personal Access Token' : 'GitHub App'}`
  );
}
