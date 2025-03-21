import { Hono } from "hono";
import { cors } from "hono/cors";
import { MCPController } from "../services/mcp-controller";

/**
 * APIを構築するためのユーティリティ関数
 */
export function createAPI(mcpController: MCPController) {
  const app = new Hono();

  // CORSを有効化
  app.use("*", cors());

  // エラーハンドラー
  app.onError((err, c) => {
    console.error("API Error:", err);
    return c.json({ error: err.message }, 500);
  });

  // ヘルスチェック
  app.get("/", (c) => c.json({ status: "ok", version: "0.1.0" }));

  // 会話関連のエンドポイント
  app.post("/conversations", async (c) => {
    const { userId, title, metadata } = await c.req.json();
    const conversationId = await mcpController.startConversation(
      userId,
      title,
      metadata,
    );
    return c.json({ conversationId });
  });

  // メッセージ関連のエンドポイント
  app.post("/messages/user", async (c) => {
    const { userId, content, metadata } = await c.req.json();
    const messageId = await mcpController.addUserMessage(
      userId,
      content,
      metadata,
    );
    return c.json({ messageId });
  });

  app.post("/messages/assistant", async (c) => {
    const { userId, content, metadata } = await c.req.json();
    const messageId = await mcpController.addAssistantMessage(
      userId,
      content,
      metadata,
    );
    return c.json({ messageId });
  });

  // 会話履歴取得
  app.get("/conversations/current", async (c) => {
    const userId = c.req.query("userId");
    if (!userId) {
      return c.json({ error: "userId is required" }, 400);
    }

    const messages = await mcpController.getCurrentConversation(userId);
    return c.json({ messages });
  });

  // 「あのスレッドのあの会話」を検索するエンドポイント
  app.post("/search/reference", async (c) => {
    const { referenceText } = await c.req.json();
    const result =
      await mcpController.getConversationByReference(referenceText);

    if (!result) {
      return c.json({ found: false });
    }

    return c.json({
      found: true,
      conversation: result.conversation,
      messages: result.messages,
      matchedMessageIndex: result.matchedMessageIndex,
    });
  });

  // 「こんな会話思い出して、この時の話の前後が欲しい」機能のエンドポイント
  app.post("/memory/remember-with-context", async (c) => {
    const { query, contextWindowSize = 5 } = await c.req.json();
    const result = await mcpController.rememberConversationWithContext(
      query,
      contextWindowSize,
    );

    if (!result) {
      return c.json({ found: false });
    }

    return c.json({
      found: true,
      conversation: result.conversation,
      matchedMessage: result.matchedMessage,
      beforeContext: result.beforeContext,
      afterContext: result.afterContext,
    });
  });

  // すべての会話履歴を取得するエンドポイント
  app.get("/memory/all-history", async (c) => {
    const history = await mcpController.getAllConversationHistory();
    return c.json(history);
  });

  return app;
}
