import { getDatabase } from "../database";

export interface Memory {
  id: number;
  content: string;
  created_at: string;
}

export interface MemoryCreateInput {
  content: string;
}

export interface MemoriesAroundId {
  before: Memory[];
  current: Memory | null;
  after: Memory[];
}

/**
 * メモリーを作成する
 */
export function createMemory(memory: MemoryCreateInput): number {
  const db = getDatabase();
  const insert = db.prepare("INSERT INTO memories (content) VALUES (?)");
  const result = insert.run(memory.content);

  return Number(result.lastInsertRowid);
}

/**
 * メモリーをIDで取得する
 */
export function getMemoryById(id: number): Memory | null {
  const db = getDatabase();
  return db
    .prepare("SELECT * FROM memories WHERE id = ?")
    .get(id) as Memory | null;
}

/**
 * 全てのメモリーを取得する
 */
export function getAllMemories(): Memory[] {
  const db = getDatabase();
  return db
    .prepare("SELECT * FROM memories ORDER BY created_at DESC")
    .all() as Memory[];
}

/**
 * テキスト検索でメモリーを検索する
 */
export function searchMemories(searchText: string): Memory[] {
  const db = getDatabase();
  const query = db.prepare(
    "SELECT * FROM memories WHERE content LIKE ? ORDER BY created_at DESC",
  );
  return query.all(`%${searchText}%`) as Memory[];
}

/**
 * 特定のIDを中心に前後のメモリーを取得する
 */
export function getMemoriesAroundId(
  id: number,
  range: number = 5,
): MemoriesAroundId {
  const db = getDatabase();

  // 指定されたIDのメモリーの作成日時を取得
  const targetMemory = db
    .prepare("SELECT created_at FROM memories WHERE id = ?")
    .get(id);

  if (!targetMemory) {
    return { before: [], current: null, after: [] };
  }

  // IDより前のメモリー（新しい順に最大range件）
  const before = db
    .prepare(
      `
    SELECT * FROM memories 
    WHERE created_at > ? 
    ORDER BY created_at ASC 
    LIMIT ?
  `,
    )
    .all(targetMemory.created_at, range) as Memory[];

  // 指定されたIDのメモリー
  const current = db
    .prepare("SELECT * FROM memories WHERE id = ?")
    .get(id) as Memory | null;

  // IDより後のメモリー（古い順に最大range件）
  const after = db
    .prepare(
      `
    SELECT * FROM memories 
    WHERE created_at < ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `,
    )
    .all(targetMemory.created_at, range) as Memory[];

  return {
    before: before.reverse(), // 古い順に並べ替え
    current,
    after,
  };
}

/**
 * 指定した日付範囲内のメモリーを取得する
 */
export function getMemoriesByDateRange(
  startDate: Date,
  endDate: Date,
): Memory[] {
  const db = getDatabase();
  const query = db.prepare(`
    SELECT * FROM memories 
    WHERE created_at >= ? AND created_at <= ? 
    ORDER BY created_at DESC
  `);

  return query.all(startDate.toISOString(), endDate.toISOString()) as Memory[];
}
