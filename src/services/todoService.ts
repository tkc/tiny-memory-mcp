import * as todoRepo from "../repositories/todoRepository";
import * as memoryRepo from "../repositories/memoryRepository";
import { TodoCreateInput } from "../repositories/todoRepository";
import { MemoryCreateInput } from "../repositories/memoryRepository";

/**
 * Create a new TODO and also save its creation as a memory
 * @param title TODO title
 * @param description TODO description
 * @param dueDate Due date
 * @returns The ID of the created TODO
 */
export function createTodoWithMemory(
  title: string,
  description?: string,
  dueDate?: Date,
) {
  // Prepare data for TODO creation
  const todoInput: TodoCreateInput = {
    title,
    description,
    due_date: dueDate,
  };

  // Create TODO using repository
  const todoId = todoRepo.createTodo(todoInput);

  // Record to memory
  const dueDateStr = dueDate ? ` (Due: ${dueDate.toLocaleDateString()})` : "";
  const memoryInput: MemoryCreateInput = {
    content: `Created TODO: ${title}${dueDateStr}`,
  };

  memoryRepo.createMemory(memoryInput);

  return todoId;
}

/**
 * Mark a TODO as completed and record it in memory
 * @param id TODO ID
 * @returns Whether the update was successful
 */
export function completeTodoWithMemory(id: number) {
  // Update TODO status using repository
  const success = todoRepo.updateTodoStatus(id, true);

  if (success) {
    // Get information about the target TODO
    const todo = todoRepo.getTodoById(id);

    if (todo) {
      // Prepare data for memory entry
      const memoryInput: MemoryCreateInput = {
        content: `Completed TODO: ${todo.title}`,
      };

      // Create memory using repository
      memoryRepo.createMemory(memoryInput);
    }
  }

  return success;
}

/**
 * Mark a TODO as incomplete and record it in memory
 * @param id TODO ID
 * @returns Whether the update was successful
 */
export function uncompleteTodoWithMemory(id: number) {
  // Update TODO status using repository
  const success = todoRepo.updateTodoStatus(id, false);

  if (success) {
    // Get information about the target TODO
    const todo = todoRepo.getTodoById(id);

    if (todo) {
      // Prepare data for memory entry
      const memoryInput: MemoryCreateInput = {
        content: `Marked TODO as incomplete: ${todo.title}`,
      };

      // Create memory using repository
      memoryRepo.createMemory(memoryInput);
    }
  }

  return success;
}

/**
 * Get all incomplete TODOs
 * @returns List of incomplete TODOs
 */
export function getAllIncompleteTodos() {
  return todoRepo.searchTodos({ completed: false });
}

/**
 * Get all completed TODOs
 * @returns List of completed TODOs
 */
export function getAllCompletedTodos() {
  return todoRepo.searchTodos({ completed: true });
}

/**
 * Get TODOs that are due soon
 * @param days Number of days until due
 * @returns List of upcoming TODOs
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
 * Get overdue TODOs
 * @returns List of overdue TODOs
 */
export function getOverdueTodos() {
  const today = new Date();

  return todoRepo.searchTodos({
    completed: false,
    dueBefore: today,
  });
}

/**
 * Delete a TODO and record the deletion in memory
 * @param id ID of the TODO to delete
 * @returns Whether the deletion was successful
 */
export function deleteTodoWithMemory(id: number) {
  // Get TODO information before deletion
  const todo = todoRepo.getTodoById(id);

  // Delete TODO using repository
  const success = todoRepo.deleteTodo(id);

  if (success && todo) {
    // Prepare data for memory entry
    const memoryInput: MemoryCreateInput = {
      content: `Deleted TODO: ${todo.title}`,
    };

    // Create memory using repository
    memoryRepo.createMemory(memoryInput);
  }

  return success;
}
