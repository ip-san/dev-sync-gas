---
name: dora-validate
description: DORA metrics計算ロジックの正当性を検証。公式基準との整合性チェック
disable-model-invocation: true
allowed-tools: Bash Read Grep Glob WebFetch
argument-hint: [metric-name]
---

# DORA metrics検証

DORA metrics計算ロジックの正当性を検証します。
引数でメトリクス名を指定すると、そのメトリクスのみ検証します（例: `/dora-validate lead-time`）。
引数なしの場合は全メトリクスを検証します。

対象メトリクス: $ARGUMENTS

## 実行手順

1. **現在の閾値設定を確認**
   `src/config/doraThresholds.ts` を読み取ってください。

2. **DORA公式ドキュメントとの整合性チェック**

   DORA公式の最新レポートから以下の基準を確認：
   - https://dora.dev/research/

   ### 4つのキーメトリクス

   | メトリクス | Elite | High | Medium | Low |
   |-----------|-------|------|--------|-----|
   | Deployment Frequency | オンデマンド（1日複数回） | 1日〜1週間に1回 | 1週間〜1ヶ月に1回 | 1ヶ月以上 |
   | Lead Time for Changes | 1日未満 | 1日〜1週間 | 1週間〜1ヶ月 | 1ヶ月以上 |
   | Change Failure Rate | 5%未満 | 5%〜10% | 10%〜15% | 15%以上 |
   | Mean Time to Recovery | 1時間未満 | 1日未満 | 1日〜1週間 | 1週間以上 |

3. **計算ロジックの検証**

   以下のファイルを確認し、計算が正しいか検証：
   - `src/utils/metrics/dora/`

   チェック項目：
   - [ ] Deployment Frequency: デプロイ数/期間の計算は正しいか
   - [ ] Lead Time: PR作成〜本番反映までの時間計算は正しいか
   - [ ] CFR: (障害デプロイ数 / 全デプロイ数) × 100 の計算は正しいか
   - [ ] MTTR: 障害発生〜復旧までの平均時間計算は正しいか

4. **テストの確認**
   ```bash
   bun test
   ```

5. **検証結果の報告**

   ```
   ## DORA Metrics検証結果

   ### 閾値設定
   - 公式ドキュメントとの整合性: OK / 要更新

   ### 計算ロジック
   - Deployment Frequency: 正確 / 要修正
   - Lead Time for Changes: 正確 / 要修正
   - Change Failure Rate: 正確 / 要修正
   - Mean Time to Recovery: 正確 / 要修正

   ### テスト
   - テストカバレッジ: 十分 / 追加推奨

   ### 推奨事項
   - (あれば記載)
   ```
