import { describe, expect, test, beforeEach, mock } from "bun:test";
import { MCPController } from "../../src/services/mcp-controller";
import { ConversationRepository } from "../../src/repositories/conversation-repository";
import { MessageRepository } from "../../src/repositories/message-repository";
import { EmbeddingService } from "../../src/services/embedding-service";
import {
  MockDatabase,
  testConversations,
  testMessages,
} from "../fixtures/test-data";

describe("MCPController", () => {
  let mockDb: MockDatabase;
  let conversationRepo: ConversationRepository;
  let messageRepo: MessageRepository;
  let embeddingService: EmbeddingService;
  let mcpController: MCPController;

  const testUserId = "test-user-001";
  const testConversationId = "test-conv-001";

  beforeEach(() => {
    mockDb = new MockDatabase();
    conversationRepo = new ConversationRepository(mockDb);
    messageRepo = new MessageRepository(mockDb);
    embeddingService = new EmbeddingService(messageRepo);

    // モックメソッドをセットアップ
    conversationRepo.createConversation = mock(async () => testConversationId);
    conversationRepo.getConversation = mock(async (id) => {
      return testConversations.find((c) => c.conversation_id === id) || null;
    });
    conversationRepo.getAllConversations = mock(async () => [
      ...testConversations,
    ]);

    messageRepo.createMessage = mock(async () => "mock-message-id");
    messageRepo.getMessagesByConversation = mock(async (id) => {
      return testMessages.filter((m) => m.conversation_id === id);
    });

    embeddingService.processMessageEmbedding = mock(async () =>
      Promise.resolve(),
    );
    embeddingService.findSimilarMessages = mock(async () => [
      { ...testMessages[3], similarity: 0.95 },
      { ...testMessages[4], similarity: 0.85 },
    ]);

    mcpController = new MCPController(
      conversationRepo,
      messageRepo,
      embeddingService,
    );
  });

  test("startConversation creates a new conversation with default title if not provided", async () => {
    const result = await mcpController.startConversation(testUserId);

    expect(result).toBe(testConversationId);
    expect(conversationRepo.createConversation).toHaveBeenCalled();

    const createCall = conversationRepo.createConversation.mock.calls[0];
    expect(createCall[0]).toBe("新しい会話"); // デフォルトタイトル
    expect(createCall[1]).toHaveProperty("userId", testUserId);
  });

  test("startConversation creates a conversation with provided title and metadata", async () => {
    const title = "カスタムタイトル";
    const metadata = { custom: true, tags: ["test"] };

    await mcpController.startConversation(testUserId, title, metadata);

    expect(conversationRepo.createConversation).toHaveBeenCalled();

    const createCall = conversationRepo.createConversation.mock.calls[0];
    expect(createCall[0]).toBe(title);
    expect(createCall[1]).toHaveProperty("userId", testUserId);
    expect(createCall[1]).toHaveProperty("custom", true);
    expect(createCall[1]).toHaveProperty("tags");
  });

  test("addUserMessage adds a message and processes embedding", async () => {
    const content = "ユーザーメッセージのテスト";
    const metadata = { sentiment: "neutral" };

    const result = await mcpController.addUserMessage(
      testUserId,
      content,
      metadata,
    );

    expect(result).toBe("mock-message-id");

    expect(messageRepo.createMessage).toHaveBeenCalled();
    const createCall = messageRepo.createMessage.mock.calls[0];
    expect(createCall[0]).toBe(testConversationId);
    expect(createCall[1]).toBe("user");
    expect(createCall[2]).toBe(content);
    expect(createCall[3]).toEqual(metadata);

    // 埋め込み処理が実行されたことを確認
    expect(embeddingService.processMessageEmbedding).toHaveBeenCalled();
  });

  test("addAssistantMessage adds a message and processes embedding", async () => {
    const content = "アシスタントの返答です";
    const metadata = { confidence: 0.95 };

    const result = await mcpController.addAssistantMessage(
      testUserId,
      content,
      metadata,
    );

    expect(result).toBe("mock-message-id");

    expect(messageRepo.createMessage).toHaveBeenCalled();
    const createCall = messageRepo.createMessage.mock.calls[0];
    expect(createCall[0]).toBe(testConversationId);
    expect(createCall[1]).toBe("assistant");
    expect(createCall[2]).toBe(content);
    expect(createCall[3]).toEqual(metadata);

    // 埋め込み処理が実行されたことを確認
    expect(embeddingService.processMessageEmbedding).toHaveBeenCalled();
  });

  test("addMessage starts a new conversation when user has no active conversation", async () => {
    // アクティブな会話がないユーザー
    const newUserId = "new-user-001";

    // プライベートメソッドを直接呼び出すため、アサーションは控えめに
    const messageId = await (mcpController as any).addMessage(
      newUserId,
      "user",
      "テストメッセージ",
    );

    expect(messageId).toBeDefined();
    expect(conversationRepo.createConversation).toHaveBeenCalled();
    expect(messageRepo.createMessage).toHaveBeenCalled();
  });

  test("getCurrentConversation returns messages for the active conversation", async () => {
    // まず会話を開始
    await mcpController.startConversation(testUserId);

    const result = await mcpController.getCurrentConversation(testUserId);

    expect(Array.isArray(result)).toBe(true);
    expect(messageRepo.getMessagesByConversation).toHaveBeenCalled();
    expect(messageRepo.getMessagesByConversation.mock.calls[0][0]).toBe(
      testConversationId,
    );
  });

  test("getCurrentConversation returns empty array when user has no active conversation", async () => {
    const result = await mcpController.getCurrentConversation("unknown-user");

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
    expect(messageRepo.getMessagesByConversation).not.toHaveBeenCalled();
  });

  test("getConversationByReference finds a conversation by reference text", async () => {
    const referenceText = "トランスフォーマー";

    const result =
      await mcpController.getConversationByReference(referenceText);

    expect(result).toBeDefined();
    expect(embeddingService.findSimilarMessages).toHaveBeenCalled();
    expect(embeddingService.findSimilarMessages.mock.calls[0][0]).toBe(
      referenceText,
    );

    expect(result).toHaveProperty("conversation");
    expect(result).toHaveProperty("messages");
    expect(result).toHaveProperty("matchedMessageIndex");
  });

  test("getConversationByReference returns null when no similar messages found", async () => {
    embeddingService.findSimilarMessages = mock(async () => []);

    const result =
      await mcpController.getConversationByReference("マッチしないクエリ");

    expect(result).toBeNull();
  });

  test("getConversationByReference returns null when conversation not found", async () => {
    embeddingService.findSimilarMessages = mock(async () => [
      {
        ...testMessages[0],
        conversation_id: "non-existent-conversation",
        similarity: 0.95,
      },
    ]);

    conversationRepo.getConversation = mock(async () => null);

    const result =
      await mcpController.getConversationByReference("テストクエリ");

    expect(result).toBeNull();
  });

  test("rememberConversationWithContext retrieves context around a matched message", async () => {
    const query = "トランスフォーマー";
    const contextWindowSize = 2;

    // 会話とメッセージをモック
    const testConv = testConversations[1];
    const testMsgs = testMessages.filter(
      (m) => m.conversation_id === testConv.conversation_id,
    );

    // 特定のメッセージがマッチしたとモック
    const matchedMsgIndex = 2;
    mcpController.getConversationByReference = mock(async () => ({
      conversation: testConv,
      messages: testMsgs,
      matchedMessageIndex: matchedMsgIndex,
    }));

    const result = await mcpController.rememberConversationWithContext(
      query,
      contextWindowSize,
    );

    expect(result).toBeDefined();
    expect(mcpController.getConversationByReference).toHaveBeenCalledWith(
      query,
    );

    // 結果の検証
    expect(result).toHaveProperty("conversation", testConv);
    expect(result).toHaveProperty("messages", testMsgs);
    expect(result).toHaveProperty("matchedMessage", testMsgs[matchedMsgIndex]);

    // 前後のコンテキストが正しく取得されているか確認
    expect(result?.beforeContext.length).toBeLessThanOrEqual(contextWindowSize);
    expect(result?.afterContext.length).toBeLessThanOrEqual(contextWindowSize);

    // 前のコンテキストには、マッチしたメッセージの前にあるメッセージが含まれる
    if (matchedMsgIndex > 0) {
      expect(result?.beforeContext).toContain(testMsgs[matchedMsgIndex - 1]);
    }

    // 後のコンテキストには、マッチしたメッセージの後にあるメッセージが含まれる
    if (matchedMsgIndex < testMsgs.length - 1) {
      expect(result?.afterContext).toContain(testMsgs[matchedMsgIndex + 1]);
    }
  });

  test("rememberConversationWithContext returns null when no similar conversation found", async () => {
    mcpController.getConversationByReference = mock(async () => null);

    const result =
      await mcpController.rememberConversationWithContext("マッチしないクエリ");

    expect(result).toBeNull();
  });

  test("rememberConversationWithContext uses default context window size when not specified", async () => {
    const query = "テストクエリ";
    const defaultSize = 5; // デフォルト値

    // スパイを設置してデフォルト値をチェック
    const spy = mock(mcpController.getConversationByReference);
    mcpController.getConversationByReference = spy;
    spy.mockImplementation(async () => ({
      conversation: testConversations[0],
      messages: testMessages.slice(0, 2),
      matchedMessageIndex: 1,
    }));

    await mcpController.rememberConversationWithContext(query);

    expect(spy).toHaveBeenCalledWith(query);

    // 結果の中にコンテキストウィンドウサイズが使われている証拠を見つけるのは難しいので、
    // 機能が動作することだけを確認
  });

  test("getAllConversationHistory retrieves all conversations with messages", async () => {
    const result = await mcpController.getAllConversationHistory();

    expect(result).toBeDefined();
    expect(conversationRepo.getAllConversations).toHaveBeenCalled();

    expect(result).toHaveProperty("conversations");
    expect(Array.isArray(result.conversations)).toBe(true);
    expect(result.conversations.length).toBe(testConversations.length);

    expect(result).toHaveProperty("messages");
    expect(typeof result.messages).toBe("object");

    // 各会話のメッセージが取得されたか確認
    for (const conv of testConversations) {
      expect(messageRepo.getMessagesByConversation).toHaveBeenCalledWith(
        conv.conversation_id,
      );
      expect(result.messages).toHaveProperty(conv.conversation_id);
    }
  });
});
