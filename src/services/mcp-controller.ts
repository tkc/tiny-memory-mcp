import { ConversationRepository } from "../repositories/conversation-repository";
import { MessageRepository } from "../repositories/message-repository";
import { EmbeddingService } from "./embedding-service";
import { Conversation, Message } from "../types/database";

/**
 * MCP (Model Control Protocol) コントローラー
 * 会話の記憶とコンテキスト管理を担当
 */
export class MCPController {
  private conversationRepo: ConversationRepository;
  private messageRepo: MessageRepository;
  private embeddingService: EmbeddingService;

  // アクティブな会話状態を保持
  private activeConversations: Map<string, string> = new Map();

  constructor(
    conversationRepo: ConversationRepository,
    messageRepo: MessageRepository,
    embeddingService: EmbeddingService,
  ) {
    this.conversationRepo = conversationRepo;
    this.messageRepo = messageRepo;
    this.embeddingService = embeddingService;
  }

  /**
   * 新しい会話を開始
   */
  async startConversation(
    userId: string,
    title: string = "新しい会話",
    metadata: Record<string, any> = {},
  ): Promise<string> {
    // 既存の会話があれば終了
    const currentConversationId = this.activeConversations.get(userId);
    if (currentConversationId) {
      // 終了処理（必要であれば）
    }

    // 新しい会話を作成
    const conversationMetadata = {
      ...metadata,
      userId,
      startedAt: new Date().toISOString(),
    };

    const conversationId = await this.conversationRepo.createConversation(
      title,
      conversationMetadata,
    );

    // アクティブな会話として設定
    this.activeConversations.set(userId, conversationId);

    return conversationId;
  }

  /**
   * ユーザーメッセージを追加
   */
  async addUserMessage(
    userId: string,
    content: string,
    metadata: Record<string, any> = {},
  ): Promise<string> {
    return this.addMessage(userId, "user", content, metadata);
  }

  /**
   * アシスタントメッセージを追加
   */
  async addAssistantMessage(
    userId: string,
    content: string,
    metadata: Record<string, any> = {},
  ): Promise<string> {
    return this.addMessage(userId, "assistant", content, metadata);
  }

  /**
   * メッセージを追加（共通処理）
   */
  private async addMessage(
    userId: string,
    role: "user" | "assistant" | "system",
    content: string,
    metadata: Record<string, any> = {},
  ): Promise<string> {
    // アクティブな会話がない場合は新しい会話を自動作成
    let conversationId = this.activeConversations.get(userId);

    if (!conversationId) {
      conversationId = await this.startConversation(userId);
    }

    // メッセージを追加
    const messageId = await this.messageRepo.createMessage(
      conversationId,
      role,
      content,
      metadata,
    );

    // 埋め込みを生成して保存（非同期で処理）
    this.embeddingService
      .processMessageEmbedding(messageId, content)
      .catch((err) => console.error("Failed to generate embedding:", err));

    return messageId;
  }

  /**
   * 現在の会話の履歴を取得
   */
  async getCurrentConversation(userId: string): Promise<Message[]> {
    const conversationId = this.activeConversations.get(userId);
    if (!conversationId) return [];

    return await this.messageRepo.getMessagesByConversation(conversationId);
  }

  /**
   * クエリに関連する会話を検索
   */
  async getConversationByReference(referenceText: string): Promise<{
    conversation: Conversation;
    messages: Message[];
    matchedMessageIndex?: number;
  } | null> {
    // 関連するメッセージを検索
    const similarMessages = await this.embeddingService.findSimilarMessages(
      referenceText,
      1,
    );

    if (similarMessages.length === 0) {
      return null;
    }

    const topMessage = similarMessages[0];
    const conversationId = topMessage.conversation_id;

    // 会話情報を取得
    const conversation =
      await this.conversationRepo.getConversation(conversationId);
    if (!conversation) return null;

    // 会話内のメッセージを取得
    const messages =
      await this.messageRepo.getMessagesByConversation(conversationId);

    // マッチしたメッセージのインデックスを特定
    const matchedMessageIndex = messages.findIndex(
      (msg) => msg.message_id === topMessage.message_id,
    );

    return {
      conversation,
      messages,
      matchedMessageIndex:
        matchedMessageIndex >= 0 ? matchedMessageIndex : undefined,
    };
  }

  /**
   * 特定のクエリに類似した会話を思い出し、その前後のコンテキストを取得
   *
   * ベクトル埋め込みによる意味的検索を使用
   */
  async rememberConversationWithContext(
    query: string,
    contextWindowSize: number = 5, // 前後に何メッセージ取得するか
  ): Promise<{
    conversation: Conversation;
    messages: Message[];
    beforeContext: Message[];
    afterContext: Message[];
    matchedMessage?: Message;
  } | null> {
    // 類似した会話を検索
    const result = await this.getConversationByReference(query);
    if (!result || result.matchedMessageIndex === undefined) return null;

    const { conversation, messages, matchedMessageIndex } = result;

    // マッチしたメッセージ
    const matchedMessage = messages[matchedMessageIndex];

    // 前後のコンテキストを取得
    const startIndex = Math.max(0, matchedMessageIndex - contextWindowSize);
    const endIndex = Math.min(
      messages.length - 1,
      matchedMessageIndex + contextWindowSize,
    );

    const beforeContext = messages.slice(startIndex, matchedMessageIndex);
    const afterContext = messages.slice(matchedMessageIndex + 1, endIndex + 1);

    return {
      conversation,
      messages,
      beforeContext,
      afterContext,
      matchedMessage,
    };
  }

  /**
   * すべての会話履歴を取得
   */
  async getAllConversationHistory(): Promise<{
    conversations: Conversation[];
    messages: Record<string, Message[]>;
  }> {
    // すべての会話を取得
    const conversations = await this.conversationRepo.getAllConversations();

    // メッセージを格納するオブジェクト
    const messages: Record<string, Message[]> = {};

    // 各会話のメッセージを取得
    for (const conversation of conversations) {
      const conversationMessages =
        await this.messageRepo.getMessagesByConversation(
          conversation.conversation_id,
        );
      messages[conversation.conversation_id] = conversationMessages;
    }

    return {
      conversations,
      messages,
    };
  }
}
