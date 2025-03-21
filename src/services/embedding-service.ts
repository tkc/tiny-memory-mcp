import { MessageRepository } from "../repositories/message-repository";

/**
 * テキスト埋め込みを処理するサービス
 */
export class EmbeddingService {
  private messageRepo: MessageRepository;
  private embeddingDimension: number = 384; // 一般的な埋め込みサイズ

  constructor(messageRepo: MessageRepository) {
    this.messageRepo = messageRepo;
  }

  /**
   * テキストの埋め込みベクトルを生成（プレースホルダー）
   *
   * 注意: 実運用環境では、この実装をOpenAIなどの埋め込みAPIに置き換えてください
   */
  async generateEmbedding(text: string): Promise<number[]> {
    // この実装はプレースホルダーです
    // 実際の実装では、OpenAIやHuggingFaceのAPIを使用します
    return this.createPlaceholderEmbedding(text);
  }

  /**
   * メッセージの埋め込みベクトルを生成して保存
   */
  async processMessageEmbedding(
    messageId: string,
    content: string,
  ): Promise<void> {
    const embedding = await this.generateEmbedding(content);
    await this.messageRepo.saveEmbedding(messageId, embedding);
  }

  /**
   * 類似したメッセージを検索
   */
  async findSimilarMessages(query: string, limit: number = 5): Promise<any[]> {
    const queryEmbedding = await this.generateEmbedding(query);
    return await this.messageRepo.searchSimilarMessages(queryEmbedding, limit);
  }

  /**
   * プレースホルダーの埋め込みベクトルを作成（テスト用）
   */
  private createPlaceholderEmbedding(text: string): number[] {
    // テキストのハッシュから決定的な埋め込みを生成
    const hash = this.simpleHash(text);
    const embedding = new Array(this.embeddingDimension).fill(0);

    // ハッシュ値を使って埋め込みベクトルの一部の次元を初期化
    for (let i = 0; i < this.embeddingDimension; i++) {
      const value = Math.sin(hash * (i + 1)) * 0.5;
      embedding[i] = value;
    }

    // ベクトルを正規化
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0),
    );
    return embedding.map((val) => val / (magnitude || 1));
  }

  /**
   * シンプルなハッシュ関数
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}
