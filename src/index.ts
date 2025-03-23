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
