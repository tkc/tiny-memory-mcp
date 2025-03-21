import { Database } from "../types/database";
import fs from "fs";
import path from "path";

/**
 * DuckDBのスキーマ初期化クラス
 */
export class DatabaseSchema {
  private db: Database;
  private dbPath: string;

  constructor(db: Database, dbPath: string) {
    this.db = db;
    this.dbPath = dbPath;
    this.ensureDbDirectory();
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
   * スキーマの初期化
   */
  async initialize(): Promise<void> {
    // 会話テーブル (対話の単位)
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        conversation_id VARCHAR PRIMARY KEY,
        title VARCHAR,
        created_at TIMESTAMP,
        updated_at TIMESTAMP,
        metadata JSON
      )
    `);

    // メッセージテーブル
    await this.db.exec(`
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
    await this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)",
    );
    await this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)",
    );

    // ベクトル関数のロード
    await this.initVectorFunctions();
  }

  /**
   * ベクトル計算関数の初期化
   */
  private async initVectorFunctions(): Promise<void> {
    // コサイン類似度の関数を定義
    await this.db.exec(`
      CREATE OR REPLACE FUNCTION cosine_similarity(a DOUBLE[], b DOUBLE[]) RETURNS DOUBLE AS '
        SELECT SUM(a[i] * b[i]) / (SQRT(SUM(a[i] * a[i])) * SQRT(SUM(b[i] * b[i])))
        FROM generate_series(1, LEAST(LENGTH(a), LENGTH(b))) AS t(i)
      ';
    `);
  }
}
