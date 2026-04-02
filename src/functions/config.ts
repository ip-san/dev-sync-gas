/**
 * 設定表示・変更関数モジュール
 *
 * サイクルタイム設定、コーディングタイム設定など
 * 各指標の設定を管理するGASエントリーポイント関数を提供。
 */

import {
  getCodingTimeIssueLabels,
  getCycleTimeIssueLabels,
  getDeployWorkflowPatterns,
  getExcludeCodingTimeBaseBranches,
  getExcludeCycleTimeBaseBranches,
  getExcludeMetricsLabels,
  getExcludePRCycleTimeBaseBranches,
  getExcludePRSizeBaseBranches,
  getExcludeReviewEfficiencyBaseBranches,
  getExcludeReworkRateBaseBranches,
  getGitHubApiMode,
  getIncidentLabels,
  getProductionBranchPattern,
  resetDeployWorkflowPatterns,
  resetExcludePRCycleTimeBaseBranches,
  resetExcludeReworkRateBaseBranches,
  setCodingTimeIssueLabels,
  setCycleTimeIssueLabels,
  setDeployWorkflowPatterns,
  setExcludeCodingTimeBaseBranches,
  setExcludeCycleTimeBaseBranches,
  setExcludeMetricsLabels,
  setExcludePRCycleTimeBaseBranches,
  setExcludePRSizeBaseBranches,
  setExcludeReviewEfficiencyBaseBranches,
  setExcludeReworkRateBaseBranches,
  setGitHubApiMode,
  setIncidentLabels,
  setProductionBranchPattern,
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

// =============================================================================
// レビュー効率除外ブランチ設定
// =============================================================================

/**
 * レビュー効率計算から除外するbaseブランチを設定（部分一致）
 *
 * @example
 * setExcludeReviewEfficiencyBaseBranches(['production', 'staging']);
 * // 以下のブランチへのマージが除外される:
 * // - "production", "production-hotfix", "production-v1" など
 * // - "staging", "staging-test" など
 *
 * setExcludeReviewEfficiencyBaseBranches([]);  // 除外しない（全PR対象）
 */
export function configureReviewEfficiencyExcludeBranches(branches: string[]): void {
  ensureContainerInitialized();
  setExcludeReviewEfficiencyBaseBranches(branches);
  if (branches.length > 0) {
    Logger.log(
      `✅ Review efficiency exclude branches set to: ${branches.join(', ')} (partial match)`
    );
  } else {
    Logger.log('✅ Review efficiency exclude branches cleared (all PRs will be included)');
  }
}

/**
 * 現在のレビュー効率除外ブランチを表示
 */
export function showReviewEfficiencyExcludeBranches(): void {
  ensureContainerInitialized();
  const branches = getExcludeReviewEfficiencyBaseBranches();
  if (branches.length > 0) {
    Logger.log(`📋 Review efficiency exclude branches: ${branches.join(', ')} (partial match)`);
  } else {
    Logger.log('📋 Review efficiency exclude branches: (none - all PRs included)');
  }
}

/**
 * レビュー効率除外ブランチ設定をリセット（全PR対象に戻す）
 */

// =============================================================================
// サイクルタイム除外ブランチ設定
// =============================================================================

/**
 * サイクルタイム計算から除外するbaseブランチを設定（部分一致）
 *
 * @example
 * configureCycleTimeExcludeBranches(['production', 'staging']);
 * // 以下のブランチへのマージが除外される:
 * // - "production", "production-hotfix", "production-v1" など
 * // - "staging", "staging-test" など
 *
 * configureCycleTimeExcludeBranches([]);  // 除外しない（全Issue対象）
 */
export function configureCycleTimeExcludeBranches(branches: string[]): void {
  ensureContainerInitialized();
  setExcludeCycleTimeBaseBranches(branches);
  if (branches.length > 0) {
    Logger.log(`✅ Cycle time exclude branches set to: ${branches.join(', ')} (partial match)`);
  } else {
    Logger.log('✅ Cycle time exclude branches cleared (all issues will be included)');
  }
}

/**
 * 現在のサイクルタイム除外ブランチを表示
 */
export function showCycleTimeExcludeBranches(): void {
  ensureContainerInitialized();
  const branches = getExcludeCycleTimeBaseBranches();
  if (branches.length > 0) {
    Logger.log(`📋 Cycle time exclude branches: ${branches.join(', ')} (partial match)`);
  } else {
    Logger.log('📋 Cycle time exclude branches: (none - all issues included)');
  }
}

/**
 * サイクルタイム除外ブランチ設定をリセット（全Issue対象に戻す）
 */

// =============================================================================
// コーディング時間除外ブランチ設定
// =============================================================================

/**
 * コーディング時間計算から除外するbaseブランチを設定（部分一致）
 *
 * @example
 * configureCodingTimeExcludeBranches(['production', 'staging']);
 * // 以下のブランチへのマージが除外される:
 * // - "production", "production-hotfix", "production-v1" など
 * // - "staging", "staging-test" など
 *
 * configureCodingTimeExcludeBranches([]);  // 除外しない（全Issue対象）
 */
export function configureCodingTimeExcludeBranches(branches: string[]): void {
  ensureContainerInitialized();
  setExcludeCodingTimeBaseBranches(branches);
  if (branches.length > 0) {
    Logger.log(`✅ Coding time exclude branches set to: ${branches.join(', ')} (partial match)`);
  } else {
    Logger.log('✅ Coding time exclude branches cleared (all issues will be included)');
  }
}

/**
 * 現在のコーディング時間除外ブランチを表示
 */
export function showCodingTimeExcludeBranches(): void {
  ensureContainerInitialized();
  const branches = getExcludeCodingTimeBaseBranches();
  if (branches.length > 0) {
    Logger.log(`📋 Coding time exclude branches: ${branches.join(', ')} (partial match)`);
  } else {
    Logger.log('📋 Coding time exclude branches: (none - all issues included)');
  }
}

/**
 * コーディング時間除外ブランチ設定をリセット（全Issue対象に戻す）
 */

// =============================================================================
// 手戻り率除外ブランチ設定
// =============================================================================

/**
 * 手戻り率計算から除外するbaseブランチを設定（部分一致）
 *
 * @example
 * configureReworkRateExcludeBranches(['production', 'staging']);
 * // 以下のブランチへのマージが除外される:
 * // - "production", "production-hotfix", "production-v1" など
 * // - "staging", "staging-test" など
 *
 * configureReworkRateExcludeBranches([]);  // 除外しない（全PR対象）
 */
export function configureReworkRateExcludeBranches(branches: string[]): void {
  ensureContainerInitialized();
  setExcludeReworkRateBaseBranches(branches);
  if (branches.length > 0) {
    Logger.log(`✅ Rework rate exclude branches set to: ${branches.join(', ')} (partial match)`);
  } else {
    Logger.log('✅ Rework rate exclude branches cleared (all PRs will be included)');
  }
}

/**
 * 現在の手戻り率除外ブランチを表示
 */
export function showReworkRateExcludeBranches(): void {
  ensureContainerInitialized();
  const branches = getExcludeReworkRateBaseBranches();
  if (branches.length > 0) {
    Logger.log(`📋 Rework rate exclude branches: ${branches.join(', ')} (partial match)`);
  } else {
    Logger.log('📋 Rework rate exclude branches: (none - all PRs included)');
  }
}

/**
 * 手戻り率除外ブランチ設定をリセット（全PR対象に戻す）
 */

export function resetReworkRateExcludeBranchesConfig(): void {
  ensureContainerInitialized();
  resetExcludeReworkRateBaseBranches();
  Logger.log('✅ Rework rate exclude branches reset (all PRs will be included)');
}

// =============================================================================
// PR Cycle Time除外ブランチ設定
// =============================================================================

/**
 * PR Cycle Time計算から除外するbaseブランチを設定（部分一致）
 *
 * @example
 * configurePRCycleTimeExcludeBranches(['production', 'staging']);
 * // 以下のブランチへのマージが除外される:
 * // - "production", "production-hotfix", "production-v1" など
 * // - "staging", "staging-test" など
 *
 * configurePRCycleTimeExcludeBranches([]);  // 除外しない（全PR対象）
 */
export function configurePRCycleTimeExcludeBranches(branches: string[]): void {
  ensureContainerInitialized();
  setExcludePRCycleTimeBaseBranches(branches);
  if (branches.length > 0) {
    Logger.log(`✅ PR Cycle Time exclude branches set to: ${branches.join(', ')} (partial match)`);
  } else {
    Logger.log('✅ PR Cycle Time exclude branches cleared (all PRs will be included)');
  }
}

/**
 * 現在のPR Cycle Time除外ブランチを表示
 */
export function showPRCycleTimeExcludeBranches(): void {
  ensureContainerInitialized();
  const branches = getExcludePRCycleTimeBaseBranches();
  if (branches.length > 0) {
    Logger.log(`📋 PR Cycle Time exclude branches: ${branches.join(', ')} (partial match)`);
  } else {
    Logger.log('📋 PR Cycle Time exclude branches: (none - all PRs included)');
  }
}

/**
 * PR Cycle Time除外ブランチ設定をリセット（全PR対象に戻す）
 */
export function resetPRCycleTimeExcludeBranchesConfig(): void {
  ensureContainerInitialized();
  resetExcludePRCycleTimeBaseBranches();
  Logger.log('✅ PR Cycle Time exclude branches reset (all PRs will be included)');
}

// =============================================================================
// デプロイワークフローパターン設定
// =============================================================================

/**
 * デプロイワークフローパターンを設定
 *
 * ワークフロー名にこれらのパターンが含まれていればデプロイとみなします（部分一致、大文字小文字を区別しない）
 *
 * @param patterns デプロイとみなすワークフロー名のパターン配列
 * @example
 * // デフォルト（"deploy"を含むワークフローをデプロイとみなす）
 * configureDeployWorkflowPatterns(["deploy"]);
 *
 * // 複数パターンを設定
 * configureDeployWorkflowPatterns(["deploy", "release", "production"]);
 * // - "Deploy to Production" → デプロイ
 * // - "release-staging" → デプロイ（部分一致）
 * // - "production-deploy" → デプロイ（部分一致）
 * // - "CI Build" → 含めない
 *
 * configureDeployWorkflowPatterns([]);  // 設定クリア（デフォルトの["deploy"]が使用される）
 */
export function configureDeployWorkflowPatterns(patterns: string[]): void {
  ensureContainerInitialized();
  setDeployWorkflowPatterns(patterns);
  if (patterns.length > 0) {
    Logger.log(`✅ Deploy workflow patterns set to: ${patterns.join(', ')} (partial match)`);
  } else {
    Logger.log('✅ Deploy workflow patterns cleared (default: deploy)');
  }
}

/**
 * 現在のデプロイワークフローパターンを表示
 */
export function showDeployWorkflowPatterns(): void {
  ensureContainerInitialized();
  const patterns = getDeployWorkflowPatterns();
  Logger.log(`📋 Deploy workflow patterns: ${patterns.join(', ')} (partial match)`);
}

/**
 * デプロイワークフローパターン設定をリセット（デフォルトに戻す）
 */
export function resetDeployWorkflowPatternsConfig(): void {
  ensureContainerInitialized();
  resetDeployWorkflowPatterns();
  Logger.log('✅ Deploy workflow patterns reset to default: deploy');
}
