import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import {
  setupDatabase,
  initializeDatabase,
  closeDatabase,
} from "../src/database";
import * as todoRepo from "../src/repositories/todoRepository";
import * as todoService from "../src/services/todoService";
import * as fs from "fs";

// テスト用の一時データベースファイル
const TEST_DB_FILE = "test-todo.sqlite";

describe("TODO機能テスト", () => {
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

  test("TODOを追加できる", () => {
    const todoId = todoRepo.createTodo({
      title: "テストタスク",
      description: "説明テキスト",
    });

    // IDが数値であることを確認
    expect(typeof todoId).toBe("number");
    expect(todoId).toBeGreaterThan(0);

    // 追加したTODOを取得して内容を確認
    const todos = todoRepo.getAllTodos();
    expect(todos.length).toBe(1);
    expect(todos[0].title).toBe("テストタスク");
    expect(todos[0].description).toBe("説明テキスト");
    expect(todos[0].completed).toBe(0); // 未完了状態
  });

  test("TODOのステータスを更新できる", () => {
    // タスクを追加
    const todoId = todoRepo.createTodo({
      title: "完了するタスク",
    });

    // タスクを完了状態に更新
    const updateResult = todoRepo.updateTodoStatus(todoId, true);
    expect(updateResult).toBe(true);

    // 更新後のタスクを取得して確認
    const todos = todoRepo.getAllTodos();
    expect(todos[0].completed).toBe(1); // 完了状態
  });

  test("TODOを削除できる", () => {
    // タスクを追加
    const todoId = todoRepo.createTodo({
      title: "削除するタスク",
    });

    // タスクを削除
    const deleteResult = todoRepo.deleteTodo(todoId);
    expect(deleteResult).toBe(true);

    // 削除後にタスクがないことを確認
    const todos = todoRepo.getAllTodos();
    expect(todos.length).toBe(0);
  });

  test("条件でTODOを検索できる", () => {
    // いくつかのタスクを追加
    todoRepo.createTodo({
      title: "買い物に行く",
      description: "牛乳と卵を買う",
      due_date: new Date(Date.now() + 86400000), // 明日
    });

    todoRepo.createTodo({
      title: "報告書を書く",
      description: "プロジェクトの月次報告",
      due_date: new Date(Date.now() + 172800000), // 明後日
    });

    todoRepo.createTodo({
      title: "歯医者の予約",
      description: "定期検診",
    }); // 期限なし

    // 一つのタスクを完了状態に更新
    todoRepo.updateTodoStatus(1, true);

    // 完了状態で検索
    const completedTodos = todoRepo.searchTodos({ completed: true });
    expect(completedTodos.length).toBe(1);
    expect(completedTodos[0].title).toBe("買い物に行く");

    // テキスト検索
    const reportTodos = todoRepo.searchTodos({ searchText: "報告" });
    expect(reportTodos.length).toBe(1);
    expect(reportTodos[0].title).toBe("報告書を書く");

    // 期限で検索（未来の日付）
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const upcomingTodos = todoRepo.searchTodos({ dueBefore: tomorrow });
    expect(upcomingTodos.length).toBe(1);
  });

  test("todoServiceのTODO作成と完了機能", () => {
    // TODOを作成し、IDを取得
    const todoId = todoService.createTodoWithMemory(
      "サービスからのタスク",
      "説明文",
    );

    // TODOとmemoryの両方が作成されていることを確認
    const todos = todoRepo.getAllTodos();
    expect(todos.length).toBe(1);
    expect(todos[0].title).toBe("サービスからのタスク");

    // TODOを完了状態に更新
    const completeResult = todoService.completeTodoWithMemory(todoId);
    expect(completeResult).toBe(true);

    // 完了状態になっていることを確認
    const completedTodos = todoService.getAllCompletedTodos();
    expect(completedTodos.length).toBe(1);

    // 再度未完了に戻す
    const uncompleteResult = todoService.uncompleteTodoWithMemory(todoId);
    expect(uncompleteResult).toBe(true);

    // 未完了状態になっていることを確認
    const incompleteTodos = todoService.getAllIncompleteTodos();
    expect(incompleteTodos.length).toBe(1);
  });

  test("期限切れと期限間近のTODOを取得できる", () => {
    // 過去のタスク（期限切れ）
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    todoRepo.createTodo({
      title: "期限切れタスク",
      description: "昨日が期限",
      due_date: pastDate,
    });

    // 明日のタスク（期限間近）
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    todoRepo.createTodo({
      title: "明日のタスク",
      description: "明日が期限",
      due_date: tomorrowDate,
    });

    // 1週間後のタスク（期限は近くない）
    const nextWeekDate = new Date();
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    todoRepo.createTodo({
      title: "来週のタスク",
      description: "来週が期限",
      due_date: nextWeekDate,
    });

    // 期限切れタスクを取得
    const overdueTodos = todoService.getOverdueTodos();
    expect(overdueTodos.length).toBe(1);
    expect(overdueTodos[0].title).toBe("期限切れタスク");

    // 期限間近（3日以内）のタスクを取得
    const upcomingTodos = todoService.getUpcomingTodos(3);
    expect(upcomingTodos.length).toBe(1);
    expect(upcomingTodos[0].title).toBe("明日のタスク");
  });
});
