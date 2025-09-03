# Local RAG Memory System - Design Document

## Overview

The Local RAG Memory System enables Bitcave to maintain persistent, searchable knowledge about the user through fact extraction and semantic retrieval. This system operates entirely locally, using SQLite with vector embeddings to create a powerful memory layer that enhances AI conversations with contextual user information.

## Core Architecture

### Database Layer

- **Technology**: SQLite with vector extension (sqlite-vss or similar)
- **Storage Location**: `~/.bitcave/memory/user_memory.db`
- **Embedding Model**: Local lightweight model (e.g., all-MiniLM-L6-v2 via Transformers.js)
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
    content TEXT NOT NULL,           -- "Teddy has a 12 year old collie called Jim"
    category TEXT,                   -- "personal", "preference", "technical", etc.
    confidence REAL DEFAULT 1.0,    -- 0.0 to 1.0, higher = more certain
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source_conversation_id TEXT,     -- Reference to originating conversation
    embedding BLOB                   -- Vector embedding of the fact
);
```

#### `conversations`

```sql
CREATE TABLE conversations (
    id TEXT PRIMARY KEY,             -- UUID
    project_id TEXT,                 -- NULL for global conversations
    title TEXT,                      -- Auto-generated or user-defined
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
    role TEXT NOT NULL,              -- 'user' or 'assistant'
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

- **Frequency**: Every 3-4 user messages in a conversation
- **Minimum Context**: At least 2 message exchanges before first extraction
- **Batch Processing**: Process multiple messages together for context

### Extraction Process

1. **Context Assembly**: Collect last N messages (6-8 messages for context)
2. **LLM Fact Extraction**: Send to AI with specialized prompt:

   ```
   Extract factual information about the user from this conversation.
   Format as structured facts like:
   - "[USER_NAME] has a 12 year old collie called Jim"
   - "[USER_NAME] prefers TypeScript over JavaScript"
   - "[USER_NAME] is working on a project called Bitcave"

   Only extract clear, factual statements. Avoid assumptions or interpretations.
   ```

3. **Fact Processing**: Parse and validate extracted facts
4. **Deduplication Check**: Search for similar existing facts
5. **Storage**: Insert new facts or update existing ones

### Fact Categorization

- **Personal**: Relationships, pets, family, location
- **Preferences**: Technologies, approaches, styles
- **Professional**: Job, skills, current projects
- **Interests**: Hobbies, topics of interest
- **Context**: Temporary context that may become irrelevant

## Search and Retrieval System

### Search Strategy

- **Trigger**: Every user message before AI processing
- **Context Window**: Use last 2-3 user messages as search query
- **Search Methods**:
  1. **Semantic Search**: Vector similarity search on embeddings
  2. **Keyword Search**: Full-text search for exact matches
  3. **Recency Boost**: Prioritize recently updated facts

### Retrieval Process

1. **Query Construction**: Combine recent user messages into search context
2. **Vector Search**: Find semantically similar facts (top 10-15 candidates)
3. **Relevance Filtering**: Apply threshold (e.g., cosine similarity > 0.3)
4. **Recency Weighting**: Boost score based on `updated_at` timestamp
5. **Final Selection**: Return top 5-8 most relevant facts

### Context Injection

- **Integration Point**: In AI service before sending to LLM
- **Format**: Structured context block in system prompt:
  ```
  ## User Context (from memory):
  - Teddy has a 12 year old collie called Jim
  - Teddy prefers line art icons for UI design
  - Teddy is building an Electron app called Bitcave
  ```

## Integration Points

### AI Service Integration

```typescript
// In ai-service.ts
async processUserMessage(message: string, conversationId: string): Promise<string> {
    // 1. Store user message
    await this.memoryService.storeMessage(conversationId, 'user', message);

    // 2. Search for relevant facts
    const relevantFacts = await this.memoryService.searchFacts(conversationId);

    // 3. Build context-enhanced prompt
    const enhancedPrompt = this.buildPromptWithContext(message, relevantFacts);

    // 4. Get AI response
    const response = await this.openRouterClient.sendMessage(enhancedPrompt);

    // 5. Store AI response
    await this.memoryService.storeMessage(conversationId, 'assistant', response);

    // 6. Trigger fact extraction if needed
    await this.memoryService.maybeExtractFacts(conversationId);

    return response;
}
```

### New Service Classes

#### `MemoryService`

- Manages fact extraction, storage, and retrieval
- Handles conversation tracking
- Interfaces with embedding generation

#### `EmbeddingService`

- Generates vector embeddings for facts and queries
- Manages local embedding model
- Handles vector similarity calculations

#### `FactExtractor`

- Orchestrates LLM calls for fact extraction
- Processes and validates extracted facts
- Handles deduplication logic

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

- [ ] Set up SQLite database with vector extension
- [ ] Implement basic conversation and message storage
- [ ] Create MemoryService with CRUD operations
- [ ] Basic fact storage without extraction

### Phase 2: Embedding System (Week 2-3)

- [ ] Integrate local embedding model (Transformers.js)
- [ ] Implement EmbeddingService
- [ ] Add vector similarity search
- [ ] Basic retrieval system

### Phase 3: Fact Extraction (Week 3-4)

- [ ] Create FactExtractor service
- [ ] Implement LLM-based fact extraction
- [ ] Add deduplication logic
- [ ] Integrate extraction triggers

### Phase 4: AI Integration (Week 4-5)

- [ ] Integrate memory system with AI service
- [ ] Implement context injection
- [ ] Add conversation context management
- [ ] Performance optimization

### Phase 5: User Interface (Week 5-6)

- [ ] Memory management UI components
- [ ] Fact viewing and editing interface
- [ ] Memory statistics and insights
- [ ] Settings and preferences

## Performance Considerations

### Optimization Strategies

- **Lazy Loading**: Only load embeddings when needed
- **Caching**: Cache recent search results and embeddings
- **Batch Operations**: Process multiple facts together
- **Index Optimization**: Proper indexing on frequently queried columns

### Resource Management

- **Memory Usage**: Monitor embedding model memory footprint
- **Storage Growth**: Implement fact pruning for old, low-confidence facts
- **Search Performance**: Limit vector search to top-k candidates

## User Interface Components

### Memory Dashboard

- View all stored facts organized by category
- Search and filter facts
- Edit or delete individual facts
- Import/export memory data

### Conversation Memory

- Show relevant facts used in current conversation
- Highlight when new facts are extracted
- Option to approve/reject extracted facts

### Settings Panel

- Configure extraction frequency
- Set relevance thresholds
- Manage fact categories
- Privacy and data controls

## Privacy and Data Management

### User Controls

- **Fact Management**: Full CRUD access to stored facts
- **Conversation History**: View, search, and delete conversations
- **Data Export**: Export all memory data
- **Selective Deletion**: Delete facts by category or date range

### Data Security

- **Local Storage**: All data remains on user's machine
- **No Network**: Memory system operates offline
- **Encryption**: Consider encrypting sensitive facts (future enhancement)

## Error Handling and Fallbacks

### Graceful Degradation

- **Embedding Failure**: Fall back to keyword search
- **LLM Unavailable**: Skip fact extraction, continue conversation
- **Database Issues**: Queue operations for retry

### Data Integrity

- **Transaction Safety**: Use database transactions for complex operations
- **Backup Strategy**: Regular automated backups of memory database
- **Corruption Recovery**: Detection and repair mechanisms

## Testing Strategy

### Unit Tests

- MemoryService CRUD operations
- EmbeddingService vector operations
- FactExtractor parsing and validation

### Integration Tests

- Full fact extraction pipeline
- Search and retrieval accuracy
- AI service integration

### Performance Tests

- Large fact database performance
- Concurrent access handling
- Memory usage under load

## Future Enhancements

### Advanced Features

- **Fact Relationships**: Link related facts together
- **Temporal Tracking**: Track how facts change over time
- **Confidence Learning**: Improve confidence scoring based on usage
- **Cross-Project Insights**: Analyze patterns across projects

### Integration Opportunities

- **Tool Integration**: Memory-aware AI tools
- **File Indexing**: Include project files in memory system
- **External Sources**: Import facts from documents or other sources

---

_This design document serves as the foundation for implementing Bitcave's local RAG memory system. The modular architecture allows for iterative development and future enhancements while maintaining performance and user privacy._

Recommended Technology Stack

1. Vector Database: Use sqlite-vec instead of sqlite-vss
   Recommended Technology Stack

1. Vector Database: Use sqlite-vec instead of sqlite-vss
   sqlite-vec is the newer, actively maintained successor to sqlite-vss. It's written in pure C with no dependencies, runs anywhere SQLite runs, and is much easier to install and use. GitHubAlexgarcia Key advantages:

Extremely small, "fast enough" vector search that supports K-Nearest Neighbor (KNN) search, multiple distance metrics, and SIMD-accelerated performance How sqlite-vec Works for Storing and Querying Vector Embeddings | by Stephen Collins | Medium
With 1 million 128-dimensional vectors, sqlite-vec performs well with fast query times Introducing sqlite-vec v0.1.0: a vector search SQLite extension that runs everywhere | Alex Garcia's Blog
No complex dependencies like FAISS required
Supports binary quantization for space savings

2. Embedding Model: Transformers.js with all-MiniLM-L6-v2
   The all-MiniLM-L6-v2 model maps sentences & paragraphs to a 384 dimensional dense vector space and can be used for clustering or semantic search sentence-transformers/all-MiniLM-L6-v2 · Hugging Face
Runs entirely in JavaScript/TypeScript - perfect for Electron
Lightweight and fast for local inference
Well-tested for semantic similarity tasks

3. SQLite Optimization: Enable WAL Mode
   WAL mode writes changes to a sequential write-ahead log and allows safely using synchronous = normal, which avoids having to wait for filesystem sync operations in most transactions SQLite Optimizations for Ultra High-Performance
   Essential optimizations:
   sqlPRAGMA journal_mode = WAL;
   PRAGMA synchronous = NORMAL;
   PRAGMA temp_store = MEMORY;
   PRAGMA mmap_size = 30000000000;
   WAL mode allows concurrent reads and writes, reducing I/O overhead and improving responsiveness Understanding WAL Mode in SQLite: Boosting Performance in SQL CRUD Operations for iOS | by Mohit Bhalla | Medium
   Implementation Architecture
   Database Schema (Modified for sqlite-vec)
   sql-- Install sqlite-vec extension first
   -- Create vector table for facts
   CREATE VIRTUAL TABLE vec_facts USING vec0(
   fact_embedding FLOAT[384] -- Dimension matches all-MiniLM-L6-v2
   );

-- Main facts table
CREATE TABLE facts (
id INTEGER PRIMARY KEY AUTOINCREMENT,
content TEXT NOT NULL,
category TEXT,
confidence REAL DEFAULT 1.0,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
source_conversation_id TEXT,
vec_id INTEGER REFERENCES vec_facts(rowid)
);

-- Create indexes for performance
CREATE INDEX idx_facts_category ON facts(category);
CREATE INDEX idx_facts_updated ON facts(updated_at);
CREATE INDEX idx_facts_confidence ON facts(confidence);
Service Implementation
typescript// embedding-service.ts
import { pipeline, env } from '@xenova/transformers';

export class EmbeddingService {
private embedder: any;

    async initialize() {
        // Configure for local model caching
        env.localURL = './models/';
        env.allowRemoteModels = false;

        // Initialize the embedding pipeline
        this.embedder = await pipeline(
            'feature-extraction',
            'Xenova/all-MiniLM-L6-v2',
            { pooling: 'mean', normalize: true }
        );
    }

    async generateEmbedding(text: string): Promise<Float32Array> {
        const output = await this.embedder(text);
        return output.data;
    }

    async generateBatchEmbeddings(texts: string[]): Promise<Float32Array[]> {
        // Process in batches for efficiency
        const embeddings = [];
        for (const text of texts) {
            const embedding = await this.generateEmbedding(text);
            embeddings.push(embedding);
        }
        return embeddings;
    }

}
typescript// memory-service.ts
import Database from 'better-sqlite3';
import { EmbeddingService } from './embedding-service';

export class MemoryService {
private db: Database.Database;
private embeddingService: EmbeddingService;

    constructor(dbPath: string) {
        this.db = new Database(dbPath);
        this.embeddingService = new EmbeddingService();
        this.initializeDatabase();
    }

    private initializeDatabase() {
        // Enable optimizations
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
        this.db.pragma('temp_store = MEMORY');
        this.db.pragma('mmap_size = 30000000000');

        // Load sqlite-vec extension
        this.db.loadExtension('./sqlite-vec');

        // Initialize embedding service
        await this.embeddingService.initialize();
    }

    async searchFacts(query: string, limit: number = 5): Promise<Fact[]> {
        // Generate query embedding
        const queryEmbedding = await this.embeddingService.generateEmbedding(query);

        // Perform vector similarity search
        const results = this.db.prepare(`
            SELECT
                f.*,
                vec_distance_l2(vf.fact_embedding, ?) as distance
            FROM vec_facts vf
            JOIN facts f ON f.vec_id = vf.rowid
            WHERE distance < 0.5  -- Similarity threshold
            ORDER BY distance ASC
            LIMIT ?
        `).all(queryEmbedding, limit);

        return results;
    }

    async storeFact(content: string, category: string, conversationId: string) {
        // Generate embedding
        const embedding = await this.embeddingService.generateEmbedding(content);

        // Check for duplicates using vector similarity
        const similar = await this.searchFacts(content, 1);
        if (similar.length > 0 && similar[0].distance < 0.1) {
            // Update existing fact confidence instead
            this.updateFactConfidence(similar[0].id);
            return;
        }

        // Insert into vector table
        const vecResult = this.db.prepare(`
            INSERT INTO vec_facts(fact_embedding) VALUES (?)
        `).run(embedding);

        // Insert into facts table
        this.db.prepare(`
            INSERT INTO facts (content, category, source_conversation_id, vec_id)
            VALUES (?, ?, ?, ?)
        `).run(content, category, conversationId, vecResult.lastInsertRowid);
    }

}
Fact Extraction with Local Processing
typescript// fact-extractor.ts
export class FactExtractor {
private memoryService: MemoryService;

    async extractFacts(messages: Message[]): Promise<ExtractedFact[]> {
        // Build context from messages
        const context = messages.map(m => `${m.role}: ${m.content}`).join('
');

        // Use the AI service to extract facts
        const prompt = `
            Extract key factual information about the user from this conversation.
            Return as JSON array of facts with categories:
            - personal (relationships, family, pets, location)
            - preferences (technologies, approaches, styles)
            - professional (job, skills, projects)
            - interests (hobbies, topics)

            Format: [{

2. Embedding Model: Transformers.js with all-MiniLM-L6-v2

The all-MiniLM-L6-v2 model maps sentences & paragraphs to a 384 dimensional dense vector space and can be used for clustering or semantic search sentence-transformers/all-MiniLM-L6-v2 · Hugging Face
Runs entirely in JavaScript/TypeScript - perfect for Electron
Lightweight and fast for local inference
Well-tested for semantic similarity tasks

3. SQLite Optimization: Enable WAL Mode
   WAL mode writes changes to a sequential write-ahead log and allows safely using synchronous = normal, which avoids having to wait for filesystem sync operations in most transactions SQLite Optimizations for Ultra High-Performance
   Essential optimizations:
   sqlPRAGMA journal_mode = WAL;
   PRAGMA synchronous = NORMAL;
   PRAGMA temp_store = MEMORY;
   PRAGMA mmap_size = 30000000000;
   WAL mode allows concurrent reads and writes, reducing I/O overhead and improving responsiveness Understanding WAL Mode in SQLite: Boosting Performance in SQL CRUD Operations for iOS | by Mohit Bhalla | Medium
   Implementation Architecture
   Database Schema (Modified for sqlite-vec)
   sql-- Install sqlite-vec extension first
   -- Create vector table for facts
   CREATE VIRTUAL TABLE vec_facts USING vec0(
   fact_embedding FLOAT[384] -- Dimension matches all-MiniLM-L6-v2
   );

-- Main facts table
CREATE TABLE facts (
id INTEGER PRIMARY KEY AUTOINCREMENT,
content TEXT NOT NULL,
category TEXT,
confidence REAL DEFAULT 1.0,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
source_conversation_id TEXT,
vec_id INTEGER REFERENCES vec_facts(rowid)
);

-- Create indexes for performance
CREATE INDEX idx_facts_category ON facts(category);
CREATE INDEX idx_facts_updated ON facts(updated_at);
CREATE INDEX idx_facts_confidence ON facts(confidence);
Service Implementation
typescript// embedding-service.ts
import { pipeline, env } from '@xenova/transformers';

export class EmbeddingService {
private embedder: any;

    async initialize() {
        // Configure for local model caching
        env.localURL = './models/';
        env.allowRemoteModels = false;

        // Initialize the embedding pipeline
        this.embedder = await pipeline(
            'feature-extraction',
            'Xenova/all-MiniLM-L6-v2',
            { pooling: 'mean', normalize: true }
        );
    }

    async generateEmbedding(text: string): Promise<Float32Array> {
        const output = await this.embedder(text);
        return output.data;
    }

    async generateBatchEmbeddings(texts: string[]): Promise<Float32Array[]> {
        // Process in batches for efficiency
        const embeddings = [];
        for (const text of texts) {
            const embedding = await this.generateEmbedding(text);
            embeddings.push(embedding);
        }
        return embeddings;
    }

}
typescript// memory-service.ts
import Database from 'better-sqlite3';
import { EmbeddingService } from './embedding-service';

export class MemoryService {
private db: Database.Database;
private embeddingService: EmbeddingService;

    constructor(dbPath: string) {
        this.db = new Database(dbPath);
        this.embeddingService = new EmbeddingService();
        this.initializeDatabase();
    }

    private initializeDatabase() {
        // Enable optimizations
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
        this.db.pragma('temp_store = MEMORY');
        this.db.pragma('mmap_size = 30000000000');

        // Load sqlite-vec extension
        this.db.loadExtension('./sqlite-vec');

        // Initialize embedding service
        await this.embeddingService.initialize();
    }

    async searchFacts(query: string, limit: number = 5): Promise<Fact[]> {
        // Generate query embedding
        const queryEmbedding = await this.embeddingService.generateEmbedding(query);

        // Perform vector similarity search
        const results = this.db.prepare(`
            SELECT
                f.*,
                vec_distance_l2(vf.fact_embedding, ?) as distance
            FROM vec_facts vf
            JOIN facts f ON f.vec_id = vf.rowid
            WHERE distance < 0.5  -- Similarity threshold
            ORDER BY distance ASC
            LIMIT ?
        `).all(queryEmbedding, limit);

        return results;
    }

    async storeFact(content: string, category: string, conversationId: string) {
        // Generate embedding
        const embedding = await this.embeddingService.generateEmbedding(content);

        // Check for duplicates using vector similarity
        const similar = await this.searchFacts(content, 1);
        if (similar.length > 0 && similar[0].distance < 0.1) {
            // Update existing fact confidence instead
            this.updateFactConfidence(similar[0].id);
            return;
        }

        // Insert into vector table
        const vecResult = this.db.prepare(`
            INSERT INTO vec_facts(fact_embedding) VALUES (?)
        `).run(embedding);

        // Insert into facts table
        this.db.prepare(`
            INSERT INTO facts (content, category, source_conversation_id, vec_id)
            VALUES (?, ?, ?, ?)
        `).run(content, category, conversationId, vecResult.lastInsertRowid);
    }

}
Fact Extraction with Local Processing
typescript// fact-extractor.ts
export class FactExtractor {
private memoryService: MemoryService;

    async extractFacts(messages: Message[]): Promise<ExtractedFact[]> {
        // Build context from messages
        const context = messages.map(m => `${m.role}: ${m.content}`).join('\n');

        // Use the AI service to extract facts
        const prompt = `
            Extract key factual information about the user from this conversation.
            Return as JSON array of facts with categories:
            - personal (relationships, family, pets, location)
            - preferences (technologies, approaches, styles)
            - professional (job, skills, projects)
            - interests (hobbies, topics)

            Format: [{"fact": "...", "category": "..."}]

            Conversation:
            ${context}
        `;

        // Process with your AI service
        const response = await this.aiService.processPrompt(prompt);
        const facts = JSON.parse(response);

        // Store each fact
        for (const fact of facts) {
            await this.memoryService.storeFact(
                fact.fact,
                fact.category,
                conversationId
            );
        }

        return facts;
    }

}
Performance Optimizations

1.  Batch Operations
    typescript// Use transactions for bulk inserts
    const insertMany = db.transaction((facts) => {
    for (const fact of facts) {
    // Insert operations
    }
    });
    insertMany(facts);
2.  Connection Pooling for Electron
    typescript// Use separate connections for read/write
    class DatabasePool {
    private writeDb: Database;
    private readDbs: Database[] = [];
        constructor(dbPath: string, readPoolSize = 3) {
            this.writeDb = new Database(dbPath);
            for (let i = 0; i < readPoolSize; i++) {
                this.readDbs.push(new Database(dbPath, { readonly: true }));
            }
        }
    }
3.  Caching Strategy
    typescriptclass FactCache {
    private cache = new Map<string, CachedResult>();
    private maxAge = 5 _ 60 _ 1000; // 5 minutes
        get(query: string): CachedResult | null {
            const cached = this.cache.get(query);
            if (cached && Date.now() - cached.timestamp < this.maxAge) {
                return cached;
            }
            return null;
        }
    }
    Implementation Timeline
    Week 1-2: Core Infrastructure

Set up sqlite-vec with Electron
Implement basic database operations
Configure WAL mode and optimizations

Week 2-3: Embedding System

Integrate Transformers.js
Implement embedding generation
Add vector similarity search

Week 3-4: Fact Extraction

Build fact extraction pipeline
Implement deduplication logic
Add confidence scoring

Week 4-5: Integration & Optimization

Connect to AI service
Implement caching layer
Performance profiling and optimization

Week 5-6: UI & Polish

Build memory management UI
Add import/export functionality
Testing and refinement

Key Performance Metrics to Target

Embedding Generation: < 50ms per sentence with all-MiniLM-L6-v2
Vector Search: < 10ms for top-5 results from 100k facts
Fact Extraction: Process 10 messages in < 2 seconds
Memory Usage: < 500MB for model + 1M facts
Database Size: ~200MB for 100k facts with embeddings

This architecture leverages the best modern tools for local vector search while maintaining excellent performance and ease of implementation in your Electron environment.
