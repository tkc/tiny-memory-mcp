import { Database } from "bun:sqlite";
import { initTodosTable } from "./schema/todos";
import { initMemoriesTable } from "./schema/memories";

// データベース接続を作成（テスト用の場合は引数で指定されたパスを使用）
let db: Database;

export function setupDatabase(dbPath: string = "tiny-memory.db") {
  // 既存の接続があれば閉じる
  if (db) {
    try {
      db.close();
    } catch (e) {
      // すでに閉じられている場合は無視
      console.log(e);
    }
  }

  // 新しい接続を作成
  db = new Database(dbPath);
  return db;
}

// デフォルトのデータベース接続を初期化
setupDatabase();

// テーブル作成
export function initializeDatabase() {
  initTodosTable();
  initMemoriesTable();

  console.log("データベースの初期化が完了しました");
}

// データベースを閉じる関数
export function closeDatabase() {
  if (db) {
    db.close();
    console.log("データベース接続を閉じました");
  }
}

// 現在のデータベース接続を取得する関数
export function getDatabase() {
  return db;
}
