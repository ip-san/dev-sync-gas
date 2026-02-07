# レビュー効率

**PRの各ステータスにおける滞留時間**を計測します。

```
Ready for Review ───→ First Review ───→ Approved ───→ Merged
      │                    │                │            │
      │←─ レビュー待ち時間 ─→│←─ レビュー時間 ─→│←マージ待ち→│
      │                                                    │
      └────────────────── 全体時間 ─────────────────────────┘
```

---

## なぜ計測するのか

- **AIコード品質の可視化**: レビュー時間が長い = AIコードが難解な可能性
- **ボトルネックの特定**: どのフェーズで時間がかかっているかを把握
- **チーム効率の測定**: レビュー文化・速度の可視化

---

## 使い方

```javascript
// 過去30日間のレビュー効率を計測（デフォルト）
syncReviewEfficiency();

// 過去90日間
syncReviewEfficiency(90);
```

---

## 出力されるシート

リポジトリごとに2つのシートが生成されます：

### 集約シート: `{owner/repo} - Review Efficiency`

**日付ごとの統計**（トレンド分析用）

| 日付 | PR数 | 平均レビュー待ち (時間) | 中央値レビュー待ち | 平均レビュー時間 (時間) | 中央値レビュー時間 | 記録日時 |
|------|------|----------------------|-----------------|---------------------|-----------------|---------|
| 2024-01-10 | 6 | 3.2 | 2.5 | 8.5 | 6.0 | 2024-01-15 12:00 |
| 2024-01-11 | 4 | 2.8 | 2.0 | 6.2 | 5.5 | 2024-01-15 12:00 |

### 詳細シート: `{owner/repo} - Review Efficiency - Details`

**PR単位の個別レコード**（ドリルダウン調査用）

| PR # | Title | Ready For Review At | First Review At | Approved At | Time to First Review (h) | Review Duration (h) | Merged At |
|------|-------|---------------------|-----------------|-------------|--------------------------|---------------------|-----------|
| 123 | Feature X | 2024-01-10T10:00 | 2024-01-10T12:30 | 2024-01-10T18:30 | 2.5 | 8.0 | 2024-01-10T19:00 |
| 124 | Bug Fix | 2024-01-10T14:00 | 2024-01-10T16:00 | 2024-01-10T20:00 | 2.0 | 6.0 | 2024-01-10T20:30 |

---

## 推奨値

| 指標 | 推奨値 |
|------|--------|
| レビュー待ち時間 | 4時間以内 |
| レビュー時間 | 24時間以内 |

---

## AIとレビュー効率

AIコードが読みやすい場合:
```
レビュー待ち時間: 2時間
レビュー時間: 4時間     ← 短い = 理解しやすい
```

AIコードが難解な場合:
```
レビュー待ち時間: 2時間
レビュー時間: 48時間    ← 長い = 理解に時間がかかる
```

### 改善アクション

| 観点 | 原因 | アクション |
|------|------|-----------|
| レビュー時間の増加 | AIコードが難解 | プロンプト改善、コード説明追加 |
| レビュー待ち時間の増加 | レビュアー不足 | レビュー担当の分散 |

---

## デプロイ用PRの除外

デプロイ用PRは通常、レビュープロセスが通常のPRと異なるため、統計を歪めます。特定のbaseブランチへのマージを除外できます。

### 設定方法

#### init.tsで設定（推奨）

`src/init.ts` に設定を記述して永続化できます：

```typescript
export const config: InitConfig = {
  // ... 他の設定 ...

  // レビュー効率計算から除外するbaseブランチ（部分一致）
  reviewEfficiencyExcludeBranches: ['production', 'staging'],
};
```

設定後の適用手順：
1. `bun run push` でデプロイ
2. GASエディタで `initConfig()` を実行（設定を保存）
3. `syncReviewEfficiency(90)` を実行（レビュー効率を再計算）

#### GASエディタで直接設定

```javascript
// デプロイ用ブランチを除外（部分一致）
configureReviewEfficiencyExcludeBranches(['production', 'staging']);
// → ✅ Review efficiency exclude branches set to: production, staging (partial match)

// 現在の設定を確認
showReviewEfficiencyExcludeBranches();
// → 📋 Review efficiency exclude branches: production, staging (partial match)

// 設定をリセット（全PR対象に戻す）
resetReviewEfficiencyExcludeBranchesConfig();
// → ✅ Review efficiency exclude branches reset (all PRs will be included)
```

### 部分一致による判定

ブランチ名は**部分一致**で判定されます。PRサイズ除外と同じロジックです。

---

## トラブルシューティング

### 除外設定が反映されない

**症状**: 除外したはずのPRがスプレッドシートに表示される

**原因**: スプレッドシートのデータは最後に `syncReviewEfficiency()` を実行した時点のものです。

**解決手順**:

```javascript
// 1. 設定が保存されているか確認
checkConfig();
// 📊 Review Efficiency Exclude Branches: production, staging
// ↑ この表示があればOK

// 2. なければ設定を適用
initConfig();  // init.tsから設定を読み込む

// 3. レビュー効率を再計算
syncReviewEfficiency(90);
// Excluded 15 PRs with base branches containing: production, staging
// ↑ 除外されたPRの数が表示される
```

### 「No PRs remaining after filtering」

- 除外ブランチ設定が広すぎる可能性があります
- `showReviewEfficiencyExcludeBranches()` で現在の設定を確認
- 必要に応じて `resetReviewEfficiencyExcludeBranchesConfig()` でリセット

### レビュー時間がnull

- レビューなしでマージされたPR（セルフマージなど）

### Ready for Reviewが古い

- Timeline API制限（古いPRでは `ready_for_review` イベントが取得できない場合があります）
- その場合、PR作成日時にフォールバックします

---

## 参考資料

- [SPACE Framework](https://queue.acm.org/detail.cfm?id=3454124) - Efficiency, Collaboration
- [LinearB - Cycle Time](https://linearb.io/blog/cycle-time) - Review Time
