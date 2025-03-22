// Bunの型定義
declare module "bun:sqlite" {
  export class Database {
    constructor(path: string);
    run(sql: string, ...params: any[]): any;
    prepare(sql: string): Statement;
    close(): void;
  }

  export class Statement {
    run(...params: any[]): {
      changes: number;
      lastInsertRowid: number | bigint;
    };
    get(...params: any[]): any;
    all(...params: any[]): any[];
  }
}

declare module "bun:test" {
  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
  export function expect(actual: any): Expectation;

  interface Expectation {
    toBe(expected: any): void;
    toBeGreaterThan(expected: number): void;
    toBeTruthy(): void;
    toBeNull(): void;
    not: Expectation;
    toContain(expected: string): void;
    toBeDefined(): void;
    toBeUndefined(): void;
    // 他の必要なメソッドを追加
  }
}

// import.meta用の型拡張
interface ImportMeta {
  main: boolean;
}
