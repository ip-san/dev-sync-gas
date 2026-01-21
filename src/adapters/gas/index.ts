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
  StorageClient,
  LoggerClient,
  TriggerClient,
  Trigger,
  TriggerBuilder,
  TimeTriggerBuilder,
} from "../../interfaces";

// HTTP Client
export class GasHttpClient implements HttpClient {
  fetch<T = unknown>(url: string, options: HttpRequestOptions = {}): HttpResponse<T> {
    const gasOptions: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
      method: options.method ?? "get",
      headers: options.headers,
      payload: options.payload,
      muteHttpExceptions: options.muteHttpExceptions ?? true,
    };

    const response = UrlFetchApp.fetch(url, gasOptions);
    const statusCode = response.getResponseCode();
    const content = response.getContentText();

    let data: T | undefined;
    try {
      data = JSON.parse(content) as T;
    } catch {
      // JSONでない場合はundefined
    }

    return { statusCode, content, data };
  }
}

// Spreadsheet Client
class GasSheetRange implements SheetRange {
  constructor(private range: GoogleAppsScript.Spreadsheet.Range) {}

  getValues(): unknown[][] {
    return this.range.getValues();
  }

  setValues(values: unknown[][]): void {
    this.range.setValues(values);
  }

  setFontWeight(weight: string): void {
    this.range.setFontWeight(weight);
  }

  setNumberFormat(format: string): void {
    this.range.setNumberFormat(format);
  }
}

class GasSheet implements Sheet {
  constructor(private sheet: GoogleAppsScript.Spreadsheet.Sheet) {}

  getName(): string {
    return this.sheet.getName();
  }

  getRange(row: number, col: number, numRows?: number, numCols?: number): SheetRange {
    const range = numRows && numCols
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
      throw new Error("Cannot delete non-GAS trigger with GasTriggerClient");
    }
    ScriptApp.deleteTrigger(trigger.getUnderlyingTrigger());
  }

  newTrigger(functionName: string): TriggerBuilder {
    return new GasTriggerBuilder(ScriptApp.newTrigger(functionName));
  }
}

// 全てのGASアダプターを作成するファクトリ関数
export function createGasAdapters() {
  return {
    httpClient: new GasHttpClient(),
    spreadsheetClient: new GasSpreadsheetClient(),
    storageClient: new GasStorageClient(),
    logger: new GasLoggerClient(),
    triggerClient: new GasTriggerClient(),
  };
}
