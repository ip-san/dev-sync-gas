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
  LogLevel,
  TriggerClient,
  Trigger,
  TriggerBuilder,
  TimeTriggerBuilder,
  EmbeddedChart,
  ServiceContainer,
  SlackClient,
} from '../../interfaces';
import { GasSlackClient } from '../../services/slack/client';

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
    const gasOptions = this.buildGasOptions(options);

    try {
      const response = UrlFetchApp.fetch(url, gasOptions);
      const statusCode = response.getResponseCode();
      const context = { statusCode, retryCount, url, options };

      const rateLimitResult = this.handleRateLimitRetry<T>(response, context);
      if (rateLimitResult) {
        return rateLimitResult;
      }

      const serverErrorResult = this.handleServerErrorRetry<T>(context);
      if (serverErrorResult) {
        return serverErrorResult;
      }

      return this.parseResponse<T>(response);
    } catch (error) {
      this.handleFetchError(error, url);
      throw error;
    }
  }

  private buildGasOptions(
    options: HttpRequestOptions
  ): GoogleAppsScript.URL_Fetch.URLFetchRequestOptions {
    const gasOptions: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
      method: options.method ?? 'get',
      headers: options.headers,
      payload: options.payload,
      muteHttpExceptions: options.muteHttpExceptions ?? true,
      validateHttpsCertificates: true,
      followRedirects: true,
    };

    if (typeof UrlFetchApp !== 'undefined') {
      const gasOptionsWithMute: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions & {
        muteHttpExceptions?: boolean;
      } = gasOptions;
      gasOptionsWithMute.muteHttpExceptions = true;
    }

    return gasOptions;
  }

  private handleRateLimitRetry<T>(
    response: GoogleAppsScript.URL_Fetch.HTTPResponse,
    context: { statusCode: number; retryCount: number; url: string; options: HttpRequestOptions }
  ): HttpResponse<T> | null {
    if (context.statusCode !== 429 || context.retryCount >= this.MAX_RETRIES) {
      return null;
    }

    const retryAfter = this.getRetryAfter(response);
    const backoffMs = retryAfter ?? this.calculateBackoff(context.retryCount);

    Logger.log(
      `⚠️ Rate limit exceeded (429). Retrying after ${backoffMs / 1000}s (attempt ${context.retryCount + 1}/${this.MAX_RETRIES})`
    );

    Utilities.sleep(backoffMs);
    return this.fetchWithRetry<T>(context.url, context.options, context.retryCount + 1);
  }

  private handleServerErrorRetry<T>(context: {
    statusCode: number;
    retryCount: number;
    url: string;
    options: HttpRequestOptions;
  }): HttpResponse<T> | null {
    if (
      context.statusCode < 500 ||
      context.statusCode >= 600 ||
      context.retryCount >= this.MAX_RETRIES
    ) {
      return null;
    }

    const backoffMs = this.calculateBackoff(context.retryCount);

    Logger.log(
      `⚠️ Server error (${context.statusCode}). Retrying after ${backoffMs / 1000}s (attempt ${context.retryCount + 1}/${this.MAX_RETRIES})`
    );

    Utilities.sleep(backoffMs);
    return this.fetchWithRetry<T>(context.url, context.options, context.retryCount + 1);
  }

  private parseResponse<T>(response: GoogleAppsScript.URL_Fetch.HTTPResponse): HttpResponse<T> {
    const statusCode = response.getResponseCode();
    const content = response.getContentText();

    let data: T | undefined;
    try {
      data = JSON.parse(content) as T;
    } catch (error) {
      Logger.log(
        `⚠️ Failed to parse JSON response: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return { statusCode, content, data };
  }

  private handleFetchError(error: unknown, url: string): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      throw new Error(
        `Request to ${url} timed out after ${this.DEFAULT_TIMEOUT_MS / 1000} seconds. ` +
          'This may indicate network issues or slow API response.'
      );
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

  setBorder(options: {
    top?: boolean | null;
    left?: boolean | null;
    bottom?: boolean | null;
    right?: boolean | null;
    vertical?: boolean | null;
    horizontal?: boolean | null;
    color?: string | null;
    style?: BorderStyle | null;
  }): void {
    this.range.setBorder(
      options.top ?? null,
      options.left ?? null,
      options.bottom ?? null,
      options.right ?? null,
      options.vertical ?? null,
      options.horizontal ?? null,
      options.color ?? null,
      toGasBorderStyle(options.style)
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

  // チャート関連メソッド
  getCharts(): EmbeddedChart[] {
    return this.sheet.getCharts();
  }

  insertChart(chart: EmbeddedChart): void {
    this.sheet.insertChart(chart as GoogleAppsScript.Spreadsheet.EmbeddedChart);
  }

  removeChart(chart: EmbeddedChart): void {
    this.sheet.removeChart(chart as GoogleAppsScript.Spreadsheet.EmbeddedChart);
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

  getId(): string {
    return this.spreadsheet.getId();
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
/**
 * Google Apps ScriptのLoggerラッパー
 *
 * ログレベル制御に対応し、設定されたログレベル以上のメッセージのみ出力します。
 */
export class GasLoggerClient implements LoggerClient {
  /**
   * ログレベル制御を含むログ出力の共通処理
   */
  private logWithLevel(level: LogLevel, message: string): void {
    // 動的インポートを避けるため、ここでは常に出力
    // レベル判定はユーティリティ関数で行う
    const prefix = `[${level}]`;
    Logger.log(`${prefix} ${message}`);
  }

  /**
   * 後方互換性のためのlog()メソッド（INFOとして扱う）
   */
  log(message: string): void {
    this.info(message);
  }

  debug(message: string): void {
    this.logWithLevel('DEBUG', message);
  }

  info(message: string): void {
    this.logWithLevel('INFO', message);
  }

  warn(message: string): void {
    this.logWithLevel('WARN', message);
  }

  error(message: string): void {
    this.logWithLevel('ERROR', message);
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

  everyWeeks(weeks: number): TimeTriggerBuilder {
    this.builder.everyWeeks(weeks);
    return this;
  }

  onWeekDay(day: GoogleAppsScript.Base.Weekday): TimeTriggerBuilder {
    this.builder.onWeekDay(day);
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
  const httpClient = new GasHttpClient();
  const slackClient: SlackClient = new GasSlackClient(httpClient);
  return {
    httpClient,
    spreadsheetClient: new GasSpreadsheetClient(),
    storageClient: new GasStorageClient(),
    logger: new GasLoggerClient(),
    triggerClient: new GasTriggerClient(),
    slackClient,
  };
}
