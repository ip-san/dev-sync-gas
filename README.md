# 📊 DevSyncGAS

**🤖 AIと一緒に開発するチームのための、開発生産性ダッシュボード**

GitHub × Google スプレッドシートで、コードを書いてからリリースまでの全てを可視化します。

---

## 🤔 AIを使って、本当に速くなった？

Claude CodeやCopilotを導入して「コードを書く速度は上がった気がする」。

でも、こんな疑問はありませんか？

- レビューに時間がかかるようになった気がする
- 手戻りが増えてないか心配
- 「速くなった」を数字で証明できない

DevSyncGASは、**感覚ではなくデータで判断する**ためのツールです。

---

## 📈 なぜDORA指標なのか？

スプリントベロシティは、AI時代には[虚栄の指標になりつつあります](https://www.scrum.org/resources/blog/velocity-agent-efficiency-evidence-based-management-ai-era)。AIが4秒でコードを生成しても、検証の複雑さは変わらないからです。

代わりに注目されているのが、**DORA指標（DevOps Research and Assessment）**。Google Cloudの研究チームが確立した、**本番リリースまでの実際の価値提供を測る4つの指標**です。

| DORA指標 | 何を測るか |
|----------|-----------|
| 🚀 **デプロイ頻度** | 本番環境へのデプロイ回数 |
| ⏱️ **リードタイム** | PR作成 → デプロイまでの時間 |
| ⚠️ **変更障害率** | 障害を引き起こしたデプロイの割合 |
| 🔧 **平均修復時間（MTTR）** | 障害から復旧までの時間 |

> **GitHubデータでどう計算しているか**: [DORA指標の詳細](docs/DORA_METRICS.md)

### 🎯 AI時代の拡張指標

DevSyncGASは、DORA指標に加えて、**AI活用の効果を評価する拡張指標**も自動計測します。

- 🔄 **サイクルタイム** - Issue作成 → Production（全体の流れ）
- ⌨️ **コーディング時間** - Issue作成 → PR作成（実装速度）
- 🔁 **手戻り率** - 追加コミット・Force Push（品質）
- 👀 **レビュー効率** - レビュー待ち・レビュー時間（ボトルネック発見）
- 📏 **PRサイズ** - 変更行数・ファイル数（複雑さ）

これらを組み合わせることで、「AIで速くなった」を定量的に証明できます。

> **GitHubデータでどう計算しているか**: [拡張指標の詳細](docs/EXTENDED_METRICS.md)

---

## ✨ 特徴

### 🔒 シンプル・セキュア・ゼロコスト

```
GitHub  ──→  Google Apps Script  ──→  Google スプレッドシート
         自動収集                    可視化
```

- 🎯 **外部ツール不要** - GitHub API + Google Apps Scriptだけで完結
- 🔐 **既存の認証基盤** - Google Workspaceをそのまま活用
- 💰 **追加コストゼロ** - 新しいサービス契約不要

### 📊 データでチーム改善

- 📅 **週次ダッシュボード** - トレンド把握
- 🌐 **複数リポジトリ横断** - チーム全体を俯瞰
- 🔍 **リポジトリ別分析** - ボトルネックを特定

---

## 🚀 始める

### ⚡ 最速セットアップ（5分）

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

詳しい手順は **[📖 クイックスタートガイド](docs/QUICK_START.md)** を参照してください。

### 🔑 GitHub認証の選択

| 方式 | おすすめのケース |
|------|-----------------|
| 🔑 [Personal Access Token](docs/QUICK_START.md#pat認証) | 個人・小規模チーム |
| 🏢 [GitHub Apps](docs/GITHUB_APPS_AUTH.md) | 組織運用・セキュリティ重視 |

---

## 📚 ドキュメント

### ⚙️ セットアップ
- **[⚡ クイックスタート](docs/QUICK_START.md)** - 5分で始める
- **[🏢 組織導入ガイド](docs/SETUP_AND_TROUBLESHOOTING.md)** - チーム運用・トラブルシューティング

### 📊 計測する指標
- **[📈 DORA指標の詳細](docs/DORA_METRICS.md)** - 4つの指標の定義とGitHubデータでの計算方法
- **[🎯 拡張指標の詳細](docs/EXTENDED_METRICS.md)** - サイクルタイム、コーディング時間、手戻り率など
- **[💡 計測思想](docs/MEASUREMENT_PHILOSOPHY.md)** - なぜこの指標を、この方法で測るのか

---

## 👨‍💻 開発者向け

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
