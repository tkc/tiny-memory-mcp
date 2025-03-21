/**
 * テスト用のダミーデータ
 */

export const testConversations = [
  {
    conversation_id: "test-conv-001",
    title: "テスト会話1",
    created_at: new Date("2025-01-01T00:00:00Z"),
    updated_at: new Date("2025-01-01T01:00:00Z"),
    metadata: { userId: "test-user-001", topic: "general" },
  },
  {
    conversation_id: "test-conv-002",
    title: "AI技術についての会話",
    created_at: new Date("2025-01-02T00:00:00Z"),
    updated_at: new Date("2025-01-02T02:00:00Z"),
    metadata: { userId: "test-user-001", topic: "ai" },
  },
  {
    conversation_id: "test-conv-003",
    title: "プログラミング言語の比較",
    created_at: new Date("2025-01-03T00:00:00Z"),
    updated_at: new Date("2025-01-03T03:00:00Z"),
    metadata: { userId: "test-user-002", topic: "programming" },
  },
];

export const testMessages = [
  // 会話1のメッセージ
  {
    message_id: "test-msg-001",
    conversation_id: "test-conv-001",
    timestamp: new Date("2025-01-01T00:05:00Z"),
    role: "user",
    content: "こんにちは！",
    metadata: { sentiment: "positive" },
  },
  {
    message_id: "test-msg-002",
    conversation_id: "test-conv-001",
    timestamp: new Date("2025-01-01T00:06:00Z"),
    role: "assistant",
    content: "こんにちは！どのようにお手伝いできますか？",
    metadata: { confidence: 0.95 },
  },

  // 会話2のメッセージ
  {
    message_id: "test-msg-003",
    conversation_id: "test-conv-002",
    timestamp: new Date("2025-01-02T00:10:00Z"),
    role: "user",
    content: "最新の大規模言語モデルについて教えてください。",
    metadata: { intent: "information_seeking" },
  },
  {
    message_id: "test-msg-004",
    conversation_id: "test-conv-002",
    timestamp: new Date("2025-01-02T00:11:00Z"),
    role: "assistant",
    content:
      "最新の大規模言語モデル（LLM）は、トランスフォーマーアーキテクチャに基づいており、大量のデータで学習されています。代表的なモデルにはGPT-4、Claude、PaLMなどがあります。",
    metadata: { sources: ["research_papers", "tech_blogs"] },
  },
  {
    message_id: "test-msg-005",
    conversation_id: "test-conv-002",
    timestamp: new Date("2025-01-02T00:12:00Z"),
    role: "user",
    content: "トランスフォーマーアーキテクチャについて詳しく知りたいです。",
    metadata: { intent: "clarification" },
  },
  {
    message_id: "test-msg-006",
    conversation_id: "test-conv-002",
    timestamp: new Date("2025-01-02T00:13:00Z"),
    role: "assistant",
    content:
      "トランスフォーマーアーキテクチャは、2017年に「Attention is All You Need」論文で紹介されたニューラルネットワーク構造です。自己注意機構（Self-Attention）を使用して、シーケンス内の各位置が他のすべての位置との関係を把握できるようにしています。",
    metadata: { sources: ["attention_paper"] },
  },

  // 会話3のメッセージ
  {
    message_id: "test-msg-007",
    conversation_id: "test-conv-003",
    timestamp: new Date("2025-01-03T00:15:00Z"),
    role: "user",
    content: "PythonとJavaScriptの違いを教えてください。",
    metadata: { intent: "comparison" },
  },
  {
    message_id: "test-msg-008",
    conversation_id: "test-conv-003",
    timestamp: new Date("2025-01-03T00:16:00Z"),
    role: "assistant",
    content:
      "PythonとJavaScriptには以下のような違いがあります：\n1. Pythonはデータ解析やAI、バックエンド開発に強く、JavaScriptはWebフロントエンド開発が主な用途です。\n2. Pythonは静的に型付けされる傾向がありますが、JavaScriptは動的型付け言語です。\n3. Pythonはインデントでブロックを表現しますが、JavaScriptは波括弧を使用します。",
    metadata: { topic: "programming_languages" },
  },
];

// 埋め込みベクトル付きメッセージ（テスト用）
export const embeddedMessages = testMessages.map((msg) => ({
  ...msg,
  embedding: Array(10)
    .fill(0)
    .map((_, i) => Math.sin(i + msg.message_id.charCodeAt(0)) * 0.5),
}));

// テスト用モックデータベース
export class MockDatabase {
  conversations = [...testConversations];
  messages = [...testMessages];

  async exec(sql: string, params: any[] = []): Promise<void> {
    // シミュレートしたSQL実行（何もしない）
    return Promise.resolve();
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    // シンプルな条件に基づいてデータをフィルタリング
    if (sql.includes("conversations")) {
      return this.conversations as unknown as T[];
    } else if (sql.includes("messages")) {
      return this.messages as unknown as T[];
    }
    return [] as T[];
  }

  async queryRow<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const results = await this.query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  async close(): Promise<void> {
    return Promise.resolve();
  }

  generateId(): string {
    return `test-id-${Date.now()}`;
  }
}
