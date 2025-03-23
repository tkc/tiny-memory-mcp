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
 * Create a memory
 */
export function createMemory(memory: MemoryCreateInput): number {
  const db = getDatabase();
  const insert = db.prepare("INSERT INTO memories (content) VALUES (?)");
  const result = insert.run(memory.content);

  return Number(result.lastInsertRowid);
}

/**
 * Get memory by ID
 */
export function getMemoryById(id: number): Memory | null {
  const db = getDatabase();
  return db
    .prepare("SELECT * FROM memories WHERE id = ?")
    .get(id) as Memory | null;
}

/**
 * Get all memories
 */
export function getAllMemories(): Memory[] {
  const db = getDatabase();
  return db
    .prepare("SELECT * FROM memories ORDER BY created_at DESC")
    .all() as Memory[];
}

/**
 * Search memories by text
 */
export function searchMemories(searchText: string): Memory[] {
  const db = getDatabase();
  const query = db.prepare(
    "SELECT * FROM memories WHERE content LIKE ? ORDER BY created_at DESC",
  );
  return query.all(`%${searchText}%`) as Memory[];
}

/**
 * Get memories around a specific ID
 */
export function getMemoriesAroundId(
  id: number,
  range: number = 5,
): MemoriesAroundId {
  const db = getDatabase();

  // Get the creation timestamp of the specified memory
  const targetMemory = db
    .prepare("SELECT created_at FROM memories WHERE id = ?")
    .get(id);

  if (!targetMemory) {
    return { before: [], current: null, after: [] };
  }

  // Memories before the ID (newer ones, maximum range entries)
  const before = db
    .prepare(
      `
    SELECT * FROM memories 
    WHERE created_at > ? 
    ORDER BY created_at ASC 
    LIMIT ?
  `,
    )
    .all((targetMemory as Memory).created_at, range) as Memory[];

  // The memory with the specified ID
  const current = db
    .prepare("SELECT * FROM memories WHERE id = ?")
    .get(id) as Memory | null;

  // Memories after the ID (older ones, maximum range entries)
  const after = db
    .prepare(
      `
    SELECT * FROM memories 
    WHERE created_at < ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `,
    )
    .all((targetMemory as Memory).created_at, range) as Memory[];

  return {
    before: before.reverse(), // Sort by oldest first
    current,
    after,
  };
}

/**
 * Get memories within a date range
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
