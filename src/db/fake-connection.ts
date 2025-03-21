import { Database } from "../types/database";
import { v4 as uuidv4 } from "uuid";

/**
 * インメモリデータベースのモック実装
 * 開発やテスト用
 */
export class FakeDatabaseConnection implements Database {
  private conversations: any[] = [];
  private messages: any[] = [];
  private isInitialized: boolean = false;

  constructor() {
    // 何もしない
  }

  /**
   * データベースの初期化
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    console.log("🦆 Initializing in-memory database...");
    this.isInitialized = true;
  }

  /**
   * SQLの代わりにインメモリ操作を実行
   */
  async exec(sql: string, params: any[] = []): Promise<void> {
    // SQLをパースして簡易的な操作に変換
    console.log(`Executing SQL: ${sql.substring(0, 50)}...`);

    if (sql.includes("INSERT INTO conversations")) {
      const [conversationId, title, created_at, updated_at, metadata] = params;
      this.conversations.push({
        conversation_id: conversationId,
        title,
        created_at,
        updated_at,
        metadata: JSON.parse(metadata),
      });
    } else if (sql.includes("INSERT INTO messages")) {
      const [
        messageId,
        conversationId,
        timestamp,
        role,
        content,
        metadata,
        embedding,
      ] = params;
      this.messages.push({
        message_id: messageId,
        conversation_id: conversationId,
        timestamp,
        role,
        content,
        metadata: JSON.parse(metadata),
        embedding,
      });
    } else if (sql.includes("UPDATE conversations")) {
      // 更新は実装しない
    } else if (sql.includes("UPDATE messages")) {
      // 更新は実装しない
    }
  }

  /**
   * SQLの代わりにインメモリ検索を実行
   */
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    console.log(`Querying: ${sql.substring(0, 50)}...`);

    // 簡易的なクエリ処理
    if (sql.includes("SELECT * FROM conversations")) {
      return this.conversations as any;
    } else if (
      sql.includes("SELECT * FROM messages WHERE conversation_id = ?")
    ) {
      const [conversationId] = params;
      return this.messages
        .filter((msg) => msg.conversation_id === conversationId)
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()) as any;
    } else if (sql.includes("cosine_similarity")) {
      // コサイン類似度の計算は省略し、最初のメッセージを返す
      if (this.messages.length === 0) return [] as any;

      return [
        {
          ...this.messages[0],
          similarity: 0.95,
        },
      ] as any;
    }

    return [] as any;
  }

  /**
   * 最初の行だけを返す
   */
  async queryRow<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const results = await this.query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * 接続を閉じる（何もしない）
   */
  async close(): Promise<void> {
    // インメモリなので特にすることはない
  }

  /**
   * ID生成
   */
  generateId(): string {
    return uuidv4();
  }
}
