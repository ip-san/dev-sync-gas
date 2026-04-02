/**
 * Sheet Range implementation for Google Apps Script
 */

import type { BorderStyle, SheetRange } from '../../../interfaces';
import { toGasBorderStyle } from './border-style';

export class GasSheetRange implements SheetRange {
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

  setNote(note: string): void {
    this.range.setNote(note);
  }

  setHeaderWithLink(text: string, url: string): void {
    const fullText = `${text} 📖`;
    const linkStart = text.length + 1; // ' 📖'の📖の開始位置
    const linkEnd = fullText.length;

    const richText = SpreadsheetApp.newRichTextValue()
      .setText(fullText)
      .setLinkUrl(linkStart, linkEnd, url)
      .build();

    this.range.setRichTextValue(richText);
  }
}
