# ADR-0002: DIコンテナによるGAS API抽象化

## ステータス

承認

## コンテキスト

Google Apps Script（GAS）固有のAPI（`UrlFetchApp`、`SpreadsheetApp`、`PropertiesService`等）を直接呼び出すと、以下の問題があった：

- **テスト困難**: GAS APIはローカル環境で実行できない
- **密結合**: ビジネスロジックがGAS APIに直接依存
- **モック困難**: グローバルオブジェクトのモック化が複雑

## 決定

DIコンテナパターンを採用し、GAS APIへのアクセスを抽象インターフェース経由にする。

```typescript
// interfaces/index.ts で抽象インターフェースを定義
export interface HttpClient {
  fetch<T>(url: string, options?: HttpRequestOptions): HttpResponse<T>;
}

// container.ts でインスタンスを管理
const { httpClient } = getContainer();
httpClient.fetch(url);

// adapters/gas/index.ts で実装
export const gasHttpClient: HttpClient = {
  fetch: (url, options) => UrlFetchApp.fetch(url, options),
};
```

## 根拠

### 検討した選択肢

1. **GAS APIを直接呼び出す** - シンプルだがテスト困難
2. **グローバル変数のモック** - テスト時にグローバルを書き換える。脆弱
3. **DIコンテナ（採用）** - インターフェース経由でアクセスし、テスト時にモック注入

### 比較

| 観点 | 直接呼び出し | グローバルモック | DIコンテナ |
|------|-------------|-----------------|-----------|
| テスト容易性 | 低 | 中 | 高 |
| 実装の複雑さ | 低 | 低 | 中 |
| 型安全性 | 低 | 低 | 高 |
| 保守性 | 低 | 低 | 高 |

## 影響

- 新しいGAS APIを使う場合は`interfaces/`にインターフェースを追加
- `adapters/gas/`に実装を追加
- テスト時は`tests/mocks/`のモック実装を注入

## 関連

- ファイル: `src/container.ts`, `src/interfaces/`, `src/adapters/gas/`
- テスト: `tests/mocks/`
