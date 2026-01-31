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

2. **自動チェックの実行**
   以下をすべて実行し、**すべてパスするまで**PRを作成しないでください：

   ```bash
   # Lintチェック
   bun run lint

   # フォーマットチェック
   bun run format:check

   # 型チェック
   bunx tsc --noEmit

   # テスト実行
   bun test

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
   - ESLint: PASS
   - Prettier: PASS
   - TypeScript: PASS
   - Tests: PASS
   - Build: PASS

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
