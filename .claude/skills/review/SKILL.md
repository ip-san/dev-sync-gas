---
name: review
description: DevSyncGASプロジェクトのコード変更をレビューし、lint/test/型チェックを実行して問題点を報告
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob
---

# コードレビュースキル

DevSyncGASプロジェクトのコード変更をレビューします。

## 実行手順

1. **変更内容の確認**
   ```bash
   git diff --name-only
   git diff
   ```

2. **自動チェックの実行**
   以下のコマンドを順番に実行し、結果を報告してください：
   ```bash
   bun run lint
   bun run format:check
   bunx tsc --noEmit
   bun test
   ```

3. **プロジェクト固有のチェック項目**

   以下の観点でコードをレビューしてください：

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
   - [ ] 関数の戻り値型は明示されているか

   ### テスト
   - [ ] 新機能にはテストが追加されているか
   - [ ] 既存テストが壊れていないか

   ### 非推奨パターンのチェック
   以下の非推奨パターンが使用されていないか確認：
   - [ ] `var` の使用（`const`/`let` を使用すべき）
   - [ ] `==` / `!=` の使用（`===` / `!==` を使用すべき）
   - [ ] `arguments` オブジェクト（rest parameters `...args` を使用すべき）
   - [ ] `Function` コンストラクタ
   - [ ] `eval()` の使用
   - [ ] `with` 文の使用
   - [ ] 非推奨のTypeScript構文（`namespace`より`module`、`<Type>`よりas Type`）

   ### 依存ライブラリのチェック
   package.jsonに変更がある場合：
   - [ ] 追加されたパッケージは適切か（必要性、メンテナンス状況、セキュリティ）
   - [ ] 非推奨パッケージを使用していないか

4. **レビュー結果の報告**

   以下の形式で報告してください：

   ```
   ## レビュー結果

   ### 自動チェック
   - ESLint: PASS / FAIL (エラー数)
   - Prettier: PASS / FAIL
   - TypeScript: PASS / FAIL (エラー数)
   - Tests: PASS / FAIL

   ### 手動チェック
   - GAS固有: OK / 要確認
   - 型安全性: OK / 要確認
   - テストカバレッジ: OK / 要確認
   - 非推奨パターン: OK / 要確認
   - 依存ライブラリ: OK / 要確認（変更がある場合）

   ### 指摘事項
   1. [ファイル名:行番号] 指摘内容

   ### 推奨事項（任意）
   - 改善提案があれば記載
   ```
