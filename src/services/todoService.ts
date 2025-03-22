import * as todoRepo from "../repositories/todoRepository";
import * as memoryRepo from "../repositories/memoryRepository";
import { TodoCreateInput } from "../repositories/todoRepository";
import { MemoryCreateInput } from "../repositories/memoryRepository";

/**
 * 新しいTODOを作成し、作成した内容をメモリーとしても保存する
 * @param title TODOのタイトル
 * @param description TODOの説明
 * @param dueDate 期限
 * @returns 作成したTODOのID
 */
export function createTodoWithMemory(
  title: string,
  description?: string,
  dueDate?: Date,
) {
  // TODO作成用データを準備
  const todoInput: TodoCreateInput = {
    title,
    description,
    due_date: dueDate,
  };

  // リポジトリを使用してTODOを作成
  const todoId = todoRepo.createTodo(todoInput);

  // メモリーにも記録
  const dueDateStr = dueDate ? ` (期限: ${dueDate.toLocaleDateString()})` : "";
  const memoryInput: MemoryCreateInput = {
    content: `TODOを作成しました: ${title}${dueDateStr}`,
  };

  memoryRepo.createMemory(memoryInput);

  return todoId;
}

/**
 * TODOを完了としてマークし、メモリーにも記録する
 * @param id TODOのID
 * @returns 更新に成功したかどうか
 */
export function completeTodoWithMemory(id: number) {
  // リポジトリを使用してTODOのステータスを更新
  const success = todoRepo.updateTodoStatus(id, true);

  if (success) {
    // 対象のTODOの情報を取得
    const todo = todoRepo.getTodoById(id);

    if (todo) {
      // メモリー入力用データを準備
      const memoryInput: MemoryCreateInput = {
        content: `TODOを完了しました: ${todo.title}`,
      };

      // リポジトリを使用してメモリーを作成
      memoryRepo.createMemory(memoryInput);
    }
  }

  return success;
}

/**
 * TODOを未完了状態に戻し、メモリーにも記録する
 * @param id TODOのID
 * @returns 更新に成功したかどうか
 */
export function uncompleteTodoWithMemory(id: number) {
  // リポジトリを使用してTODOのステータスを更新
  const success = todoRepo.updateTodoStatus(id, false);

  if (success) {
    // 対象のTODOの情報を取得
    const todo = todoRepo.getTodoById(id);

    if (todo) {
      // メモリー入力用データを準備
      const memoryInput: MemoryCreateInput = {
        content: `TODOを未完了に戻しました: ${todo.title}`,
      };

      // リポジトリを使用してメモリーを作成
      memoryRepo.createMemory(memoryInput);
    }
  }

  return success;
}

/**
 * 未完了のTODOをすべて取得する
 * @returns 未完了のTODOリスト
 */
export function getAllIncompleteTodos() {
  return todoRepo.searchTodos({ completed: false });
}

/**
 * 完了済みのTODOをすべて取得する
 * @returns 完了済みのTODOリスト
 */
export function getAllCompletedTodos() {
  return todoRepo.searchTodos({ completed: true });
}

/**
 * 期限切れ間近のTODOを取得する
 * @param days 期限切れまでの日数
 * @returns 期限切れ間近のTODOリスト
 */
export function getUpcomingTodos(days: number = 3) {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + days);

  return todoRepo.searchTodos({
    completed: false,
    dueBefore: futureDate,
    dueAfter: today,
  });
}

/**
 * 期限切れのTODOを取得する
 * @returns 期限切れのTODOリスト
 */
export function getOverdueTodos() {
  const today = new Date();

  return todoRepo.searchTodos({
    completed: false,
    dueBefore: today,
  });
}

/**
 * TODOを削除し、削除操作をメモリーに記録する
 * @param id 削除するTODOのID
 * @returns 削除に成功したかどうか
 */
export function deleteTodoWithMemory(id: number) {
  // 削除前にTODO情報を取得
  const todo = todoRepo.getTodoById(id);

  // リポジトリを使用してTODOを削除
  const success = todoRepo.deleteTodo(id);

  if (success && todo) {
    // メモリー入力用データを準備
    const memoryInput: MemoryCreateInput = {
      content: `TODOを削除しました: ${todo.title}`,
    };

    // リポジトリを使用してメモリーを作成
    memoryRepo.createMemory(memoryInput);
  }

  return success;
}
