/**
 * Sheet implementation for Google Apps Script
 */

import type { Sheet, SheetRange, EmbeddedChart } from '../../../interfaces';
import { GasSheetRange } from './sheet-range';

export class GasSheet implements Sheet {
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

  getColumnWidth(col: number): number {
    return this.sheet.getColumnWidth(col);
  }

  setColumnWidth(col: number, width: number): void {
    this.sheet.setColumnWidth(col, width);
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
