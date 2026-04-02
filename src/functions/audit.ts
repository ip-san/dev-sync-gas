/**
 * 監査ログ関連のGASエントリーポイント関数
 */

import { getConfig } from '../config/settings';
import { exportAuditLogsToSheet, getAuditLogs } from '../utils/auditLog';
import { ensureContainerInitialized } from './helpers';

/**
 * 監査ログをスプレッドシートに書き出す
 *
 * 使い方:
 * ```javascript
 * // デフォルトのスプレッドシートに書き出し
 * exportAuditLogs();
 *
 * // 別のスプレッドシートに書き出し
 * exportAuditLogs('spreadsheet-id-here');
 * ```
 */
export function exportAuditLogs(spreadsheetId?: string): void {
  ensureContainerInitialized();

  // スプレッドシートIDが指定されていない場合は設定から取得
  const targetSpreadsheetId = spreadsheetId ?? getConfig().spreadsheet.id;

  if (!targetSpreadsheetId) {
    throw new Error(
      'Spreadsheet ID is not configured. ' +
        'Please specify a spreadsheet ID or configure it with setup()'
    );
  }

  exportAuditLogsToSheet(targetSpreadsheetId);
}

/**
 * 直近の監査ログをコンソールに表示
 *
 * 使い方:
 * ```javascript
 * // 直近10件を表示
 * showAuditLogs();
 *
 * // 直近50件を表示
 * showAuditLogs(50);
 * ```
 */
export function showAuditLogs(limit = 10): void {
  ensureContainerInitialized();

  const logs = getAuditLogs(limit);

  if (logs.length === 0) {
    Logger.log('📋 No audit logs found');
    return;
  }

  Logger.log(`📋 Recent Audit Logs (${logs.length} entries):\n`);

  for (const log of logs) {
    const statusIcon = log.status === 'success' ? '✅' : '❌';
    Logger.log(`${statusIcon} [${log.timestamp}] ${log.user}`);
    Logger.log(`   Action: ${log.action}`);
    Logger.log(`   Details: ${JSON.stringify(log.details)}`);

    if (log.errorMessage) {
      Logger.log(`   Error: ${log.errorMessage}`);
    }

    Logger.log('');
  }
}
