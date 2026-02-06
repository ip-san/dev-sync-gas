/**
 * 初期化ロジック
 * init.ts の設定オブジェクトから実際の設定を適用する
 */

import {
  setConfig,
  addRepository,
  setExcludePRSizeBaseBranches,
  setExcludeReviewEfficiencyBaseBranches,
  setExcludeCycleTimeBaseBranches,
  setExcludeCodingTimeBaseBranches,
  setExcludeReworkRateBaseBranches,
} from './settings';
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
  /** レビュー効率計算から除外するbaseブランチ（部分一致） */
  reviewEfficiencyExcludeBranches?: string[];
  /** サイクルタイム計算から除外するbaseブランチ（部分一致） */
  cycleTimeExcludeBranches?: string[];
  /** コーディング時間計算から除外するbaseブランチ（部分一致） */
  codingTimeExcludeBranches?: string[];
  /** 手戻り率計算から除外するbaseブランチ（部分一致） */
  reworkRateExcludeBranches?: string[];
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

  // レビュー効率除外ブランチ設定
  if (config.reviewEfficiencyExcludeBranches && config.reviewEfficiencyExcludeBranches.length > 0) {
    setExcludeReviewEfficiencyBaseBranches(config.reviewEfficiencyExcludeBranches);
    Logger.log(
      `✅ Review efficiency exclude branches: ${config.reviewEfficiencyExcludeBranches.join(', ')} (partial match)`
    );
  }

  // サイクルタイム除外ブランチ設定
  if (config.cycleTimeExcludeBranches && config.cycleTimeExcludeBranches.length > 0) {
    setExcludeCycleTimeBaseBranches(config.cycleTimeExcludeBranches);
    Logger.log(
      `✅ Cycle time exclude branches: ${config.cycleTimeExcludeBranches.join(', ')} (partial match)`
    );
  }

  // コーディング時間除外ブランチ設定
  if (config.codingTimeExcludeBranches && config.codingTimeExcludeBranches.length > 0) {
    setExcludeCodingTimeBaseBranches(config.codingTimeExcludeBranches);
    Logger.log(
      `✅ Coding time exclude branches: ${config.codingTimeExcludeBranches.join(', ')} (partial match)`
    );
  }

  // 手戻り率除外ブランチ設定
  if (config.reworkRateExcludeBranches && config.reworkRateExcludeBranches.length > 0) {
    setExcludeReworkRateBaseBranches(config.reworkRateExcludeBranches);
    Logger.log(
      `✅ Rework rate exclude branches: ${config.reworkRateExcludeBranches.join(', ')} (partial match)`
    );
  }

  Logger.log('✅ 初期設定完了');
  Logger.log(
    `🔐 認証モード: ${config.auth.type === 'token' ? 'Personal Access Token' : 'GitHub App'}`
  );
}
