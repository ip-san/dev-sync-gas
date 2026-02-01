/**
 * spreadsheet.ts のユニットテスト
 *
 * リポジトリ別シート構造のテスト
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  writeMetricsToRepositorySheet,
  writeMetricsToAllRepositorySheets,
  groupMetricsByRepository,
  getRepositorySheetName,
} from '../../src/services/spreadsheet';
import { setupTestContainer, teardownTestContainer, type TestContainer } from '../helpers/setup';
import type { DevOpsMetrics } from '../../src/types';
import { MockSheet } from '../mocks';

describe('spreadsheet (repository-per-sheet)', () => {
  let container: TestContainer;

  beforeEach(() => {
    container = setupTestContainer();
  });

  afterEach(() => {
    teardownTestContainer();
  });

  describe('getRepositorySheetName', () => {
    it('リポジトリ名をそのままシート名として返す', () => {
      expect(getRepositorySheetName('owner/repo')).toBe('owner/repo');
    });
  });

  describe('groupMetricsByRepository', () => {
    it('リポジトリごとにメトリクスをグループ化する', () => {
      const metrics: DevOpsMetrics[] = [
        {
          date: '2024-01-01',
          repository: 'owner/repo1',
          deploymentCount: 10,
          deploymentFrequency: 'daily',
          leadTimeForChangesHours: 2.5,
          totalDeployments: 12,
          failedDeployments: 2,
          changeFailureRate: 16.7,
          meanTimeToRecoveryHours: 1.5,
        },
        {
          date: '2024-01-01',
          repository: 'owner/repo2',
          deploymentCount: 5,
          deploymentFrequency: 'weekly',
          leadTimeForChangesHours: 3.0,
          totalDeployments: 6,
          failedDeployments: 1,
          changeFailureRate: 16.7,
          meanTimeToRecoveryHours: 2.0,
        },
        {
          date: '2024-01-02',
          repository: 'owner/repo1',
          deploymentCount: 8,
          deploymentFrequency: 'daily',
          leadTimeForChangesHours: 2.0,
          totalDeployments: 20,
          failedDeployments: 3,
          changeFailureRate: 15.0,
          meanTimeToRecoveryHours: 1.0,
        },
      ];

      const grouped = groupMetricsByRepository(metrics);

      expect(grouped.size).toBe(2);
      expect(grouped.get('owner/repo1')).toHaveLength(2);
      expect(grouped.get('owner/repo2')).toHaveLength(1);
    });

    it('空の配列を渡すと空のMapを返す', () => {
      const grouped = groupMetricsByRepository([]);
      expect(grouped.size).toBe(0);
    });
  });

  describe('writeMetricsToRepositorySheet', () => {
    const testMetrics: DevOpsMetrics[] = [
      {
        date: '2024-01-01',
        repository: 'owner/repo',
        deploymentCount: 10,
        deploymentFrequency: 'daily',
        leadTimeForChangesHours: 2.5,
        totalDeployments: 12,
        failedDeployments: 2,
        changeFailureRate: 16.7,
        meanTimeToRecoveryHours: 1.5,
      },
    ];

    it('リポジトリ別シートを作成してメトリクスを書き込む', () => {
      const spreadsheet = container.spreadsheetClient.addSpreadsheet('test-id');

      writeMetricsToRepositorySheet('test-id', 'owner/repo', testMetrics);

      const sheet = spreadsheet.getSheetByName('owner/repo') as MockSheet;
      expect(sheet).not.toBeNull();
      expect(sheet!.getFrozenRows()).toBe(1);
    });

    it('ヘッダー行を設定する', () => {
      const spreadsheet = container.spreadsheetClient.addSpreadsheet('test-id');

      writeMetricsToRepositorySheet('test-id', 'owner/repo', testMetrics);

      const sheet = spreadsheet.getSheetByName('owner/repo') as MockSheet;
      const data = sheet!.getData();
      expect(data[0]).toEqual([
        '日付',
        'デプロイ回数',
        'デプロイ頻度',
        'リードタイム (時間)',
        '総デプロイ数',
        '失敗デプロイ数',
        '変更障害率 (%)',
        '平均復旧時間 (時間)',
      ]);
    });

    it('メトリクスデータを書き込む', () => {
      const spreadsheet = container.spreadsheetClient.addSpreadsheet('test-id');

      writeMetricsToRepositorySheet('test-id', 'owner/repo', testMetrics);

      const sheet = spreadsheet.getSheetByName('owner/repo') as MockSheet;
      const data = sheet!.getData();
      expect(data[1]).toEqual(['2024-01-01', 10, 'daily', 2.5, 12, 2, 16.7, 1.5]);
    });

    it('MTTRがnullの場合はN/Aを書き込む', () => {
      const spreadsheet = container.spreadsheetClient.addSpreadsheet('test-id');
      const metricsWithNullMTTR: DevOpsMetrics[] = [
        {
          ...testMetrics[0],
          meanTimeToRecoveryHours: null,
        },
      ];

      writeMetricsToRepositorySheet('test-id', 'owner/repo', metricsWithNullMTTR);

      const sheet = spreadsheet.getSheetByName('owner/repo') as MockSheet;
      const data = sheet!.getData();
      expect(data[1][7]).toBe('N/A');
    });

    it('空のメトリクスの場合は何も書き込まない', () => {
      container.spreadsheetClient.addSpreadsheet('test-id');

      const result = writeMetricsToRepositorySheet('test-id', 'owner/repo', []);

      expect(result.written).toBe(0);
      expect(result.skipped).toBe(0);
    });

    it('重複チェックが有効な場合、既存データをスキップする', () => {
      const spreadsheet = container.spreadsheetClient.addSpreadsheet('test-id');
      spreadsheet.addSheet('owner/repo', [
        [
          '日付',
          'デプロイ回数',
          'デプロイ頻度',
          'リードタイム (時間)',
          '総デプロイ数',
          '失敗デプロイ数',
          '変更障害率 (%)',
          '平均復旧時間 (時間)',
        ],
        ['2024-01-01', 10, 'daily', 2.5, 12, 2, 16.7, 1.5],
      ]);

      const result = writeMetricsToRepositorySheet('test-id', 'owner/repo', testMetrics, {
        skipDuplicates: true,
      });

      expect(result.written).toBe(0);
      expect(result.skipped).toBe(1);
    });
  });

  describe('writeMetricsToAllRepositorySheets', () => {
    it('複数リポジトリのメトリクスを各シートに書き込む', () => {
      const spreadsheet = container.spreadsheetClient.addSpreadsheet('test-id');
      const metrics: DevOpsMetrics[] = [
        {
          date: '2024-01-01',
          repository: 'owner/repo1',
          deploymentCount: 10,
          deploymentFrequency: 'daily',
          leadTimeForChangesHours: 2.5,
          totalDeployments: 12,
          failedDeployments: 2,
          changeFailureRate: 16.7,
          meanTimeToRecoveryHours: 1.5,
        },
        {
          date: '2024-01-01',
          repository: 'owner/repo2',
          deploymentCount: 5,
          deploymentFrequency: 'weekly',
          leadTimeForChangesHours: 3.0,
          totalDeployments: 6,
          failedDeployments: 1,
          changeFailureRate: 16.7,
          meanTimeToRecoveryHours: 2.0,
        },
      ];

      writeMetricsToAllRepositorySheets('test-id', metrics);

      const sheet1 = spreadsheet.getSheetByName('owner/repo1');
      const sheet2 = spreadsheet.getSheetByName('owner/repo2');
      expect(sheet1).not.toBeNull();
      expect(sheet2).not.toBeNull();
    });

    it('空のメトリクスの場合は0リポジトリを処理', () => {
      container.spreadsheetClient.addSpreadsheet('test-id');

      const results = writeMetricsToAllRepositorySheets('test-id', []);

      expect(results.size).toBe(0);
      expect(container.logger.logs).toContain(
        '[INFO] 📊 Writing metrics to 0 repository sheets...'
      );
    });
  });
});
