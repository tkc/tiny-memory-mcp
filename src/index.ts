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

// エクスポート
export {
  initializeDatabase,
  closeDatabase,
  todoRepo,
  memoryRepo,
  todoService,
  memoryService
};

// Initialize database
setupDatabase();
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
  "Creates a new TODO task with optional description and due date.",
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
        todoInput.due_date
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
  }
);

server.tool(
  "update_todo_status",
  "Updates the completion status of a TODO task.",
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
  }
);

server.tool(
  "delete_todo",
  "Deletes a TODO task by ID.",
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
  }
);

server.tool(
  "search_todos",
  "Searches for TODOs based on various criteria.",
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
  }
);

server.tool(
  "get_upcoming_todos",
  "Gets upcoming TODOs that are due within a certain number of days.",
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
  }
);

server.tool(
  "get_overdue_todos",
  "Gets overdue TODOs.",
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
  }
);

// Memory tools
server.tool(
  "create_memory",
  "Creates a new memory entry.",
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
  }
);

server.tool(
  "search_memories",
  "Searches for memories containing specific text.",
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
  }
);

server.tool(
  "get_memory_context",
  "Gets the context around a specific memory (previous and next memories).",
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
  }
);

server.tool(
  "get_memory_stats",
  "Gets statistics about memories by date.",
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
  }
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
  closeDatabase();
  process.exit(0);
});

// Error handler
process.on("uncaughtException", (error) => {
  log("error", "Uncaught exception:", error);
  closeDatabase();
});

// Entry point
// Run the server if executed directly
if (import.meta.main) {
  main().catch((error) => {
    log("error", "Unexpected error:", error);
    closeDatabase();
    process.exit(1);
  });
}
