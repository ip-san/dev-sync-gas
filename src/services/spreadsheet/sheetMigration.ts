/**
 * シート構造マイグレーション
 *
 * 従来の混在型シート構造から、リポジトリ別シート構造へのマイグレーションを提供。
 * 既存データを保持しながら新構造に移行する。
 */

import type { DevOpsMetrics } from '../../types';
import { getContainer } from '../../container';
import { openSpreadsheet } from './helpers';
import { writeMetricsToAllRepositorySheets, groupMetricsByRepository } from './repositorySheet';
import { writeDashboard, writeDashboardTrends } from './dashboard';
import { createDevOpsSummaryFromMetrics } from './metricsSummary';

/**
 * 文字列が有効なデプロイメント頻度かをチェックする型ガード
 */
function isValidDeploymentFrequency(value: unknown): value is DevOpsMetrics['deploymentFrequency'] {
  return value === 'daily' || value === 'weekly' || value === 'monthly' || value === 'yearly';
}

/**
 * マイグレーション結果
 */
export interface SheetMigrationResult {
  success: boolean;
  sourceSheetName: string;
  /** 移行されたリポジトリ数 */
  repositoryCount: number;
  /** 移行されたレコード数 */
  recordCount: number;
  /** 作成されたシート */
  createdSheets: string[];
  /** エラーメッセージ（失敗時） */
  error?: string;
  /** 処理時間（ms） */
  duration: number;
}

/**
 * 従来型シートからDevOpsMetricsを読み取る
 */
function parseDevOpsMetricsFromLegacySheet(
  spreadsheetId: string,
  sheetName: string
): DevOpsMetrics[] {
  const spreadsheet = openSpreadsheet(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    return [];
  }

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return [];
  }

  const data = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
  const metrics: DevOpsMetrics[] = [];

  for (const row of data) {
    // 空行をスキップ
    if (!row[0] || !row[1]) {
      continue;
    }

    const frequency = isValidDeploymentFrequency(row[3]) ? row[3] : 'daily';

    metrics.push({
      date: String(row[0]),
      repository: String(row[1]),
      deploymentCount: Number(row[2]) || 0,
      deploymentFrequency: frequency,
      leadTimeForChangesHours: Number(row[4]) || 0,
      totalDeployments: Number(row[5]) || 0,
      failedDeployments: Number(row[6]) || 0,
      changeFailureRate: Number(row[7]) || 0,
      meanTimeToRecoveryHours: row[8] === 'N/A' ? null : Number(row[8]) || null,
    });
  }

  return metrics;
}

/**
 * 従来型シートからリポジトリ別シートへマイグレーション
 *
 * 既存の「DevOps Metrics」シートから各リポジトリ別シートにデータを移行し、
 * Dashboard、Summary シートを作成する。
 *
 * @param spreadsheetId - スプレッドシートID
 * @param sourceSheetName - 移行元シート名（デフォルト: "DevOps Metrics"）
 * @param options - オプション
 */
export function migrateToRepositorySheets(
  spreadsheetId: string,
  sourceSheetName: string = 'DevOps Metrics',
  options: {
    /** 従来シートを保持するか（デフォルト: true） */
    keepLegacySheet?: boolean;
    /** Dashboardを作成するか（デフォルト: true） */
    createDashboard?: boolean;
    /** Summaryを作成するか（デフォルト: true） */
    createSummary?: boolean;
  } = {}
): SheetMigrationResult {
  const { logger } = getContainer();
  const startTime = Date.now();

  const keepLegacySheet = options.keepLegacySheet !== false;
  const createDashboard = options.createDashboard !== false;
  const createSummary = options.createSummary !== false;

  logger.log(`🔄 Starting migration from "${sourceSheetName}"...`);

  try {
    // 1. 従来シートからデータを読み取り
    const metrics = parseDevOpsMetricsFromLegacySheet(spreadsheetId, sourceSheetName);

    if (metrics.length === 0) {
      return {
        success: false,
        sourceSheetName,
        repositoryCount: 0,
        recordCount: 0,
        createdSheets: [],
        error: 'No data found in source sheet',
        duration: Date.now() - startTime,
      };
    }

    logger.log(`📊 Found ${metrics.length} records to migrate`);

    // 2. リポジトリ別にグループ化
    const grouped = groupMetricsByRepository(metrics);
    logger.log(`📁 Migrating to ${grouped.size} repository sheets`);

    // 3. リポジトリ別シートに書き込み
    writeMetricsToAllRepositorySheets(spreadsheetId, metrics, {
      skipDuplicates: false, // マイグレーション時は重複チェックしない
    });

    const createdSheets: string[] = [];
    for (const repository of grouped.keys()) {
      createdSheets.push(repository);
    }

    // 4. Dashboard作成
    if (createDashboard) {
      writeDashboard(spreadsheetId, metrics);
      writeDashboardTrends(spreadsheetId, metrics);
      createdSheets.push('Dashboard', 'Dashboard - Trend');
    }

    // 5. Summary作成
    if (createSummary) {
      createDevOpsSummaryFromMetrics(spreadsheetId, metrics, 'DevOps Summary');
      createdSheets.push('DevOps Summary');
    }

    // 6. 従来シートのリネーム（保持する場合）
    if (keepLegacySheet) {
      const spreadsheet = openSpreadsheet(spreadsheetId);
      const legacySheet = spreadsheet.getSheetByName(sourceSheetName);
      if (!legacySheet) {
        // 従来シートが見つからない場合は何もしない
      } else {
        const newName = `${sourceSheetName} (Legacy)`;
        // 既に同名のシートがあれば削除
        const existingLegacy = spreadsheet.getSheetByName(newName);
        if (existingLegacy) {
          spreadsheet.deleteSheet(existingLegacy);
        }
        legacySheet.setName(newName);
        logger.log(`📝 Renamed legacy sheet to "${newName}"`);
      }
    }

    const duration = Date.now() - startTime;

    logger.log(`✅ Migration completed in ${duration}ms`);
    logger.log(`   - ${grouped.size} repository sheets created`);
    logger.log(`   - ${metrics.length} records migrated`);

    return {
      success: true,
      sourceSheetName,
      repositoryCount: grouped.size,
      recordCount: metrics.length,
      createdSheets,
      duration,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.log(`❌ Migration failed: ${errorMessage}`);

    return {
      success: false,
      sourceSheetName,
      repositoryCount: 0,
      recordCount: 0,
      createdSheets: [],
      error: errorMessage,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * マイグレーションのプレビュー（実際の変更は行わない）
 */
export function previewMigration(
  spreadsheetId: string,
  sourceSheetName: string = 'DevOps Metrics'
): {
  sourceSheetExists: boolean;
  recordCount: number;
  repositories: string[];
  sheetsToCreate: string[];
} {
  const metrics = parseDevOpsMetricsFromLegacySheet(spreadsheetId, sourceSheetName);
  const grouped = groupMetricsByRepository(metrics);
  const repositories = Array.from(grouped.keys());

  const sheetsToCreate = [...repositories, 'Dashboard', 'Dashboard - Trend', 'DevOps Summary'];

  return {
    sourceSheetExists: metrics.length > 0,
    recordCount: metrics.length,
    repositories,
    sheetsToCreate,
  };
}

/**
 * 従来シートを削除（マイグレーション完了後に手動で実行）
 */
export function removeLegacySheet(
  spreadsheetId: string,
  sheetName: string = 'DevOps Metrics (Legacy)'
): boolean {
  const { logger } = getContainer();
  const spreadsheet = openSpreadsheet(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    logger.log(`⚠️ Sheet "${sheetName}" not found`);
    return false;
  }

  spreadsheet.deleteSheet(sheet);
  logger.log(`🗑️ Deleted sheet "${sheetName}"`);
  return true;
}
