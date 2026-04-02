/**
 * Spreadsheet Client implementation for Google Apps Script
 */

import type { Spreadsheet, SpreadsheetClient } from '../../../interfaces';
import { GasSpreadsheet } from './spreadsheet';

export class GasSpreadsheetClient implements SpreadsheetClient {
  openById(id: string): Spreadsheet {
    return new GasSpreadsheet(SpreadsheetApp.openById(id));
  }
}
