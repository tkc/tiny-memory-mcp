/**
 * データベースの基本的なインターフェース
 */
export interface Database {
  exec(sql: string, params?: any[]): Promise<void>;
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  queryRow<T = any>(sql: string, params?: any[]): Promise<T | null>;
  close(): Promise<void>;
}

/**
 * 会話のデータ型
 */
export interface Conversation {
  conversation_id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
  metadata?: Record<string, any>;
}

/**
 * メッセージのデータ型
 */
export interface Message {
  message_id: string;
  conversation_id: string;
  timestamp: Date;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: Record<string, any>;
  embedding?: number[];
}
