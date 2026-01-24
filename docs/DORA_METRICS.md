# DORA Metrics 実装ガイド

このドキュメントでは、DevSyncGASで実装しているDORA Four Key Metricsの定義、計算方法、および制約事項について解説します。

---

## 目次

### 📖 概要
- [DORA Metricsとは](#dora-metricsとは)
- [4つの主要指標](#4つの主要指標)

### 📊 詳細ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [GitHubから取得するデータ](./dora/github-data.md) | Pull Request、Workflow、Deployment、Issuesの各データソースの詳細 |
| [各指標の詳細](./dora/metrics-detail.md) | 4つの指標それぞれの公式定義、計算式、実装方法 |
| [設定・実装上の考慮事項](./dora/configuration.md) | 閾値設定、環境フィルタリング、インシデントトラッキングの設定方法 |
| [出典・参考資料](./dora/references.md) | DORA公式ドキュメント、書籍、API仕様へのリンク |

---

## DORA Metricsとは

DORA（DevOps Research and Assessment）は、ソフトウェアデリバリーのパフォーマンスを測定するための4つの主要指標を定義しています。これらの指標は、Google CloudのDORAチームによる6年以上の研究に基づいており、組織のソフトウェアデリバリー能力と運用パフォーマンスを客観的に評価するために使用されます。

---

## 4つの主要指標

| 指標 | 説明 | 測定対象 |
|------|------|----------|
| **Deployment Frequency** | 本番環境へのデプロイ頻度 | スループット |
| **Lead Time for Changes** | コード変更から本番デプロイまでの時間 | スループット |
| **Change Failure Rate** | 本番環境で障害を引き起こしたデプロイの割合 | 安定性 |
| **Mean Time to Recovery** | 本番環境の障害から復旧するまでの時間 | 安定性 |

> **注意**: パフォーマンスレベル（Elite/High/Medium/Low）の閾値は、DORAの年次調査データに基づいて毎年更新されます。本ドキュメントの閾値は2024年時点のものです。最新の閾値は[DORA公式サイト](https://dora.dev/)を参照してください。

---

## クイックスタート

### 基本的な使い方

```javascript
// GASエディタで実行
syncDevOpsMetrics();  // メトリクスを計算してスプレッドシートに出力
```

### 初期設定

```javascript
// APIトークンとスプレッドシートIDを設定
setup(
  'ghp_xxxx',           // GitHub PAT
  'secret_xxxx',        // Notion Token（オプション）
  'xxxxxxxx-xxxx',      // Notion Database ID（オプション）
  'spreadsheet-id'      // Google Spreadsheet ID
);

// リポジトリを追加
addRepo('owner', 'repo-name');
```

### インシデントトラッキングを有効化

```javascript
// インシデントラベルを設定（真のMTTR計測用）
setIncidentConfig({ labels: ["incident", "production-bug"] });
```

---

## ドキュメント構成

```
docs/
├── DORA_METRICS.md          # このファイル（概要と目次）
└── dora/
    ├── github-data.md       # GitHubから取得するデータ
    ├── metrics-detail.md    # 各指標の詳細
    ├── configuration.md     # 設定・実装上の考慮事項
    └── references.md        # 出典・参考資料
```

---

## 次のステップ

1. **[GitHubから取得するデータ](./dora/github-data.md)** を読んで、どのGitHubデータが使用されるかを理解する
2. **[各指標の詳細](./dora/metrics-detail.md)** で計算方法を確認する
3. **[設定・実装上の考慮事項](./dora/configuration.md)** でプロジェクトに合わせた設定を行う

---

## 関連ドキュメント

- **[組織導入ガイド＆トラブルシューティング](./SETUP_AND_TROUBLESHOOTING.md)** - GitHub/Notionの権限設定、接続エラーの対処法
