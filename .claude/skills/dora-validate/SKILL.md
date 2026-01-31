---
name: dora-validate
description: DORA metrics計算ロジックの正当性を検証し、公式基準との整合性をチェック
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob, WebFetch
---

# DORA metrics検証スキル

DORA metrics計算ロジックの正当性を検証します。

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
   - `src/utils/metrics/dora.ts`
   - `src/utils/metrics/extended.ts`

   チェック項目：
   - [ ] Deployment Frequency: マージ数/期間の計算は正しいか
   - [ ] Lead Time: 最初のコミット〜マージまでの時間計算は正しいか
   - [ ] CFR: (障害PR数 / 全PR数) × 100 の計算は正しいか
   - [ ] MTTR: 障害発生〜復旧までの平均時間計算は正しいか

4. **テストの確認**
   ```bash
   bun test tests/unit/metrics.test.ts
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

## 参考リンク
- DORA公式: https://dora.dev/
- State of DevOps Report: https://dora.dev/research/
