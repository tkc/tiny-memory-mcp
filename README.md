# tiny-memory-mcp

DuckDBを使用して会話履歴を保存し、過去の会話を検索・参照できるMCP（Model Context Protocol）システム。シンプルな機能セットに焦点を当てています。

## 主要機能

- **全会話保存**

  - すべての会話がDuckDBに永続的に保存
  - 会話履歴を後から参照可能

- **意味的検索**

  - ベクトル埋め込みを使った意味的な類似度検索
  - 単語の一致だけでなく文脈や意味から関連会話を検索
  - 「あのスレッドのあの会話」検索機能

- **コンテキスト検索**
  - ベクトル検索を使った「こんな会話思い出して」機能
  - 関連する会話の前後のコンテキストを取得
  - 調整可能なコンテキストウィンドウサイズ

## ベクトル検索について

このアプリケーションは、テキストの意味的な類似性を捕えるベクトル埋め込み技術を使用しています。各メッセージは高次元ベクトル空間に変換され、コサイン類似度によって検索されます。

### 他の検索メソッドとの違い

- **キーワード検索との違い**: キーワード検索は完全一致または部分一致を探しますが、ベクトル検索は意味的な類似性を考慮します。例えば、「自動車」で検索すると、「車」「乗り物」「運転」などの関連メッセージも見つかります。

- **意味理解**: 同じ概念を異なる言い回しで表現した場合でも、ベクトル検索はその関連性を捕えることができます。

### 実装のカスタマイズ

デフォルトではプレースホルダーの埋め込み実装を使用していますが、実運用環境では、OpenAIのEmbeddings APIなどを使用することを強く推奨します。プロジェクト内にサンプル実装 `src/services/openai-embedding-example.ts` が含まれています。

## 必要環境

- Bun 1.0.x 以上（推奨）
- または Node.js 16.x 以上

## インストール

```bash
# リポジトリをクローン
git clone https://github.com/yourusername/duck-mcp.git
cd duck-mcp

# 依存関係のインストール
bun install
```

## 使い方

Duck MCPには2つの実行モードがあります：

1. **REST API モード**（従来の実装）
2. **MCP サーバーモード**（Model Context Protocol 準拠）

### REST API モードでの起動

```bash
# 開発モードで起動
bun run dev

# または本番モードで起動
bun run start
```

デフォルトではポート3000でAPIサーバーが起動します。ポートを変更するには環境変数を設定します：

```bash
PORT=8080 bun run start
```

### MCP サーバーモードでの起動

```bash
# MCP サーバーを開発モードで起動
bun run dev:mcp

# または本番モードで起動
bun run start:mcp
```

MCP サーバーモードでは、標準入出力を通じて Model Context Protocol に準拠した通信を行います。

## REST API モードのエンドポイント

- `POST /messages/user` - ユーザーメッセージを追加
- `POST /messages/assistant` - アシスタントメッセージを追加
- `POST /search/reference` - 「あのスレッドのあの会話」を検索
- `POST /memory/remember-with-context` - 会話を思い出して前後のコンテキストを取得
- `GET /memory/all-history` - すべての会話履歴を取得

## MCP サーバーモードのツール

- `start_conversation` - 新しい会話を開始
- `add_user_message` - ユーザーメッセージを追加
- `add_assistant_message` - アシスタントメッセージを追加
- `get_current_conversation` - 現在の会話を取得
- `search_reference` - 「あのスレッドのあの会話」を検索
- `remember_with_context` - 会話を思い出して前後のコンテキストを取得
- `get_all_history` - すべての会話履歴を取得

## テスト

Duck MCPはユニットテストを備えています。テストの実行には以下のコマンドを使用します：

```bash
# テストを実行
bun test

# カバレッジレポート付きでテスト実行
bun test:coverage
```

テストは以下のディレクトリ構造に整理されています：

- `tests/unit/` - 各コンポーネントの単体テスト
- `tests/fixtures/` - テスト用のモックデータ

### ユニットテスト

ユニットテストでは、各コンポーネントが個別に正しく動作することを確認します：

- `conversation-repository.test.ts` - 会話リポジトリのCRUD操作
- `message-repository.test.ts` - メッセージリポジトリのCRUD操作とベクトル検索
- `embedding-service.test.ts` - 埋め込みベクトル生成と類似度検索
- `mcp-controller.test.ts` - MCPコントローラーの各メソッド
- `mcp-server.test.ts` - MCPサーバーのツールハンドラー

### 継続的インテグレーション (CI)

このプロジェクトはGitHub Actionsを使用した継続的インテグレーションを実装しています。以下のワークフローが設定されています：

- **CI**: プッシュとプルリクエスト時にテストとビルドを実行
- **Code Quality**: コード品質チェック（TypeScript型チェック、Lint、Prettierフォーマット）
- **Test Coverage**: テストカバレッジレポートの生成（週次実行および主要ブランチへのプッシュ時）

## 使用例

### REST API モードでの使用例

#### 「あのスレッドのあの会話」の使い方

```javascript
// 例: 「機械学習について話した会話」を検索
const response = await fetch("http://localhost:3000/search/reference", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    referenceText: "機械学習 モデル トレーニング",
  }),
});

const result = await response.json();
if (result.found) {
  console.log("会話:", result.conversation);
  console.log("メッセージ:", result.messages);
  console.log("マッチしたメッセージインデックス:", result.matchedMessageIndex);
}
```

#### 「こんな会話思い出して、この時の話の前後が欲しい」の使い方

```javascript
// 例: 「画像分類について話した会話」を検索し、前後5メッセージを取得
const response = await fetch(
  "http://localhost:3000/memory/remember-with-context",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "画像分類 CNN",
      contextWindowSize: 5, // 前後に取得するメッセージ数
    }),
  }
);

const result = await response.json();
if (result.found) {
  console.log("マッチしたメッセージ:", result.matchedMessage);
  console.log("前のコンテキスト:", result.beforeContext);
  console.log("後のコンテキスト:", result.afterContext);
}
```

### MCP サーバーモードでの使用例

MCP プロトコルに準拠したクライアントを使用して通信します。以下は使用例の擬似コードです：

```javascript
// MCP クライアントの初期化
const mcpClient = new McpClient();
await mcpClient.connect();

// 会話を開始
const startResult = await mcpClient.callTool("start_conversation", {
  userId: "user-123",
  title: "AI技術についての会話",
});
const { conversationId } = JSON.parse(startResult.content[0].text);

// ユーザーメッセージを追加
await mcpClient.callTool("add_user_message", {
  userId: "user-123",
  content: "大規模言語モデルについて教えてください",
});

// アシスタントメッセージを追加
await mcpClient.callTool("add_assistant_message", {
  userId: "user-123",
  content: "大規模言語モデル（LLM）は、...",
});

// 「あのスレッドのあの会話」を検索
const searchResult = await mcpClient.callTool("search_reference", {
  referenceText: "大規模言語モデル トランスフォーマー",
});
```

## カスタマイズ

### 埋め込みモデルの変更

デフォルトではプレースホルダーの埋め込み実装を使用していますが、実際のアプリケーションでは、OpenAIのEmbeddings APIなどを使用することを推奨します。

```typescript
// OpenAI API をインストール
// bun add openai

// src/services/embedding-service.ts の generateEmbedding メソッドを変更
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: text,
  });

  return response.data[0].embedding;
}
```

## 開発者向け情報

### プロジェクト構造

```
duck-mcp/
├── .github/             # GitHub関連設定
│   └── workflows/       # GitHub Actions ワークフロー
├── data/                # データベースファイル保存ディレクトリ
├── src/                 # ソースコード
│   ├── api/             # REST API実装
│   ├── db/              # データベース接続
│   ├── repositories/    # データアクセスレイヤー
│   ├── services/        # ビジネスロジック
│   ├── types/           # 型定義
│   ├── index.ts         # REST APIエントリーポイント
│   └── mcp-server.ts    # MCPサーバーエントリーポイント
├── tests/               # テストコード
│   ├── fixtures/        # テスト用モックデータ
│   └── unit/            # ユニットテスト
├── package.json         # プロジェクト設定
└── tsconfig.json        # TypeScript設定
```

### コーディング規約

このプロジェクトでは、ESLintとPrettierを使用してコード品質とスタイルを維持しています。

```bash
# コードスタイルチェック
bun run lint

# 自動修正
bun run lint:fix

# コードフォーマット
bun run format

# TypeScriptの型チェック
bun run check
```

## 貢献ガイド

1. リポジトリをフォークする
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add some amazing feature'`)
4. ブランチをプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成する

すべてのプルリクエストは自動的にGitHub Actionsでテストされます。テストとコード品質チェックに合格する必要があります。

## 注意点

- プロジェクトを実運用環境で使用する場合は、埋め込みベクトル生成の実装をOpenAIなどの実際のサービスに置き換えることを強く推奨します

## ライセンス

MIT
