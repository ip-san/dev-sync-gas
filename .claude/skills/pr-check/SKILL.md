---
name: pr-check
description: PR作成前にlint/test/buildのセルフチェックを実行し、CI失敗を防ぐ
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob
---

# PR作成前チェックスキル

PRを作成する前にセルフチェックを行います。

## 実行手順

1. **ブランチ状態の確認**
   ```bash
   git status
   git log --oneline -5
   ```

2. **品質チェック一括実行**
   以下をすべて実行し、各結果を記録してください。
   エラーが発生しても途中で止めず、**すべてのチェックを最後まで実行**してください：

   ```bash
   # Biome check（lint + format一括）
   bun run check

   # 型チェック
   bunx tsc --noEmit

   # テスト実行
   bun test

   # 循環参照チェック
   bun run check:circular

   # 未使用コード検出（knip）
   bun run check:unused

   # 型カバレッジ
   bun run check:types

   # コピペ検出（jscpd）
   bun run cpd

   # ビルド確認
   bun run build
   ```

3. **エラーがある場合**
   - エラー内容を報告し、修正を提案してください
   - ユーザーの確認後、修正を実施してください
   - 修正後、再度チェックを実行してください

4. **すべてパスした場合**
   以下の形式で報告してください：

   ```
   ## PR作成準備完了

   ### チェック結果
   | チェック項目 | 結果 | 詳細 |
   |---|---|---|
   | Biome (lint + format) | PASS / FAIL | エラー数、warning数 |
   | TypeScript型チェック | PASS / FAIL | エラー数 |
   | テスト | PASS / FAIL | パス数 / 失敗数 |
   | 循環参照 | PASS / FAIL | 検出数 |
   | 未使用コード (knip) | PASS / FAIL | 検出数 |
   | 型カバレッジ | PASS / FAIL | カバレッジ率 |
   | コピペ検出 (jscpd) | PASS / FAIL | 重複率 |
   | ビルド | PASS / FAIL | - |

   ### 変更ファイル
   - file1.ts
   - file2.ts

   ### コミット内容
   - commit message 1
   - commit message 2

   PRを作成する準備ができました。
   ```

## 注意事項
- CIと同じチェックをローカルで実行するため、PR作成後のCI失敗を防げます
- エラーがある状態でPRを作成しないでください
