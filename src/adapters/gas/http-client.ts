/**
 * HTTP Client implementation for Google Apps Script
 */

import type { HttpClient, HttpRequestOptions, HttpResponse } from '../../interfaces';

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
        if (!Number.isNaN(seconds)) {
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
    return this.INITIAL_BACKOFF_MS * 2 ** retryCount;
  }
}
