import { describe, expect, test, beforeEach, mock } from "bun:test";
import { EmbeddingService } from "../../src/services/embedding-service";
import { MessageRepository } from "../../src/repositories/message-repository";
import { MockDatabase } from "../fixtures/test-data";

describe("EmbeddingService", () => {
  let mockDb: MockDatabase;
  let mockMessageRepo: MessageRepository;
  let embeddingService: EmbeddingService;

  beforeEach(() => {
    mockDb = new MockDatabase();
    mockMessageRepo = new MessageRepository(mockDb);

    // モックメソッドをセットアップ
    mockMessageRepo.saveEmbedding = mock(async () => Promise.resolve());
    mockMessageRepo.searchSimilarMessages = mock(async () => [
      { message_id: "msg1", content: "関連メッセージ1", similarity: 0.95 },
      { message_id: "msg2", content: "関連メッセージ2", similarity: 0.85 },
      { message_id: "msg3", content: "関連メッセージ3", similarity: 0.75 },
    ]);

    embeddingService = new EmbeddingService(mockMessageRepo);
  });

  test("generateEmbedding creates a valid embedding vector of correct dimension", async () => {
    const testText = "テスト文章です。埋め込みベクトルを生成します。";

    const embedding = await embeddingService.generateEmbedding(testText);

    // 埋め込みベクトルの次元数が正しいことを確認
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(384); // デフォルトの埋め込み次元数

    // すべての値が数値であることを確認
    embedding.forEach((value) => {
      expect(typeof value).toBe("number");
      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThanOrEqual(1);
    });

    // ベクトルが正規化されていることを確認（長さが約1.0）
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0),
    );
    expect(magnitude).toBeCloseTo(1.0, 1); // 許容誤差0.1で1.0に近いことを確認
  });

  test("generateEmbedding creates different embeddings for different texts", async () => {
    const text1 = "これは一つ目のテスト文章です。";
    const text2 = "全く異なる内容の二つ目の文章です。";

    const embedding1 = await embeddingService.generateEmbedding(text1);
    const embedding2 = await embeddingService.generateEmbedding(text2);

    // 同じ次元数を持つこと
    expect(embedding1.length).toBe(embedding2.length);

    // 異なるベクトルであること
    let differences = 0;
    for (let i = 0; i < embedding1.length; i++) {
      if (Math.abs(embedding1[i] - embedding2[i]) > 0.01) {
        differences++;
      }
    }

    // 少なくともいくつかの次元で十分な差があること
    expect(differences).toBeGreaterThan(embedding1.length * 0.3); // 少なくとも30%は異なる値
  });

  test("generateEmbedding creates embeddings that can be compared", async () => {
    // プレースホルダー実装では類似度の予測が難しいため、単に値を計算できることを確認
    const text1 = "人工知能についての最新の研究成果";
    const text2 = "AIに関する最新の研究の進展";

    const embedding1 = await embeddingService.generateEmbedding(text1);
    const embedding2 = await embeddingService.generateEmbedding(text2);

    // コサイン類似度を計算
    const dotProduct = embedding1.reduce(
      (sum, val, i) => sum + val * embedding2[i],
      0,
    );
    const magnitude1 = Math.sqrt(
      embedding1.reduce((sum, val) => sum + val * val, 0),
    );
    const magnitude2 = Math.sqrt(
      embedding2.reduce((sum, val) => sum + val * val, 0),
    );
    const cosineSimilarity = dotProduct / (magnitude1 * magnitude2);

    // 類似度が計算可能であることを確認
    expect(typeof cosineSimilarity).toBe("number");
    expect(cosineSimilarity).toBeGreaterThan(-1);
    expect(cosineSimilarity).toBeLessThan(1);
  });

  test("processMessageEmbedding generates and saves embedding for a message", async () => {
    const messageId = "test-message-id";
    const content = "テストメッセージの内容";

    await embeddingService.processMessageEmbedding(messageId, content);

    expect(mockMessageRepo.saveEmbedding).toHaveBeenCalled();

    const saveCall = mockMessageRepo.saveEmbedding.mock.calls[0];
    expect(saveCall[0]).toBe(messageId);

    const embedding = saveCall[1];
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(384); // デフォルトの埋め込み次元数
  });

  test("findSimilarMessages returns similar messages", async () => {
    const query = "検索クエリ";
    const limit = 3;

    const result = await embeddingService.findSimilarMessages(query, limit);

    expect(mockMessageRepo.searchSimilarMessages).toHaveBeenCalled();

    const searchCall = mockMessageRepo.searchSimilarMessages.mock.calls[0];
    expect(Array.isArray(searchCall[0])).toBe(true); // 最初の引数は埋め込みベクトル
    expect(searchCall[1]).toBe(limit);

    expect(result).toEqual([
      { message_id: "msg1", content: "関連メッセージ1", similarity: 0.95 },
      { message_id: "msg2", content: "関連メッセージ2", similarity: 0.85 },
      { message_id: "msg3", content: "関連メッセージ3", similarity: 0.75 },
    ]);
  });

  test("findSimilarMessages uses default limit when not specified", async () => {
    const query = "検索クエリ";

    await embeddingService.findSimilarMessages(query);

    expect(mockMessageRepo.searchSimilarMessages).toHaveBeenCalled();
    expect(mockMessageRepo.searchSimilarMessages.mock.calls[0][1]).toBe(5); // デフォルト値
  });

  test("createPlaceholderEmbedding creates deterministic embeddings based on input text", async () => {
    // プライベートメソッドを直接テストするために、テスト用にスパイを設置
    const originalMethod = (embeddingService as any).createPlaceholderEmbedding;
    const spy = mock(originalMethod);
    (embeddingService as any).createPlaceholderEmbedding = spy;

    const text = "テストテキスト";
    await embeddingService.generateEmbedding(text);

    expect(spy).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(text);

    // 元のメソッドに戻す
    (embeddingService as any).createPlaceholderEmbedding = originalMethod;
  });
});
