# ADR-0001: GraphQL APIをデフォルトにする

## ステータス

承認

## コンテキスト

GitHub APIからPR、デプロイメント、Issueなどのデータを取得する際、REST APIを使用していた。しかし、複数リポジトリを横断して大量のデータを取得する運用において、以下の課題があった：

- **API呼び出し回数が多い**: PR 100件のレビュー効率データ取得に300リクエスト必要
- **レート制限に抵触しやすい**: REST APIは5,000 req/hour（PAT）
- **GAS実行時間制限**: 6分以内に処理を完了する必要がある

## 決定

GitHub GraphQL APIをデフォルトのAPIモードとし、REST APIはフォールバックとして残す。

```typescript
// デフォルトでGraphQL
const mode = getGitHubApiMode(); // "graphql"

// 必要に応じてREST APIに切り替え可能
configureApiMode('rest');
```

## 根拠

### 検討した選択肢

1. **REST APIのみ** - 実装が単純だが、レート制限が厳しい
2. **GraphQL APIのみ** - 効率的だが、一部機能でREST APIが必要な場合がある
3. **GraphQL優先、RESTフォールバック（採用）** - 効率性と互換性のバランス

### 比較（PR 100件のレビュー効率データ取得）

| 観点 | REST API | GraphQL API |
|------|----------|-------------|
| リクエスト数 | 300 | 10 |
| 所要時間 | 長い | 短い |
| 実装複雑度 | 低 | 中 |
| 柔軟性 | 高 | 中 |

GraphQL APIは1リクエストで必要なデータを全て取得できるため、30倍効率的。

## 影響

- GraphQLクエリの追加実装が必要（実装済み: `src/services/github/graphql/`）
- 既存のREST API実装は残し、設定で切り替え可能
- 新機能追加時はGraphQL版を優先実装する

## 関連

- PR: feature/graphql-migration
- ファイル: `src/services/github/graphql/`
- 設定: `configureApiMode()`, `showApiMode()`
