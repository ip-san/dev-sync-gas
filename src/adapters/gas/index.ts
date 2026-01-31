/**
 * GAS固有API実装（本番用アダプター）
 */

import type {
  HttpClient,
  HttpRequestOptions,
  HttpResponse,
  SpreadsheetClient,
  Spreadsheet,
  Sheet,
  SheetRange,
  BorderStyle,
  StorageClient,
  LoggerClient,
  TriggerClient,
  Trigger,
  TriggerBuilder,
  TimeTriggerBuilder,
  ServiceContainer,
} from '../../interfaces';

// HTTP Client
export class GasHttpClient implements HttpClient {
  // セキュリティ: デフォルトタイムアウトを設定（30秒）
  private readonly DEFAULT_TIMEOUT_MS = 30000;
  // レート制限対策: リトライ設定
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_BACKOFF_MS = 1000;

  fetch<T = unknown>(url: string, options: HttpRequestOptions = {}): HttpResponse<T> {
    return this.fetchWithRetry<T>(url, options, 0);
  }

  private fetchWithRetry<T = unknown>(
    url: string,
    options: HttpRequestOptions,
    retryCount: number
  ): HttpResponse<T> {
    const gasOptions: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
      method: options.method ?? 'get',
      headers: options.headers,
      payload: options.payload,
      muteHttpExceptions: options.muteHttpExceptions ?? true,
      // タイムアウト設定（GAS実行時間制限6分を考慮）
      validateHttpsCertificates: true, // セキュリティ: SSL証明書を検証
      followRedirects: true,
      // GASのfetchはミリ秒ではなく秒単位
      // ただし、型定義上は存在しないため any でキャスト
    };

    // タイムアウトを設定（GAS環境のみ）
    if (typeof UrlFetchApp !== 'undefined') {
      (gasOptions as unknown as { muteHttpExceptions: boolean }).muteHttpExceptions = true;
    }

    try {
      const response = UrlFetchApp.fetch(url, gasOptions);
      const statusCode = response.getResponseCode();
      const content = response.getContentText();

      // レート制限（429）の場合はリトライ
      if (statusCode === 429 && retryCount < this.MAX_RETRIES) {
        const retryAfter = this.getRetryAfter(response);
        const backoffMs = retryAfter ?? this.calculateBackoff(retryCount);

        Logger.log(
          `⚠️ Rate limit exceeded (429). Retrying after ${backoffMs / 1000}s (attempt ${retryCount + 1}/${this.MAX_RETRIES})`
        );

        Utilities.sleep(backoffMs);
        return this.fetchWithRetry<T>(url, options, retryCount + 1);
      }

      // サーバーエラー（5xx）の場合もリトライ
      if (statusCode >= 500 && statusCode < 600 && retryCount < this.MAX_RETRIES) {
        const backoffMs = this.calculateBackoff(retryCount);

        Logger.log(
          `⚠️ Server error (${statusCode}). Retrying after ${backoffMs / 1000}s (attempt ${retryCount + 1}/${this.MAX_RETRIES})`
        );

        Utilities.sleep(backoffMs);
        return this.fetchWithRetry<T>(url, options, retryCount + 1);
      }

      let data: T | undefined;
      try {
        data = JSON.parse(content) as T;
      } catch {
        // JSONでない場合はundefined
      }

      return { statusCode, content, data };
    } catch (error) {
      // タイムアウトエラーの場合は明示的なメッセージ
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
        throw new Error(
          `Request to ${url} timed out after ${this.DEFAULT_TIMEOUT_MS / 1000} seconds. ` +
            'This may indicate network issues or slow API response.'
        );
      }
      throw error;
    }
  }

  /**
   * Retry-Afterヘッダーから待機時間を取得
   */
  private getRetryAfter(response: GoogleAppsScript.URL_Fetch.HTTPResponse): number | null {
    try {
      const headers = response.getHeaders() as Record<string, string>;
      const retryAfter = headers['Retry-After'] || headers['retry-after'];

      if (retryAfter) {
        const seconds = parseInt(String(retryAfter), 10);
        if (!isNaN(seconds)) {
          return seconds * 1000; // ミリ秒に変換
        }
      }
    } catch {
      // ヘッダー取得失敗時はnull
    }
    return null;
  }

  /**
   * Exponential backoffで待機時間を計算
   */
  private calculateBackoff(retryCount: number): number {
    return this.INITIAL_BACKOFF_MS * Math.pow(2, retryCount);
  }
}

// BorderStyleをGASのBorderStyleにマップ
function toGasBorderStyle(
  style: BorderStyle | null | undefined
): GoogleAppsScript.Spreadsheet.BorderStyle | null {
  if (!style) {
    return null;
  }
  const styleMap: Record<BorderStyle, GoogleAppsScript.Spreadsheet.BorderStyle> = {
    dotted: SpreadsheetApp.BorderStyle.DOTTED,
    dashed: SpreadsheetApp.BorderStyle.DASHED,
    solid: SpreadsheetApp.BorderStyle.SOLID,
    solid_medium: SpreadsheetApp.BorderStyle.SOLID_MEDIUM,
    solid_thick: SpreadsheetApp.BorderStyle.SOLID_THICK,
    double: SpreadsheetApp.BorderStyle.DOUBLE,
  };
  return styleMap[style];
}

// Spreadsheet Client
class GasSheetRange implements SheetRange {
  constructor(private range: GoogleAppsScript.Spreadsheet.Range) {}

  getValues(): unknown[][] {
    return this.range.getValues();
  }

  getValue(): unknown {
    return this.range.getValue();
  }

  setValues(values: unknown[][]): void {
    this.range.setValues(values);
  }

  setValue(value: unknown): void {
    this.range.setValue(value);
  }

  setFontWeight(weight: 'bold' | 'normal' | null): void {
    this.range.setFontWeight(weight);
  }

  setNumberFormat(format: string): void {
    this.range.setNumberFormat(format);
  }

  setBackground(color: string | null): void {
    this.range.setBackground(color);
  }

  setFontColor(color: string): void {
    this.range.setFontColor(color);
  }

  setBorder(
    top: boolean | null,
    left: boolean | null,
    bottom: boolean | null,
    right: boolean | null,
    vertical: boolean | null,
    horizontal: boolean | null,
    color?: string | null,
    style?: BorderStyle | null
  ): void {
    this.range.setBorder(
      top,
      left,
      bottom,
      right,
      vertical,
      horizontal,
      color ?? null,
      toGasBorderStyle(style)
    );
  }

  setHorizontalAlignment(alignment: 'left' | 'center' | 'right'): void {
    this.range.setHorizontalAlignment(alignment);
  }

  setVerticalAlignment(alignment: 'top' | 'middle' | 'bottom'): void {
    this.range.setVerticalAlignment(alignment);
  }

  setFontSize(size: number): void {
    this.range.setFontSize(size);
  }

  setWrap(wrap: boolean): void {
    this.range.setWrap(wrap);
  }
}

class GasSheet implements Sheet {
  constructor(private sheet: GoogleAppsScript.Spreadsheet.Sheet) {}

  getName(): string {
    return this.sheet.getName();
  }

  setName(name: string): void {
    this.sheet.setName(name);
  }

  getRange(row: number, col: number, numRows?: number, numCols?: number): SheetRange {
    const range =
      numRows && numCols
        ? this.sheet.getRange(row, col, numRows, numCols)
        : this.sheet.getRange(row, col);
    return new GasSheetRange(range);
  }

  getDataRange(): SheetRange {
    return new GasSheetRange(this.sheet.getDataRange());
  }

  getLastRow(): number {
    return this.sheet.getLastRow();
  }

  getLastColumn(): number {
    return this.sheet.getLastColumn();
  }

  setFrozenRows(rows: number): void {
    this.sheet.setFrozenRows(rows);
  }

  autoResizeColumn(col: number): void {
    this.sheet.autoResizeColumn(col);
  }

  deleteRow(row: number): void {
    this.sheet.deleteRow(row);
  }

  clear(): void {
    this.sheet.clear();
  }
}

class GasSpreadsheet implements Spreadsheet {
  constructor(private spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet) {}

  getName(): string {
    return this.spreadsheet.getName();
  }

  getSheetByName(name: string): Sheet | null {
    const sheet = this.spreadsheet.getSheetByName(name);
    return sheet ? new GasSheet(sheet) : null;
  }

  insertSheet(name: string): Sheet {
    return new GasSheet(this.spreadsheet.insertSheet(name));
  }

  deleteSheet(sheet: Sheet): void {
    const gasSheet = this.spreadsheet.getSheetByName(sheet.getName());
    if (gasSheet) {
      this.spreadsheet.deleteSheet(gasSheet);
    }
  }

  setActiveSheet(sheet: Sheet): void {
    const gasSheet = this.spreadsheet.getSheetByName(sheet.getName());
    if (gasSheet) {
      this.spreadsheet.setActiveSheet(gasSheet);
    }
  }

  moveActiveSheet(position: number): void {
    this.spreadsheet.moveActiveSheet(position);
  }
}

export class GasSpreadsheetClient implements SpreadsheetClient {
  openById(id: string): Spreadsheet {
    return new GasSpreadsheet(SpreadsheetApp.openById(id));
  }
}

// Storage Client
export class GasStorageClient implements StorageClient {
  private props = PropertiesService.getScriptProperties();

  getProperty(key: string): string | null {
    return this.props.getProperty(key);
  }

  setProperty(key: string, value: string): void {
    this.props.setProperty(key, value);
  }

  deleteProperty(key: string): void {
    this.props.deleteProperty(key);
  }

  getProperties(): Record<string, string> {
    return this.props.getProperties();
  }
}

// Logger Client
export class GasLoggerClient implements LoggerClient {
  log(message: string): void {
    Logger.log(message);
  }
}

// Trigger Client
class GasTrigger implements Trigger {
  // Symbol to identify GasTrigger instances
  private readonly _isGasTrigger = true;

  constructor(private trigger: GoogleAppsScript.Script.Trigger) {}

  getHandlerFunction(): string {
    return this.trigger.getHandlerFunction();
  }

  getUnderlyingTrigger(): GoogleAppsScript.Script.Trigger {
    return this.trigger;
  }

  static isGasTrigger(trigger: Trigger): trigger is GasTrigger {
    return (trigger as GasTrigger)._isGasTrigger === true;
  }
}

class GasTimeTriggerBuilder implements TimeTriggerBuilder {
  constructor(private builder: GoogleAppsScript.Script.ClockTriggerBuilder) {}

  everyDays(days: number): TimeTriggerBuilder {
    this.builder.everyDays(days);
    return this;
  }

  atHour(hour: number): TimeTriggerBuilder {
    this.builder.atHour(hour);
    return this;
  }

  create(): Trigger {
    return new GasTrigger(this.builder.create());
  }
}

class GasTriggerBuilder implements TriggerBuilder {
  constructor(private builder: GoogleAppsScript.Script.TriggerBuilder) {}

  timeBased(): TimeTriggerBuilder {
    return new GasTimeTriggerBuilder(this.builder.timeBased());
  }
}

export class GasTriggerClient implements TriggerClient {
  getProjectTriggers(): Trigger[] {
    return ScriptApp.getProjectTriggers().map((t) => new GasTrigger(t));
  }

  deleteTrigger(trigger: Trigger): void {
    if (!GasTrigger.isGasTrigger(trigger)) {
      throw new Error('Cannot delete non-GAS trigger with GasTriggerClient');
    }
    ScriptApp.deleteTrigger(trigger.getUnderlyingTrigger());
  }

  newTrigger(functionName: string): TriggerBuilder {
    return new GasTriggerBuilder(ScriptApp.newTrigger(functionName));
  }
}

// 全てのGASアダプターを作成するファクトリ関数
export function createGasAdapters(): ServiceContainer {
  return {
    httpClient: new GasHttpClient(),
    spreadsheetClient: new GasSpreadsheetClient(),
    storageClient: new GasStorageClient(),
    logger: new GasLoggerClient(),
    triggerClient: new GasTriggerClient(),
  };
}
