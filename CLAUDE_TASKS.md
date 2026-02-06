# DevSyncGAS - タスク別フロー

開発作業の種類別に、推奨される作業フローを示します。

---

## 🆕 新機能実装

1. 要件確認 → 過剰機能を実装しない（要求された機能のみ）
2. 既存パターン確認 → Grep/Read で類似コード検索
3. 実装 → 必要最小限の変更、1回限りの処理には抽象化不要
4. テスト追加 → `bun test`
5. 品質チェック → `bun run check:all`
6. レビュー実行 → `/review`

**関連**: [CLAUDE_ARCH.md](CLAUDE_ARCH.md), [CLAUDE_NAV.md](CLAUDE_NAV.md)

---

## 🐛 バグ修正

1. 再現確認 → `configureLogLevel('DEBUG')` でログ確認
2. 原因特定 → Grep でエラーコード検索、src/utils/errors.ts 確認
3. 修正 → 最小限の変更（影響範囲を最小化）
4. テスト → 該当テストケース実行、リグレッションテスト
5. レビュー実行 → `/review`

**関連**: [CLAUDE_COMMANDS.md](CLAUDE_COMMANDS.md) エラー調査パターン

---

## 📊 新しい指標追加

1. 設計 → [ADDING_METRICS.md](docs/ADDING_METRICS.md) 参照
2. MetricsCalculator実装 → src/services/metrics/ に実装
3. スプレッドシート出力 → src/services/spreadsheet/ に実装
4. テスト追加 → 計算ロジックのユニットテスト、統合テスト
5. 検証 → `/dora-validate` 実行

**参考**: [DORA_METRICS.md](docs/DORA_METRICS.md), [EXTENDED_METRICS.md](docs/EXTENDED_METRICS.md)

---

## 🔧 設定変更・トラブルシューティング

1. 診断ツール実行 → GASエディタで `checkConfig()`
2. ドキュメント参照 → [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
3. エラーコード確認 → src/utils/errors.ts
4. 設定変更 → src/init.ts 更新 → 再デプロイ → `initConfig()`

**トラブルシューティング**: `checkConfig()`, `configureLogLevel('DEBUG')`, [SETUP.md](docs/SETUP.md)

---

## 📝 PR作成前

1. セルフチェック → `/pr-check`
2. git操作 → `git add <files>` → `git commit -m "message"`
3. 動作確認 → `bun run push` → GASエディタで実際に関数実行
4. PR作成 → 変更内容の要約、テスト結果の記載

### 完了前の必須チェック
```bash
bunx tsc --noEmit && bun run lint && bun test && bun run build
```

### チェックリスト
- [ ] 型エラーなし: `bunx tsc --noEmit`
- [ ] Lint通過: `bun run lint`
- [ ] テスト通過: `bun test`
- [ ] ビルド成功: `bun run build`
- [ ] 未使用コードなし: `bun run check:unused`
- [ ] 循環依存なし: `bun run check:circular`
- [ ] 型カバレッジ95%以上: `bun run check:types`
- [ ] `/review` 実行済み
- [ ] 必要に応じてドキュメント更新

---

## 🔄 リファクタリング

1. 現状分析 → `bun run check:all`, [REFACTORING_GUIDE.md](docs/REFACTORING_GUIDE.md) 参照
2. リファクタリング実施 → 既存テストを通しながら段階的に変更
3. テスト確認 → すべてのテストが通ることを確認
4. 品質確認 → 複雑度改善、循環依存なしを確認

**参考**: [REFACTORING_GUIDE.md](docs/REFACTORING_GUIDE.md), [CODE_QUALITY.md](docs/CODE_QUALITY.md)

---

## 📚 ドキュメント更新

1. 変更内容の確認 → 機能追加や設計変更がある場合は更新が必要
2. 該当ドキュメントの特定 → [CLAUDE_NAV.md](CLAUDE_NAV.md) のドキュメントマトリックスを参照
3. ドキュメント更新 → 明確で簡潔な記述、実例やコードサンプルを含める
4. クロスリファレンス確認 → 関連ドキュメントからのリンク、矛盾がないか確認

**ドキュメント構造**: [CLAUDE.md](CLAUDE.md), [CLAUDE_COMMANDS.md](CLAUDE_COMMANDS.md), [CLAUDE_TASKS.md](CLAUDE_TASKS.md), [CLAUDE_NAV.md](CLAUDE_NAV.md), [CLAUDE_ARCH.md](CLAUDE_ARCH.md), [docs/](docs/)

---

## 💡 設計判断の記録

| 規模 | 記録先 | 例 |
|------|--------|-----|
| 小（バグ修正、軽微な改善） | コミットメッセージ | "fix: 日付フォーマットのバグを修正" |
| 中（機能追加、リファクタリング） | PR Description | "feat: Slack通知機能の追加" |
| 大（アーキテクチャ変更、技術選定） | [docs/adr/](docs/adr/) | "ADR-0003: スプレッドシート構造の変更" |

**ADR作成手順**: [docs/adr/README.md](docs/adr/README.md)
