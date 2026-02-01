/**
 * スプレッドシートアクセス検証
 * セキュリティ: アクセス権限を事前に確認し、適切なエラーメッセージを提供
 */

import { SpreadsheetError, ValidationError, ErrorCode } from './errors';

/**
 * スプレッドシートのアクセステストを実行
 */
function testSpreadsheetAccess(spreadsheetId: string): void {
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const name = spreadsheet.getName();

  if (!name) {
    throw new SpreadsheetError('Spreadsheet exists but has no name', {
      code: ErrorCode.SPREADSHEET_NOT_FOUND,
      context: { spreadsheetId },
    });
  }
}

/**
 * スプレッドシートアクセスエラーを適切なエラー型に変換
 */
function handleSpreadsheetAccessError(spreadsheetId: string, error: unknown): never {
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (errorMessage.includes('perhaps it was deleted') || errorMessage.includes('not found')) {
    throw new SpreadsheetError(
      `Spreadsheet not found: ${spreadsheetId}\n` +
        'Check if:\n' +
        '1. The spreadsheet ID is correct\n' +
        '2. The spreadsheet has not been deleted\n' +
        '3. The spreadsheet is in your Google Drive or shared with you',
      {
        code: ErrorCode.SPREADSHEET_NOT_FOUND,
        context: { spreadsheetId },
        cause: error instanceof Error ? error : undefined,
      }
    );
  }

  if (errorMessage.includes('permission') || errorMessage.includes('access')) {
    throw new SpreadsheetError(
      `Cannot access spreadsheet ${spreadsheetId}\n` +
        'Check if:\n' +
        '1. You have edit permission for this spreadsheet\n' +
        '2. The spreadsheet owner has granted access to your account\n' +
        '3. The sharing settings allow access',
      {
        code: ErrorCode.SPREADSHEET_ACCESS_DENIED,
        context: { spreadsheetId },
        cause: error instanceof Error ? error : undefined,
      }
    );
  }

  throw new SpreadsheetError(`Failed to access spreadsheet ${spreadsheetId}: ${errorMessage}`, {
    code: ErrorCode.SPREADSHEET_ACCESS_DENIED,
    context: { spreadsheetId },
    cause: error instanceof Error ? error : undefined,
  });
}

/**
 * スプレッドシートへのアクセス権限を検証
 *
 * @param spreadsheetId - 検証するスプレッドシートID
 * @throws Error アクセスできない場合
 */
export function validateSpreadsheetAccess(spreadsheetId: string): void {
  if (!spreadsheetId) {
    throw new ValidationError('Spreadsheet ID is required', {
      code: ErrorCode.INVALID_SPREADSHEET_ID,
    });
  }

  // テスト環境ではSpreadsheetAppが存在しないのでスキップ
  if (typeof SpreadsheetApp === 'undefined') {
    return;
  }

  try {
    testSpreadsheetAccess(spreadsheetId);
  } catch (error) {
    handleSpreadsheetAccessError(spreadsheetId, error);
  }
}

/**
 * 複数のスプレッドシートへのアクセス権限を検証
 *
 * @param spreadsheetIds - 検証するスプレッドシートIDの配列
 * @returns 検証結果 { valid: 成功したID[], invalid: 失敗したID[] }
 */
export function validateMultipleSpreadsheetAccess(spreadsheetIds: string[]): {
  valid: string[];
  invalid: Array<{ id: string; error: string }>;
} {
  const valid: string[] = [];
  const invalid: Array<{ id: string; error: string }> = [];

  for (const id of spreadsheetIds) {
    try {
      validateSpreadsheetAccess(id);
      valid.push(id);
    } catch (error) {
      invalid.push({
        id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { valid, invalid };
}
