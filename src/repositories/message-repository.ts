import { Database, Message } from "../types/database";

/**
 * メッセージの操作を担当するリポジトリクラス
 */
export class MessageRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * 新しいメッセージを追加
   */
  async createMessage(
    conversationId: string,
    role: "user" | "assistant" | "system",
    content: string,
    metadata: Record<string, any> = {},
    embedding?: number[] | string,
  ): Promise<string> {
    const messageId = (this.db as any).generateId?.() || crypto.randomUUID();
    const now = new Date();

    // メッセージを保存
    await this.db.exec(
      `INSERT INTO messages 
         (message_id, conversation_id, timestamp, role, content, metadata, embedding)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        messageId,
        conversationId,
        now,
        role,
        content,
        JSON.stringify(metadata),
        embedding,
      ],
    );

    // 会話の更新時間も更新
    await this.db.exec(
      "UPDATE conversations SET updated_at = ? WHERE conversation_id = ?",
      [now, conversationId],
    );

    return messageId;
  }

  /**
   * メッセージを取得
   */
  async getMessage(messageId: string): Promise<Message | null> {
    return await this.db.queryRow<Message>(
      "SELECT * FROM messages WHERE message_id = ?",
      [messageId],
    );
  }

  /**
   * 会話に属するすべてのメッセージを取得
   */
  async getMessagesByConversation(conversationId: string): Promise<Message[]> {
    return await this.db.query<Message>(
      `SELECT * FROM messages 
       WHERE conversation_id = ? 
       ORDER BY timestamp`,
      [conversationId],
    );
  }

  /**
   * キーワードによるメッセージ検索
   */
  async searchMessages(
    keyword: string,
    limit: number = 10,
  ): Promise<Message[]> {
    return await this.db.query<Message>(
      `SELECT * FROM messages 
       WHERE content LIKE ? 
       ORDER BY timestamp DESC 
       LIMIT ?`,
      [`%${keyword}%`, limit],
    );
  }

  /**
   * ベクトル類似度によるメッセージ検索
   * 埋め込みは数値配列かJSON文字列で受け取る
   */
  async searchSimilarMessages(
    embedding: number[] | string,
    limit: number = 5,
  ): Promise<Array<Message & { similarity: number }>> {
    // 埋め込みが文字列の場合、そのままクエリに渡す
    // 配列の場合は、NativeDuckDBConnectionクラスがSQLに変換する
    return await this.db.query<Message & { similarity: number }>(
      `SELECT m.*, cosine_similarity(m.embedding, ?) as similarity
       FROM messages m
       WHERE m.embedding IS NOT NULL
       ORDER BY similarity DESC
       LIMIT ?`,
      [embedding, limit],
    );
  }

  /**
   * メッセージの埋め込みベクトルを保存
   * 埋め込みは数値配列かJSON文字列で受け取る
   */
  async saveEmbedding(
    messageId: string,
    embedding: number[] | string,
  ): Promise<void> {
    await this.db.exec(
      "UPDATE messages SET embedding = ? WHERE message_id = ?",
      [embedding, messageId],
    );
  }
}
