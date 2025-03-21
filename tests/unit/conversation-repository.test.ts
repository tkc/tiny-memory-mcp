import { describe, expect, test, beforeEach, mock } from "bun:test";
import { ConversationRepository } from "../../src/repositories/conversation-repository";
import { MockDatabase, testConversations } from "../fixtures/test-data";

describe("ConversationRepository", () => {
  let mockDb: MockDatabase;
  let conversationRepo: ConversationRepository;

  beforeEach(() => {
    mockDb = new MockDatabase();
    conversationRepo = new ConversationRepository(mockDb);

    // モックメソッドをセットアップ
    mockDb.exec = mock(async () => Promise.resolve());
    mockDb.queryRow = mock(async (sql, params) => {
      if (sql.includes("conversation_id =") && params?.length) {
        const id = params[0];
        return testConversations.find((c) => c.conversation_id === id) || null;
      }
      return null;
    });
    mockDb.query = mock(async (sql) => {
      if (sql.includes("ORDER BY updated_at DESC")) {
        return [...testConversations];
      }
      if (sql.includes("LIKE")) {
        return testConversations.filter((c) => c.title.includes("AI"));
      }
      return [];
    });
    mockDb.generateId = mock(() => "mock-id-" + Date.now());
  });

  test("createConversation should create a new conversation with proper ID", async () => {
    const title = "New Test Conversation";
    const metadata = { test: true };

    const conversationId = await conversationRepo.createConversation(
      title,
      metadata,
    );

    expect(conversationId).toBeDefined();
    expect(mockDb.exec).toHaveBeenCalled();
    expect(conversationId).toContain("mock-id-");
  });

  test("getConversation should retrieve a conversation by ID", async () => {
    const testConversation = testConversations[0];
    const result = await conversationRepo.getConversation(
      testConversation.conversation_id,
    );

    expect(result).toBeDefined();
    expect(mockDb.queryRow).toHaveBeenCalled();
    expect(mockDb.queryRow.mock.calls[0][1]).toContain(
      testConversation.conversation_id,
    );
  });

  test("getConversation should return null for non-existent ID", async () => {
    const result = await conversationRepo.getConversation("non-existent-id");

    expect(result).toBeNull();
    expect(mockDb.queryRow).toHaveBeenCalled();
  });

  test("updateConversation should update title and metadata", async () => {
    const testConversation = testConversations[0];
    const newTitle = "Updated Test Conversation";
    const newMetadata = { updated: true };

    await conversationRepo.updateConversation(
      testConversation.conversation_id,
      newTitle,
      newMetadata,
    );

    expect(mockDb.exec).toHaveBeenCalled();
    const execCall = mockDb.exec.mock.calls[0];
    expect(execCall[0]).toContain("UPDATE conversations SET");
    expect(execCall[1]).toContain(newTitle);
    expect(execCall[1]).toContain(testConversation.conversation_id);
  });

  test("updateConversation should handle partial updates (title only)", async () => {
    const testConversation = testConversations[0];
    const newTitle = "Updated Title Only";

    await conversationRepo.updateConversation(
      testConversation.conversation_id,
      newTitle,
    );

    expect(mockDb.exec).toHaveBeenCalled();
    const execCall = mockDb.exec.mock.calls[0];
    expect(execCall[0]).toContain("UPDATE conversations SET");
    expect(execCall[1]).toContain(newTitle);
    expect(execCall[1]).not.toContain("metadata");
  });

  test("updateConversation should handle partial updates (metadata only)", async () => {
    const testConversation = testConversations[0];
    const newMetadata = { updated: true };

    await conversationRepo.updateConversation(
      testConversation.conversation_id,
      undefined,
      newMetadata,
    );

    expect(mockDb.exec).toHaveBeenCalled();
    const execCall = mockDb.exec.mock.calls[0];
    expect(execCall[0]).toContain("UPDATE conversations SET");
    expect(execCall[1]).not.toContain("title");
    expect(execCall[1]).toContain(JSON.stringify(newMetadata));
  });

  test("updateConversation should not update if no changes provided", async () => {
    const testConversation = testConversations[0];

    await conversationRepo.updateConversation(testConversation.conversation_id);

    expect(mockDb.exec).not.toHaveBeenCalled();
  });

  test("getAllConversations should retrieve all conversations ordered by update time", async () => {
    const result = await conversationRepo.getAllConversations();

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toEqual(testConversations.length);
    expect(mockDb.query).toHaveBeenCalled();
    expect(mockDb.query.mock.calls[0][0]).toContain("ORDER BY updated_at DESC");
  });

  test("searchConversations should find conversations by keyword", async () => {
    const result = await conversationRepo.searchConversations("AI");

    expect(Array.isArray(result)).toBe(true);
    expect(mockDb.query).toHaveBeenCalled();
    expect(mockDb.query.mock.calls[0][0]).toContain("LIKE");
    expect(mockDb.query.mock.calls[0][1]).toContain("%AI%");
  });

  test("searchConversations should limit results", async () => {
    const limit = 5;
    await conversationRepo.searchConversations("AI", limit);

    expect(mockDb.query).toHaveBeenCalled();
    expect(mockDb.query.mock.calls[0][0]).toContain("LIMIT");
    expect(mockDb.query.mock.calls[0][1]).toContain(limit);
  });
});
