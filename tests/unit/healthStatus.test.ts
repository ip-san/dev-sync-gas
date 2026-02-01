/**
 * ヘルスステータスのテスト
 */

import { describe, it, expect } from 'bun:test';
import {
  evaluateMetric,
  selectWorstStatus,
  evaluateOverallHealth,
} from '../../src/utils/healthStatus';

describe('healthStatus', () => {
  describe('evaluateMetric', () => {
    it('good閾値以下の場合はgoodを返す', () => {
      const status = evaluateMetric(10, { good: 24, warning: 168 });
      expect(status).toBe('good');
    });

    it('good閾値ちょうどの場合はgoodを返す', () => {
      const status = evaluateMetric(24, { good: 24, warning: 168 });
      expect(status).toBe('good');
    });

    it('warning閾値以下の場合はwarningを返す', () => {
      const status = evaluateMetric(100, { good: 24, warning: 168 });
      expect(status).toBe('warning');
    });

    it('warning閾値ちょうどの場合はwarningを返す', () => {
      const status = evaluateMetric(168, { good: 24, warning: 168 });
      expect(status).toBe('warning');
    });

    it('warning閾値を超える場合はcriticalを返す', () => {
      const status = evaluateMetric(200, { good: 24, warning: 168 });
      expect(status).toBe('critical');
    });

    it('nullの場合はnullを返す', () => {
      const status = evaluateMetric(null, { good: 24, warning: 168 });
      expect(status).toBeNull();
    });

    it('0の場合も正しく評価する', () => {
      const status = evaluateMetric(0, { good: 24, warning: 168 });
      expect(status).toBe('good');
    });

    it('負の値も正しく評価する', () => {
      const status = evaluateMetric(-10, { good: 24, warning: 168 });
      expect(status).toBe('good');
    });
  });

  describe('selectWorstStatus', () => {
    it('criticalが含まれる場合はcriticalを返す', () => {
      const status = selectWorstStatus(['good', 'warning', 'critical']);
      expect(status).toBe('critical');
    });

    it('criticalとnullが混在する場合はcriticalを返す', () => {
      const status = selectWorstStatus(['good', null, 'critical']);
      expect(status).toBe('critical');
    });

    it('warningのみの場合はwarningを返す', () => {
      const status = selectWorstStatus(['warning', 'warning']);
      expect(status).toBe('warning');
    });

    it('warningとgoodが混在する場合はwarningを返す', () => {
      const status = selectWorstStatus(['good', 'warning', 'good']);
      expect(status).toBe('warning');
    });

    it('goodのみの場合はgoodを返す', () => {
      const status = selectWorstStatus(['good', 'good']);
      expect(status).toBe('good');
    });

    it('すべてnullの場合はgoodを返す', () => {
      const status = selectWorstStatus([null, null, null]);
      expect(status).toBe('good');
    });

    it('空配列の場合はgoodを返す', () => {
      const status = selectWorstStatus([]);
      expect(status).toBe('good');
    });

    it('単一のステータスの場合はそれを返す', () => {
      expect(selectWorstStatus(['good'])).toBe('good');
      expect(selectWorstStatus(['warning'])).toBe('warning');
      expect(selectWorstStatus(['critical'])).toBe('critical');
    });
  });

  describe('evaluateOverallHealth', () => {
    it('すべてgoodの場合はgoodを返す', () => {
      const status = evaluateOverallHealth({
        leadTime: { value: 12, threshold: { good: 24, warning: 168 } },
        cycleTime: { value: 30, threshold: { good: 48, warning: 120 } },
      });
      expect(status).toBe('good');
    });

    it('一部warningの場合はwarningを返す', () => {
      const status = evaluateOverallHealth({
        leadTime: { value: 12, threshold: { good: 24, warning: 168 } },
        cycleTime: { value: 100, threshold: { good: 48, warning: 120 } },
      });
      expect(status).toBe('warning');
    });

    it('一部criticalの場合はcriticalを返す', () => {
      const status = evaluateOverallHealth({
        leadTime: { value: 200, threshold: { good: 24, warning: 168 } },
        cycleTime: { value: 30, threshold: { good: 48, warning: 120 } },
      });
      expect(status).toBe('critical');
    });

    it('nullを含む場合も正しく評価する', () => {
      const status = evaluateOverallHealth({
        leadTime: { value: null, threshold: { good: 24, warning: 168 } },
        cycleTime: { value: 30, threshold: { good: 48, warning: 120 } },
      });
      expect(status).toBe('good');
    });

    it('すべてnullの場合はgoodを返す', () => {
      const status = evaluateOverallHealth({
        leadTime: { value: null, threshold: { good: 24, warning: 168 } },
        cycleTime: { value: null, threshold: { good: 48, warning: 120 } },
      });
      expect(status).toBe('good');
    });

    it('複数の指標を同時に評価できる', () => {
      const status = evaluateOverallHealth({
        metric1: { value: 10, threshold: { good: 20, warning: 50 } },
        metric2: { value: 30, threshold: { good: 20, warning: 50 } },
        metric3: { value: 60, threshold: { good: 20, warning: 50 } },
      });
      expect(status).toBe('critical');
    });

    it('空のメトリクスの場合はgoodを返す', () => {
      const status = evaluateOverallHealth({});
      expect(status).toBe('good');
    });
  });
});
