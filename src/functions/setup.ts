/**
 * セットアップ・設定関数モジュール
 *
 * 初期設定、リポジトリ管理、プロジェクト管理、トリガー設定など
 * 設定に関するGASエントリーポイント関数を提供。
 */

import {
  diagnoseConfig,
  formatDiagnosticResult,
  getConfig,
  getGitHubAuthMode,
} from '../config/settings';
import { getContainer } from '../container';
import { auditLog } from '../utils/auditLog';
import { ensureContainerInitialized } from './helpers';

// =============================================================================
// 初期セットアップ
// =============================================================================
// NOTE: 初期セットアップは src/init.ts の initConfig() を使用してください
// setup() と setupWithGitHubApp() は削除されました

/** 現在の認証モードを表示 */
export function showAuthMode(): void {
  ensureContainerInitialized();
  const mode = getGitHubAuthMode();

  if (mode === 'app') {
    Logger.log('🔐 Current auth mode: GitHub App');
  } else if (mode === 'pat') {
    Logger.log('🔐 Current auth mode: Personal Access Token (PAT)');
  } else {
    Logger.log('⚠️ GitHub authentication is not configured');
  }
}

// =============================================================================
// リポジトリ管理
// =============================================================================

/** 登録済みリポジトリ一覧を表示 */
export function listRepos(): void {
  ensureContainerInitialized();
  const config = getConfig();
  Logger.log('Registered repositories:');
  config.github.repositories.forEach((repo, i) => {
    Logger.log(`  ${i + 1}. ${repo.fullName}`);
  });
}

// =============================================================================
// トリガー管理
// =============================================================================

/** 日次メトリクス同期のスケジュール設定（syncAllMetricsIncrementalを毎日午前9時に自動実行） */
export function scheduleDailyMetricsSync(): void {
  ensureContainerInitialized();
  const { triggerClient, logger } = getContainer();

  try {
    // 既存のトリガーを削除（旧関数名も含む）
    const triggers = triggerClient.getProjectTriggers();
    for (const trigger of triggers) {
      const funcName = trigger.getHandlerFunction();
      if (funcName === 'syncAllMetricsIncremental' || funcName === 'syncDevOpsMetrics') {
        triggerClient.deleteTrigger(trigger);
      }
    }

    // 毎日午前9時に実行（差分更新）
    triggerClient
      .newTrigger('syncAllMetricsIncremental')
      .timeBased()
      .everyDays(1)
      .atHour(9)
      .create();

    // 監査ログ
    auditLog('trigger.create', {
      functionName: 'syncAllMetricsIncremental',
      schedule: 'daily at 9:00 AM',
    });

    logger.info('✅ Daily trigger created for syncAllMetricsIncremental at 9:00 AM');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    auditLog(
      'trigger.create',
      { functionName: 'syncAllMetricsIncremental' },
      'failure',
      errorMessage
    );
    throw error;
  }
}

// =============================================================================
// 診断・権限テスト
// =============================================================================

/**
 * 設定状況を診断して問題を報告
 */
export function checkConfig(): void {
  ensureContainerInitialized();
  const result = diagnoseConfig();
  const formatted = formatDiagnosticResult(result);
  Logger.log(formatted);
}

/**
 * 権限テスト用関数 - 初回実行で承認ダイアログを表示
 */
export function testPermissions(): void {
  // 外部リクエスト権限のテスト
  const response = UrlFetchApp.fetch('https://api.github.com', {
    muteHttpExceptions: true,
  });
  Logger.log(`GitHub API status: ${response.getResponseCode()}`);

  // スプレッドシート権限のテスト
  const config = getConfig();
  const spreadsheet = SpreadsheetApp.openById(config.spreadsheet.id);
  Logger.log(`Spreadsheet name: ${spreadsheet.getName()}`);

  Logger.log('✅ All permissions granted!');
}
