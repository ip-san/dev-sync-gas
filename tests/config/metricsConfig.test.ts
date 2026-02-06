/**
 * メトリクス設定のテスト
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  getProductionBranchPattern,
  setProductionBranchPattern,
  resetProductionBranchPattern,
  getExcludeMetricsLabels,
  setExcludeMetricsLabels,
  resetExcludeMetricsLabels,
  getIncidentLabels,
  setIncidentLabels,
  resetIncidentLabels,
  getExcludePRSizeBaseBranches,
  setExcludePRSizeBaseBranches,
  resetExcludePRSizeBaseBranches,
} from '../../src/config/metrics';
import { initializeContainer } from '../../src/container';
import { createMockContainer } from '../mocks';

describe('metricsConfig', () => {
  let mocks: ReturnType<typeof createMockContainer>;

  beforeEach(() => {
    mocks = createMockContainer();
    initializeContainer(mocks);
  });

  describe('productionBranchPattern', () => {
    it('デフォルトはproductionを返す', () => {
      expect(getProductionBranchPattern()).toBe('production');
    });

    it('カスタムパターンを設定できる', () => {
      setProductionBranchPattern('main');
      expect(getProductionBranchPattern()).toBe('main');
    });

    it('リセットするとデフォルトに戻る', () => {
      setProductionBranchPattern('release');
      expect(getProductionBranchPattern()).toBe('release');

      resetProductionBranchPattern();
      expect(getProductionBranchPattern()).toBe('production');
    });

    it('複数回設定できる', () => {
      setProductionBranchPattern('staging');
      expect(getProductionBranchPattern()).toBe('staging');

      setProductionBranchPattern('main');
      expect(getProductionBranchPattern()).toBe('main');
    });
  });

  describe('excludeLabels', () => {
    it('デフォルトは["exclude-metrics"]を返す', () => {
      const labels = getExcludeMetricsLabels();
      expect(labels).toEqual(['exclude-metrics']);
    });

    it('カスタムラベルを設定できる', () => {
      setExcludeMetricsLabels(['bot', 'dependencies']);
      const labels = getExcludeMetricsLabels();
      expect(labels).toEqual(['bot', 'dependencies']);
    });

    it('空配列を設定した場合でもデフォルト値が返る', () => {
      setExcludeMetricsLabels([]);
      const labels = getExcludeMetricsLabels();
      // 空配列の場合はデフォルト値が返される
      expect(labels).toEqual(['exclude-metrics']);
    });

    it('リセットするとデフォルトに戻る', () => {
      setExcludeMetricsLabels(['custom-label']);
      expect(getExcludeMetricsLabels()).toEqual(['custom-label']);

      resetExcludeMetricsLabels();
      expect(getExcludeMetricsLabels()).toEqual(['exclude-metrics']);
    });

    it('複数のラベルを設定できる', () => {
      setExcludeMetricsLabels(['bot', 'dependencies', 'wontfix', 'duplicate']);
      const labels = getExcludeMetricsLabels();
      expect(labels.length).toBe(4);
      expect(labels).toContain('bot');
      expect(labels).toContain('dependencies');
    });
  });

  describe('incidentLabels', () => {
    it('デフォルトは["incident"]を返す', () => {
      const labels = getIncidentLabels();
      expect(labels).toEqual(['incident']);
    });

    it('カスタムラベルを設定できる', () => {
      setIncidentLabels(['bug', 'p0', 'critical']);
      const labels = getIncidentLabels();
      expect(labels).toEqual(['bug', 'p0', 'critical']);
    });

    it('空配列を設定した場合でもデフォルト値が返る', () => {
      setIncidentLabels([]);
      const labels = getIncidentLabels();
      // 空配列の場合はデフォルト値が返される
      expect(labels).toEqual(['incident']);
    });

    it('リセットするとデフォルトに戻る', () => {
      setIncidentLabels(['critical']);
      expect(getIncidentLabels()).toEqual(['critical']);

      resetIncidentLabels();
      expect(getIncidentLabels()).toEqual(['incident']);
    });

    it('複数のラベルを設定できる', () => {
      setIncidentLabels(['incident', 'bug', 'hotfix']);
      const labels = getIncidentLabels();
      expect(labels.length).toBe(3);
      expect(labels).toContain('incident');
      expect(labels).toContain('bug');
      expect(labels).toContain('hotfix');
    });
  });

  describe('excludePRSizeBaseBranches', () => {
    it('デフォルトは空配列を返す', () => {
      const branches = getExcludePRSizeBaseBranches();
      expect(branches).toEqual([]);
    });

    it('除外ブランチを設定できる', () => {
      setExcludePRSizeBaseBranches(['production', 'staging']);
      const branches = getExcludePRSizeBaseBranches();
      expect(branches).toEqual(['production', 'staging']);
    });

    it('空配列を設定できる', () => {
      setExcludePRSizeBaseBranches(['production']);
      expect(getExcludePRSizeBaseBranches()).toEqual(['production']);

      setExcludePRSizeBaseBranches([]);
      expect(getExcludePRSizeBaseBranches()).toEqual([]);
    });

    it('リセットすると空配列に戻る', () => {
      setExcludePRSizeBaseBranches(['production', 'staging', 'release']);
      expect(getExcludePRSizeBaseBranches()).toEqual(['production', 'staging', 'release']);

      resetExcludePRSizeBaseBranches();
      expect(getExcludePRSizeBaseBranches()).toEqual([]);
    });

    it('複数のブランチを設定できる', () => {
      setExcludePRSizeBaseBranches(['production', 'production-v1', 'staging', 'release']);
      const branches = getExcludePRSizeBaseBranches();
      expect(branches.length).toBe(4);
      expect(branches).toContain('production');
      expect(branches).toContain('staging');
      expect(branches).toContain('release');
    });
  });

  describe('複数設定の組み合わせ', () => {
    it('すべての設定を独立して管理できる', () => {
      setProductionBranchPattern('main');
      setExcludeMetricsLabels(['bot']);
      setIncidentLabels(['critical']);
      setExcludePRSizeBaseBranches(['production', 'staging']);

      expect(getProductionBranchPattern()).toBe('main');
      expect(getExcludeMetricsLabels()).toEqual(['bot']);
      expect(getIncidentLabels()).toEqual(['critical']);
      expect(getExcludePRSizeBaseBranches()).toEqual(['production', 'staging']);
    });

    it('個別にリセットできる', () => {
      setProductionBranchPattern('release');
      setExcludeMetricsLabels(['bot', 'test']);
      setIncidentLabels(['p0', 'p1']);
      setExcludePRSizeBaseBranches(['production']);

      resetProductionBranchPattern();
      expect(getProductionBranchPattern()).toBe('production');
      expect(getExcludeMetricsLabels()).toEqual(['bot', 'test']);
      expect(getIncidentLabels()).toEqual(['p0', 'p1']);
      expect(getExcludePRSizeBaseBranches()).toEqual(['production']);

      resetExcludeMetricsLabels();
      expect(getExcludeMetricsLabels()).toEqual(['exclude-metrics']);
      expect(getIncidentLabels()).toEqual(['p0', 'p1']);
      expect(getExcludePRSizeBaseBranches()).toEqual(['production']);

      resetIncidentLabels();
      expect(getIncidentLabels()).toEqual(['incident']);
      expect(getExcludePRSizeBaseBranches()).toEqual(['production']);

      resetExcludePRSizeBaseBranches();
      expect(getExcludePRSizeBaseBranches()).toEqual([]);
    });
  });
});
