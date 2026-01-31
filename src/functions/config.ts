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
} from "../config/settings";
import { ensureContainerInitialized } from "./helpers";

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
    Logger.log(`✅ Cycle time labels set to: ${labels.join(", ")}`);
  } else {
    Logger.log("✅ Cycle time labels cleared (all issues will be tracked)");
  }
}

/** 現在のサイクルタイムIssueラベルを表示 */
export function showCycleTimeLabels(): void {
  ensureContainerInitialized();
  const labels = getCycleTimeIssueLabels();
  if (labels.length > 0) {
    Logger.log(`📋 Cycle time labels: ${labels.join(", ")}`);
  } else {
    Logger.log("📋 Cycle time labels: (all issues)");
  }
}

/** サイクルタイムIssueラベルをリセット */
export function resetCycleTimeLabelsConfig(): void {
  ensureContainerInitialized();
  resetCycleTimeIssueLabels();
  Logger.log("✅ Cycle time labels reset (all issues will be tracked)");
}

/** サイクルタイム設定を一覧表示 */
export function showCycleTimeConfig(): void {
  ensureContainerInitialized();
  Logger.log("📋 Cycle Time Configuration:");
  Logger.log(`   Production branch pattern: "${getProductionBranchPattern()}"`);
  const labels = getCycleTimeIssueLabels();
  if (labels.length > 0) {
    Logger.log(`   Issue labels: ${labels.join(", ")}`);
  } else {
    Logger.log("   Issue labels: (all issues)");
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
    Logger.log(`✅ Coding time labels set to: ${labels.join(", ")}`);
  } else {
    Logger.log("✅ Coding time labels cleared (all issues will be tracked)");
  }
}

/** 現在のコーディングタイムIssueラベルを表示 */
export function showCodingTimeLabels(): void {
  ensureContainerInitialized();
  const labels = getCodingTimeIssueLabels();
  if (labels.length > 0) {
    Logger.log(`📋 Coding time labels: ${labels.join(", ")}`);
  } else {
    Logger.log("📋 Coding time labels: (all issues)");
  }
}

/** コーディングタイムIssueラベルをリセット */
export function resetCodingTimeLabelsConfig(): void {
  ensureContainerInitialized();
  resetCodingTimeIssueLabels();
  Logger.log("✅ Coding time labels reset (all issues will be tracked)");
}

/** コーディングタイム設定を一覧表示 */
export function showCodingTimeConfig(): void {
  ensureContainerInitialized();
  Logger.log("📋 Coding Time Configuration:");
  const labels = getCodingTimeIssueLabels();
  if (labels.length > 0) {
    Logger.log(`   Issue labels: ${labels.join(", ")}`);
  } else {
    Logger.log("   Issue labels: (all issues)");
  }
}
