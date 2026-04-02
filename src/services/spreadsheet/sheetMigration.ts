/**
 * シート構造マイグレーション
 *
 * 従来の混在型シート構造から、リポジトリ別シート構造へのマイグレーションを提供。
 * 既存データを保持しながら新構造に移行する。
 */

import { getContainer } from '../../container';
import type { DevOpsMetrics } from '../../types';
import { writeDashboard, writeDashboardTrends } from './dashboard';
import { openSpreadsheet } from './helpers';
import { groupMetricsByRepository, writeMetricsToAllRepositorySheets } from './repositorySheet';

/**
 * レガシー形式のデプロイ頻度（文字列）を数値に変換
 * マイグレーション用のヘルパー関数
 */
function convertLegacyDeploymentFrequency(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  // レガシー形式の変換（後方互換性）
  if (value === 'daily') {
    return 1.0;
  }
  if (value === 'weekly') {
    return 1 / 7;
  }
  if (value === 'monthly') {
    return 1 / 30;
  }
  if (value === 'yearly') {
    return 1 / 365;
  }
  return 0;
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
 * 行データが有効かをチェックする
 */
function isValidRow(row: unknown[]): boolean {
  return !!(row[0] && row[1]);
}

/**
 * 行データをDevOpsMetricsにパースする
 */
function parseMetricRow(row: unknown[]): DevOpsMetrics {
  return {
    date: String(row[0]),
    repository: String(row[1]),
    deploymentCount: Number(row[2]) || 0,
    deploymentFrequency: convertLegacyDeploymentFrequency(row[3]),
    leadTimeForChangesHours: Number(row[4]) || 0,
    totalDeployments: Number(row[5]) || 0,
    failedDeployments: Number(row[6]) || 0,
    changeFailureRate: Number(row[7]) || 0,
    meanTimeToRecoveryHours: row[8] === 'N/A' ? null : Number(row[8]) || null,
  };
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
    if (!isValidRow(row)) {
      continue;
    }

    metrics.push(parseMetricRow(row));
  }

  return metrics;
}

/**
 * 従来シートをリネームしてアーカイブする
 */
function renameLegacySheet(
  spreadsheetId: string,
  sourceSheetName: string,
  logger: { log: (msg: string) => void }
): void {
  const spreadsheet = openSpreadsheet(spreadsheetId);
  const legacySheet = spreadsheet.getSheetByName(sourceSheetName);

  if (!legacySheet) {
    return; // 従来シートが見つからない場合は何もしない
  }

  const newName = `${sourceSheetName} (Legacy)`;
  // 既に同名のシートがあれば削除
  const existingLegacy = spreadsheet.getSheetByName(newName);
  if (existingLegacy) {
    spreadsheet.deleteSheet(existingLegacy);
  }
  legacySheet.setName(newName);
  logger.log(`📝 Renamed legacy sheet to "${newName}"`);
}

/**
 * 空のマイグレーション結果を作成
 */
function createEmptyMigrationResult(
  sourceSheetName: string,
  error: string,
  duration: number
): SheetMigrationResult {
  return {
    success: false,
    sourceSheetName,
    repositoryCount: 0,
    recordCount: 0,
    createdSheets: [],
    error,
    duration,
  };
}

/**
 * リポジトリ別シート移行を実行
 */
async function performRepositoryMigration(
  spreadsheetId: string,
  metrics: DevOpsMetrics[],
  options: {
    createDashboard: boolean;
  },
  logger: { log: (msg: string) => void }
): Promise<string[]> {
  const grouped = groupMetricsByRepository(metrics);
  logger.log(`📁 Migrating to ${grouped.size} repository sheets`);

  writeMetricsToAllRepositorySheets(spreadsheetId, metrics, {
    skipDuplicates: false,
  });

  const createdSheets: string[] = [];
  for (const repository of grouped.keys()) {
    createdSheets.push(repository);
  }

  if (options.createDashboard) {
    await writeDashboard(spreadsheetId, metrics);
    await writeDashboardTrends(spreadsheetId, metrics);
    createdSheets.push('Dashboard', 'Dashboard - Trend');
  }

  return createdSheets;
}

/**
 * 成功時のマイグレーション結果を作成
 */
function createSuccessMigrationResult(params: {
  sourceSheetName: string;
  metrics: DevOpsMetrics[];
  createdSheets: string[];
  duration: number;
  logger: { log: (msg: string) => void };
}): SheetMigrationResult {
  const { sourceSheetName, metrics, createdSheets, duration, logger } = params;
  const grouped = groupMetricsByRepository(metrics);

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
export async function migrateToRepositorySheets(
  spreadsheetId: string,
  sourceSheetName: string = 'DevOps Metrics',
  options: {
    /** 従来シートを保持するか（デフォルト: true） */
    keepLegacySheet?: boolean;
    /** Dashboardを作成するか（デフォルト: true） */
    createDashboard?: boolean;
  } = {}
): Promise<SheetMigrationResult> {
  const { logger } = getContainer();
  const startTime = Date.now();

  const keepLegacySheet = options.keepLegacySheet !== false;
  const createDashboard = options.createDashboard !== false;

  logger.log(`🔄 Starting migration from "${sourceSheetName}"...`);

  try {
    const metrics = parseDevOpsMetricsFromLegacySheet(spreadsheetId, sourceSheetName);

    if (metrics.length === 0) {
      return createEmptyMigrationResult(
        sourceSheetName,
        'No data found in source sheet',
        Date.now() - startTime
      );
    }

    logger.log(`📊 Found ${metrics.length} records to migrate`);

    const createdSheets = await performRepositoryMigration(
      spreadsheetId,
      metrics,
      { createDashboard },
      logger
    );

    if (keepLegacySheet) {
      renameLegacySheet(spreadsheetId, sourceSheetName, logger);
    }

    return createSuccessMigrationResult({
      sourceSheetName,
      metrics,
      createdSheets,
      duration: Date.now() - startTime,
      logger,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.log(`❌ Migration failed: ${errorMessage}`);

    return createEmptyMigrationResult(sourceSheetName, errorMessage, Date.now() - startTime);
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
