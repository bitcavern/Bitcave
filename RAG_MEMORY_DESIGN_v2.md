# Local RAG Memory System - Design Document

## Overview

The Local RAG Memory System enables Bitcave to maintain persistent, searchable knowledge about the user through fact extraction and semantic retrieval. This system operates entirely locally, using SQLite with vector embeddings to create a powerful memory layer that enhances AI conversations with contextual user information.

## Task Tracker

### Phase 1: Foundation (Completed)

- [x] Set up SQLite database with vector extension (`sqlite-vec`).
- [x] Implement `MemoryService` with initial database schema.
- [x] Implement basic conversation and message storage logic.
- [x] Create CRUD operations for facts (without embedding generation).
- [x] Configure WAL mode and other performance optimizations.

### Phase 2: Embedding System (Completed)

- [x] Integrate `Transformers.js` with the `all-MiniLM-L6-v2` model.
- [x] Implement `EmbeddingService` to generate vector embeddings.
- [x] Add vector similarity search capabilities to `MemoryService`.
- [x] Implement a basic fact retrieval system based on semantic search.

### Phase 3: Fact Extraction (Completed)

- [x] Create `FactExtractor` service for orchestrating LLM-based extraction.
- [x] Implement the prompt and logic for extracting facts from conversations.
- [x] Add deduplication logic based on vector similarity.
- [x] Integrate the extraction process with `MemoryService`.

### Phase 4: AI Integration (Completed)

- [x] Integrate the memory system into `ai-service.ts`.
- [x] Implement the context injection mechanism.
- [x] Add logic to trigger fact extraction periodically.
- [x] Conduct performance testing and optimization.

### Phase 5: User Interface (To Do)

- [ ] Memory management UI components
- [ ] Fact viewing and editing interface
- [ ] Memory statistics and insights
- [ ] Settings and preferences

## Design Notes

- **User Control**: The system is designed for future extensibility to allow users to manually add, edit, approve, or reject facts. This will provide greater control over the AI's memory.
- **Fact Scope**: The initial implementation will use a global memory store for all facts. However, the `facts` table schema will include a nullable `project_id` column to allow for the future implementation of project-specific memories without requiring a schema migration.
- **Fact Editing**: When a fact's content is edited via the UI, its vector embedding must be regenerated to ensure search and retrieval accuracy.
- **Error Handling**: The implementation must include robust error handling for all external services, including the database and embedding models, to ensure the application remains stable and responsive.
- **Confidence Score**: The `confidence` score will initially be updated based on fact duplication. Future iterations may incorporate user feedback and retrieval frequency to refine this score.

## Core Architecture

### Database Layer

- **Technology**: SQLite with vector extension (`sqlite-vec`)
- **Storage Location**: `~/.bitcave/memory/user_memory.db`
- **Embedding Model**: Local lightweight model (e.g., `all-MiniLM-L6-v2` via `Transformers.js`)
- **Scope**: Global across all projects and conversations

### Data Flow

```
User Message → Conversation Context → Fact Search → Context Injection → AI Response
                     ↓
            Periodic Fact Extraction → Fact Storage → Embedding Generation
```

## Database Schema

### Tables

#### `facts`

```sql
CREATE TABLE facts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    category TEXT,
    confidence REAL DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source_conversation_id TEXT,
    project_id TEXT, -- For future project-specific memory
    vec_id INTEGER REFERENCES vec_facts(rowid)
);
```

#### `vec_facts`

```sql
CREATE VIRTUAL TABLE vec_facts USING vec0(
    fact_embedding FLOAT[384]
);
```

#### `conversations`

```sql
CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    title TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    message_count INTEGER DEFAULT 0
);
```

#### `conversation_messages`

```sql
CREATE TABLE conversation_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT REFERENCES conversations(id),
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_for_facts BOOLEAN DEFAULT FALSE
);
```

#### `user_profile`

```sql
CREATE TABLE user_profile (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Fact Extraction Pipeline

### Trigger Conditions

- **Frequency**: Every 3-4 user messages in a conversation.
- **Minimum Context**: At least 2 message exchanges before first extraction.
- **Batch Processing**: Process multiple messages together for context.

### Extraction Process

1. **Context Assembly**: Collect last N messages (6-8 messages for context).
2. **LLM Fact Extraction**: Send to AI with specialized prompt.
3. **Fact Processing**: Parse and validate extracted facts.
4. **Deduplication Check**: Search for similar existing facts.
5. **Storage**: Insert new facts or update existing ones.

## Search and Retrieval System

### Search Strategy

- **Trigger**: Every user message before AI processing.
- **Context Window**: Use last 2-3 user messages as search query.
- **Search Methods**: Semantic Search, Keyword Search, Recency Boost.

### Retrieval Process

1. **Query Construction**: Combine recent user messages.
2. **Vector Search**: Find semantically similar facts.
3. **Relevance Filtering**: Apply a similarity threshold.
4. **Recency Weighting**: Boost score based on `updated_at`.
5. **Final Selection**: Return top 5-8 most relevant facts.

### Context Injection

- **Integration Point**: In AI service before sending to LLM.
- **Format**: Structured context block in the system prompt.

## Integration Points

- The `MemoryService` is integrated into the main application (`main.ts`).
- The `AIService` is injected into the `MemoryService` to be used by the `FactExtractor`.
- Fact extraction is triggered automatically after a new message is added to a conversation.

## Future Enhancements

- **Fact Relationships**: Link related facts together.
- **Temporal Tracking**: Track how facts change over time.
- **Confidence Learning**: Improve confidence scoring based on usage.
- **Cross-Project Insights**: Analyze patterns across projects.
- **UI for Memory Management**: Allow users to view, edit, and delete facts.
