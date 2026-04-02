/**
 * 拡張指標同期関数モジュール
 *
 * サイクルタイム、コーディング時間、手戻り率、レビュー効率、PRサイズの
 * 拡張指標をGitHub APIから取得し、スプレッドシートに書き出す。
 *
 * GASエディタから直接実行可能な関数を提供。
 */

import {
  getCodingTimeIssueLabels,
  getConfig,
  getCycleTimeIssueLabels,
  getExcludePRCycleTimeBaseBranches,
  getExcludePRSizeBaseBranches,
  getExcludeReviewEfficiencyBaseBranches,
  getExcludeReworkRateBaseBranches,
  getGitHubToken,
  getProductionBranchPattern,
} from '../config/settings';
import {
  type DateRange,
  getCodingTimeDataGraphQL,
  getCycleTimeDataGraphQL,
  getPRCycleTimeDataGraphQL,
  getPRSizeDataForPRsGraphQL,
  getPullRequestsGraphQL,
  getReviewEfficiencyDataForPRsGraphQL,
  getReworkDataForPRsGraphQL,
} from '../services/github';
import {
  writeCodingTimeToSheet,
  writeCycleTimeToSheet,
  writePRCycleTimeToSheet,
  writePRSizeToSheet,
  writeReviewEfficiencyToSheet,
  writeReworkRateToSheet,
} from '../services/spreadsheet';
import type { GitHubPullRequest, GitHubRepository } from '../types';
import {
  calculateCodingTime,
  calculateCycleTime,
  calculatePRCycleTime,
  calculatePRSize,
  calculateReviewEfficiency,
  calculateReworkRate,
} from '../utils/metrics';
import { ensureContainerInitialized } from './helpers';

// =============================================================================
// ヘルパー関数
// =============================================================================

/**
 * 全リポジトリからPRを取得
 *
 * @param repositories - リポジトリ一覧
 * @param token - GitHubトークン
 * @param dateRange - 日付範囲
 * @returns 全PRのリスト
 */
function fetchAllPRs(
  repositories: GitHubRepository[],
  token: string,
  dateRange: DateRange
): GitHubPullRequest[] {
  const allPRs: GitHubPullRequest[] = [];
  for (const repo of repositories) {
    const prsResult = getPullRequestsGraphQL({ repo, token, state: 'all', dateRange });
    if (prsResult.success && prsResult.data) {
      allPRs.push(...prsResult.data);
    } else {
      Logger.log(`  ⚠️ Failed to fetch PRs for ${repo.fullName}: ${prsResult.error}`);
    }
  }
  return allPRs;
}

/**
 * 除外ブランチパターンに基づいてPRをフィルタリング
 *
 * @param prs - フィルタリング対象のPRリスト
 * @param excludeBranches - 除外するブランチパターン（部分一致）
 * @returns フィルタリング後のPRリスト
 */
function filterPRsByExcludeBranches(
  prs: GitHubPullRequest[],
  excludeBranches: string[]
): GitHubPullRequest[] {
  if (excludeBranches.length === 0) {
    return prs;
  }

  return prs.filter((pr) => {
    const baseBranch = pr.baseBranch ?? '';
    // 除外ブランチパターンに部分一致する場合は除外
    const shouldExclude = excludeBranches.some((pattern) => baseBranch.includes(pattern));
    return !shouldExclude;
  });
}

// =============================================================================
// サイクルタイム同期
// =============================================================================

/**
 * サイクルタイムを収集してスプレッドシートに書き出す
 *
 * Issue作成からProductionマージまでの時間を計測。
 *
 * @param days - 過去何日分のデータを取得するか（デフォルト: 30日）
 */
function syncCycleTime(days = 30): void {
  ensureContainerInitialized();
  const config = getConfig();
  const token = getGitHubToken();

  Logger.log(`🔄 Syncing Cycle Time (past ${days} days)`);
  Logger.log(`   Repositories: ${config.github.repositories.length}`);

  const since = new Date();
  since.setDate(since.getDate() - days);

  // GitHub APIからサイクルタイムデータを取得
  const cycleTimeResult = getCycleTimeDataGraphQL(config.github.repositories, token, {
    dateRange: { start: since.toISOString() },
    productionBranchPattern: getProductionBranchPattern(),
    labels: getCycleTimeIssueLabels(),
  });

  if (!cycleTimeResult.success || !cycleTimeResult.data) {
    Logger.log(`❌ Failed to fetch cycle time data: ${cycleTimeResult.error}`);
    return;
  }

  Logger.log(`📥 Fetched ${cycleTimeResult.data.length} cycle time records`);

  // メトリクス計算
  const period = `過去${days}日`;
  const metrics = calculateCycleTime(cycleTimeResult.data, period);

  Logger.log(
    `📈 Calculated cycle time: ${metrics.completedTaskCount} issues, avg ${metrics.avgCycleTimeHours?.toFixed(1) ?? 'N/A'}h`
  );

  // スプレッドシートに書き込み
  writeCycleTimeToSheet(config.spreadsheet.id, metrics);

  Logger.log(`✅ Cycle Time synced successfully`);
}

// =============================================================================
// コーディング時間同期
// =============================================================================

/**
 * コーディング時間を収集してスプレッドシートに書き出す
 *
 * Issue作成からPR作成までの時間を計測。
 *
 * @param days - 過去何日分のデータを取得するか（デフォルト: 30日）
 */
function syncCodingTime(days = 30): void {
  ensureContainerInitialized();
  const config = getConfig();
  const token = getGitHubToken();

  Logger.log(`🔄 Syncing Coding Time (past ${days} days)`);
  Logger.log(`   Repositories: ${config.github.repositories.length}`);

  const since = new Date();
  since.setDate(since.getDate() - days);

  // GitHub APIからコーディング時間データを取得
  const codingTimeResult = getCodingTimeDataGraphQL(config.github.repositories, token, {
    dateRange: { start: since.toISOString() },
    labels: getCodingTimeIssueLabels(),
  });

  if (!codingTimeResult.success || !codingTimeResult.data) {
    Logger.log(`❌ Failed to fetch coding time data: ${codingTimeResult.error}`);
    return;
  }

  Logger.log(`📥 Fetched ${codingTimeResult.data.length} coding time records`);

  // メトリクス計算
  const period = `過去${days}日`;
  const metrics = calculateCodingTime(codingTimeResult.data, period);

  Logger.log(
    `📈 Calculated coding time: ${metrics.issueCount} issues, avg ${metrics.avgCodingTimeHours?.toFixed(1) ?? 'N/A'}h`
  );

  // スプレッドシートに書き込み
  writeCodingTimeToSheet(config.spreadsheet.id, metrics);

  Logger.log(`✅ Coding Time synced successfully`);
}

// =============================================================================
// PR Cycle Time同期
// =============================================================================

/**
 * PR Cycle Timeを収集してスプレッドシートに書き出す
 *
 * PR作成からPRマージまでの時間を計測（Issue有無は問わない）。
 *
 * @param days - 過去何日分のデータを取得するか（デフォルト: 30日）
 */
function syncPRCycleTime(days = 30): void {
  ensureContainerInitialized();
  const config = getConfig();
  const token = getGitHubToken();

  Logger.log(`🔄 Syncing PR Cycle Time (past ${days} days)`);
  Logger.log(`   Repositories: ${config.github.repositories.length}`);

  const since = new Date();
  since.setDate(since.getDate() - days);

  // GitHub APIからPR Cycle Timeデータを取得
  const excludeBranches = getExcludePRCycleTimeBaseBranches();
  const prCycleTimeResult = getPRCycleTimeDataGraphQL(config.github.repositories, token, {
    dateRange: { since },
    excludeBaseBranches: excludeBranches,
  });

  if (!prCycleTimeResult.success || !prCycleTimeResult.data) {
    Logger.log(`❌ Failed to fetch PR cycle time data: ${prCycleTimeResult.error}`);
    return;
  }

  Logger.log(`📥 Fetched ${prCycleTimeResult.data.length} PR cycle time records`);

  // メトリクス計算
  const period = `過去${days}日`;
  const metrics = calculatePRCycleTime(prCycleTimeResult.data, period);

  Logger.log(
    `📈 Calculated PR cycle time: ${metrics.mergedPRCount} PRs, avg ${metrics.avgPRCycleTimeHours?.toFixed(1) ?? 'N/A'}h`
  );

  // スプレッドシートに書き込み
  writePRCycleTimeToSheet(config.spreadsheet.id, metrics);

  Logger.log(`✅ PR Cycle Time synced successfully`);
}

// =============================================================================
// 手戻り率同期
// =============================================================================

/**
 * 手戻り率を収集してスプレッドシートに書き出す
 *
 * PRマージ後の追加コミット・Force Pushの回数を計測。
 *
 * @param days - 過去何日分のデータを取得するか（デフォルト: 30日）
 */
function syncReworkRate(days = 30): void {
  ensureContainerInitialized();
  const config = getConfig();
  const token = getGitHubToken();

  Logger.log(`🔄 Syncing Rework Rate (past ${days} days)`);
  Logger.log(`   Repositories: ${config.github.repositories.length}`);

  const since = new Date();
  since.setDate(since.getDate() - days);
  const dateRange: DateRange = { since };

  // PRを取得
  const allPRs = fetchAllPRs(config.github.repositories, token, dateRange);
  Logger.log(`📥 Fetched ${allPRs.length} PRs`);

  // 除外ブランチでフィルタリング
  const excludeBranches = getExcludeReworkRateBaseBranches();
  const filteredPRs = filterPRsByExcludeBranches(allPRs, excludeBranches);
  if (excludeBranches.length > 0) {
    Logger.log(
      `🔍 Filtered by exclude branches (${excludeBranches.join(', ')}): ${filteredPRs.length} PRs remaining`
    );
  }

  // 手戻り率データを取得
  const reworkData = getReworkDataForPRsGraphQL(filteredPRs, token);
  Logger.log(`📥 Fetched rework data for ${reworkData.length} PRs`);

  // メトリクス計算
  const period = `過去${days}日`;
  const metrics = calculateReworkRate(reworkData, period);

  Logger.log(
    `📈 Calculated rework rate: ${metrics.prCount} PRs, avg ${metrics.additionalCommits.avgPerPr?.toFixed(1) ?? 'N/A'} commits`
  );

  // スプレッドシートに書き込み
  writeReworkRateToSheet(config.spreadsheet.id, metrics);

  Logger.log(`✅ Rework Rate synced successfully`);
}

// =============================================================================
// レビュー効率同期
// =============================================================================

/**
 * レビュー効率を収集してスプレッドシートに書き出す
 *
 * レビュー待ち時間とレビュー時間を計測。
 *
 * @param days - 過去何日分のデータを取得するか（デフォルト: 30日）
 */
function syncReviewEfficiency(days = 30): void {
  ensureContainerInitialized();
  const config = getConfig();
  const token = getGitHubToken();

  Logger.log(`🔄 Syncing Review Efficiency (past ${days} days)`);
  Logger.log(`   Repositories: ${config.github.repositories.length}`);

  const since = new Date();
  since.setDate(since.getDate() - days);
  const dateRange: DateRange = { since };

  // PRを取得
  const allPRs = fetchAllPRs(config.github.repositories, token, dateRange);
  Logger.log(`📥 Fetched ${allPRs.length} PRs`);

  // 除外ブランチでフィルタリング
  const excludeBranches = getExcludeReviewEfficiencyBaseBranches();
  const filteredPRs = filterPRsByExcludeBranches(allPRs, excludeBranches);
  if (excludeBranches.length > 0) {
    Logger.log(
      `🔍 Filtered by exclude branches (${excludeBranches.join(', ')}): ${filteredPRs.length} PRs remaining`
    );
  }

  // レビュー効率データを取得
  const reviewData = getReviewEfficiencyDataForPRsGraphQL(filteredPRs, token);
  Logger.log(`📥 Fetched review data for ${reviewData.length} PRs`);

  // メトリクス計算
  const period = `過去${days}日`;
  const metrics = calculateReviewEfficiency(reviewData, period);

  Logger.log(
    `📈 Calculated review efficiency: ${metrics.prCount} PRs, avg wait ${metrics.timeToFirstReview.avgHours?.toFixed(1) ?? 'N/A'}h`
  );

  // スプレッドシートに書き込み
  writeReviewEfficiencyToSheet(config.spreadsheet.id, metrics);

  Logger.log(`✅ Review Efficiency synced successfully`);
}

// =============================================================================
// PRサイズ同期
// =============================================================================

/**
 * PRサイズを収集してスプレッドシートに書き出す
 *
 * 変更行数・変更ファイル数を計測。
 *
 * @param days - 過去何日分のデータを取得するか（デフォルト: 30日）
 */
function syncPRSize(days = 30): void {
  ensureContainerInitialized();
  const config = getConfig();
  const token = getGitHubToken();

  Logger.log(`🔄 Syncing PR Size (past ${days} days)`);
  Logger.log(`   Repositories: ${config.github.repositories.length}`);

  const since = new Date();
  since.setDate(since.getDate() - days);
  const dateRange: DateRange = { since };

  // PRを取得
  const allPRs = fetchAllPRs(config.github.repositories, token, dateRange);
  Logger.log(`📥 Fetched ${allPRs.length} PRs`);

  // 除外ブランチでフィルタリング
  const excludeBranches = getExcludePRSizeBaseBranches();
  const filteredPRs = filterPRsByExcludeBranches(allPRs, excludeBranches);
  if (excludeBranches.length > 0) {
    Logger.log(
      `🔍 Filtered by exclude branches (${excludeBranches.join(', ')}): ${filteredPRs.length} PRs remaining`
    );
  }

  // PRサイズデータを取得
  const sizeData = getPRSizeDataForPRsGraphQL(filteredPRs, token);
  Logger.log(`📥 Fetched size data for ${sizeData.length} PRs`);

  // メトリクス計算
  const period = `過去${days}日`;
  const metrics = calculatePRSize(sizeData, period);

  Logger.log(
    `📈 Calculated PR size: ${metrics.prCount} PRs, avg ${metrics.linesOfCode.avg?.toFixed(0) ?? 'N/A'} lines`
  );

  // スプレッドシートに書き込み
  writePRSizeToSheet(config.spreadsheet.id, metrics);

  Logger.log(`✅ PR Size synced successfully`);
}

// =============================================================================
// 全指標同期
// =============================================================================

/**
 * DORA指標を同期
 *
 * @param days - 過去何日分のデータを取得するか
 */
async function syncDORAMetrics(days: number): Promise<void> {
  Logger.log(`📊 [1/7] DORA指標を取得中...`);
  const config = getConfig();
  const token = getGitHubToken();
  const since = new Date();
  since.setDate(since.getDate() - days);

  // GitHubデータ取得
  const { getAllRepositoriesDataGraphQL } = await import('../services/github');
  const { pullRequests, workflowRuns, deployments } = getAllRepositoriesDataGraphQL(
    config.github.repositories,
    token,
    { dateRange: { since } }
  );

  Logger.log(
    `   📥 ${pullRequests.length} PRs, ${workflowRuns.length} Workflow実行, ${deployments.length} デプロイメントを取得`
  );

  // DORA指標計算
  const { calculateMetricsForRepository } = await import('../utils/metrics');
  const doraMetrics = config.github.repositories.map((repo) =>
    calculateMetricsForRepository({
      repository: repo.fullName,
      prs: pullRequests,
      runs: workflowRuns,
      deployments,
    })
  );

  // リポジトリ別シートに書き込み
  const { writeMetricsToAllRepositorySheets } = await import('../services/spreadsheet');
  writeMetricsToAllRepositorySheets(config.spreadsheet.id, doraMetrics, { skipDuplicates: true });

  Logger.log(`   ✅ ${doraMetrics.length}リポジトリの DORA指標を同期完了`);
}

/**
 * 拡張指標（サイクルタイム、コーディング時間、手戻り率、レビュー効率、PRサイズ）を同期
 *
 * @param days - 過去何日分のデータを取得するか
 */
function syncAllExtendedMetrics(days: number): void {
  Logger.log(`\n⏱️  [2/8] サイクルタイムを取得中...`);
  syncCycleTime(days);

  Logger.log(`\n⌨️  [3/8] コーディング時間を取得中...`);
  syncCodingTime(days);

  Logger.log(`\n📦 [4/8] PR Cycle Timeを取得中...`);
  syncPRCycleTime(days);

  Logger.log(`\n🔄 [5/8] 手戻り率を取得中...`);
  syncReworkRate(days);

  Logger.log(`\n👀 [6/8] レビュー効率を取得中...`);
  syncReviewEfficiency(days);

  Logger.log(`\n📏 [7/8] PRサイズを取得中...`);
  syncPRSize(days);
}

/**
 * ダッシュボードを更新
 */
async function updateDashboard(): Promise<void> {
  Logger.log(`\n📊 [8/8] ダッシュボードを更新中...`);
  const config = getConfig();
  const { writeDashboard, readMetricsFromAllRepositorySheets } = await import(
    '../services/spreadsheet'
  );
  const repositories = config.github.repositories.map((repo) => repo.fullName);
  const metrics = readMetricsFromAllRepositorySheets(config.spreadsheet.id, repositories);
  await writeDashboard(config.spreadsheet.id, metrics);
}

/**
 * 同期完了ログを出力
 *
 * @param startTime - 開始時刻（ミリ秒）
 */
function logSyncSuccess(startTime: number): void {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  Logger.log('');
  Logger.log('━'.repeat(60));
  Logger.log(`✅ すべてのデータ取得が完了しました！ (${elapsed}秒)`);
  Logger.log('━'.repeat(60));
  Logger.log('');
  Logger.log('📋 次のステップ:');
  Logger.log('  1. スプレッドシートを開く');
  Logger.log('  2. "Dashboard" シートで全体指標を確認');
  Logger.log('  3. "Dashboard - Trend" シートで週次トレンドを確認');
  Logger.log('  4. リポジトリ別シートで詳細データを確認');
  Logger.log('');
  Logger.log('💡 ヒント:');
  Logger.log('  - 日次自動実行: scheduleDailyMetricsSync() を実行');
  Logger.log('  - 設定確認: checkConfig() を実行');
  Logger.log('');
  Logger.log('━'.repeat(60));
}

/**
 * 同期エラーログを出力
 *
 * @param error - エラーオブジェクト
 */
function logSyncError(error: unknown): void {
  Logger.log('');
  Logger.log('━'.repeat(60));
  Logger.log(`❌ データ取得中にエラーが発生しました`);
  Logger.log('━'.repeat(60));
  Logger.log('');
  Logger.log(`エラー内容: ${String(error)}`);
  Logger.log('');
  Logger.log('💡 トラブルシューティング:');
  Logger.log('  1. checkConfig() で設定を確認');
  Logger.log('  2. docs/TROUBLESHOOTING.md を参照');
  Logger.log('  3. GitHub APIレート制限を確認');
  Logger.log('');
  Logger.log('━'.repeat(60));
}

/**
 * 全指標（DORA + 拡張指標）を一括同期
 *
 * GASエディタで一発で全シート生成できる便利関数。
 * - DORA指標（Dashboard含む）
 * - サイクルタイム
 * - コーディング時間
 * - 手戻り率
 * - レビュー効率
 * - PRサイズ
 *
 * @param days - 過去何日分のデータを取得するか（デフォルト: 30日）
 */
export async function syncAllMetrics(days = 30): Promise<void> {
  ensureContainerInitialized();

  Logger.log('━'.repeat(60));
  Logger.log('📊 DevSyncGAS データ取得を開始します');
  Logger.log('━'.repeat(60));
  Logger.log('');
  Logger.log(`📅 対象期間: 過去 ${days} 日`);
  Logger.log(`📝 モード: 差分更新（重複をスキップ）`);
  Logger.log('');
  Logger.log('⏳ データ取得中です... (30秒〜1分ほどかかります)');
  Logger.log('');

  const startTime = Date.now();

  try {
    await syncDORAMetrics(days);
    syncAllExtendedMetrics(days);
    await updateDashboard();
    logSyncSuccess(startTime);
  } catch (error) {
    logSyncError(error);
    throw error;
  }
}

// =============================================================================
// 全メトリクス完全再構築
// =============================================================================

/**
 * リポジトリ別拡張メトリクスシートをすべてクリア
 *
 * 以下のリポジトリ別シートを削除します:
 * - {repo} - サイクルタイム
 * - {repo} - コーディング時間
 * - {repo} - 手戻り率
 * - {repo} - レビュー効率
 * - {repo} - PRサイズ
 */
function clearAllExtendedMetricSheets(): void {
  const config = getConfig();
  const spreadsheet = SpreadsheetApp.openById(config.spreadsheet.id);
  const metricTypes = [
    'サイクルタイム',
    'コーディング時間',
    '手戻り率',
    'レビュー効率',
    'PRサイズ',
  ];

  let deletedCount = 0;

  for (const repo of config.github.repositories) {
    for (const metricType of metricTypes) {
      const sheetName = `${repo.fullName} - ${metricType}`;
      const sheet = spreadsheet.getSheetByName(sheetName);
      if (sheet) {
        spreadsheet.deleteSheet(sheet);
        deletedCount++;
      }
    }
  }

  Logger.log(`🗑️  Deleted ${deletedCount} repository metric sheets`);
}

/**
 * 全メトリクスを完全に再構築（既存データをクリアして同期）
 *
 * 既存のリポジトリ別拡張メトリクスシートをすべて削除してから、
 * 全メトリクスを新規に同期します。
 *
 * **使用例:**
 * - データの不整合を解消したい場合
 * - 設定変更後に完全に再計算したい場合
 * - 古いデータを削除してクリーンな状態から始めたい場合
 *
 * **注意:**
 * - DORA指標シートとDashboardは削除されず、更新されます
 * - リポジトリ別の拡張メトリクス詳細シートのみが削除対象です
 *
 * @param days - 過去何日分のデータを取得するか（デフォルト: 30日）
 */
export async function syncAllMetricsFromScratch(days = 30): Promise<void> {
  ensureContainerInitialized();

  Logger.log(`🚀 Starting FULL REBUILD of all metrics (past ${days} days)`);
  Logger.log(`   ⚠️  Mode: From Scratch (will delete existing repository sheets)`);
  Logger.log(`   📝 DORA metrics and Dashboard will be recreated`);

  const startTime = Date.now();

  try {
    // リポジトリ別拡張メトリクスシートをクリア
    Logger.log(`\n🗑️  Clearing all repository metric sheets...`);
    clearAllExtendedMetricSheets();

    // 全メトリクスを同期
    await syncAllMetrics(days);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    Logger.log(`\n✅ Full rebuild completed in ${elapsed}s`);
    Logger.log(`   All repository sheets recreated from scratch!`);
  } catch (error) {
    Logger.log(`\n❌ Failed to rebuild metrics: ${String(error)}`);
    throw error;
  }
}

// =============================================================================
// 差分同期（定期実行用）
// =============================================================================

/** PropertiesServiceのキー: 最終同期日時 */
const LAST_SYNC_TIMESTAMP_KEY = 'lastMetricsSyncTimestamp';

/** デフォルトの初回同期日数 */
const DEFAULT_INITIAL_SYNC_DAYS = 30;

/**
 * 前回同期以降の差分データを自動取得して更新（定期実行用）
 *
 * PropertiesServiceで最終同期日時を管理:
 * - 初回実行: 過去30日分を取得
 * - 2回目以降: 前回同期日時以降のデータのみ取得
 * - APIレート制限を大幅に節約
 *
 * **推奨用途:**
 * - 定期実行トリガー（毎日・毎時）
 * - 差分更新でAPIコールを最小化
 *
 * **手動実行の場合:**
 * - 期間指定したい場合: `syncAllMetrics(days)` を使用
 * - 完全再構築したい場合: `syncAllMetricsFromScratch(days)` を使用
 */
export async function syncAllMetricsIncremental(): Promise<void> {
  ensureContainerInitialized();

  const properties = PropertiesService.getScriptProperties();
  const now = new Date();
  const lastSyncTimestamp = properties.getProperty(LAST_SYNC_TIMESTAMP_KEY);

  let days: number;
  let syncMode: string;

  if (!lastSyncTimestamp) {
    // 初回実行: 過去30日分を取得
    days = DEFAULT_INITIAL_SYNC_DAYS;
    syncMode = 'Initial sync';
    Logger.log(`🔄 ${syncMode} (past ${days} days)`);
  } else {
    // 2回目以降: 前回同期日時以降のデータを取得
    const lastSync = new Date(lastSyncTimestamp);
    const diffMs = now.getTime() - lastSync.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    // 最低1日、最大90日（異常値対策）
    days = Math.max(1, Math.min(diffDays + 1, 90));
    syncMode = 'Incremental sync';
    Logger.log(`🔄 ${syncMode}`);
    Logger.log(`   Last sync: ${lastSync.toISOString()}`);
    Logger.log(`   Days to fetch: ${days} (${diffDays} days since last sync)`);
  }

  try {
    // 全メトリクスを同期
    await syncAllMetrics(days);

    // 同期日時を更新
    properties.setProperty(LAST_SYNC_TIMESTAMP_KEY, now.toISOString());
    Logger.log(`\n📝 Updated last sync timestamp: ${now.toISOString()}`);
  } catch (error) {
    Logger.log(`\n❌ Incremental sync failed: ${String(error)}`);
    throw error;
  }
}
