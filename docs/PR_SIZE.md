# PRサイズ

**PRの変更行数と変更ファイル数**を計測します。

```
PR Size = Lines of Code + Files Changed
        = (Additions + Deletions) + Changed Files

例: +200行 / -50行 / 8ファイル変更
    → Lines of Code: 250
    → Files Changed: 8
```

---

## なぜ計測するのか

- **レビュー容易性**: 小さいPRほどレビューしやすい
- **マージ速度**: 小さいPRほど早くマージされる傾向
- **リスク管理**: 大きなPRは障害リスクが高い
- **AI活用の評価**: AIは一度に大量のコードを生成する傾向がある

---

## 使い方

```javascript
// 過去30日間のPRサイズを計測（デフォルト）
syncPRSize();

// 過去90日間
syncPRSize(90);
```

---

## 出力されるシート

### 「PR Size」シート（サマリー）

| Period | PR Count | LOC Total | LOC Avg | LOC Median | Files Avg | Files Median |
|--------|----------|-----------|---------|------------|-----------|--------------|
| 2024-01-01〜01-31 | 25 | 5000 | 200 | 150 | 5 | 4 |

### 「PR Size - Details」シート（PR詳細）

| PR # | Title | Repository | Additions | Deletions | Lines of Code | Files Changed |
|------|-------|------------|-----------|-----------|---------------|---------------|
| 123 | Feature X | owner/repo | 150 | 30 | 180 | 6 |

---

## 推奨されるPRサイズ

| サイズ | Lines of Code | 評価 |
|--------|---------------|------|
| XS | ~50 | 理想的 |
| S | 51-200 | 推奨 |
| M | 201-400 | 許容範囲 |
| L | 401-800 | 注意が必要 |
| XL | 800+ | 分割を検討 |

Google社の研究によると、**200行以下のPR**が最もレビュー効率が高いとされています。

---

## AIとPRサイズ

AIは一度に大量のコードを生成できるため、PRが肥大化しやすい傾向があります。

### 適切な分割ができている場合
```
Lines of Code: 150
Files Changed: 5
→ レビュアーが理解しやすい
→ マージが早い
```

### 過大なPR
```
Lines of Code: 1500
Files Changed: 30
→ AIの出力を適切に分割できていない
→ レビューが困難
```

### 改善アクション

- AIへの指示を具体的かつ限定的に
- 「すべてを一度に」ではなく段階的に実装
- 1機能 = 1PR の原則を守る

---

## デプロイ用PRの除外

デプロイ用PRは通常、大量の変更を含むためPRサイズの統計を歪めます。特定のbaseブランチへのマージを除外できます。

### 設定方法

#### init.tsで設定（推奨）

`src/init.ts` に設定を記述して永続化できます：

```typescript
export const config: InitConfig = {
  // ... 他の設定 ...

  // PRサイズ計算から除外するbaseブランチ（部分一致）
  prSizeExcludeBranches: ['production', 'staging'],
};
```

設定後の適用手順：
1. `bun run push` でデプロイ
2. GASエディタで `initConfig()` を実行（設定を保存）
3. `syncPRSize(90)` を実行（PRサイズを再計算）

#### GASエディタで直接設定

```javascript
// デプロイ用ブランチを除外（部分一致）
configurePRSizeExcludeBranches(['production', 'staging']);
// → ✅ PR size exclude branches set to: production, staging (partial match)

// 現在の設定を確認
showPRSizeExcludeBranches();
// → 📋 PR size exclude branches: production, staging (partial match)

// 設定をリセット（全PR対象に戻す）
resetPRSizeExcludeBranchesConfig();
// → ✅ PR size exclude branches reset (all PRs will be included)
```

### 部分一致による判定

ブランチ名は**部分一致**で判定されます:

| 設定 | baseブランチ | 判定 |
|------|-------------|------|
| `['production']` | `production` | ❌ 除外 |
| `['production']` | `production-hotfix` | ❌ 除外 |
| `['production']` | `production-v1` | ❌ 除外 |
| `['production']` | `main` | ✅ 含める |
| `['staging']` | `staging-test` | ❌ 除外 |

### 使用例

```javascript
// 1. デプロイ用ブランチを設定
setExcludePRSizeBaseBranches(['production', 'staging']);

// 2. PRサイズを計算
syncPRSize(90);
// → "Excluded 15 PRs with base branches containing: production, staging"

// 3. スプレッドシートに反映される統計は、通常の開発PRのみ
```

---

## トラブルシューティング

### 除外設定が反映されない

**症状**: 除外したはずのPRがスプレッドシートに表示される

**原因**: スプレッドシートのデータは最後に `syncPRSize()` を実行した時点のものです。

**解決手順**:

```javascript
// 1. 設定が保存されているか確認
checkConfig();
// 📊 PR Size Exclude Branches: production, staging
// ↑ この表示があればOK

// 2. なければ設定を適用
initConfig();  // init.tsから設定を読み込む

// 3. PRサイズを再計算
syncPRSize(90);
// Excluded 15 PRs with base branches containing: production, staging
// ↑ 除外されたPRの数が表示される
```

### 「No merged PRs found」

- 期間を広げる
- `listRepos()` でリポジトリが正しく登録されているか確認

### 「No PRs remaining after filtering」

- 除外ブランチ設定が広すぎる可能性があります
- `showPRSizeExcludeBranches()` で現在の設定を確認
- 必要に応じて `resetPRSizeExcludeBranchesConfig()` でリセット

### サイズが0のPR

- 空のマージ（リベースのみ等）の場合、正常動作です

---

## 参考資料

- [Modern Code Review at Google](https://research.google/pubs/pub47025/) - PRサイズ研究
- [LinearB - PR Size Best Practices](https://linearb.io/blog/pr-size-best-practices)
