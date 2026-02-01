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

export { addRepository, removeRepository, getRepositories } from './repositories.js';

// =============================================================================
// Project Group Management
// =============================================================================

export {
  getProjects,
  addProject,
  updateProject,
  removeProject,
  addRepositoryToProject,
  removeRepositoryFromProject,
} from './projects.js';

// =============================================================================
// Metrics Configuration
// =============================================================================

export {
  getProductionBranchPattern,
  setProductionBranchPattern,
  resetProductionBranchPattern,
  getCycleTimeIssueLabels,
  setCycleTimeIssueLabels,
  resetCycleTimeIssueLabels,
  getCodingTimeIssueLabels,
  setCodingTimeIssueLabels,
  resetCodingTimeIssueLabels,
} from './metrics.js';

// =============================================================================
// API Mode Configuration (Re-export from apiMode.ts)
// =============================================================================

export type { GitHubApiMode } from './apiMode.js';
export { getGitHubApiMode, setGitHubApiMode, resetGitHubApiMode } from './apiMode.js';

// =============================================================================
// Authentication Mode (Re-export from authMode.ts)
// =============================================================================

export { getGitHubAuthMode } from './authMode.js';

// =============================================================================
// Configuration Diagnostics (Re-export from diagnostics.ts)
// =============================================================================

export type { ConfigDiagnosticItem, ConfigDiagnosticResult } from './diagnostics.js';
export { diagnoseConfig, formatDiagnosticResult } from './diagnostics.js';
