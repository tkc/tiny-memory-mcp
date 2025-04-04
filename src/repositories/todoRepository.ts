import { getDatabase } from "../database";

export interface Todo {
  id: number;
  title: string;
  description?: string;
  due_date?: string; // Date string in ISO format
  completed: number; // SQLite doesn't have boolean type, so use 0/1
  created_at: string;
}

export interface TodoCreateInput {
  title: string;
  description?: string;
  due_date?: Date;
}

export interface TodoSearchOptions {
  completed?: boolean;
  dueBefore?: Date;
  dueAfter?: Date;
  searchText?: string;
}

/**
 * Create a TODO
 */
export function createTodo(todo: TodoCreateInput): number {
  const db = getDatabase();
  const insert = db.prepare(
    "INSERT INTO todos (title, description, due_date) VALUES (?, ?, ?)",
  );
  const result = insert.run(
    todo.title,
    todo.description || null,
    todo.due_date ? todo.due_date.toISOString() : null,
  );

  return Number(result.lastInsertRowid);
}

/**
 * Get TODO by ID
 */
export function getTodoById(id: number): Todo | null {
  const db = getDatabase();
  return db.prepare("SELECT * FROM todos WHERE id = ?").get(id) as Todo | null;
}

/**
 * Get all TODOs
 */
export function getAllTodos(): Todo[] {
  const db = getDatabase();
  return db
    .prepare("SELECT * FROM todos ORDER BY created_at DESC")
    .all() as Todo[];
}

/**
 * Search TODOs
 */
export function searchTodos(options: TodoSearchOptions = {}): Todo[] {
  let sql = "SELECT * FROM todos WHERE 1=1";
  const params: any[] = [];

  // Filter by completion status
  if (options.completed !== undefined) {
    sql += " AND completed = ?";
    params.push(options.completed ? 1 : 0);
  }

  // Filter by due date
  if (options.dueBefore) {
    sql += " AND due_date IS NOT NULL AND due_date <= ?";
    params.push(options.dueBefore.toISOString());
  }

  if (options.dueAfter) {
    sql += " AND due_date IS NOT NULL AND due_date >= ?";
    params.push(options.dueAfter.toISOString());
  }

  // Text search
  if (options.searchText) {
    sql += " AND (title LIKE ? OR description LIKE ?)";
    const searchParam = `%${options.searchText}%`;
    params.push(searchParam, searchParam);
  }

  sql += " ORDER BY due_date IS NULL, due_date ASC, created_at DESC";

  const db = getDatabase();
  const query = db.prepare(sql);
  return query.all(...params) as Todo[];
}

/**
 * Update completion status
 */
export function updateTodoStatus(id: number, completed: boolean): boolean {
  const db = getDatabase();
  const update = db.prepare("UPDATE todos SET completed = ? WHERE id = ?");
  const result = update.run(completed ? 1 : 0, id);

  return result.changes > 0;
}

/**
 * Delete a TODO
 */
export function deleteTodo(id: number): boolean {
  const db = getDatabase();
  const del = db.prepare("DELETE FROM todos WHERE id = ?");
  const result = del.run(id);

  return result.changes > 0;
}
