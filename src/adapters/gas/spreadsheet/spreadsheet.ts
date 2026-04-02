/**
 * Spreadsheet implementation for Google Apps Script
 */

import type { Sheet, Spreadsheet } from '../../../interfaces';
import { GasSheet } from './sheet';

export class GasSpreadsheet implements Spreadsheet {
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
