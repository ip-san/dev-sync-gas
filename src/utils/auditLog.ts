/**
 * 監査ログユーティリティ
 * ITGC要件: 設定変更の追跡と監査証跡の記録
 */

import { getContainer } from '../container';

/**
 * 監査ログエントリ
 */
export interface AuditLogEntry {
  timestamp: string;
  user: string;
  action: string;
  details: Record<string, unknown>;
  status: 'success' | 'failure';
  errorMessage?: string;
}

/**
 * 監査対象のアクション
 */
export type AuditAction =
  | 'setup.pat'
  | 'setup.github_app'
  | 'repository.add'
  | 'repository.remove'
  | 'project.create'
  | 'project.update'
  | 'project.delete'
  | 'project.repository.add'
  | 'project.repository.remove'
  | 'config.github_app.clear'
  | 'config.api_mode.set'
  | 'config.production_branch.set'
  | 'trigger.create'
  | 'trigger.delete'
  | 'sync.execute'
  | 'migration.execute';

/**
 * 監査ログを記録
 *
 * @param action - 実行されたアクション
 * @param details - アクションの詳細（機密情報を含めないこと）
 * @param status - 成功/失敗
 * @param errorMessage - エラーメッセージ（失敗時）
 */
export function auditLog(
  action: AuditAction,
  details: Record<string, unknown>,
  status: 'success' | 'failure' = 'success',
  errorMessage?: string
): void {
  const { logger } = getContainer();

  // GAS環境でユーザー情報を取得
  let user = 'unknown';
  try {
    // Session.getEffectiveUser() はGAS環境でのみ利用可能
    user = Session?.getEffectiveUser?.()?.getEmail?.() ?? 'unknown';
  } catch {
    // Session APIが利用できない環境（テスト等）では unknown のまま
  }

  const entry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    user,
    action,
    details: sanitizeDetails(details),
    status,
    errorMessage,
  };

  // 構造化ログとして出力
  const logMessage = `[AUDIT] ${JSON.stringify(entry)}`;
  logger.log(logMessage);

  // 将来的な拡張: Stackdriver Logging、外部SIEMへの送信など
  // if (shouldSendToExternalLog()) {
  //   sendToStackdriver(entry);
  // }
}

/**
 * 詳細情報から機密情報を除外
 *
 * @param details - 元の詳細情報
 * @returns サニタイズされた詳細情報
 */
function sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(details)) {
    // 機密情報のキーをマスク
    const sensitiveKeys = ['token', 'privateKey', 'password', 'secret', 'key'];
    const isSensitive = sensitiveKeys.some((sk) => key.toLowerCase().includes(sk.toLowerCase()));

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'string' && value.length > 200) {
      // 長い文字列は切り詰め
      sanitized[key] = value.substring(0, 200) + '... (truncated)';
    } else if (typeof value === 'object' && value !== null) {
      // ネストされたオブジェクトは再帰的にサニタイズ
      sanitized[key] = sanitizeDetails(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * 監査ログの取得（直近N件）
 * 注意: GASのLogger.getLog()は実行ログ全体を返すため、
 * 実際の運用では専用のストレージ（Spreadsheet、外部DB等）を推奨
 *
 * @param limit - 取得件数
 * @returns 監査ログエントリの配列
 */
export function getAuditLogs(limit = 100): AuditLogEntry[] {
  try {
    if (!Logger?.getLog?.()) {
      return [];
    }

    const fullLog = Logger.getLog();
    const lines = fullLog.split('\n');
    const auditEntries: AuditLogEntry[] = [];

    for (const line of lines) {
      if (line.includes('[AUDIT]')) {
        try {
          const jsonStr = line.substring(line.indexOf('{'));
          const entry = JSON.parse(jsonStr) as AuditLogEntry;
          auditEntries.push(entry);

          if (auditEntries.length >= limit) {
            break;
          }
        } catch {
          // パースエラーは無視
        }
      }
    }

    return auditEntries;
  } catch {
    return [];
  }
}

/**
 * 監査ログをスプレッドシートに書き出し
 * 長期保存・監査対応のための機能
 *
 * @param spreadsheetId - 書き出し先スプレッドシートID
 * @param sheetName - シート名（デフォルト: "Audit Log"）
 */
export function exportAuditLogsToSheet(spreadsheetId: string, sheetName = 'Audit Log'): void {
  const { spreadsheetClient, logger } = getContainer();

  const logs = getAuditLogs(1000); // 直近1000件
  if (logs.length === 0) {
    logger.log('No audit logs to export');
    return;
  }

  const spreadsheet = spreadsheetClient.openById(spreadsheetId);
  let sheet = spreadsheet.getSheetByName(sheetName);

  // シートが存在しない場合は作成
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  // ヘッダー行
  const headers = ['Timestamp', 'User', 'Action', 'Status', 'Details', 'Error'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');

  // データ行
  const rows = logs.map((log) => [
    log.timestamp,
    log.user,
    log.action,
    log.status,
    JSON.stringify(log.details),
    log.errorMessage ?? '',
  ]);

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  logger.log(`✅ Exported ${logs.length} audit log entries to "${sheetName}"`);
}
