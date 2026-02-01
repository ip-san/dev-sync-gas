/**
 * 抽象インターフェース定義
 * GAS固有APIへの依存を排除し、テスト可能な構造にする
 */

// HTTP通信の抽象化
export interface HttpRequestOptions {
  method?: 'get' | 'post' | 'put' | 'patch' | 'delete';
  headers?: Record<string, string>;
  payload?: string;
  muteHttpExceptions?: boolean;
}

export interface HttpResponse<T = unknown> {
  statusCode: number;
  content: string;
  data?: T;
}

export interface HttpClient {
  fetch<T = unknown>(url: string, options?: HttpRequestOptions): HttpResponse<T>;
}

// スプレッドシートの抽象化

/** Border設定オプション */
export interface BorderOptions {
  top?: boolean | null;
  left?: boolean | null;
  bottom?: boolean | null;
  right?: boolean | null;
  vertical?: boolean | null;
  horizontal?: boolean | null;
  color?: string | null;
  style?: BorderStyle | null;
}

export interface SheetRange {
  getValues(): unknown[][];
  getValue(): unknown;
  setValues(values: unknown[][]): void;
  setValue(value: unknown): void;
  setFontWeight(weight: 'bold' | 'normal' | null): void;
  setNumberFormat(format: string): void;
  // デザイン用メソッド
  setBackground(color: string | null): void;
  setFontColor(color: string): void;
  setBorder(options: BorderOptions): void;
  setHorizontalAlignment(alignment: 'left' | 'center' | 'right'): void;
  setVerticalAlignment(alignment: 'top' | 'middle' | 'bottom'): void;
  setFontSize(size: number): void;
  setWrap(wrap: boolean): void;
}

export type BorderStyle = 'dotted' | 'dashed' | 'solid' | 'solid_medium' | 'solid_thick' | 'double';

export interface Sheet {
  getName(): string;
  setName(name: string): void;
  getRange(row: number, col: number, numRows?: number, numCols?: number): SheetRange;
  getDataRange(): SheetRange;
  getLastRow(): number;
  getLastColumn(): number;
  setFrozenRows(rows: number): void;
  autoResizeColumn(col: number): void;
  deleteRow(row: number): void;
  clear(): void;
}

export interface Spreadsheet {
  getName(): string;
  getSheetByName(name: string): Sheet | null;
  insertSheet(name: string): Sheet;
  deleteSheet(sheet: Sheet): void;
  setActiveSheet(sheet: Sheet): void;
  moveActiveSheet(position: number): void;
}

export interface SpreadsheetClient {
  openById(id: string): Spreadsheet;
}

// ストレージの抽象化
export interface StorageClient {
  getProperty(key: string): string | null;
  setProperty(key: string, value: string): void;
  deleteProperty(key: string): void;
  getProperties(): Record<string, string>;
}

// ロガーの抽象化
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LoggerClient {
  log(message: string): void; // 後方互換性のため維持（INFOとして扱う）
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

// トリガーの抽象化
export interface Trigger {
  getHandlerFunction(): string;
}

export interface TriggerBuilder {
  timeBased(): TimeTriggerBuilder;
}

export interface TimeTriggerBuilder {
  everyDays(days: number): TimeTriggerBuilder;
  atHour(hour: number): TimeTriggerBuilder;
  create(): Trigger;
}

export interface TriggerClient {
  getProjectTriggers(): Trigger[];
  deleteTrigger(trigger: Trigger): void;
  newTrigger(functionName: string): TriggerBuilder;
}

// サービスコンテナの型
export interface ServiceContainer {
  httpClient: HttpClient;
  spreadsheetClient: SpreadsheetClient;
  storageClient: StorageClient;
  logger: LoggerClient;
  triggerClient: TriggerClient;
}
