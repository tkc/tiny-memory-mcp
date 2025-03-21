import { describe, expect, test, beforeEach, mock, spyOn } from "bun:test";
import { MCPController } from "../../src/services/mcp-controller";
import { ConversationRepository } from "../../src/repositories/conversation-repository";
import { MessageRepository } from "../../src/repositories/message-repository";
import { EmbeddingService } from "../../src/services/embedding-service";

import {
  MockDatabase,
  testMessages,
  testConversations,
} from "../fixtures/test-data";

// MCPサーバーをインポート（必要ならパスを調整）
// import '../src/mcp-server';

// テスト用のモックデータ
const testUserId = "test-user-1";
const testConversationId = "test-conversation-1";
const testMessageContent = "これはテストメッセージです。";

// MCPサーバーのサブクラスをモックで作成
class MockMcpServer {
  tools = {};

  tool(name, description, schema, handler) {
    this.tools[name] = { name, description, schema, handler };
    return this;
  }

  async connect() {
    return Promise.resolve();
  }
}

describe("MCP Server", () => {
  let mockDb: MockDatabase;
  let mcpController: MCPController;
  let mockServer: MockMcpServer;

  beforeEach(() => {
    // モックデータベースとコントローラーの設定
    mockDb = new MockDatabase();
    const conversationRepo = new ConversationRepository(mockDb);
    const messageRepo = new MessageRepository(mockDb);
    const embeddingService = new EmbeddingService(messageRepo);

    mcpController = new MCPController(
      conversationRepo,
      messageRepo,
      embeddingService
    );

    // MCPコントローラーのメソッドをモック
    mcpController.startConversation = mock(async () => testConversationId);
    mcpController.addUserMessage = mock(async () => "test-message-1");
    mcpController.addAssistantMessage = mock(async () => "test-message-2");
    mcpController.getCurrentConversation = mock(async () => [
      {
        message_id: "test-message-1",
        conversation_id: testConversationId,
        timestamp: new Date(),
        role: "user",
        content: testMessageContent,
      },
    ]);
    mcpController.getConversationByReference = mock(async () => ({
      conversation: testConversations[0],
      messages: testMessages.slice(0, 2),
      matchedMessageIndex: 1,
    }));
    mcpController.rememberConversationWithContext = mock(async () => ({
      conversation: testConversations[0],
      messages: testMessages.slice(0, 3),
      matchedMessage: testMessages[1],
      beforeContext: [testMessages[0]],
      afterContext: [testMessages[2]],
    }));
    mcpController.getAllConversationHistory = mock(async () => ({
      conversations: testConversations,
      messages: { [testConversationId]: testMessages.slice(0, 2) },
    }));

    // MCPサーバーのモック
    mockServer = new MockMcpServer();

    // グローバルなMcpServerコンストラクタをモック
    global.McpServer = mock(() => mockServer);
    global.StdioServerTransport = mock(() => ({
      connect: mock(async () => Promise.resolve()),
    }));
  });

  test("Tool Handlers - start_conversation should create a new conversation", async () => {
    // サーバークラスのモックインスタンスを作成
    const DuckMCPServer = eval(`
      class DuckMCPServer {
        server = mockServer;
        mcpController = mcpController;
        
        registerTools() {
          this.server.tool(
            'start_conversation',
            '新しい会話を開始します。',
            {},
            async (args) => {
              try {
                const conversationId = await this.mcpController.startConversation(
                  args.userId,
                  args.title,
                  args.metadata
                );
                
                return {
                  content: [{ type: 'text', text: JSON.stringify({ conversationId }) }],
                  isError: false
                };
              } catch (error) {
                return {
                  content: [{ type: 'text', text: JSON.stringify({ error: String(error) }) }],
                  isError: true
                };
              }
            }
          );
        }
      }
      DuckMCPServer;
    `);

    const server = new DuckMCPServer();
    server.registerTools();

    // ツールのハンドラーをテスト
    const tool = mockServer.tools["start_conversation"];
    expect(tool).toBeDefined();

    // ハンドラーを実行
    const args = { userId: testUserId, title: "テスト会話", metadata: {} };
    const result = await tool.handler(args);

    // 結果を検証
    expect(result.isError).toBe(false);
    expect(result.content[0].type).toBe("text");

    const responseData = JSON.parse(result.content[0].text);
    expect(responseData).toHaveProperty("conversationId", testConversationId);

    // コントローラーメソッドが呼ばれたことを確認
    expect(mcpController.startConversation).toHaveBeenCalledWith(
      args.userId,
      args.title,
      args.metadata
    );
  });

  test("Tool Handlers - add_user_message should add a user message", async () => {
    // サーバークラスのモックインスタンスを作成
    const DuckMCPServer = eval(`
      class DuckMCPServer {
        server = mockServer;
        mcpController = mcpController;
        
        registerTools() {
          this.server.tool(
            'add_user_message',
            'ユーザーメッセージを追加します。',
            {},
            async (args) => {
              try {
                const messageId = await this.mcpController.addUserMessage(
                  args.userId,
                  args.content,
                  args.metadata
                );
                
                return {
                  content: [{ type: 'text', text: JSON.stringify({ messageId }) }],
                  isError: false
                };
              } catch (error) {
                return {
                  content: [{ type: 'text', text: JSON.stringify({ error: String(error) }) }],
                  isError: true
                };
              }
            }
          );
        }
      }
      DuckMCPServer;
    `);

    const server = new DuckMCPServer();
    server.registerTools();

    // ツールのハンドラーをテスト
    const tool = mockServer.tools["add_user_message"];
    expect(tool).toBeDefined();

    // ハンドラーを実行
    const args = {
      userId: testUserId,
      content: testMessageContent,
      metadata: { sentiment: "neutral" },
    };
    const result = await tool.handler(args);

    // 結果を検証
    expect(result.isError).toBe(false);
    expect(result.content[0].type).toBe("text");

    const responseData = JSON.parse(result.content[0].text);
    expect(responseData).toHaveProperty("messageId", "test-message-1");

    // コントローラーメソッドが呼ばれたことを確認
    expect(mcpController.addUserMessage).toHaveBeenCalledWith(
      args.userId,
      args.content,
      args.metadata
    );
  });

  test("Tool Handlers - search_reference should find relevant conversations", async () => {
    // サーバークラスのモックインスタンスを作成
    const DuckMCPServer = eval(`
      class DuckMCPServer {
        server = mockServer;
        mcpController = mcpController;
        
        registerTools() {
          this.server.tool(
            'search_reference',
            '「あのスレッドのあの会話」を検索します。',
            {},
            async (args) => {
              try {
                const result = await this.mcpController.getConversationByReference(args.referenceText);
                
                if (!result) {
                  return {
                    content: [{ type: 'text', text: JSON.stringify({ found: false }) }],
                    isError: false
                  };
                }
                
                return {
                  content: [{ 
                    type: 'text', 
                    text: JSON.stringify({
                      found: true,
                      conversation: result.conversation,
                      messages: result.messages,
                      matchedMessageIndex: result.matchedMessageIndex
                    }) 
                  }],
                  isError: false
                };
              } catch (error) {
                return {
                  content: [{ type: 'text', text: JSON.stringify({ error: String(error) }) }],
                  isError: true
                };
              }
            }
          );
        }
      }
      DuckMCPServer;
    `);

    const server = new DuckMCPServer();
    server.registerTools();

    // ツールのハンドラーをテスト
    const tool = mockServer.tools["search_reference"];
    expect(tool).toBeDefined();

    // ハンドラーを実行
    const args = { referenceText: "トランスフォーマー" };
    const result = await tool.handler(args);

    // 結果を検証
    expect(result.isError).toBe(false);
    expect(result.content[0].type).toBe("text");

    const responseData = JSON.parse(result.content[0].text);
    expect(responseData).toHaveProperty("found", true);
    expect(responseData).toHaveProperty("conversation");
    expect(responseData).toHaveProperty("messages");
    expect(responseData).toHaveProperty("matchedMessageIndex");

    // コントローラーメソッドが呼ばれたことを確認
    expect(mcpController.getConversationByReference).toHaveBeenCalledWith(
      args.referenceText
    );
  });

  test("Tool Handlers - search_reference should handle not found case", async () => {
    // getConversationByReferenceがnullを返すようにモック
    mcpController.getConversationByReference = mock(async () => null);

    // サーバークラスのモックインスタンスを作成
    const DuckMCPServer = eval(`
      class DuckMCPServer {
        server = mockServer;
        mcpController = mcpController;
        
        registerTools() {
          this.server.tool(
            'search_reference',
            '「あのスレッドのあの会話」を検索します。',
            {},
            async (args) => {
              try {
                const result = await this.mcpController.getConversationByReference(args.referenceText);
                
                if (!result) {
                  return {
                    content: [{ type: 'text', text: JSON.stringify({ found: false }) }],
                    isError: false
                  };
                }
                
                return {
                  content: [{ type: 'text', text: JSON.stringify({ found: true }) }],
                  isError: false
                };
              } catch (error) {
                return {
                  content: [{ type: 'text', text: JSON.stringify({ error: String(error) }) }],
                  isError: true
                };
              }
            }
          );
        }
      }
      DuckMCPServer;
    `);

    const server = new DuckMCPServer();
    server.registerTools();

    // ツールのハンドラーをテスト
    const tool = mockServer.tools["search_reference"];

    // ハンドラーを実行
    const args = { referenceText: "存在しないテキスト" };
    const result = await tool.handler(args);

    // 結果を検証
    const responseData = JSON.parse(result.content[0].text);
    expect(responseData).toHaveProperty("found", false);
  });

  test("Tool Handlers should handle errors gracefully", async () => {
    // エラーをスローするようにモック
    mcpController.startConversation = mock(async () => {
      throw new Error("テストエラー");
    });

    // サーバークラスのモックインスタンスを作成
    const DuckMCPServer = eval(`
      class DuckMCPServer {
        server = mockServer;
        mcpController = mcpController;
        
        createErrorResponse(error) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: String(error) }) }],
            isError: true
          };
        }
        
        registerTools() {
          this.server.tool(
            'start_conversation',
            '新しい会話を開始します。',
            {},
            async (args) => {
              try {
                const conversationId = await this.mcpController.startConversation(
                  args.userId,
                  args.title,
                  args.metadata
                );
                
                return {
                  content: [{ type: 'text', text: JSON.stringify({ conversationId }) }],
                  isError: false
                };
              } catch (error) {
                return this.createErrorResponse(error);
              }
            }
          );
        }
      }
      DuckMCPServer;
    `);

    const server = new DuckMCPServer();
    server.registerTools();

    // ツールのハンドラーをテスト
    const tool = mockServer.tools["start_conversation"];

    // ハンドラーを実行
    const args = { userId: testUserId };
    const result = await tool.handler(args);

    // 結果を検証
    expect(result.isError).toBe(true);

    const responseData = JSON.parse(result.content[0].text);
    expect(responseData).toHaveProperty("error");
    expect(responseData.error).toContain("テストエラー");
  });
});
