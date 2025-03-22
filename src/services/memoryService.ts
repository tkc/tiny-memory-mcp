import * as memoryRepo from "../repositories/memoryRepository";
import { Memory, MemoryCreateInput } from "../repositories/memoryRepository";

/**
 * Create a memory
 * @param content Memory content
 * @returns ID of the created memory
 */
export function createMemory(content: string): number {
  const memoryInput: MemoryCreateInput = {
    content,
  };

  return memoryRepo.createMemory(memoryInput);
}

/**
 * Get a summary of memories containing a keyword
 * @param keyword Search keyword
 * @returns Summary of search results
 */
export function getMemorySummary(keyword: string) {
  // Search memories using repository
  const memories = memoryRepo.searchMemories(keyword);

  return {
    count: memories.length,
    latest: memories.length > 0 ? memories[0] : null,
    oldest: memories.length > 0 ? memories[memories.length - 1] : null,
    keywords: keyword,
  };
}

/**
 * Get the latest memories
 * @param limit Number of memories to retrieve
 * @returns List of the latest memories
 */
export function getLatestMemories(limit: number = 10): Memory[] {
  // Get all memories using repository
  const memories = memoryRepo.getAllMemories();
  return memories.slice(0, limit);
}

/**
 * Get the context around a memory and format it as Markdown
 * @param id Memory ID
 * @param range Range of surrounding memories to include
 * @returns Context formatted as Markdown
 */
export function getMemoryContextAsMarkdown(
  id: number,
  range: number = 5,
): string {
  // Get memory context using repository
  const context = memoryRepo.getMemoriesAroundId(id, range);

  if (!context.current) {
    return "No memory found with the specified ID.";
  }

  let markdown = "# Memory Context\n\n";

  if (context.before.length > 0) {
    markdown += "## Previous Memories\n\n";
    context.before.forEach((memory) => {
      const date = new Date(memory.created_at).toLocaleString();
      markdown += `- **${date}**: ${memory.content}\n`;
    });
    markdown += "\n";
  }

  markdown += "## Current Memory\n\n";
  const currentDate = new Date(context.current.created_at).toLocaleString();
  markdown += `**${currentDate}**: ${context.current.content}\n\n`;

  if (context.after.length > 0) {
    markdown += "## Subsequent Memories\n\n";
    context.after.forEach((memory) => {
      const date = new Date(memory.created_at).toLocaleString();
      markdown += `- **${date}**: ${memory.content}\n`;
    });
  }

  return markdown;
}

/**
 * Count memories by date
 * @param days How many past days to include
 * @returns Memory counts by date
 */
export function getMemoryStatsByDate(days: number = 30) {
  // Get all memories using repository
  const memories = memoryRepo.getAllMemories();

  // Create date range
  const stats: Record<string, number> = {};
  const today = new Date();

  // Initialize dates for the past 'days' days
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD format
    stats[dateStr] = 0;
  }

  // Count memories by date
  memories.forEach((memory) => {
    const dateStr = new Date(memory.created_at).toISOString().split("T")[0];

    // Add to count if within target date range
    if (stats[dateStr] !== undefined) {
      stats[dateStr]++;
    }
  });

  // Return results sorted by date
  return Object.entries(stats)
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, count]) => ({ date, count }));
}

/**
 * Group memories by a specific pattern
 * @param pattern Search pattern
 * @returns Grouped memories
 */
export function groupMemoriesByPattern(pattern: string) {
  // Search memories using repository
  const memories = memoryRepo.searchMemories(pattern);

  // Group memories by pattern
  const groups: Record<string, Memory[]> = {};

  memories.forEach((memory) => {
    // Simple pattern extraction (can be more flexible with regex)
    const content = memory.content;
    const match = content.includes(pattern) ? pattern : "Other";

    if (!groups[match]) {
      groups[match] = [];
    }

    groups[match].push(memory);
  });

  return groups;
}

/**
 * Get memories within a specific date range
 * @param startDate Start date
 * @param endDate End date
 * @returns Memories within the date range
 */
export function getMemoriesByDateRange(
  startDate: Date,
  endDate: Date,
): Memory[] {
  // Get memories by date range using repository
  return memoryRepo.getMemoriesByDateRange(startDate, endDate);
}
