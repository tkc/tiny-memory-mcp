// Duck MCP のファイルシステムによる簡易デモ (続き)
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// データ保存用ディレクトリ
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 会話とメッセージを保存するJSONファイル
const conversationsFile = path.join(dataDir, "conversations.json");
const messagesFile = path.join(dataDir, "messages.json");

// 初期データ
let conversations = [];
let messages = [];

// ファイルが存在する場合は読み込む
try {
  if (fs.existsSync(conversationsFile)) {
    const data = fs.readFileSync(conversationsFile, "utf8");
    conversations = JSON.parse(data);
    console.log(`Loaded ${conversations.length} conversations`);
  }

  if (fs.existsSync(messagesFile)) {
    const data = fs.readFileSync(messagesFile, "utf8");
    messages = JSON.parse(data);
    console.log(`Loaded ${messages.length} messages`);
  }
} catch (error) {
  console.error("Error loading data:", error);
}

// MCPコントローラークラス（ファイルシステム版）
class FSMCPController {
  // 新しい会話を開始
  startConversation(userId, title = "新しい会話", metadata = {}) {
    const conversationId = randomUUID();
    const now = new Date();

    const conversation = {
      conversation_id: conversationId,
      title,
      created_at: now,
      updated_at: now,
      metadata: { ...metadata, userId },
    };

    conversations.push(conversation);
    this._saveConversations();

    return conversationId;
  }

  // ユーザーメッセージを追加
  addUserMessage(userId, content, metadata = {}) {
    return this._addMessage(userId, "user", content, metadata);
  }

  // アシスタントメッセージを追加
  addAssistantMessage(userId, content, metadata = {}) {
    return this._addMessage(userId, "assistant", content, metadata);
  }

  // メッセージを追加（共通処理）
  _addMessage(userId, role, content, metadata = {}) {
    // ユーザーの最新の会話を探す
    let conversationId = this._getUserLatestConversation(userId);

    // 会話がなければ新規作成
    if (!conversationId) {
      conversationId = this.startConversation(userId);
    }

    const messageId = randomUUID();
    const now = new Date();

    const message = {
      message_id: messageId,
      conversation_id: conversationId,
      timestamp: now,
      role,
      content,
      metadata,
    };

    messages.push(message);
    this._saveMessages();

    // 会話の更新時間を更新
    const conversation = conversations.find(
      (c) => c.conversation_id === conversationId,
    );
    if (conversation) {
      conversation.updated_at = now;
      this._saveConversations();
    }

    return messageId;
  }

  // ユーザーの最新の会話IDを取得
  _getUserLatestConversation(userId) {
    // 更新日時でソートして最新の会話を取得
    const userConversations = conversations
      .filter((c) => c.metadata?.userId === userId)
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    return userConversations.length > 0
      ? userConversations[0].conversation_id
      : null;
  }

  // 会話のメッセージを取得
  getConversationMessages(conversationId) {
    return messages
      .filter((m) => m.conversation_id === conversationId)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  // 現在の会話の履歴を取得
  getCurrentConversation(userId) {
    const conversationId = this._getUserLatestConversation(userId);
    if (!conversationId) return [];

    return this.getConversationMessages(conversationId);
  }

  // すべての会話履歴を取得
  getAllConversationHistory() {
    const messagesMap = {};

    for (const conversation of conversations) {
      const conversationMessages = this.getConversationMessages(
        conversation.conversation_id,
      );
      messagesMap[conversation.conversation_id] = conversationMessages;
    }

    return {
      conversations,
      messages: messagesMap,
    };
  }

  // 関連する会話を検索（シンプルな単語一致）
  searchConversations(keyword) {
    const matchingMessages = messages.filter((m) =>
      m.content.toLowerCase().includes(keyword.toLowerCase()),
    );

    const matchingConversationIds = new Set(
      matchingMessages.map((m) => m.conversation_id),
    );

    const matchingConversations = conversations.filter((c) =>
      matchingConversationIds.has(c.conversation_id),
    );

    return {
      conversations: matchingConversations,
      messages: matchingMessages,
    };
  }

  // 会話データを保存
  _saveConversations() {
    fs.writeFileSync(conversationsFile, JSON.stringify(conversations, null, 2));
  }

  // メッセージデータを保存
  _saveMessages() {
    fs.writeFileSync(messagesFile, JSON.stringify(messages, null, 2));
  }
}

// コントローラーの初期化
const mcpController = new FSMCPController();

// デモ実行 (続き)
console.log("⏳ Running Duck MCP FS Demo (続き)...");

// 既存のユーザーの会話に続ける
const userId = "demo-user-001";

// 新しいメッセージを追加
const userMessageId = mcpController.addUserMessage(
  userId,
  "その中でも特にトランスフォーマーアーキテクチャについて詳しく知りたいです。",
);
console.log(`✅ Added user message: ${userMessageId}`);

const assistantMessageId = mcpController.addAssistantMessage(
  userId,
  "トランスフォーマーアーキテクチャは、2017年にGoogleが発表した「Attention is All You Need」論文で紹介されたニューラルネットワーク構造です。マルチヘッドアテンション機構により、長距離の依存関係を効率的に処理できる点が特徴です。現在のGPT、Claude、Llama、Mistraなど最先端のAIモデルはすべてトランスフォーマーをベースにしています。",
);
console.log(`✅ Added assistant message: ${assistantMessageId}`);

// 会話履歴を取得
const currentConversation = mcpController.getCurrentConversation(userId);
console.log("\n会話の全内容:");
for (const msg of currentConversation) {
  console.log(`[${msg.role}]: ${msg.content}`);
}

// キーワード検索でメッセージを探す
const keyword = "トランスフォーマー";
console.log(`\n「${keyword}」に関連する会話を検索:`);
const searchResults = mcpController.searchConversations(keyword);
console.log(`- ${searchResults.conversations.length}個の会話が見つかりました`);
console.log(`- ${searchResults.messages.length}個のメッセージが見つかりました`);

if (searchResults.messages.length > 0) {
  console.log("\n検索結果の一部:");
  searchResults.messages.slice(0, 2).forEach((msg) => {
    console.log(`[${msg.role}]: ${msg.content.substring(0, 100)}...`);
  });
}

console.log("\n✅ Demo continuing completed successfully");
