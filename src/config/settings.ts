/**
 * Configuration Management - Backward Compatibility Layer
 *
 * このファイルは後方互換性のために残されています。
 * 新しい構造では以下のモジュールに分割されています：
 *
 * - core.ts        : getConfig, setConfig
 * - auth.ts        : GitHub認証関連
 * - repositories.ts: リポジトリ管理
 * - projects.ts    : プロジェクトグループ管理
 * - metrics.ts     : メトリクス設定
 *
 * 新しいコードでは直接これらのモジュールからインポートすることを推奨します。
 */

// =============================================================================
// Core Configuration
// =============================================================================

export { getConfig, setConfig } from './core.js';

// =============================================================================
// GitHub Authentication
// =============================================================================

export { clearGitHubAppConfig, getGitHubToken } from './auth.js';

// =============================================================================
// Repository Management
// =============================================================================

export { addRepository, getRepositories, removeRepository } from './repositories.js';

// =============================================================================
// Project Group Management
// =============================================================================

export {
  addProject,
  addRepositoryToProject,
  getProjects,
  removeProject,
  removeRepositoryFromProject,
  updateProject,
} from './projects.js';

// =============================================================================
// Metrics Configuration
// =============================================================================

export {
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
  getIncidentLabels,
  getIncidentLabelsForRepository,
  getProductionBranchPattern,
  resetCodingTimeIssueLabels,
  resetCycleTimeIssueLabels,
  resetDeployWorkflowPatterns,
  resetExcludeCodingTimeBaseBranches,
  resetExcludeCycleTimeBaseBranches,
  resetExcludeMetricsLabels,
  resetExcludePRCycleTimeBaseBranches,
  resetExcludePRSizeBaseBranches,
  resetExcludeReviewEfficiencyBaseBranches,
  resetExcludeReworkRateBaseBranches,
  resetIncidentLabels,
  resetProductionBranchPattern,
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
  setIncidentLabels,
  setProductionBranchPattern,
} from './metrics.js';

// =============================================================================
// API Mode Configuration (Re-export from apiMode.ts)
// =============================================================================

export type { GitHubApiMode } from './apiMode.js';
export { getGitHubApiMode, resetGitHubApiMode, setGitHubApiMode } from './apiMode.js';

// =============================================================================
// Authentication Mode (Re-export from authMode.ts)
// =============================================================================

export { getGitHubAuthMode } from './authMode.js';

// =============================================================================
// Configuration Diagnostics (Re-export from diagnostics.ts)
// =============================================================================

export type { ConfigDiagnosticItem, ConfigDiagnosticResult } from './diagnostics.js';
export { diagnoseConfig, formatDiagnosticResult } from './diagnostics.js';

// =============================================================================
// Display Configuration (Re-export from display.ts)
// =============================================================================

export type { SheetNamesConfig } from './display.js';
export {
  getAuditLogSheetName,
  getSheetNames,
  setAuditLogSheetName,
  setSheetNames,
} from './display.js';

// =============================================================================
// Project-Specific Settings (Re-export from projectSettings.ts)
// =============================================================================

export {
  getExcludeMetricsLabelsForRepository,
  getHealthThresholdsForRepository,
  getInitialSyncDaysForRepository,
} from './projectSettings.js';
