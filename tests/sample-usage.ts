/**
 * Duck MCP (シンプル版)の使用例を示すサンプルコード
 */

async function sampleUsage() {
  const API_BASE = "http://localhost:3000";

  // 1. 新しい会話を開始
  const userId = "user123";
  const conversationResponse = await fetch(`${API_BASE}/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      title: "機械学習モデルの選び方",
      metadata: { topic: "model-selection" },
    }),
  });

  const { conversationId } = await conversationResponse.json();
  console.log(`新しい会話が開始されました: ${conversationId}`);

  // 2. メッセージのやり取り
  const messages = [
    {
      role: "user",
      content: "機械学習モデルの選び方について教えてください。",
      endpoint: "messages/user",
    },
    {
      role: "assistant",
      content:
        "機械学習モデルの選択は問題の性質によって異なります。分類、回帰、クラスタリングなど、どのような問題を解決したいですか？",
      endpoint: "messages/assistant",
    },
    {
      role: "user",
      content: "画像分類をしたいと考えています。",
      endpoint: "messages/user",
    },
    {
      role: "assistant",
      content:
        "画像分類には畳み込みニューラルネットワーク（CNN）が適しています。ResNet、EfficientNet、Vision Transformerなどがよく使われるアーキテクチャです。",
      endpoint: "messages/assistant",
    },
  ];

  for (const msg of messages) {
    await fetch(`${API_BASE}/${msg.endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        content: msg.content,
      }),
    });

    console.log(
      `${msg.role}メッセージを追加しました: ${msg.content.slice(0, 30)}...`,
    );
  }

  // 3. 「あのスレッドのあの会話」を参照
  const referenceResponse = await fetch(`${API_BASE}/search/reference`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      referenceText: "画像分類 CNN",
    }),
  });

  const referenceResult = await referenceResponse.json();

  if (referenceResult.found) {
    console.log("会話が見つかりました:");
    console.log("  タイトル:", referenceResult.conversation.title);
    console.log(
      "  マッチしたメッセージ:",
      referenceResult.messages[referenceResult.matchedMessageIndex].content,
    );
  }

  // 4. 「こんな会話思い出して、この時の話の前後が欲しい」
  const contextResponse = await fetch(
    `${API_BASE}/memory/remember-with-context`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "画像分類",
        contextWindowSize: 2,
      }),
    },
  );

  const contextResult = await contextResponse.json();

  if (contextResult.found) {
    console.log("会話コンテキストが見つかりました:");
    console.log(
      "  マッチしたメッセージ:",
      contextResult.matchedMessage.content,
    );
    console.log(
      "  前のコンテキスト:",
      contextResult.beforeContext.map((m) => m.content),
    );
    console.log(
      "  後のコンテキスト:",
      contextResult.afterContext.map((m) => m.content),
    );
  }

  // 5. すべての会話履歴を取得
  const historyResponse = await fetch(`${API_BASE}/memory/all-history`);
  const history = await historyResponse.json();

  console.log("取得した会話履歴の概要:");
  console.log("  会話数:", history.conversations.length);

  // 各会話のメッセージ数をカウント
  let totalMessages = 0;
  Object.values(history.messages).forEach((msgs: any[]) => {
    totalMessages += msgs.length;
  });

  console.log("  メッセージ総数:", totalMessages);
}

// 実行（実際のサーバーが動いていることが前提）
// sampleUsage().catch(console.error);

export { sampleUsage };
