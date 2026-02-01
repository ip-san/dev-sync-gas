import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  getIncidentLabels,
  setIncidentLabels,
  resetIncidentLabels,
} from '../../src/config/metrics';
import { setupTestContainer, teardownTestContainer } from '../helpers/setup';

describe('Incident Labels Configuration', () => {
  beforeEach(() => {
    setupTestContainer();
    resetIncidentLabels();
  });

  afterEach(() => {
    teardownTestContainer();
  });

  describe('getIncidentLabels', () => {
    it('デフォルトで["incident"]を返す', () => {
      const labels = getIncidentLabels();
      expect(labels).toEqual(['incident']);
    });

    it('設定されたラベルを返す', () => {
      setIncidentLabels(['bug', 'p0', 'critical']);
      const labels = getIncidentLabels();
      expect(labels).toEqual(['bug', 'p0', 'critical']);
    });

    it('空配列が設定された場合はデフォルト値を返す', () => {
      setIncidentLabels([]);
      const labels = getIncidentLabels();
      expect(labels).toEqual(['incident']);
    });
  });

  describe('setIncidentLabels', () => {
    it('ラベルを設定できる', () => {
      setIncidentLabels(['bug', 'hotfix']);
      expect(getIncidentLabels()).toEqual(['bug', 'hotfix']);
    });

    it('空配列を設定できる（デフォルト値が使われる）', () => {
      setIncidentLabels(['custom']);
      setIncidentLabels([]);
      expect(getIncidentLabels()).toEqual(['incident']);
    });
  });

  describe('resetIncidentLabels', () => {
    it('設定をリセットしてデフォルトに戻す', () => {
      setIncidentLabels(['custom', 'labels']);
      resetIncidentLabels();
      expect(getIncidentLabels()).toEqual(['incident']);
    });

    it('未設定の状態でリセットしてもエラーにならない', () => {
      resetIncidentLabels();
      expect(getIncidentLabels()).toEqual(['incident']);
    });
  });
});
