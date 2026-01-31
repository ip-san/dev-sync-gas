# DevSyncGAS

**AIと一緒に開発するチームのための、開発生産性ダッシュボード**

GitHub × Google スプレッドシートで、コードを書いてからリリースまでの全てを可視化します。

---

## AIを使って、本当に速くなった？

Claude CodeやCopilotを導入して「コードを書く速度は上がった気がする」。

でも、こんな疑問はありませんか？

- レビューに時間がかかるようになった気がする
- 手戻りが増えてないか心配
- 「速くなった」を数字で証明できない

DevSyncGASは、**感覚ではなくデータで判断する**ためのツールです。

---

## 3分でわかる仕組み

```
GitHub  ──→  DevSyncGAS (GAS)  ──→  Google スプレッドシート
  PR・Issue・デプロイ情報を取得        →  自動でダッシュボード化
```

**計測できる指標:**

| 観点 | 指標 | 何がわかるか |
|------|------|-------------|
| **スピード** | デプロイ頻度、リードタイム、サイクルタイム | AI導入で実装サイクルは早まったか |
| **品質** | 変更障害率、MTTR、手戻り率 | 速さの代償に品質は下がっていないか |
| **チーム** | レビュー待ち時間、レビュー時間 | AIコードはレビューしやすいか |
| **規模** | PRサイズ | コードが肥大化していないか |

業界標準のDORA指標 + AI時代に必要な追加指標を、**GitHubのデータだけ**で自動計測します。

---

## 始める

### 最速セットアップ（5分）

```bash
# 1. インストール
git clone https://github.com/your-org/dev-sync-gas.git
cd dev-sync-gas
bun install

# 2. GASにデプロイ
bunx clasp login
bunx clasp create --title "DevSyncGAS" --type standalone --rootDir ./dist
bun run push

# 3. GASエディタで初期設定
# setup('ghp_xxxx', 'spreadsheet-id') を実行
# addRepo('owner', 'repo') でリポジトリ追加
```

詳しい手順は **[クイックスタートガイド](docs/QUICK_START.md)** を参照してください。

### GitHub認証の選択

| 方式 | おすすめのケース |
|------|-----------------|
| [Personal Access Token](docs/QUICK_START.md#pat認証) | 個人・小規模チーム |
| [GitHub Apps](docs/GITHUB_APPS_AUTH.md) | 組織運用・セキュリティ重視 |

---

## ドキュメント

### 使い方
- **[クイックスタート](docs/QUICK_START.md)** - 5分で始める
- **[組織導入ガイド](docs/SETUP_AND_TROUBLESHOOTING.md)** - チームでの導入・トラブルシューティング

### 指標を理解する
- **[計測思想](docs/MEASUREMENT_PHILOSOPHY.md)** - なぜこの指標を、この方法で測るのか
- **[アーキテクチャ](docs/ARCHITECTURE.md)** - データの流れと設計原則

### 各指標の詳細
| 指標 | 概要 |
|------|------|
| [サイクルタイム](docs/CYCLE_TIME.md) | Issue作成 → Production マージ |
| [コーディング時間](docs/CODING_TIME.md) | Issue作成 → PR作成 |
| [手戻り率](docs/REWORK_RATE.md) | PR作成後の追加コミット・Force Push |
| [レビュー効率](docs/REVIEW_EFFICIENCY.md) | レビュー待ち・レビュー中・マージ待ち |
| [PRサイズ](docs/PR_SIZE.md) | 変更行数・ファイル数 |

### 拡張・開発
- **[新しい指標を追加する](docs/ADDING_METRICS.md)** - 独自指標の実装ガイド
- **[ADR（設計判断の記録）](docs/adr/)** - なぜそうなっているか

---

## 開発者向け

```bash
bun run build    # ビルド
bun run push     # ビルド＆GASにデプロイ
bun test         # テスト実行
bun run lint     # Lintチェック
```

詳細は [CLAUDE.md](CLAUDE.md) を参照してください。

---

## License

MIT
