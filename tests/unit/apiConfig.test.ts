/**
 * API設定のテスト
 */

import { describe, it, expect } from 'bun:test';
import {
  DEFAULT_MAX_PAGES,
  PER_PAGE,
  DEFAULT_PAGE_SIZE,
  DEFAULT_BATCH_SIZE,
  MAX_PR_CHAIN_DEPTH,
  MAX_RETRIES,
  RETRY_DELAY_MS,
  INITIAL_BACKOFF_MS,
  STATUS_FETCH_WARNING_THRESHOLD,
  LEAD_TIME_DEPLOY_MATCH_THRESHOLD_HOURS,
  SHEET_NAMES,
  SPREADSHEET_ID_DISPLAY_LENGTH,
  AUDIT_LOG_VALUE_MAX_LENGTH,
  REPOSITORY_NAME_MAX_LENGTH,
  PRIVATE_KEY_PREVIEW_LENGTH,
  DECIMAL_PRECISION_MULTIPLIER,
  getApiConfig,
} from '../../src/config/apiConfig';

describe('apiConfig', () => {
  describe('定数値のテスト', () => {
    it('ページネーション設定の値が正しい', () => {
      expect(DEFAULT_MAX_PAGES).toBe(5);
      expect(PER_PAGE).toBe(100);
      expect(DEFAULT_PAGE_SIZE).toBe(100);
      expect(DEFAULT_BATCH_SIZE).toBe(10);
      expect(MAX_PR_CHAIN_DEPTH).toBe(5);
    });

    it('リトライ設定の値が正しい', () => {
      expect(MAX_RETRIES).toBe(3);
      expect(RETRY_DELAY_MS).toBe(1000);
      expect(INITIAL_BACKOFF_MS).toBe(1000);
    });

    it('警告・しきい値設定の値が正しい', () => {
      expect(STATUS_FETCH_WARNING_THRESHOLD).toBe(50);
      expect(LEAD_TIME_DEPLOY_MATCH_THRESHOLD_HOURS).toBe(24);
    });

    it('表示・フォーマット設定の値が正しい', () => {
      expect(SPREADSHEET_ID_DISPLAY_LENGTH).toBe(10);
      expect(AUDIT_LOG_VALUE_MAX_LENGTH).toBe(200);
      expect(REPOSITORY_NAME_MAX_LENGTH).toBe(100);
      expect(PRIVATE_KEY_PREVIEW_LENGTH).toBe(100);
      expect(DECIMAL_PRECISION_MULTIPLIER).toBe(10);
    });
  });

  describe('SHEET_NAMES', () => {
    it('すべてのシート名が定義されている', () => {
      expect(SHEET_NAMES.CYCLE_TIME).toBe('サイクルタイム');
      expect(SHEET_NAMES.CODING_TIME).toBe('コーディング時間');
      expect(SHEET_NAMES.REWORK_RATE).toBe('手戻り率');
      expect(SHEET_NAMES.REVIEW_EFFICIENCY).toBe('レビュー効率');
      expect(SHEET_NAMES.PR_SIZE).toBe('PRサイズ');
      expect(SHEET_NAMES.DASHBOARD).toBe('Dashboard');
      expect(SHEET_NAMES.DASHBOARD_TREND).toBe('Dashboard - Trend');
      expect(SHEET_NAMES.DEVOPS_SUMMARY).toBe('DevOps Summary');
    });

    it('シート名がユニークである', () => {
      const values = Object.values(SHEET_NAMES);
      const uniqueValues = new Set(values);
      expect(values.length).toBe(uniqueValues.size);
    });

    it('シート名が空文字列でない', () => {
      Object.values(SHEET_NAMES).forEach((name) => {
        expect(name.length).toBeGreaterThan(0);
      });
    });

    it('シート名がGoogleスプレッドシートの制限内（100文字以下）', () => {
      Object.values(SHEET_NAMES).forEach((name) => {
        expect(name.length).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('getApiConfig', () => {
    it('すべての設定値を返す', () => {
      const config = getApiConfig();

      expect(config.maxPages).toBe(DEFAULT_MAX_PAGES);
      expect(config.perPage).toBe(PER_PAGE);
      expect(config.pageSize).toBe(DEFAULT_PAGE_SIZE);
      expect(config.batchSize).toBe(DEFAULT_BATCH_SIZE);
      expect(config.maxPRChainDepth).toBe(MAX_PR_CHAIN_DEPTH);
      expect(config.maxRetries).toBe(MAX_RETRIES);
      expect(config.retryDelayMs).toBe(RETRY_DELAY_MS);
      expect(config.leadTimeMatchThresholdHours).toBe(LEAD_TIME_DEPLOY_MATCH_THRESHOLD_HOURS);
    });

    it('複数回呼び出しても同じ値を返す', () => {
      const config1 = getApiConfig();
      const config2 = getApiConfig();

      expect(config1).toEqual(config2);
    });

    it('返されるオブジェクトが正しい型を持つ', () => {
      const config = getApiConfig();

      expect(typeof config.maxPages).toBe('number');
      expect(typeof config.perPage).toBe('number');
      expect(typeof config.pageSize).toBe('number');
      expect(typeof config.batchSize).toBe('number');
      expect(typeof config.maxPRChainDepth).toBe('number');
      expect(typeof config.maxRetries).toBe('number');
      expect(typeof config.retryDelayMs).toBe('number');
      expect(typeof config.leadTimeMatchThresholdHours).toBe('number');
    });

    it('すべての値が正の数である', () => {
      const config = getApiConfig();

      expect(config.maxPages).toBeGreaterThan(0);
      expect(config.perPage).toBeGreaterThan(0);
      expect(config.pageSize).toBeGreaterThan(0);
      expect(config.batchSize).toBeGreaterThan(0);
      expect(config.maxPRChainDepth).toBeGreaterThan(0);
      expect(config.maxRetries).toBeGreaterThan(0);
      expect(config.retryDelayMs).toBeGreaterThan(0);
      expect(config.leadTimeMatchThresholdHours).toBeGreaterThan(0);
    });
  });

  describe('定数の合理性チェック', () => {
    it('PER_PAGEはGitHub APIの最大値（100）である', () => {
      expect(PER_PAGE).toBe(100);
    });

    it('DEFAULT_PAGE_SIZEはPER_PAGEと同じ値である', () => {
      expect(DEFAULT_PAGE_SIZE).toBe(PER_PAGE);
    });

    it('DEFAULT_BATCH_SIZEは1以上100以下である', () => {
      expect(DEFAULT_BATCH_SIZE).toBeGreaterThanOrEqual(1);
      expect(DEFAULT_BATCH_SIZE).toBeLessThanOrEqual(100);
    });

    it('MAX_PR_CHAIN_DEPTHは無限ループ防止のため適切な値である', () => {
      expect(MAX_PR_CHAIN_DEPTH).toBeGreaterThanOrEqual(3);
      expect(MAX_PR_CHAIN_DEPTH).toBeLessThanOrEqual(10);
    });

    it('MAX_RETRIESは過度に多くない', () => {
      expect(MAX_RETRIES).toBeGreaterThanOrEqual(1);
      expect(MAX_RETRIES).toBeLessThanOrEqual(5);
    });

    it('RETRY_DELAY_MSは適切な遅延時間である', () => {
      expect(RETRY_DELAY_MS).toBeGreaterThanOrEqual(100);
      expect(RETRY_DELAY_MS).toBeLessThanOrEqual(5000);
    });

    it('LEAD_TIME_DEPLOY_MATCH_THRESHOLD_HOURSは妥当な範囲である', () => {
      expect(LEAD_TIME_DEPLOY_MATCH_THRESHOLD_HOURS).toBeGreaterThanOrEqual(1);
      expect(LEAD_TIME_DEPLOY_MATCH_THRESHOLD_HOURS).toBeLessThanOrEqual(72);
    });
  });
});
