import { describe, expect, test, beforeEach, mock } from "bun:test";
import { MessageRepository } from "../../src/repositories/message-repository";
import {
  MockDatabase,
  testMessages,
  embeddedMessages,
} from "../fixtures/test-data";

describe("MessageRepository", () => {
  let mockDb: MockDatabase;
  let messageRepo: MessageRepository;

  beforeEach(() => {
    mockDb = new MockDatabase();
    messageRepo = new MessageRepository(mockDb);

    // モックメソッドをセットアップ
    mockDb.exec = mock(async () => Promise.resolve());
    mockDb.queryRow = mock(async (sql, params) => {
      if (sql.includes("message_id =") && params?.length) {
        const id = params[0];
        return testMessages.find((m) => m.message_id === id) || null;
      }
      return null;
    });
    mockDb.query = mock(async (sql, params) => {
      if (sql.includes("conversation_id =") && params?.length) {
        const conversationId = params[0];
        return testMessages.filter((m) => m.conversation_id === conversationId);
      }
      if (sql.includes("LIKE") && params?.length) {
        const keyword = params[0].replace(/%/g, "");
        return testMessages.filter((m) => m.content.includes(keyword));
      }
      if (sql.includes("cosine_similarity") && params?.length) {
        // 埋め込みベクトル検索のモック
        return embeddedMessages.slice(0, 3).map((msg, i) => ({
          ...msg,
          similarity: 0.95 - i * 0.1,
        }));
      }
      return [];
    });
    mockDb.generateId = mock(() => "mock-msg-id-" + Date.now());
  });

  test("createMessage should create a new message with proper ID and update conversation", async () => {
    const conversationId = "test-conv-001";
    const role = "user";
    const content = "Test message content";
    const metadata = { test: true };

    const messageId = await messageRepo.createMessage(
      conversationId,
      role as "user" | "assistant" | "system",
      content,
      metadata,
    );

    expect(messageId).toBeDefined();
    expect(messageId).toContain("mock-msg-id-");

    // メッセージ追加のSQLチェック
    expect(mockDb.exec).toHaveBeenCalledTimes(2); // メッセージ追加と会話更新
    const firstCall = mockDb.exec.mock.calls[0];
    expect(firstCall[0]).toContain("INSERT INTO messages");
    expect(firstCall[1]).toContain(conversationId);
    expect(firstCall[1]).toContain(role);
    expect(firstCall[1]).toContain(content);

    // 会話更新のSQLチェック
    const secondCall = mockDb.exec.mock.calls[1];
    expect(secondCall[0]).toContain("UPDATE conversations SET updated_at");
    expect(secondCall[1]).toContain(conversationId);
  });

  test("getMessage should retrieve a message by ID", async () => {
    const testMessage = testMessages[0];
    const result = await messageRepo.getMessage(testMessage.message_id);

    expect(result).toBeDefined();
    expect(mockDb.queryRow).toHaveBeenCalled();
    expect(mockDb.queryRow.mock.calls[0][1]).toContain(testMessage.message_id);
  });

  test("getMessage should return null for non-existent ID", async () => {
    const result = await messageRepo.getMessage("non-existent-id");

    expect(result).toBeNull();
    expect(mockDb.queryRow).toHaveBeenCalled();
  });

  test("getMessagesByConversation should retrieve messages for a conversation", async () => {
    const conversationId = "test-conv-002";
    const result = await messageRepo.getMessagesByConversation(conversationId);

    expect(Array.isArray(result)).toBe(true);
    expect(mockDb.query).toHaveBeenCalled();
    expect(mockDb.query.mock.calls[0][0]).toContain("conversation_id =");
    expect(mockDb.query.mock.calls[0][0]).toContain("ORDER BY timestamp");
    expect(mockDb.query.mock.calls[0][1]).toContain(conversationId);
  });

  test("searchMessages should find messages by keyword", async () => {
    const keyword = "トランスフォーマー";
    const result = await messageRepo.searchMessages(keyword);

    expect(Array.isArray(result)).toBe(true);
    expect(mockDb.query).toHaveBeenCalled();
    expect(mockDb.query.mock.calls[0][0]).toContain("LIKE");
    expect(mockDb.query.mock.calls[0][1]).toContain(`%${keyword}%`);
  });

  test("searchMessages should limit results", async () => {
    const limit = 5;
    await messageRepo.searchMessages("テスト", limit);

    expect(mockDb.query).toHaveBeenCalled();
    expect(mockDb.query.mock.calls[0][0]).toContain("LIMIT");
    expect(mockDb.query.mock.calls[0][1]).toContain(limit);
  });

  test("searchSimilarMessages should use cosine similarity", async () => {
    const testEmbedding = Array(10)
      .fill(0)
      .map((_, i) => i * 0.1);
    const result = await messageRepo.searchSimilarMessages(testEmbedding, 3);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(3);

    expect(mockDb.query).toHaveBeenCalled();
    expect(mockDb.query.mock.calls[0][0]).toContain("cosine_similarity");
    expect(mockDb.query.mock.calls[0][0]).toContain("ORDER BY similarity DESC");
    expect(mockDb.query.mock.calls[0][1]).toContain(testEmbedding);
    expect(mockDb.query.mock.calls[0][1]).toContain(3); // limit

    // 結果に類似度が含まれていることを確認
    result.forEach((msg) => {
      expect(msg).toHaveProperty("similarity");
      expect(typeof msg.similarity).toBe("number");
    });

    // 類似度が降順になっていることを確認
    expect(result[0].similarity).toBeGreaterThan(result[1].similarity);
    expect(result[1].similarity).toBeGreaterThan(result[2].similarity);
  });

  test("saveEmbedding should update message with embedding vector", async () => {
    const messageId = "test-msg-001";
    const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];

    await messageRepo.saveEmbedding(messageId, embedding);

    expect(mockDb.exec).toHaveBeenCalled();

    const execCall = mockDb.exec.mock.calls[0];
    expect(execCall[0]).toContain("UPDATE messages SET embedding =");
    expect(execCall[1]).toContain(embedding);
    expect(execCall[1]).toContain(messageId);
  });

  test("saveEmbedding should handle string embedding format", async () => {
    const messageId = "test-msg-001";
    const embeddingStr = JSON.stringify([0.1, 0.2, 0.3]);

    await messageRepo.saveEmbedding(messageId, embeddingStr);

    expect(mockDb.exec).toHaveBeenCalled();

    const execCall = mockDb.exec.mock.calls[0];
    expect(execCall[0]).toContain("UPDATE messages SET embedding =");
    expect(execCall[1]).toContain(embeddingStr);
    expect(execCall[1]).toContain(messageId);
  });
});
