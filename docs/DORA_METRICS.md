# DORA指標（Four Key Metrics）

**ソフトウェアデリバリーのパフォーマンス**を計測するDORAの4つの主要指標を取得します。

```
DORA Four Key Metrics
├── Deployment Frequency     本番にどれくらい頻繁にデプロイしているか
├── Lead Time for Changes    コードが本番に届くまでどれくらいかかるか
├── Change Failure Rate      デプロイが失敗する割合はどれくらいか
└── Mean Time to Recovery    障害からどれくらい早く復旧できるか
```

---

## 使い方

```javascript
// 過去30日間のDORA指標を計測（デフォルト）
syncDevOpsMetrics();

// 過去90日間
syncDevOpsMetrics(90);

// 過去30日分を日次でバックフィル
syncDailyBackfill(30);
```

---

## 4つの指標

### 1. Deployment Frequency（デプロイ頻度）

本番環境へのデプロイ頻度を計測します。

| レベル | 頻度 | パフォーマンス |
|--------|------|---------------|
| Elite | 1日1回以上 | daily |
| High | 週1回以上 | weekly |
| Medium | 月1回以上 | monthly |
| Low | 月1回未満 | yearly |

**データソース:**
1. GitHub Deployments API（優先）
2. ワークフロー実行（名前に "deploy" を含む成功したもの）

### 2. Lead Time for Changes（変更リードタイム）

コードがコミットされてから本番環境にデプロイされるまでの時間。

| レベル | 時間 |
|--------|------|
| Elite | 1時間未満 |
| High | 1時間〜1日未満 |
| Medium | 1日〜1週間未満 |
| Low | 1週間以上 |

**計算方法:**
1. マージ後24時間以内のデプロイを探す
2. 見つかった場合: マージ → デプロイ時間
3. 見つからない場合: PR作成 → マージ時間（フォールバック）

### 3. Change Failure Rate（変更障害率）

本番環境でインシデントを引き起こしたデプロイの割合。

| レベル | 割合 |
|--------|------|
| Elite/High | 0-15% |
| Medium | 16-30% |
| Low | 30%超 |

**計算方法:**
```
失敗デプロイ数 / 総デプロイ数 × 100
```

### 4. Mean Time to Recovery（平均復旧時間）

本番環境の障害から復旧するまでの平均時間。

| レベル | 時間 |
|--------|------|
| Elite | 1時間未満 |
| High | 1日未満 |
| Medium | 1週間未満 |
| Low | 1週間以上 |

**計算方法:**
失敗デプロイから次の成功デプロイまでの時間を平均

---

## 出力されるシート

### リポジトリ別シート（例: `owner/repo-a`）

| Date | Deploy Count | Deploy Freq | Lead Time (h) | CFR (%) | MTTR (h) |
|------|--------------|-------------|---------------|---------|----------|
| 2024-01-15 | 3 | daily | 2.5 | 0 | - |
| 2024-01-14 | 1 | daily | 4.2 | 0 | - |

### Dashboard

全リポジトリ×全指標の俯瞰ビュー。パフォーマンスレベルをステータスで表示。

### DevOps Summary

リポジトリ間の比較サマリー。

---

## インシデントベースのMTTR

より正確なMTTRを計測するため、インシデントラベルを設定できます。

```javascript
// "incident" ラベルのIssueをインシデントとして計測
configureIncidentLabels(["incident", "outage", "production-bug"]);
```

この場合、MTTRは「インシデントIssue作成 → close」で計算されます。

---

## デプロイメント検出の設定

デフォルトでは、ワークフロー名に "deploy" を含む成功した実行をデプロイとして検出します。

異なるワークフロー名を使っている場合は、GitHub Deployments APIを有効にするか、ワークフロー名を変更してください。

---

## DORAとの差異

| 観点 | DORA公式 | DevSyncGAS |
|------|----------|------------|
| デプロイ頻度 | オンデマンド（複数回/日）がElite | 1日1回以上をEliteとして扱う |
| Lead Time | コミット → デプロイ | マージ → デプロイ（またはPR作成 → マージ） |
| CFR | インシデント発生率 | 失敗デプロイ率 |
| MTTR | インシデント → 復旧 | 失敗デプロイ → 成功デプロイ（またはIssueベース） |

詳細な設計判断は [計測思想](MEASUREMENT_PHILOSOPHY.md) を参照してください。

---

## 参考資料

- [DORA Metrics Guide](https://dora.dev/guides/dora-metrics/) - 公式定義
- [State of DevOps Report](https://dora.dev/research/) - 年次調査レポート
- [Accelerate](https://itrevolution.com/product/accelerate/) - DORA研究の基礎となった書籍
