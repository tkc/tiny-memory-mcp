import { getDatabase } from "../index";

/**
 * TODOテーブルを初期化する
 */
export function initTodosTable() {
  const db = getDatabase();

  db.run(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      due_date TIMESTAMP,
      completed BOOLEAN DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
