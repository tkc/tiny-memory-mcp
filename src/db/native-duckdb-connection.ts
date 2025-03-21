import { Database as IDatabase } from "../types/database";
import * as duckdb from "duckdb";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import * as path from "path";

/**
 * ネイティブDuckDBを使用したデータベース接続クラス
 */
export class NativeDuckDBConnection implements IDatabase {
  private db: duckdb.Database;
  private connection: duckdb.Connection;
  private dbPath: string;
  private isInitialized: boolean = false;

  constructor(dbPath: string = "data/conversations.duckdb") {
    this.dbPath = dbPath;
    this.ensureDbDirectory();
    this.db = new duckdb.Database(dbPath);
    this.connection = this.db.connect();
  }

  /**
   * データベースディレクトリが存在することを確認
   */
  private ensureDbDirectory(): void {
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  /**
   * データベースの初期化
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // スキーマの初期化
    return new Promise<void>((resolve, reject) => {
      try {
        // 会話テーブル
        this.connection.exec(`
          CREATE TABLE IF NOT EXISTS conversations (
            conversation_id VARCHAR PRIMARY KEY,
            title VARCHAR,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            metadata JSON
          )
        `);

        // メッセージテーブル
        this.connection.exec(`
          CREATE TABLE IF NOT EXISTS messages (
            message_id VARCHAR PRIMARY KEY,
            conversation_id VARCHAR,
            timestamp TIMESTAMP,
            role VARCHAR,
            content TEXT,
            metadata JSON,
            embedding DOUBLE[],
            FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id)
          )
        `);

        // インデックスの作成
        this.connection.exec(
          "CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)",
        );
        this.connection.exec(
          "CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)",
        );

        // ベクトル計算関数の初期化
        this.initVectorFunctions();

        this.isInitialized = true;
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * ベクトル計算関数の初期化
   */
  private initVectorFunctions(): void {
    // コサイン類似度の関数を定義
    this.connection.exec(`
      CREATE OR REPLACE FUNCTION cosine_similarity(a DOUBLE[], b DOUBLE[]) RETURNS DOUBLE AS '
        SELECT SUM(a[i] * b[i]) / (SQRT(SUM(a[i] * a[i])) * SQRT(SUM(b[i] * b[i])))
        FROM generate_series(1, LEAST(LENGTH(a), LENGTH(b))) AS t(i)
      ';
    `);
  }

  /**
   * SQLクエリを実行する
   */
  async exec(sql: string, params: any[] = []): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        // パラメータをSQL文字列に埋め込む（DuckDBの接続オブジェクトは準備済みステートメントをサポートしていないため）
        const query = this.prepareSql(sql, params);
        this.connection.exec(query);
        resolve();
      } catch (error) {
        console.error(`Error executing SQL: ${sql}`, error);
        reject(error);
      }
    });
  }

  /**
   * SQLクエリを実行し、結果の配列を返す
   */
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise<T[]>((resolve, reject) => {
      try {
        // パラメータをSQL文字列に埋め込む
        const query = this.prepareSql(sql, params);

        this.connection.all(query, (err, rows) => {
          if (err) {
            reject(err);
            return;
          }

          const transformedRows = this.transformRows<T>(rows);
          resolve(transformedRows);
        });
      } catch (error) {
        console.error(`Error querying SQL: ${sql}`, error);
        reject(error);
      }
    });
  }

  /**
   * SQLクエリを実行し、最初の行を返す
   */
  async queryRow<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    return new Promise<T | null>((resolve, reject) => {
      try {
        // パラメータをSQL文字列に埋め込む
        const query = this.prepareSql(sql, params);

        // connection.getの代わりにall()を使用し、最初の結果を取得
        this.connection.all(query, (err: any, rows: any[]) => {
          if (err) {
            reject(err);
            return;
          }

          if (!rows || rows.length === 0) {
            resolve(null);
            return;
          }

          const transformedRow = this.transformRow<T>(rows[0]);
          resolve(transformedRow);
        });
      } catch (error) {
        console.error(`Error querying row SQL: ${sql}`, error);
        reject(error);
      }
    });
  }

  /**
   * パラメータを埋め込んだSQL文字列を作成
   * 注: このメソッドはSQLインジェクションに対して安全ではありません。本番環境では使用しないでください。
   */
  private prepareSql(sql: string, params: any[]): string {
    if (params.length === 0) return sql;

    let index = 0;
    return sql.replace(/\?/g, () => {
      const param = params[index++];

      if (param === null || param === undefined) {
        return "NULL";
      } else if (typeof param === "string") {
        return `'${param.replace(/'/g, "''")}'`;
      } else if (typeof param === "object" && Array.isArray(param)) {
        // 埋め込みの場合
        return `[${param.map((item) => (typeof item === "string" ? `'${item}'` : item)).join(", ")}]`;
      } else if (typeof param === "object") {
        // JSONの場合
        return `'${JSON.stringify(param).replace(/'/g, "''")}'`;
      } else {
        return param.toString();
      }
    });
  }

  /**
   * 行結果をJavaScriptオブジェクトに変換
   */
  private transformRows<T>(rows: any[]): T[] {
    return rows.map((row) => this.transformRow<T>(row));
  }

  /**
   * 単一行をJavaScriptオブジェクトに変換
   */
  private transformRow<T>(row: any): T {
    const result: any = {};
    for (const key in row) {
      if (key.endsWith("metadata") && typeof row[key] === "string") {
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
   * 接続を閉じる
   */
  async close(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.connection.close();
      this.db.close();
      resolve();
    });
  }

  /**
   * ID生成
   */
  generateId(): string {
    return uuidv4();
  }
}
