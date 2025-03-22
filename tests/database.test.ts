import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import {
  setupDatabase,
  initializeDatabase,
  closeDatabase,
  getDatabase,
} from "../src/database";
import * as fs from "fs";

// テスト用の一時データベースファイル
const TEST_DB_FILE = "test-db.sqlite";

describe("データベース機能テスト", () => {
  // 各テスト前に実行
  beforeEach(() => {
    // 既存のテストDBファイルがあれば削除
    if (fs.existsSync(TEST_DB_FILE)) {
      fs.unlinkSync(TEST_DB_FILE);
    }

    // テスト用のDBファイルを作成して初期化
    setupDatabase(TEST_DB_FILE);
    initializeDatabase();
  });

  // 各テスト後に実行
  afterEach(() => {
    closeDatabase();
    // テストDBファイルを削除
    if (fs.existsSync(TEST_DB_FILE)) {
      fs.unlinkSync(TEST_DB_FILE);
    }
  });

  test("データベースが正しく初期化される", () => {
    // todosテーブルが存在するか確認
    const db = getDatabase();
    const todoTableExists = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='todos'",
      )
      .get();

    // memoriesテーブルが存在するか確認
    const memoriesTableExists = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='memories'",
      )
      .get();

    expect(todoTableExists).toBeTruthy();
    expect(memoriesTableExists).toBeTruthy();
  });

  test("todosテーブルが正しいスキーマを持つ", () => {
    const db = getDatabase();
    const tableInfo = db.prepare("PRAGMA table_info(todos)").all();

    // カラム名の配列を作成
    const columnNames = tableInfo.map((col) => col.name);

    // 期待するカラムが存在するか確認
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("title");
    expect(columnNames).toContain("description");
    expect(columnNames).toContain("due_date");
    expect(columnNames).toContain("completed");
    expect(columnNames).toContain("created_at");
  });

  test("memoriesテーブルが正しいスキーマを持つ", () => {
    const db = getDatabase();
    const tableInfo = db.prepare("PRAGMA table_info(memories)").all();

    // カラム名の配列を作成
    const columnNames = tableInfo.map((col) => col.name);

    // 期待するカラムが存在するか確認
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("content");
    expect(columnNames).toContain("created_at");
  });
});
