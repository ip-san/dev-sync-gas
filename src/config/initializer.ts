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
  setDeployWorkflowPatterns,
  setProductionBranchPattern,
} from './settings';
import { initializeContainer, isContainerInitialized } from '../container';
import { createGasAdapters } from '../adapters/gas';

/**
 * 認証設定の型定義
 */
export type AuthConfig =
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

/**
 * リポジトリ設定
 */
export interface RepositoryConfig {
  owner: string;
  name: string;
}

/**
 * 除外ブランチ設定（プロジェクトごと）
 */
export interface ExcludeBranchesConfig {
  /** PRサイズ計算から除外するbaseブランチ（部分一致） */
  prSize?: string[];
  /** レビュー効率計算から除外するbaseブランチ（部分一致） */
  reviewEfficiency?: string[];
  /** サイクルタイム計算から除外するbaseブランチ（部分一致） */
  cycleTime?: string[];
  /** コーディング時間計算から除外するbaseブランチ（部分一致） */
  codingTime?: string[];
  /** 手戻り率計算から除外するbaseブランチ（部分一致） */
  reworkRate?: string[];
}

/**
 * プロジェクト設定
 */
export interface ProjectConfig {
  /** プロジェクト名（識別用） */
  name: string;
  /** 出力先スプレッドシート設定 */
  spreadsheet: {
    id: string;
    sheetName?: string;
  };
  /** このプロジェクトに含まれるリポジトリ */
  repositories: RepositoryConfig[];
  /** 除外ブランチ設定 */
  excludeBranches?: ExcludeBranchesConfig;
  /** デプロイワークフローパターン（部分一致） */
  deployWorkflowPatterns?: string[];
  /** Productionブランチパターン（デフォルト: "production"） */
  productionBranchPattern?: string;
}

/**
 * 設定オブジェクトの型定義（新形式）
 */
export interface InitConfig {
  /** 認証設定 */
  auth: AuthConfig;
  /** プロジェクト一覧 */
  projects: ProjectConfig[];
}

/**
 * 設定オブジェクトの型定義（旧形式 - 後方互換性）
 * @deprecated projects形式を使用してください
 */
export interface LegacyInitConfig {
  auth: AuthConfig;
  spreadsheet: {
    id: string;
    sheetName?: string;
  };
  repositories: RepositoryConfig[];
  /** PRサイズ計算から除外するbaseブランチ（部分一致） */
  prSizeExcludeBranches?: string[];
  /** レビュー効判計算から除外するbaseブランチ（部分一致） */
  reviewEfficiencyExcludeBranches?: string[];
  /** サイクルタイム計算から除外するbaseブランチ（部分一致） */
  cycleTimeExcludeBranches?: string[];
  /** コーディング時間計算から除外するbaseブランチ（部分一致） */
  codingTimeExcludeBranches?: string[];
  /** 手戻り率計算から除外するbaseブランチ（部分一致） */
  reworkRateExcludeBranches?: string[];
  /** デプロイワークフローパターン（部分一致） */
  deployWorkflowPatterns?: string[];
}

/**
 * 旧形式の設定かどうかを判定
 */
function isLegacyConfig(config: InitConfig | LegacyInitConfig): config is LegacyInitConfig {
  return 'spreadsheet' in config && 'repositories' in config;
}

/**
 * 旧形式の設定を新形式に変換
 */
function convertLegacyConfig(legacyConfig: LegacyInitConfig): InitConfig {
  return {
    auth: legacyConfig.auth,
    projects: [
      {
        name: 'Default Project',
        spreadsheet: legacyConfig.spreadsheet,
        repositories: legacyConfig.repositories,
        excludeBranches: {
          prSize: legacyConfig.prSizeExcludeBranches,
          reviewEfficiency: legacyConfig.reviewEfficiencyExcludeBranches,
          cycleTime: legacyConfig.cycleTimeExcludeBranches,
          codingTime: legacyConfig.codingTimeExcludeBranches,
          reworkRate: legacyConfig.reworkRateExcludeBranches,
        },
        deployWorkflowPatterns: legacyConfig.deployWorkflowPatterns,
      },
    ],
  };
}

/**
 * 認証設定を保存
 */
function saveAuthConfig(auth: AuthConfig, spreadsheetId: string, sheetName: string): void {
  if (auth.type === 'token') {
    setConfig({
      github: { token: auth.token, repositories: [] },
      spreadsheet: {
        id: spreadsheetId,
        sheetName,
      },
    });
    Logger.log('✅ Configuration saved (Personal Access Token auth)');
  } else {
    setConfig({
      github: {
        appConfig: {
          appId: auth.appId,
          privateKey: auth.privateKey,
          installationId: auth.installationId,
        },
        repositories: [],
      },
      spreadsheet: {
        id: spreadsheetId,
        sheetName,
      },
    });
    Logger.log('✅ Configuration saved (GitHub App auth)');
  }
}

/**
 * リポジトリを追加
 */
function addRepositories(repositories: RepositoryConfig[]): void {
  for (const repo of repositories) {
    addRepository(repo.owner, repo.name);
    Logger.log(`✅ Added repository: ${repo.owner}/${repo.name}`);
  }
}

/**
 * 除外ブランチ設定を適用
 */
function applyExcludeBranchSettings(excludeBranches?: ExcludeBranchesConfig): void {
  if (excludeBranches?.prSize?.length) {
    setExcludePRSizeBaseBranches(excludeBranches.prSize);
    Logger.log(`✅ PR size exclude branches: ${excludeBranches.prSize.join(', ')} (partial match)`);
  }

  if (excludeBranches?.reviewEfficiency?.length) {
    setExcludeReviewEfficiencyBaseBranches(excludeBranches.reviewEfficiency);
    Logger.log(
      `✅ Review efficiency exclude branches: ${excludeBranches.reviewEfficiency.join(', ')} (partial match)`
    );
  }

  if (excludeBranches?.cycleTime?.length) {
    setExcludeCycleTimeBaseBranches(excludeBranches.cycleTime);
    Logger.log(
      `✅ Cycle time exclude branches: ${excludeBranches.cycleTime.join(', ')} (partial match)`
    );
  }

  if (excludeBranches?.codingTime?.length) {
    setExcludeCodingTimeBaseBranches(excludeBranches.codingTime);
    Logger.log(
      `✅ Coding time exclude branches: ${excludeBranches.codingTime.join(', ')} (partial match)`
    );
  }

  if (excludeBranches?.reworkRate?.length) {
    setExcludeReworkRateBaseBranches(excludeBranches.reworkRate);
    Logger.log(
      `✅ Rework rate exclude branches: ${excludeBranches.reworkRate.join(', ')} (partial match)`
    );
  }
}

/**
 * デプロイワークフローパターンを適用
 */
function applyDeployWorkflowPatterns(patterns?: string[]): void {
  if (patterns?.length) {
    setDeployWorkflowPatterns(patterns);
    Logger.log(`✅ Deploy workflow patterns: ${patterns.join(', ')} (partial match)`);
  }
}

/**
 * Productionブランチパターンを適用
 */
function applyProductionBranchPattern(pattern?: string): void {
  if (pattern) {
    setProductionBranchPattern(pattern);
    Logger.log(`✅ Production branch pattern: ${pattern}`);
  }
}

/**
 * プロジェクト設定を初期化
 */
function initializeProject(project: ProjectConfig, auth: AuthConfig): void {
  Logger.log(`\n📦 Initializing project: ${project.name}`);

  const sheetName = project.spreadsheet.sheetName ?? 'DevOps Metrics';

  // 認証設定を保存（最初のプロジェクトのスプレッドシートを使用）
  saveAuthConfig(auth, project.spreadsheet.id, sheetName);

  // リポジトリを追加
  addRepositories(project.repositories);

  // 除外ブランチ設定を適用
  applyExcludeBranchSettings(project.excludeBranches);

  // デプロイワークフローパターンを適用
  applyDeployWorkflowPatterns(project.deployWorkflowPatterns);

  // Productionブランチパターンを適用
  applyProductionBranchPattern(project.productionBranchPattern);

  Logger.log(`✅ Project "${project.name}" initialized`);
}

/**
 * 設定オブジェクトから初期化を実行
 */
export function initializeFromConfig(config: InitConfig | LegacyInitConfig): void {
  if (!isContainerInitialized()) {
    initializeContainer(createGasAdapters());
  }

  // 旧形式の設定を新形式に変換
  const normalizedConfig = isLegacyConfig(config) ? convertLegacyConfig(config) : config;

  Logger.log('🚀 Starting initialization...');
  Logger.log(
    `🔐 Auth mode: ${normalizedConfig.auth.type === 'token' ? 'Personal Access Token' : 'GitHub App'}`
  );
  Logger.log(`📊 Projects count: ${normalizedConfig.projects.length}`);

  // 各プロジェクトを初期化
  for (const project of normalizedConfig.projects) {
    initializeProject(project, normalizedConfig.auth);
  }

  Logger.log('\n✅ 初期設定完了');
}
