import { getDatabase } from "../index";

/**
 * Initialize the Memories table
 */
export function initMemoriesTable() {
  const db = getDatabase();

  db.run(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
