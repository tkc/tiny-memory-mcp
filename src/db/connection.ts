import { Database } from "../types/database";
import { DatabaseSchema } from "./schema";
import { AsyncDuckDB } from "@duckdb/duckdb-wasm";
import { v4 as uuidv4 } from "uuid";

/**
 * DuckDBとの接続を管理するクラス
 */
export class DuckDBConnection implements Database {
  private db: AsyncDuckDB;
  private dbPath: string;
  private isInitialized: boolean = false;

  constructor(db: AsyncDuckDB, dbPath: string = "data/conversations.duckdb") {
    this.db = db;
    this.dbPath = dbPath;
  }

  /**
   * データベース接続を初期化し、スキーマを設定
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // スキーマを初期化
    const schema = new DatabaseSchema(this, this.dbPath);
    await schema.initialize();

    this.isInitialized = true;
  }

  /**
   * SQLクエリを実行
   */
  async exec(sql: string, params: any[] = []): Promise<void> {
    const connection = await this.db.connect();
    try {
      // params引数を取り除く
      await connection.query(sql);
    } finally {
      connection.close();
    }
  }

  /**
   * SQLクエリを実行し、結果の配列を返す
   */
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const connection = await this.db.connect();
    try {
      // params引数を取り除く
      const result = await connection.query(sql);
      return result.toArray().map((row) => this.transformRow<T>(row));
    } finally {
      connection.close();
    }
  }

  /**
   * SQLクエリを実行し、最初の行を返す
   */
  async queryRow<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const results = await this.query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * データベース接続を閉じる
   */
  async close(): Promise<void> {
    await this.db.flushFiles();
  }

  /**
   * 行結果をJavaScriptオブジェクトに変換
   */
  private transformRow<T>(row: any): T {
    const result: any = {};
    for (const key in row) {
      if (typeof row[key] === "string" && key.endsWith("metadata")) {
        try {
          result[key] = JSON.parse(row[key]);
        } catch (e) {
          result[key] = row[key];
        }
      } else {
        result[key] = row[key];
      }
    }
    return result as T;
  }

  /**
   * UUID生成
   */
  generateId(): string {
    return uuidv4();
  }
}
