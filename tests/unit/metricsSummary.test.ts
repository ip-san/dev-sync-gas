/**
 * Metrics Summary のユニットテスト
 *
 * リポジトリ別シートからの集計とSummaryシート作成のテスト
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { initializeContainer, resetContainer } from '../../src/container';
import { createMockContainer, MockSpreadsheet } from '../mocks';
import {
  createDevOpsSummaryFromRepositorySheets,
  createDevOpsSummaryFromMetrics,
} from '../../src/services/spreadsheet/metricsSummary';
import type { DevOpsMetrics } from '../../src/types';

describe('Metrics Summary', () => {
  let mockContainer: ReturnType<typeof createMockContainer>;

  beforeEach(() => {
    mockContainer = createMockContainer();
    initializeContainer(mockContainer);
  });

  afterEach(() => {
    resetContainer();
  });

  describe('createDevOpsSummaryFromRepositorySheets', () => {
    it('should create summary sheet from repository sheets', () => {
      const spreadsheet = mockContainer.spreadsheetClient.openById(
        mockContainer.spreadsheetId
      ) as MockSpreadsheet;

      // リポジトリ別シートを作成
      spreadsheet.addSheet('owner/repo1', [
        [
          '日付',
          'リポジトリ',
          'デプロイ頻度',
          'リードタイム (時間)',
          '変更障害率 (%)',
          'MTTR (時間)',
          'デプロイ回数',
          '期間開始',
          '期間終了',
        ],
        ['2024-01-01', 'owner/repo1', '1.5', 24.5, 5.0, 3.2, 3, '2023-12-25', '2024-01-01'],
        ['2024-01-02', 'owner/repo1', '2.0', 20.0, 3.0, 2.5, 4, '2023-12-26', '2024-01-02'],
      ]);

      spreadsheet.addSheet('owner/repo2', [
        [
          '日付',
          'リポジトリ',
          'デプロイ頻度',
          'リードタイム (時間)',
          '変更障害率 (%)',
          'MTTR (時間)',
          'デプロイ回数',
          '期間開始',
          '期間終了',
        ],
        ['2024-01-01', 'owner/repo2', '3.0', 15.0, 2.0, 1.5, 6, '2023-12-25', '2024-01-01'],
      ]);

      createDevOpsSummaryFromRepositorySheets(mockContainer.spreadsheetId, [
        'owner/repo1',
        'owner/repo2',
      ]);

      const summarySheet = spreadsheet.getSheetByName('DevOps Summary');
      expect(summarySheet).not.toBeNull();
      expect(summarySheet?.getLastRow()).toBeGreaterThanOrEqual(3); // ヘッダー + 2リポジトリ + 全体平均
    });

    it('should handle custom summary sheet name', () => {
      const spreadsheet = mockContainer.spreadsheetClient.openById(
        mockContainer.spreadsheetId
      ) as MockSpreadsheet;

      spreadsheet.addSheet('owner/repo1', [
        [
          '日付',
          'リポジトリ',
          'デプロイ頻度',
          'リードタイム (時間)',
          '変更障害率 (%)',
          'MTTR (時間)',
          'デプロイ回数',
          '期間開始',
          '期間終了',
        ],
        ['2024-01-01', 'owner/repo1', '1.5', 24.5, 5.0, 3.2, 3, '2023-12-25', '2024-01-01'],
      ]);

      createDevOpsSummaryFromRepositorySheets(
        mockContainer.spreadsheetId,
        ['owner/repo1'],
        'Custom Summary'
      );

      const summarySheet = spreadsheet.getSheetByName('Custom Summary');
      expect(summarySheet).not.toBeNull();
    });

    it('should handle empty repository sheets', () => {
      const spreadsheet = mockContainer.spreadsheetClient.openById(
        mockContainer.spreadsheetId
      ) as MockSpreadsheet;

      // 空のシート（ヘッダーのみ）
      spreadsheet.addSheet('owner/repo1', [
        [
          '日付',
          'リポジトリ',
          'デプロイ頻度',
          'リードタイム (時間)',
          '変更障害率 (%)',
          'MTTR (時間)',
          'デプロイ回数',
          '期間開始',
          '期間終了',
        ],
      ]);

      createDevOpsSummaryFromRepositorySheets(mockContainer.spreadsheetId, ['owner/repo1']);

      // 空のメトリクスなのでSummaryシートは作成されない（warningログのみ）
      const summarySheet = spreadsheet.getSheetByName('DevOps Summary');
      expect(summarySheet).toBeNull();
    });

    it('should clear existing summary sheet before creating new one', () => {
      const spreadsheet = mockContainer.spreadsheetClient.openById(
        mockContainer.spreadsheetId
      ) as MockSpreadsheet;

      // 既存のSummaryシート
      spreadsheet.addSheet('DevOps Summary', [
        ['Old', 'Data'],
        ['foo', 'bar'],
      ]);

      // リポジトリシート
      spreadsheet.addSheet('owner/repo1', [
        [
          '日付',
          'リポジトリ',
          'デプロイ頻度',
          'リードタイム (時間)',
          '変更障害率 (%)',
          'MTTR (時間)',
          'デプロイ回数',
          '期間開始',
          '期間終了',
        ],
        ['2024-01-01', 'owner/repo1', '1.5', 24.5, 5.0, 3.2, 3, '2023-12-25', '2024-01-01'],
      ]);

      createDevOpsSummaryFromRepositorySheets(mockContainer.spreadsheetId, ['owner/repo1']);

      const summarySheet = spreadsheet.getSheetByName('DevOps Summary');
      expect(summarySheet).not.toBeNull();
      // 古いデータはクリアされ、新しいデータが書き込まれている
      const data = summarySheet?.getDataRange().getValues();
      expect(data?.[0][0]).toBe('リポジトリ'); // ヘッダーが正しい
    });

    it('should include overall average for multiple repositories', () => {
      const spreadsheet = mockContainer.spreadsheetClient.openById(
        mockContainer.spreadsheetId
      ) as MockSpreadsheet;

      spreadsheet.addSheet('owner/repo1', [
        [
          '日付',
          'リポジトリ',
          'デプロイ頻度',
          'リードタイム (時間)',
          '変更障害率 (%)',
          'MTTR (時間)',
          'デプロイ回数',
          '期間開始',
          '期間終了',
        ],
        ['2024-01-01', 'owner/repo1', '1.0', 20.0, 5.0, 2.0, 2, '2023-12-25', '2024-01-01'],
      ]);

      spreadsheet.addSheet('owner/repo2', [
        [
          '日付',
          'リポジトリ',
          'デプロイ頻度',
          'リードタイム (時間)',
          '変更障害率 (%)',
          'MTTR (時間)',
          'デプロイ回数',
          '期間開始',
          '期間終了',
        ],
        ['2024-01-01', 'owner/repo2', '3.0', 10.0, 3.0, 1.0, 6, '2023-12-25', '2024-01-01'],
      ]);

      createDevOpsSummaryFromRepositorySheets(mockContainer.spreadsheetId, [
        'owner/repo1',
        'owner/repo2',
      ]);

      const summarySheet = spreadsheet.getSheetByName('DevOps Summary');
      const data = summarySheet?.getDataRange().getValues();

      // 全体平均行が含まれているはず（リンクセクションの前）
      const hasOverallRow = data?.some((row) => row[0] === '【全体平均】');
      expect(hasOverallRow).toBe(true);
    });

    it('should not include overall average for single repository', () => {
      const spreadsheet = mockContainer.spreadsheetClient.openById(
        mockContainer.spreadsheetId
      ) as MockSpreadsheet;

      spreadsheet.addSheet('owner/repo1', [
        [
          '日付',
          'リポジトリ',
          'デプロイ頻度',
          'リードタイム (時間)',
          '変更障害率 (%)',
          'MTTR (時間)',
          'デプロイ回数',
          '期間開始',
          '期間終了',
        ],
        ['2024-01-01', 'owner/repo1', '1.0', 20.0, 5.0, 2.0, 2, '2023-12-25', '2024-01-01'],
      ]);

      createDevOpsSummaryFromRepositorySheets(mockContainer.spreadsheetId, ['owner/repo1']);

      const summarySheet = spreadsheet.getSheetByName('DevOps Summary');
      const data = summarySheet?.getDataRange().getValues();

      // 全体平均行は含まれない
      const hasOverallRow = data?.some((row) => row[0] === '【全体平均】');
      expect(hasOverallRow).toBe(false);
    });
  });

  describe('createDevOpsSummaryFromMetrics', () => {
    it('should create summary sheet from metrics directly', () => {
      const metrics: DevOpsMetrics[] = [
        {
          date: '2024-01-01',
          repository: 'owner/repo1',
          deploymentFrequency: '1.5',
          leadTimeForChangesHours: 24.5,
          changeFailureRate: 5.0,
          meanTimeToRecoveryHours: 3.2,
          deploymentCount: 3,
          periodStart: '2023-12-25',
          periodEnd: '2024-01-01',
        },
        {
          date: '2024-01-02',
          repository: 'owner/repo1',
          deploymentFrequency: '2.0',
          leadTimeForChangesHours: 20.0,
          changeFailureRate: 3.0,
          meanTimeToRecoveryHours: 2.5,
          deploymentCount: 4,
          periodStart: '2023-12-26',
          periodEnd: '2024-01-02',
        },
        {
          date: '2024-01-01',
          repository: 'owner/repo2',
          deploymentFrequency: '3.0',
          leadTimeForChangesHours: 15.0,
          changeFailureRate: 2.0,
          meanTimeToRecoveryHours: 1.5,
          deploymentCount: 6,
          periodStart: '2023-12-25',
          periodEnd: '2024-01-01',
        },
      ];

      createDevOpsSummaryFromMetrics(mockContainer.spreadsheetId, metrics);

      const spreadsheet = mockContainer.spreadsheetClient.openById(
        mockContainer.spreadsheetId
      ) as MockSpreadsheet;
      const summarySheet = spreadsheet.getSheetByName('DevOps Summary');

      expect(summarySheet).not.toBeNull();
      expect(summarySheet?.getLastRow()).toBeGreaterThanOrEqual(3); // ヘッダー + 2リポジトリ + 全体平均
    });

    it('should handle empty metrics array', () => {
      createDevOpsSummaryFromMetrics(mockContainer.spreadsheetId, []);

      const spreadsheet = mockContainer.spreadsheetClient.openById(
        mockContainer.spreadsheetId
      ) as MockSpreadsheet;
      const summarySheet = spreadsheet.getSheetByName('DevOps Summary');

      // 空のメトリクスなのでSummaryシートは作成されない
      expect(summarySheet).toBeNull();
    });

    it('should add repository links section', () => {
      const metrics: DevOpsMetrics[] = [
        {
          date: '2024-01-01',
          repository: 'owner/repo1',
          deploymentFrequency: '1.0',
          leadTimeForChangesHours: 20.0,
          changeFailureRate: 5.0,
          meanTimeToRecoveryHours: 2.0,
          deploymentCount: 2,
          periodStart: '2023-12-25',
          periodEnd: '2024-01-01',
        },
      ];

      createDevOpsSummaryFromMetrics(mockContainer.spreadsheetId, metrics);

      const spreadsheet = mockContainer.spreadsheetClient.openById(
        mockContainer.spreadsheetId
      ) as MockSpreadsheet;
      const summarySheet = spreadsheet.getSheetByName('DevOps Summary');
      const data = summarySheet?.getDataRange().getValues();

      // リンクセクションが含まれている
      const hasLinkSection = data?.some((row) => row[0] === '詳細データ');
      expect(hasLinkSection).toBe(true);
    });

    it('should deduplicate repositories from metrics', () => {
      const metrics: DevOpsMetrics[] = [
        {
          date: '2024-01-01',
          repository: 'owner/repo1',
          deploymentFrequency: '1.0',
          leadTimeForChangesHours: 20.0,
          changeFailureRate: 5.0,
          meanTimeToRecoveryHours: 2.0,
          deploymentCount: 2,
          periodStart: '2023-12-25',
          periodEnd: '2024-01-01',
        },
        {
          date: '2024-01-02',
          repository: 'owner/repo1', // 同じリポジトリ
          deploymentFrequency: '1.5',
          leadTimeForChangesHours: 18.0,
          changeFailureRate: 4.0,
          meanTimeToRecoveryHours: 1.8,
          deploymentCount: 3,
          periodStart: '2023-12-26',
          periodEnd: '2024-01-02',
        },
      ];

      createDevOpsSummaryFromMetrics(mockContainer.spreadsheetId, metrics);

      const spreadsheet = mockContainer.spreadsheetClient.openById(
        mockContainer.spreadsheetId
      ) as MockSpreadsheet;
      const summarySheet = spreadsheet.getSheetByName('DevOps Summary');
      const data = summarySheet?.getDataRange().getValues();

      // リポジトリは1つだけ表示される
      const repoRows = data?.filter((row) => row[0] === 'owner/repo1');
      expect(repoRows?.length).toBe(1);
    });
  });
});
