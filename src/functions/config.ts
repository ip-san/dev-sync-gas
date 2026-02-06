/**
 * 設定表示・変更関数モジュール
 *
 * サイクルタイム設定、コーディングタイム設定など
 * 各指標の設定を管理するGASエントリーポイント関数を提供。
 */

import {
  getProductionBranchPattern,
  setProductionBranchPattern,
  resetProductionBranchPattern,
  getCycleTimeIssueLabels,
  setCycleTimeIssueLabels,
  resetCycleTimeIssueLabels,
  getCodingTimeIssueLabels,
  setCodingTimeIssueLabels,
  resetCodingTimeIssueLabels,
  getExcludeMetricsLabels,
  setExcludeMetricsLabels,
  resetExcludeMetricsLabels,
  getIncidentLabels,
  setIncidentLabels,
  resetIncidentLabels,
  getExcludePRSizeBaseBranches,
  setExcludePRSizeBaseBranches,
  resetExcludePRSizeBaseBranches,
  getGitHubApiMode,
  setGitHubApiMode,
  resetGitHubApiMode,
} from '../config/settings';
import { ensureContainerInitialized } from './helpers';

// =============================================================================
// サイクルタイム設定
// =============================================================================

/**
 * productionブランチパターンを設定
 *
 * @example
 * configureProductionBranch("production");  // "xxx_production" にマッチ
 * configureProductionBranch("release");     // "release" ブランチにマッチ
 */
export function configureProductionBranch(pattern: string): void {
  ensureContainerInitialized();
  setProductionBranchPattern(pattern);
  Logger.log(`✅ Production branch pattern set to: "${pattern}"`);
}

/** 現在のproductionブランチパターンを表示 */
export function showProductionBranch(): void {
  ensureContainerInitialized();
  const pattern = getProductionBranchPattern();
  Logger.log(`📋 Production branch pattern: "${pattern}"`);
}

/** productionブランチパターンをリセット */
export function resetProductionBranch(): void {
  ensureContainerInitialized();
  resetProductionBranchPattern();
  Logger.log('✅ Production branch pattern reset to: "production"');
}

/**
 * サイクルタイム計測対象のIssueラベルを設定
 *
 * @example
 * configureCycleTimeLabels(["feature", "enhancement"]);  // 特定ラベルのみ
 * configureCycleTimeLabels([]);                          // 全Issue対象
 */
export function configureCycleTimeLabels(labels: string[]): void {
  ensureContainerInitialized();
  setCycleTimeIssueLabels(labels);
  if (labels.length > 0) {
    Logger.log(`✅ Cycle time labels set to: ${labels.join(', ')}`);
  } else {
    Logger.log('✅ Cycle time labels cleared (all issues will be tracked)');
  }
}

/** 現在のサイクルタイムIssueラベルを表示 */
export function showCycleTimeLabels(): void {
  ensureContainerInitialized();
  const labels = getCycleTimeIssueLabels();
  if (labels.length > 0) {
    Logger.log(`📋 Cycle time labels: ${labels.join(', ')}`);
  } else {
    Logger.log('📋 Cycle time labels: (all issues)');
  }
}

/** サイクルタイムIssueラベルをリセット */
export function resetCycleTimeLabelsConfig(): void {
  ensureContainerInitialized();
  resetCycleTimeIssueLabels();
  Logger.log('✅ Cycle time labels reset (all issues will be tracked)');
}

/** サイクルタイム設定を一覧表示 */
export function showCycleTimeConfig(): void {
  ensureContainerInitialized();
  Logger.log('📋 Cycle Time Configuration:');
  Logger.log(`   Production branch pattern: "${getProductionBranchPattern()}"`);
  const labels = getCycleTimeIssueLabels();
  if (labels.length > 0) {
    Logger.log(`   Issue labels: ${labels.join(', ')}`);
  } else {
    Logger.log('   Issue labels: (all issues)');
  }
}

// =============================================================================
// コーディングタイム設定
// =============================================================================

/**
 * コーディングタイム計測対象のIssueラベルを設定
 *
 * @example
 * configureCodingTimeLabels(["feature", "enhancement"]);  // 特定ラベルのみ
 * configureCodingTimeLabels([]);                          // 全Issue対象
 */
export function configureCodingTimeLabels(labels: string[]): void {
  ensureContainerInitialized();
  setCodingTimeIssueLabels(labels);
  if (labels.length > 0) {
    Logger.log(`✅ Coding time labels set to: ${labels.join(', ')}`);
  } else {
    Logger.log('✅ Coding time labels cleared (all issues will be tracked)');
  }
}

/** 現在のコーディングタイムIssueラベルを表示 */
export function showCodingTimeLabels(): void {
  ensureContainerInitialized();
  const labels = getCodingTimeIssueLabels();
  if (labels.length > 0) {
    Logger.log(`📋 Coding time labels: ${labels.join(', ')}`);
  } else {
    Logger.log('📋 Coding time labels: (all issues)');
  }
}

/** コーディングタイムIssueラベルをリセット */
export function resetCodingTimeLabelsConfig(): void {
  ensureContainerInitialized();
  resetCodingTimeIssueLabels();
  Logger.log('✅ Coding time labels reset (all issues will be tracked)');
}

/** コーディングタイム設定を一覧表示 */
export function showCodingTimeConfig(): void {
  ensureContainerInitialized();
  Logger.log('📋 Coding Time Configuration:');
  const labels = getCodingTimeIssueLabels();
  if (labels.length > 0) {
    Logger.log(`   Issue labels: ${labels.join(', ')}`);
  } else {
    Logger.log('   Issue labels: (all issues)');
  }
}

// =============================================================================
// GitHub API モード設定
// =============================================================================

/**
 * GitHub APIモードを設定
 *
 * @param mode - "graphql" または "rest"
 *
 * @example
 * configureApiMode("graphql");  // GraphQL APIを使用（デフォルト、効率的）
 * configureApiMode("rest");     // REST APIを使用（従来互換）
 */
export function configureApiMode(mode: 'graphql' | 'rest'): void {
  ensureContainerInitialized();
  setGitHubApiMode(mode);
  if (mode === 'graphql') {
    Logger.log('✅ API mode set to: GraphQL (efficient mode)');
    Logger.log('   Benefits: Reduced API calls, batch operations, better rate limit usage');
  } else {
    Logger.log('✅ API mode set to: REST (legacy mode)');
    Logger.log('   Note: This may result in more API calls. Use GraphQL for better performance.');
  }
}

/** 現在のAPIモードを表示 */
export function showApiMode(): void {
  ensureContainerInitialized();
  const mode = getGitHubApiMode();
  if (mode === 'graphql') {
    Logger.log('📋 Current API mode: GraphQL (efficient mode)');
  } else {
    Logger.log('📋 Current API mode: REST (legacy mode)');
  }
}

/** APIモードをリセット（GraphQLに戻す） */
export function resetApiMode(): void {
  ensureContainerInitialized();
  resetGitHubApiMode();
  Logger.log('✅ API mode reset to: GraphQL (default)');
}

// =============================================================================
// 除外ラベル設定
// =============================================================================

/**
 * 計測から除外するラベルを設定
 *
 * @example
 * configureExcludeLabels(["exclude-metrics", "dependencies", "bot"]);
 * configureExcludeLabels([]);  // 除外しない
 */
export function configureExcludeLabels(labels: string[]): void {
  ensureContainerInitialized();
  setExcludeMetricsLabels(labels);
  if (labels.length > 0) {
    Logger.log(`✅ Exclude labels set to: ${labels.join(', ')}`);
  } else {
    Logger.log('✅ Exclude labels cleared (no exclusions)');
  }
}

/**
 * 現在の除外ラベルを表示
 */
export function showExcludeLabels(): void {
  ensureContainerInitialized();
  const labels = getExcludeMetricsLabels();
  Logger.log(`📋 Exclude labels: ${labels.join(', ')}`);
}

/**
 * 除外ラベル設定をリセット
 */
export function resetExcludeLabelsConfig(): void {
  ensureContainerInitialized();
  resetExcludeMetricsLabels();
  Logger.log('✅ Exclude labels reset to: "exclude-metrics"');
}

// =============================================================================
// インシデントラベル設定
// =============================================================================

/**
 * インシデント判定に使用するラベルを設定
 *
 * @example
 * configureIncidentLabels(['incident', 'bug', 'p0']);
 * configureIncidentLabels([]);  // デフォルトの 'incident' に戻す
 */
export function configureIncidentLabels(labels: string[]): void {
  ensureContainerInitialized();
  setIncidentLabels(labels);
  if (labels.length > 0) {
    Logger.log(`✅ Incident labels set to: ${labels.join(', ')}`);
  } else {
    Logger.log('✅ Incident labels cleared (default: "incident")');
  }
}

/**
 * 現在のインシデントラベルを表示
 */
export function showIncidentLabels(): void {
  ensureContainerInitialized();
  const labels = getIncidentLabels();
  Logger.log(`📋 Incident labels: ${labels.join(', ')}`);
}

/**
 * インシデントラベル設定をリセット
 */
export function resetIncidentLabelsConfig(): void {
  ensureContainerInitialized();
  resetIncidentLabels();
  Logger.log('✅ Incident labels reset to: "incident"');
}

// =============================================================================
// PRサイズ除外ブランチ設定
// =============================================================================

/**
 * PRサイズ計算から除外するbaseブランチを設定（部分一致）
 *
 * @example
 * setExcludePRSizeBaseBranches(['production', 'staging']);
 * // 以下のブランチへのマージが除外される:
 * // - "production", "production-hotfix", "production-v1" など
 * // - "staging", "staging-test" など
 *
 * setExcludePRSizeBaseBranches([]);  // 除外しない（全PR対象）
 */
export function configurePRSizeExcludeBranches(branches: string[]): void {
  ensureContainerInitialized();
  setExcludePRSizeBaseBranches(branches);
  if (branches.length > 0) {
    Logger.log(`✅ PR size exclude branches set to: ${branches.join(', ')} (partial match)`);
  } else {
    Logger.log('✅ PR size exclude branches cleared (all PRs will be included)');
  }
}

/**
 * 現在のPRサイズ除外ブランチを表示
 */
export function showPRSizeExcludeBranches(): void {
  ensureContainerInitialized();
  const branches = getExcludePRSizeBaseBranches();
  if (branches.length > 0) {
    Logger.log(`📋 PR size exclude branches: ${branches.join(', ')} (partial match)`);
  } else {
    Logger.log('📋 PR size exclude branches: (none - all PRs included)');
  }
}

/**
 * PRサイズ除外ブランチ設定をリセット（全PR対象に戻す）
 */
export function resetPRSizeExcludeBranchesConfig(): void {
  ensureContainerInitialized();
  resetExcludePRSizeBaseBranches();
  Logger.log('✅ PR size exclude branches reset (all PRs will be included)');
}
