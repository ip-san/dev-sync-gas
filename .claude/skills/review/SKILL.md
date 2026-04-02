---
name: review
description: コード変更をレビュー。Biome/tsc/test実行 + GAS固有・DORA・型安全性・テストの観点でチェック
allowed-tools: Bash Read Grep Glob
---

# コードレビュー

DevSyncGASプロジェクトのコード変更をレビューします。

## 実行手順

1. **変更内容の確認**
   ```bash
   git diff --name-only
   git diff
   ```

2. **自動チェックの実行**
   ```bash
   bun run check
   bunx tsc --noEmit
   bun test
   ```

3. **プロジェクト固有のチェック項目**

   ### GAS固有の注意点
   - [ ] グローバル関数は `global.functionName = functionName` でエクスポートされているか
   - [ ] `fetch` ではなく `UrlFetchApp.fetch` を使用しているか
   - [ ] シークレットは `PropertiesService.getScriptProperties()` で管理されているか

   ### DORA metrics関連
   - [ ] メトリクス計算ロジックに変更がある場合、単位（時間/日/週など）は正しいか
   - [ ] 閾値の変更がある場合、`src/config/doraThresholds.ts` と整合性があるか

   ### 型安全性
   - [ ] `any` 型の使用は最小限か
   - [ ] nullチェックは適切か

   ### テスト
   - [ ] 新機能にはテストが追加されているか
   - [ ] 既存テストが壊れていないか

   ### 依存ライブラリ（package.jsonに変更がある場合）
   - [ ] 追加パッケージは適切か（必要性、メンテナンス状況）
   - [ ] 非推奨パッケージを使用していないか

4. **レビュー結果の報告**

   ```
   ## レビュー結果

   ### 自動チェック
   - Biome (lint + format): PASS / FAIL (エラー数)
   - TypeScript: PASS / FAIL (エラー数)
   - Tests: PASS / FAIL

   ### 手動チェック
   - GAS固有: OK / 要確認
   - 型安全性: OK / 要確認
   - テストカバレッジ: OK / 要確認
   - 依存ライブラリ: OK / 要確認（変更がある場合）

   ### 指摘事項
   1. [ファイル名:行番号] 指摘内容

   ### 推奨事項（任意）
   - 改善提案
   ```
