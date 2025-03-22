import * as memoryRepo from "../repositories/memoryRepository";
import { Memory, MemoryCreateInput } from "../repositories/memoryRepository";

/**
 * メモリーを作成する
 * @param content メモリーの内容
 * @returns 作成したメモリーのID
 */
export function createMemory(content: string): number {
  const memoryInput: MemoryCreateInput = {
    content,
  };

  return memoryRepo.createMemory(memoryInput);
}

/**
 * キーワードを含むメモリーの要約を取得する
 * @param keyword 検索キーワード
 * @returns 検索結果の要約
 */
export function getMemorySummary(keyword: string) {
  // リポジトリを使用してメモリーを検索
  const memories = memoryRepo.searchMemories(keyword);

  return {
    count: memories.length,
    latest: memories.length > 0 ? memories[0] : null,
    oldest: memories.length > 0 ? memories[memories.length - 1] : null,
    keywords: keyword,
  };
}

/**
 * 最新のメモリーを指定件数取得する
 * @param limit 取得する件数
 * @returns 最新のメモリーリスト
 */
export function getLatestMemories(limit: number = 10): Memory[] {
  // リポジトリを使用して全メモリーを取得
  const memories = memoryRepo.getAllMemories();
  return memories.slice(0, limit);
}

/**
 * メモリーの前後コンテキストを取得し、マークダウン形式でフォーマットする
 * @param id メモリーID
 * @param range 前後の取得範囲
 * @returns マークダウン形式のコンテキスト
 */
export function getMemoryContextAsMarkdown(
  id: number,
  range: number = 5,
): string {
  // リポジトリを使用してメモリーの前後コンテキストを取得
  const context = memoryRepo.getMemoriesAroundId(id, range);

  if (!context.current) {
    return "指定されたIDのメモリーが見つかりません。";
  }

  let markdown = "# メモリーコンテキスト\n\n";

  if (context.before.length > 0) {
    markdown += "## 前のメモリー\n\n";
    context.before.forEach((memory) => {
      const date = new Date(memory.created_at).toLocaleString();
      markdown += `- **${date}**: ${memory.content}\n`;
    });
    markdown += "\n";
  }

  markdown += "## 現在のメモリー\n\n";
  const currentDate = new Date(context.current.created_at).toLocaleString();
  markdown += `**${currentDate}**: ${context.current.content}\n\n`;

  if (context.after.length > 0) {
    markdown += "## 後のメモリー\n\n";
    context.after.forEach((memory) => {
      const date = new Date(memory.created_at).toLocaleString();
      markdown += `- **${date}**: ${memory.content}\n`;
    });
  }

  return markdown;
}

/**
 * 日付ごとのメモリー数を集計する
 * @param days 過去何日分を集計するか
 * @returns 日付ごとのメモリー数
 */
export function getMemoryStatsByDate(days: number = 30) {
  // リポジトリを使用して全メモリーを取得
  const memories = memoryRepo.getAllMemories();

  // 日付範囲の作成
  const stats: Record<string, number> = {};
  const today = new Date();

  // 過去days日分の日付を初期化
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD形式
    stats[dateStr] = 0;
  }

  // メモリーを日付ごとに集計
  memories.forEach((memory) => {
    const dateStr = new Date(memory.created_at).toISOString().split("T")[0];

    // 集計対象の日付範囲内であれば加算
    if (stats[dateStr] !== undefined) {
      stats[dateStr]++;
    }
  });

  // 日付でソートした結果を返す
  return Object.entries(stats)
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, count]) => ({ date, count }));
}

/**
 * 特定の文字列パターンを含むメモリーをグループ化する
 * @param pattern 検索パターン
 * @returns グループ化されたメモリー
 */
export function groupMemoriesByPattern(pattern: string) {
  // リポジトリを使用してメモリーを検索
  const memories = memoryRepo.searchMemories(pattern);

  // メモリーをパターンごとにグループ化
  const groups: Record<string, Memory[]> = {};

  memories.forEach((memory) => {
    // パターンをシンプルに抽出する例（実際には正規表現などでより柔軟に）
    const content = memory.content;
    const match = content.includes(pattern) ? pattern : "その他";

    if (!groups[match]) {
      groups[match] = [];
    }

    groups[match].push(memory);
  });

  return groups;
}

/**
 * 指定した日付範囲内のメモリーを取得する
 * @param startDate 開始日
 * @param endDate 終了日
 * @returns 日付範囲内のメモリー
 */
export function getMemoriesByDateRange(
  startDate: Date,
  endDate: Date,
): Memory[] {
  // リポジトリを使用して日付範囲でメモリーを取得
  return memoryRepo.getMemoriesByDateRange(startDate, endDate);
}
