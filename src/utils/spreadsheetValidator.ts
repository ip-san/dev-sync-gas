/**
 * スプレッドシートアクセス検証
 * セキュリティ: アクセス権限を事前に確認し、適切なエラーメッセージを提供
 */

/**
 * スプレッドシートへのアクセス権限を検証
 *
 * @param spreadsheetId - 検証するスプレッドシートID
 * @throws Error アクセスできない場合
 */
export function validateSpreadsheetAccess(spreadsheetId: string): void {
  if (!spreadsheetId) {
    throw new Error('Spreadsheet ID is required');
  }

  // テスト環境ではSpreadsheetAppが存在しないのでスキップ
  if (typeof SpreadsheetApp === 'undefined') {
    return;
  }

  try {
    // スプレッドシートを開いてアクセステスト
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);

    // getName()を呼び出すことで実際にアクセス可能か確認
    const name = spreadsheet.getName();

    // 空の名前は異常なので警告
    if (!name) {
      throw new Error('Spreadsheet exists but has no name');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // エラーの種類に応じて適切なメッセージを提供
    if (errorMessage.includes('perhaps it was deleted') || errorMessage.includes('not found')) {
      throw new Error(
        `Spreadsheet not found: ${spreadsheetId}\n` +
          'Check if:\n' +
          '1. The spreadsheet ID is correct\n' +
          '2. The spreadsheet has not been deleted\n' +
          '3. The spreadsheet is in your Google Drive or shared with you'
      );
    }

    if (errorMessage.includes('permission') || errorMessage.includes('access')) {
      throw new Error(
        `Cannot access spreadsheet ${spreadsheetId}\n` +
          'Check if:\n' +
          '1. You have edit permission for this spreadsheet\n' +
          '2. The spreadsheet owner has granted access to your account\n' +
          '3. The sharing settings allow access'
      );
    }

    // その他のエラーはそのまま再スロー
    throw new Error(`Failed to access spreadsheet ${spreadsheetId}: ${errorMessage}`);
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
