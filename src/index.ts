/**
 * Tiny Memory MCP - Model Context Protocol (MCP) Server Implementation
 *
 * A specialized MCP server that provides TODO and memory management functionality
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Database initialization
import { setupDatabase, initializeDatabase, closeDatabase } from "./database";
import * as todoRepo from "./repositories/todoRepository";
import * as memoryRepo from "./repositories/memoryRepository";
import * as todoService from "./services/todoService";
import * as memoryService from "./services/memoryService";

// Process command line arguments
const args = process.argv.slice(2);
let dbPath = "tiny-memory.db"; // Default path

// Display current directory and default path
console.error(`[INFO] Current working directory: ${process.cwd()}`);
console.error(`[INFO] Default database path: ${process.cwd()}/tiny-memory.db`);

// Use the first argument as database path if provided
if (args.length > 0) {
  dbPath = args[0];
  console.error(`[INFO] Setting database path: ${dbPath}`);
}

// Exports
export {
  initializeDatabase,
  closeDatabase,
  todoRepo,
  memoryRepo,
  todoService,
  memoryService,
};

// Initialize database
setupDatabase(dbPath);
initializeDatabase();

// Logger utility
function log(level: string, ...args: any[]) {
  console.error(`[${level.toUpperCase()}]`, ...args);
}

// Schema definitions
const TodoCreateSchema = z.object({
  title: z.string().describe("The title of the TODO"),
  description: z.string().optional().describe("The description of the TODO"),
  due_date: z
    .string()
    .optional()
    .describe("Due date in ISO format (YYYY-MM-DD)"),
});

const TodoUpdateSchema = z.object({
  id: z.number().describe("The ID of the TODO to update"),
  completed: z.boolean().describe("The completed status to set"),
});

const TodoDeleteSchema = z.object({
  id: z.number().describe("The ID of the TODO to delete"),
});

const TodoSearchSchema = z.object({
  completed: z.boolean().optional().describe("Filter by completion status"),
  due_before: z
    .string()
    .optional()
    .describe("Filter by due date before (ISO format)"),
  due_after: z
    .string()
    .optional()
    .describe("Filter by due date after (ISO format)"),
  search_text: z
    .string()
    .optional()
    .describe("Search text in title and description"),
});

const MemoryCreateSchema = z.object({
  content: z.string().describe("The content of the memory"),
});

const MemorySearchSchema = z.object({
  search_text: z.string().describe("Text to search for in memories"),
});

const MemoryAroundSchema = z.object({
  id: z.number().describe("The ID of the memory to get context for"),
  range: z
    .number()
    .optional()
    .describe("The number of memories to get before and after"),
});

// Initialize MCP server
const server = new McpServer({
  name: "tiny-memory-mcp-server",
  version: "1.0.0",
  description:
    "A specialized Model Context Protocol server that provides TODO and memory management functionality.",
});

// TODO tools
server.tool(
  "create_todo",
  "Creates a new TODO task in the system. You can specify a title (required), an optional description for more details, and an optional due date in ISO format (YYYY-MM-DD). The task will be automatically marked as incomplete upon creation. The created TODO will also be recorded in the memory system for future reference.",
  TodoCreateSchema.shape,
  async (args) => {
    try {
      const todoInput = {
        title: args.title,
        description: args.description,
        due_date: args.due_date ? new Date(args.due_date) : undefined,
      };

      const todoId = todoService.createTodoWithMemory(
        todoInput.title,
        todoInput.description,
        todoInput.due_date,
      );

      return {
        content: [
          {
            type: "text",
            text: `Successfully created TODO with ID: ${todoId}`,
          },
        ],
        isError: false,
      };
    } catch (error) {
      log("error", "Create TODO error:", error);
      return {
        content: [
          {
            type: "text",
            text: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.tool(
  "update_todo_status",
  "Updates the completion status of an existing TODO task. Requires the task ID and the desired completion status (true for completed, false for incomplete). This action is recorded in the memory system, allowing you to track when tasks were completed or reopened. If the specified task doesn't exist, the operation will fail gracefully with a notification.",
  TodoUpdateSchema.shape,
  async (args) => {
    try {
      const success = args.completed
        ? todoService.completeTodoWithMemory(args.id)
        : todoService.uncompleteTodoWithMemory(args.id);

      if (success) {
        return {
          content: [
            {
              type: "text",
              text: `Successfully updated TODO ${args.id} to ${args.completed ? "completed" : "incomplete"}`,
            },
          ],
          isError: false,
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `No TODO found with ID: ${args.id}`,
            },
          ],
          isError: false,
        };
      }
    } catch (error) {
      log("error", "Update TODO error:", error);
      return {
        content: [
          {
            type: "text",
            text: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.tool(
  "delete_todo",
  "Permanently removes a TODO task from the system by its ID. This action cannot be undone. Before deletion, the task details are recorded in the memory system for historical purposes. If no task exists with the specified ID, the operation will return a notification that no matching task was found.",
  TodoDeleteSchema.shape,
  async (args) => {
    try {
      const success = todoService.deleteTodoWithMemory(args.id);

      if (success) {
        return {
          content: [
            {
              type: "text",
              text: `Successfully deleted TODO ${args.id}`,
            },
          ],
          isError: false,
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `No TODO found with ID: ${args.id}`,
            },
          ],
          isError: false,
        };
      }
    } catch (error) {
      log("error", "Delete TODO error:", error);
      return {
        content: [
          {
            type: "text",
            text: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.tool(
  "search_todos",
  "Searches for TODO tasks based on various criteria. You can filter by completion status (true/false), due dates (before or after specified dates in ISO format), and search text that appears in the title or description. Multiple filters can be combined for more precise searches. Results are sorted with upcoming due dates first, followed by creation date.",
  TodoSearchSchema.shape,
  async (args) => {
    try {
      const searchOptions = {
        completed: args.completed,
        dueBefore: args.due_before ? new Date(args.due_before) : undefined,
        dueAfter: args.due_after ? new Date(args.due_after) : undefined,
        searchText: args.search_text,
      };

      const todos = todoRepo.searchTodos(searchOptions);

      return {
        content: [
          {
            type: "text",
            text: `Found ${todos.length} TODOs:\n\n${JSON.stringify(todos, null, 2)}`,
          },
        ],
        isError: false,
      };
    } catch (error) {
      log("error", "Search TODOs error:", error);
      return {
        content: [
          {
            type: "text",
            text: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.tool(
  "get_upcoming_todos",
  "Retrieves incomplete TODO tasks that are due within a specified number of days from today. The default period is 3 days if not specified. This function helps identify tasks that require immediate attention. Results include all task details such as title, description, due date, and creation timestamp.",
  z.object({ days: z.number().optional() }).shape,
  async (args) => {
    try {
      const days = args.days || 3;
      const upcomingTodos = todoService.getUpcomingTodos(days);

      return {
        content: [
          {
            type: "text",
            text: `Found ${upcomingTodos.length} upcoming TODOs due in the next ${days} days:\n\n${JSON.stringify(upcomingTodos, null, 2)}`,
          },
        ],
        isError: false,
      };
    } catch (error) {
      log("error", "Get upcoming TODOs error:", error);
      return {
        content: [
          {
            type: "text",
            text: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.tool(
  "get_overdue_todos",
  "Retrieves all incomplete TODO tasks with due dates that have already passed. These are tasks that require immediate attention as they are behind schedule. Results are sorted with the oldest overdue tasks first, allowing you to prioritize tasks that have been pending the longest.",
  z.object({}).shape,
  async () => {
    try {
      const overdueTodos = todoService.getOverdueTodos();

      return {
        content: [
          {
            type: "text",
            text: `Found ${overdueTodos.length} overdue TODOs:\n\n${JSON.stringify(overdueTodos, null, 2)}`,
          },
        ],
        isError: false,
      };
    } catch (error) {
      log("error", "Get overdue TODOs error:", error);
      return {
        content: [
          {
            type: "text",
            text: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Memory tools
server.tool(
  "create_memory",
  "Stores a new text entry in the memory system with the current timestamp. Memories serve as a persistent record of actions, thoughts, and events. This function allows creating standalone memories, while other todo operations automatically create associated memories. Each memory entry is assigned a unique ID for future reference.",
  MemoryCreateSchema.shape,
  async (args) => {
    try {
      const memoryId = memoryService.createMemory(args.content);

      return {
        content: [
          {
            type: "text",
            text: `Successfully created memory with ID: ${memoryId}`,
          },
        ],
        isError: false,
      };
    } catch (error) {
      log("error", "Create memory error:", error);
      return {
        content: [
          {
            type: "text",
            text: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.tool(
  "search_memories",
  "Searches through all stored memories for entries containing the specified text. The search is case-insensitive and matches partial text within the memory content. Results are returned in reverse chronological order (newest first) and include the full content and creation timestamp of each matching memory.",
  MemorySearchSchema.shape,
  async (args) => {
    try {
      const memories = memoryRepo.searchMemories(args.search_text);

      return {
        content: [
          {
            type: "text",
            text: `Found ${memories.length} memories containing "${args.search_text}":\n\n${JSON.stringify(memories, null, 2)}`,
          },
        ],
        isError: false,
      };
    } catch (error) {
      log("error", "Search memories error:", error);
      return {
        content: [
          {
            type: "text",
            text: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.tool(
  "get_memory_context",
  "Retrieves a specific memory by ID along with surrounding memories (before and after) to provide context. You can specify how many surrounding memories to include (default is 5). The result is formatted as Markdown with clear sections for previous memories, the current memory, and subsequent memories, making it easy to understand the sequence of events.",
  MemoryAroundSchema.shape,
  async (args) => {
    try {
      const range = args.range || 5;
      const context = memoryRepo.getMemoriesAroundId(args.id, range);

      if (!context.current) {
        return {
          content: [
            {
              type: "text",
              text: `No memory found with ID: ${args.id}`,
            },
          ],
          isError: false,
        };
      }

      const markdown = memoryService.getMemoryContextAsMarkdown(args.id, range);

      return {
        content: [
          {
            type: "text",
            text: markdown,
          },
        ],
        isError: false,
      };
    } catch (error) {
      log("error", "Get memory context error:", error);
      return {
        content: [
          {
            type: "text",
            text: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.tool(
  "get_memory_stats",
  "Generates statistics about memory creation activity over a specified time period (default is 30 days). Returns daily counts of memories created, allowing you to track usage patterns and activity levels over time. The statistics are returned as an array of date and count pairs, sorted chronologically from oldest to newest.",
  z.object({ days: z.number().optional() }).shape,
  async (args) => {
    try {
      const days = args.days || 30;
      const stats = memoryService.getMemoryStatsByDate(days);

      return {
        content: [
          {
            type: "text",
            text: `Memory statistics for the past ${days} days:\n\n${JSON.stringify(stats, null, 2)}`,
          },
        ],
        isError: false,
      };
    } catch (error) {
      log("error", "Get memory stats error:", error);
      return {
        content: [
          {
            type: "text",
            text: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Server start function
async function main() {
  try {
    log("info", "Starting Tiny Memory MCP server...");

    // Configure transport
    const transport = new StdioServerTransport();

    // Connect server to transport
    await server.connect(transport);

    // Display startup messages
    log("info", "Tiny Memory MCP Server started");
    log("info", "Available tools:");
    log("info", " - create_todo: Create a new TODO");
    log("info", " - update_todo_status: Update TODO completion status");
    log("info", " - delete_todo: Delete a TODO");
    log("info", " - search_todos: Search for TODOs");
    log("info", " - get_upcoming_todos: Get upcoming TODOs");
    log("info", " - get_overdue_todos: Get overdue TODOs");
    log("info", " - create_memory: Create a new memory");
    log("info", " - search_memories: Search for memories");
    log("info", " - get_memory_context: Get context around a memory");
    log("info", " - get_memory_stats: Get memory statistics");
    log("info", "Listening for requests...");
  } catch (error) {
    log("error", "Failed to start Tiny Memory MCP Server:", error);
    process.exit(1);
  }
}

// Process termination handler
process.on("SIGINT", () => {
  log("info", "Server shutting down...");
  process.exit(0);
});

// Error handler
process.on("uncaughtException", (error) => {
  log("error", "Uncaught exception:", error);
});

// Run the server
main().catch((error) => {
  log("error", "Unexpected error:", error);
  process.exit(1);
});
