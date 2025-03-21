import { Database, Conversation } from "../types/database";

/**
 * 会話の操作を担当するリポジトリクラス
 */
export class ConversationRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * 新しい会話を作成
   */
  async createConversation(
    title: string,
    metadata: Record<string, any> = {},
  ): Promise<string> {
    const conversationId =
      (this.db as any).generateId?.() || crypto.randomUUID();
    const now = new Date();

    await this.db.exec(
      `INSERT INTO conversations (conversation_id, title, created_at, updated_at, metadata)
       VALUES (?, ?, ?, ?, ?)`,
      [conversationId, title, now, now, JSON.stringify(metadata)],
    );

    return conversationId;
  }

  /**
   * 会話を取得
   */
  async getConversation(conversationId: string): Promise<Conversation | null> {
    return await this.db.queryRow<Conversation>(
      "SELECT * FROM conversations WHERE conversation_id = ?",
      [conversationId],
    );
  }

  /**
   * 会話を更新
   */
  async updateConversation(
    conversationId: string,
    title?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const updates: string[] = [];
    const params: any[] = [];

    if (title !== undefined) {
      updates.push("title = ?");
      params.push(title);
    }

    if (metadata !== undefined) {
      updates.push("metadata = ?");
      params.push(JSON.stringify(metadata));
    }

    if (updates.length === 0) return;

    // 更新時間も更新
    updates.push("updated_at = ?");
    params.push(new Date());

    params.push(conversationId);

    await this.db.exec(
      `UPDATE conversations SET ${updates.join(", ")} WHERE conversation_id = ?`,
      params,
    );
  }

  /**
   * すべての会話を取得
   */
  async getAllConversations(): Promise<Conversation[]> {
    return await this.db.query<Conversation>(
      "SELECT * FROM conversations ORDER BY updated_at DESC",
    );
  }

  /**
   * キーワードで会話を検索
   */
  async searchConversations(
    keyword: string,
    limit: number = 10,
  ): Promise<Conversation[]> {
    return await this.db.query<Conversation>(
      `SELECT DISTINCT c.* 
       FROM conversations c
       JOIN messages m ON c.conversation_id = m.conversation_id
       WHERE c.title LIKE ? 
          OR c.metadata::TEXT LIKE ?
          OR m.content LIKE ?
       ORDER BY c.updated_at DESC
       LIMIT ?`,
      [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, limit],
    );
  }
}
