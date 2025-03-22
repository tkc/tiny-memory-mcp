# Tiny Memory MCP

A Model Context Protocol (MCP) server implementation providing persistent memory and task management capabilities for AI assistants.

## Overview

Tiny Memory MCP is a specialized server that implements the Model Context Protocol (MCP), allowing AI assistants to interact with persistent storage for tasks and memories. This enables AI models to maintain context over time, create and manage tasks, and build a persistent memory system beyond their usual context limitations.

## Features

### Task Management

- **Create Tasks**: Store TODO items with titles, descriptions, and due dates
- **Update Tasks**: Mark tasks as complete or incomplete
- **Delete Tasks**: Remove tasks that are no longer needed
- **Search Tasks**: Find tasks using various criteria including:
  - Completion status
  - Due date ranges
  - Text in title or description
- **Upcoming Tasks**: Identify tasks due in the next few days
- **Overdue Tasks**: Find tasks that have passed their due dates

### Memory System

- **Create Memories**: Store timestamped text entries for future reference
- **Search Memories**: Find past memories by text content
- **Memory Context**: View a memory within its historical context (previous and next memories)
- **Memory Statistics**: Analyze memory creation patterns over time

### Integration

- Follows the Model Context Protocol standard
- Designed for easy integration with AI assistants
- Automates memory creation for task operations
- Provides consistent error handling and responses

## Use Cases

- Extend AI capabilities with persistent task tracking
- Create a running log of important events or interactions
- Build a memory system that persists beyond a single conversation
- Enable AI assistants to track tasks with due dates and completion status
- Support for time-aware task reminders (upcoming and overdue tasks)

## Architecture

Tiny Memory MCP uses a SQLite database for persistent storage, with a clean layered architecture separating:

- Tool interface (MCP protocol implementation)
- Service layer (business logic)
- Repository layer (data access)
- Database layer (storage)

Each tool exposed through the MCP interface provides clear documentation of its capabilities, parameters, and return values.
