/**
 * Duck MCP - Model Context Protocol (MCP) Server Implementation
 *
 * DuckDBを使用した会話履歴の保存と検索機能を提供するMCPサーバー
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { NativeDuckDBConnection } from "./db/native-duckdb-connection";
import { ConversationRepository } from "./repositories/conversation-repository";
import { MessageRepository } from "./repositories/message-repository";
import { EmbeddingService } from "./services/embedding-service";
import { MCPController } from "./services/mcp-controller";
import * as path from "path";
import * as fs from "fs";

// データベースファイルのパス
const dbPath = process.env.DB_PATH || "data/conversations.duckdb";

// データディレクトリの確認
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// ログユーティリティ
const logLevel = process.env.LOG_LEVEL || "info";
function log(level: string, ...args: any[]) {
  if (level === "debug" && logLevel !== "debug") return;
  console.error(`[${level.toUpperCase()}]`, ...args);
}

// MCPツール名をenumオブジェクトとして定義
const DuckMCPTools = {
  // 会話関連ツール
  START_CONVERSATION: "start_conversation",
  ADD_USER_MESSAGE: "add_user_message",
  ADD_ASSISTANT_MESSAGE: "add_assistant_message",
  GET_CURRENT_CONVERSATION: "get_current_conversation",

  // 検索関連ツール
  SEARCH_REFERENCE: "search_reference",
  REMEMBER_WITH_CONTEXT: "remember_with_context",
  GET_ALL_HISTORY: "get_all_history",
} as const;

// ツール入力用のZodスキーマを定義
const StartConversationSchema = z.object({
  userId: z.string().describe("ユーザーID"),
  title: z.string().optional().describe("会話のタイトル"),
  metadata: z.record(z.any()).optional().describe("追加のメタデータ"),
});

const AddUserMessageSchema = z.object({
  userId: z.string().describe("ユーザーID"),
  content: z.string().describe("メッセージの内容"),
  metadata: z.record(z.any()).optional().describe("追加のメタデータ"),
});

const AddAssistantMessageSchema = z.object({
  userId: z.string().describe("ユーザーID"),
  content: z.string().describe("メッセージの内容"),
  metadata: z.record(z.any()).optional().describe("追加のメタデータ"),
});

const GetCurrentConversationSchema = z.object({
  userId: z.string().describe("ユーザーID"),
});

const SearchReferenceSchema = z.object({
  referenceText: z.string().describe("検索するテキスト"),
});

const RememberWithContextSchema = z.object({
  query: z.string().describe("検索クエリ"),
  contextWindowSize: z.number().optional().describe("前後のコンテキストサイズ"),
});

const GetAllHistorySchema = z.object({});

/**
 * Duck MCPサーバークラス
 */
class DuckMCPServer {
  private server: McpServer;
  private mcpController: MCPController;

  constructor() {
    // MCPサーバーの初期化
    this.server = new McpServer({
      name: "duck-mcp",
      version: "0.2.0",
      description:
        "DuckDBを使用した会話履歴の保存と検索機能を提供するMCPサーバー",
    });

    // データベース接続の初期化
    this.initializeDatabase().catch((error) => {
      log("error", "Failed to initialize database:", error);
      process.exit(1);
    });
  }

  /**
   * データベースと各コンポーネントを初期化
   */
  private async initializeDatabase() {
    try {
      log("info", "🦆 Initializing DuckDB...");

      // DuckDBの初期化
      const connection = new NativeDuckDBConnection(dbPath);
      await connection.initialize();

      // リポジトリの初期化
      const conversationRepo = new ConversationRepository(connection);
      const messageRepo = new MessageRepository(connection);

      // サービスの初期化
      const embeddingService = new EmbeddingService(messageRepo);

      // MCPコントローラーの初期化
      this.mcpController = new MCPController(
        conversationRepo,
        messageRepo,
        embeddingService,
      );

      log("info", "✅ Database initialized successfully");
    } catch (error) {
      log("error", "❌ Database initialization failed:", error);
      throw error;
    }
  }

  /**
   * MCPサーバーにツールを登録
   */
  private registerTools() {
    // 会話開始ツール
    this.server.tool(
      DuckMCPTools.START_CONVERSATION,
      "新しい会話を開始します。会話のタイトルとメタデータを指定できます。",
      StartConversationSchema.shape,
      async (args) => {
        try {
          const conversationId = await this.mcpController.startConversation(
            args.userId,
            args.title,
            args.metadata,
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ conversationId }, null, 2),
              },
            ],
            isError: false,
          };
        } catch (error) {
          return this.createErrorResponse(error);
        }
      },
    );

    // ユーザーメッセージ追加ツール
    this.server.tool(
      DuckMCPTools.ADD_USER_MESSAGE,
      "ユーザーからのメッセージを会話に追加します。",
      AddUserMessageSchema.shape,
      async (args) => {
        try {
          const messageId = await this.mcpController.addUserMessage(
            args.userId,
            args.content,
            args.metadata,
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ messageId }, null, 2),
              },
            ],
            isError: false,
          };
        } catch (error) {
          return this.createErrorResponse(error);
        }
      },
    );

    // アシスタントメッセージ追加ツール
    this.server.tool(
      DuckMCPTools.ADD_ASSISTANT_MESSAGE,
      "アシスタントからのメッセージを会話に追加します。",
      AddAssistantMessageSchema.shape,
      async (args) => {
        try {
          const messageId = await this.mcpController.addAssistantMessage(
            args.userId,
            args.content,
            args.metadata,
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ messageId }, null, 2),
              },
            ],
            isError: false,
          };
        } catch (error) {
          return this.createErrorResponse(error);
        }
      },
    );

    // 現在の会話取得ツール
    this.server.tool(
      DuckMCPTools.GET_CURRENT_CONVERSATION,
      "現在のユーザーの会話履歴を取得します。",
      GetCurrentConversationSchema.shape,
      async (args) => {
        try {
          const messages = await this.mcpController.getCurrentConversation(
            args.userId,
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ messages }, null, 2),
              },
            ],
            isError: false,
          };
        } catch (error) {
          return this.createErrorResponse(error);
        }
      },
    );

    // 会話参照検索ツール
    this.server.tool(
      DuckMCPTools.SEARCH_REFERENCE,
      "「あのスレッドのあの会話」を検索します。指定したテキストに類似した会話を見つけます。",
      SearchReferenceSchema.shape,
      async (args) => {
        try {
          const result = await this.mcpController.getConversationByReference(
            args.referenceText,
          );

          if (!result) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ found: false }, null, 2),
                },
              ],
              isError: false,
            };
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    found: true,
                    conversation: result.conversation,
                    messages: result.messages,
                    matchedMessageIndex: result.matchedMessageIndex,
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: false,
          };
        } catch (error) {
          return this.createErrorResponse(error);
        }
      },
    );

    // コンテキスト付き記憶検索ツール
    this.server.tool(
      DuckMCPTools.REMEMBER_WITH_CONTEXT,
      "「こんな会話思い出して、この時の話の前後が欲しい」機能を提供します。",
      RememberWithContextSchema.shape,
      async (args) => {
        try {
          const result =
            await this.mcpController.rememberConversationWithContext(
              args.query,
              args.contextWindowSize,
            );

          if (!result) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ found: false }, null, 2),
                },
              ],
              isError: false,
            };
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    found: true,
                    conversation: result.conversation,
                    matchedMessage: result.matchedMessage,
                    beforeContext: result.beforeContext,
                    afterContext: result.afterContext,
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: false,
          };
        } catch (error) {
          return this.createErrorResponse(error);
        }
      },
    );

    // 全履歴取得ツール
    this.server.tool(
      DuckMCPTools.GET_ALL_HISTORY,
      "すべての会話履歴を取得します。",
      GetAllHistorySchema.shape,
      async () => {
        try {
          const history = await this.mcpController.getAllConversationHistory();

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(history, null, 2),
              },
            ],
            isError: false,
          };
        } catch (error) {
          return this.createErrorResponse(error);
        }
      },
    );
  }

  /**
   * エラーレスポンスを作成
   */
  private createErrorResponse(error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: errorMessage }, null, 2),
        },
      ],
      isError: true,
    };
  }

  /**
   * サーバーを開始
   */
  public async start() {
    try {
      // ツールの登録
      this.registerTools();

      // トランスポートの設定と接続
      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      log("info", "🚀 Duck MCP Server started");
      log("info", `💾 Database: ${dbPath}`);
    } catch (error) {
      log("error", "❌ Failed to start Duck MCP Server:", error);
      throw error;
    }
  }
}

// サーバーのインスタンスを作成して開始
async function main() {
  try {
    const server = new DuckMCPServer();
    await server.start();
  } catch (error) {
    log("error", "Fatal error:", error);
    process.exit(1);
  }
}

// サーバーを実行
main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
