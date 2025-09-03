import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

// Mock the embedding service before importing anything else
jest.mock('../../src/main/memory/embedding-service', () => {
  class MockEmbeddingService {
    async initialize() {}
    
    async generateEmbedding(text: string): Promise<Float32Array> {
      const hash = this.simpleHash(text);
      const embedding = new Float32Array(384);
      for (let i = 0; i < 384; i++) {
        embedding[i] = Math.sin((hash + i) * 0.1) * 0.5;
      }
      return embedding;
    }

    async generateBatchEmbeddings(texts: string[]): Promise<Float32Array[]> {
      const embeddings = [];
      for (const text of texts) {
        embeddings.push(await this.generateEmbedding(text));
      }
      return embeddings;
    }

    private simpleHash(str: string): number {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash);
    }
  }

  return { EmbeddingService: MockEmbeddingService };
});

// Mock the database module to use test database
jest.mock('../../src/main/memory/database', () => {
  let testDb: Database.Database;
  
  return {
    getDb: () => {
      if (!testDb) {
        const testDbPath = createTestDatabase('memory-service');
        testDb = new Database(testDbPath);
        setupTestDatabase(testDb);
      }
      return testDb;
    }
  };
});

// Now import the modules after mocking
import { MemoryService } from '../../src/main/memory/memory-service';
import { 
  createTestDatabase, 
  cleanupTestDatabase, 
  mockFacts, 
  mockConversations,
  generateTestId,
  delay
} from '../utils/test-helpers';

// Mock AI service
class MockAIService {
  async processPrompt(prompt: string): Promise<string> {
    if (prompt.includes('Extract key factual information')) {
      return JSON.stringify([
        {
          content: "User prefers React for frontend development",
          category: "preferences"
        },
        {
          content: "User has 5 years of programming experience", 
          category: "professional"
        }
      ]);
    }
    return "Mock AI response";
  }
}

function setupTestDatabase(db: Database.Database) {
  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('temp_store = MEMORY');

  // For tests, we'll create a simple mock vector table since sqlite-vec might not be available
  try {
    // Try to create the vector table - if sqlite-vec is available
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_facts USING vec0(
        fact_embedding FLOAT[384]
      );
    `);
  } catch (error) {
    // Fallback to regular table for tests
    console.warn('sqlite-vec not available in tests, using mock table');
    db.exec(`
      CREATE TABLE IF NOT EXISTS vec_facts (
        rowid INTEGER PRIMARY KEY AUTOINCREMENT,
        fact_embedding TEXT -- Store as JSON string for tests
      );
    `);
  }

  // Create tables
  const createTables = db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS facts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        category TEXT,
        confidence REAL DEFAULT 1.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        source_conversation_id TEXT,
        project_id TEXT,
        vec_id INTEGER REFERENCES vec_facts(rowid)
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        title TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        message_count INTEGER DEFAULT 0
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS conversation_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT REFERENCES conversations(id),
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_for_facts BOOLEAN DEFAULT FALSE
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS user_profile (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  });

  createTables();
}

describe('MemoryService', () => {
  let memoryService: MemoryService;
  let mockAIService: MockAIService;

  beforeEach(() => {
    mockAIService = new MockAIService();
    memoryService = new MemoryService(mockAIService as any);
  });

  afterEach(() => {
    // Clean up test database
    const db = memoryService.getDatabase();
    db.exec('DELETE FROM facts');
    db.exec('DELETE FROM conversations');
    db.exec('DELETE FROM conversation_messages');
    db.exec('DELETE FROM vec_facts');
  });

  describe('Conversation Management', () => {
    test('should create a conversation', async () => {
      const conversation = await memoryService.createConversation('Test Conversation', 'project1');
      
      expect(conversation).toHaveProperty('id');
      expect(conversation.title).toBe('Test Conversation');
      expect(conversation.project_id).toBe('project1');
      expect(conversation.message_count).toBe(0);
      expect(conversation).toHaveProperty('created_at');
      expect(conversation).toHaveProperty('updated_at');
    });

    test('should retrieve a conversation', async () => {
      const created = await memoryService.createConversation('Test Conversation');
      const retrieved = await memoryService.getConversation(created.id);
      
      expect(retrieved).toEqual(created);
    });

    test('should return null for non-existent conversation', async () => {
      const conversation = await memoryService.getConversation('non-existent');
      expect(conversation).toBeNull();
    });

    test('should update conversation', async () => {
      const conversation = await memoryService.createConversation('Original Title');
      
      await memoryService.updateConversation(conversation.id, {
        title: 'Updated Title',
        message_count: 5
      });

      const updated = await memoryService.getConversation(conversation.id);
      expect(updated?.title).toBe('Updated Title');
      expect(updated?.message_count).toBe(5);
    });

    test('should delete conversation', async () => {
      const conversation = await memoryService.createConversation('To Delete');
      
      await memoryService.deleteConversation(conversation.id);
      
      const deleted = await memoryService.getConversation(conversation.id);
      expect(deleted).toBeNull();
    });
  });

  describe('Message Management', () => {
    test('should add message to conversation', async () => {
      const conversation = await memoryService.createConversation('Test Conversation');
      
      const message = await memoryService.addMessageToConversation(
        conversation.id, 
        'user', 
        'Hello, this is a test message'
      );

      expect(message).toHaveProperty('id');
      expect(message.conversation_id).toBe(conversation.id);
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello, this is a test message');
      expect(message.processed_for_facts).toBe(false);
      expect(message).toHaveProperty('timestamp');

      // Check that conversation message count was updated
      const updatedConversation = await memoryService.getConversation(conversation.id);
      expect(updatedConversation?.message_count).toBe(1);
    });

    test('should retrieve messages for conversation', async () => {
      const conversation = await memoryService.createConversation('Test Conversation');
      
      await memoryService.addMessageToConversation(conversation.id, 'user', 'First message');
      await memoryService.addMessageToConversation(conversation.id, 'assistant', 'Second message');
      
      const messages = await memoryService.getMessagesForConversation(conversation.id);
      
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe('First message');
      expect(messages[1].content).toBe('Second message');
    });

    test('should trigger fact extraction after 3 messages', async () => {
      const conversation = await memoryService.createConversation('Test Conversation');
      
      // Add first two messages (no extraction yet)
      await memoryService.addMessageToConversation(conversation.id, 'user', 'Message 1');
      await memoryService.addMessageToConversation(conversation.id, 'assistant', 'Response 1');
      
      let facts = await memoryService.searchFacts('test', 10);
      expect(facts).toHaveLength(0);

      // Add third message (should trigger extraction)
      await memoryService.addMessageToConversation(conversation.id, 'user', 'Message 2 about TypeScript');
      
      // Wait a bit for async fact extraction
      await delay(100);
      
      // Check if facts were extracted (based on our mock AI service)
      facts = await memoryService.searchFacts('React', 10);
      expect(facts.length).toBeGreaterThan(0);
    });
  });

  describe('Fact Management', () => {
    test('should add a fact', async () => {
      const factData = mockFacts[0];
      const fact = await memoryService.addFact(factData);

      expect(fact).toHaveProperty('id');
      expect(fact.content).toBe(factData.content);
      expect(fact.category).toBe(factData.category);
      expect(fact.confidence).toBe(factData.confidence);
      expect(fact).toHaveProperty('vec_id');
      expect(fact).toHaveProperty('created_at');
      expect(fact).toHaveProperty('updated_at');
    });

    test('should retrieve a fact', async () => {
      const factData = mockFacts[0];
      const created = await memoryService.addFact(factData);
      const retrieved = await memoryService.getFact(created.id);

      expect(retrieved).toEqual(created);
    });

    test('should return null for non-existent fact', async () => {
      const fact = await memoryService.getFact(999);
      expect(fact).toBeNull();
    });

    test('should update a fact', async () => {
      const factData = mockFacts[0];
      const fact = await memoryService.addFact(factData);

      await memoryService.updateFact(fact.id, {
        content: 'Updated content',
        confidence: 0.8
      });

      const updated = await memoryService.getFact(fact.id);
      expect(updated?.content).toBe('Updated content');
      expect(updated?.confidence).toBe(0.8);
    });

    test('should delete a fact', async () => {
      const factData = mockFacts[0];
      const fact = await memoryService.addFact(factData);

      await memoryService.deleteFact(fact.id);

      const deleted = await memoryService.getFact(fact.id);
      expect(deleted).toBeNull();
    });

    test('should search facts by similarity', async () => {
      // Add multiple facts
      for (const factData of mockFacts) {
        await memoryService.addFact(factData);
      }

      // Search for TypeScript-related facts
      const results = await memoryService.searchFacts('TypeScript programming', 5);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('distance');
      
      // Results should be sorted by distance (ascending)
      for (let i = 1; i < results.length; i++) {
        expect(results[i].distance).toBeGreaterThanOrEqual(results[i-1].distance);
      }
    });

    test('should limit search results', async () => {
      // Add multiple facts
      for (const factData of mockFacts) {
        await memoryService.addFact(factData);
      }

      const results = await memoryService.searchFacts('user', 2);
      expect(results).toHaveLength(2);
    });
  });

  describe('Integration Tests', () => {
    test('should handle full conversation flow with fact extraction', async () => {
      // Create conversation
      const conversation = await memoryService.createConversation('Integration Test');

      // Add messages that should trigger fact extraction
      await memoryService.addMessageToConversation(conversation.id, 'user', 'I work with React and TypeScript daily');
      await memoryService.addMessageToConversation(conversation.id, 'assistant', 'That\'s a great tech stack!');
      await memoryService.addMessageToConversation(conversation.id, 'user', 'I have been programming for 5 years');

      // Wait for fact extraction
      await delay(200);

      // Verify facts were extracted
      const facts = await memoryService.searchFacts('programming experience', 10);
      expect(facts.length).toBeGreaterThan(0);

      // Verify conversation state
      const updatedConversation = await memoryService.getConversation(conversation.id);
      expect(updatedConversation?.message_count).toBe(3);
    });

    test('should handle multiple conversations independently', async () => {
      const conv1 = await memoryService.createConversation('Conversation 1');
      const conv2 = await memoryService.createConversation('Conversation 2');

      await memoryService.addMessageToConversation(conv1.id, 'user', 'I like cats');
      await memoryService.addMessageToConversation(conv2.id, 'user', 'I prefer dogs');

      const conv1Messages = await memoryService.getMessagesForConversation(conv1.id);
      const conv2Messages = await memoryService.getMessagesForConversation(conv2.id);

      expect(conv1Messages).toHaveLength(1);
      expect(conv2Messages).toHaveLength(1);
      expect(conv1Messages[0].content).toBe('I like cats');
      expect(conv2Messages[0].content).toBe('I prefer dogs');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid conversation ID gracefully', async () => {
      const message = await memoryService.addMessageToConversation('invalid-id', 'user', 'Test message');
      
      // Should still create the message even if conversation doesn't exist
      expect(message).toHaveProperty('id');
      expect(message.conversation_id).toBe('invalid-id');
    });

    test('should handle empty search query', async () => {
      const results = await memoryService.searchFacts('', 10);
      expect(Array.isArray(results)).toBe(true);
    });

    test('should handle update of non-existent fact', async () => {
      // Should not throw an error
      await expect(memoryService.updateFact(999, { content: 'Updated' })).resolves.not.toThrow();
    });

    test('should handle deletion of non-existent fact', async () => {
      // Should not throw an error
      await expect(memoryService.deleteFact(999)).resolves.not.toThrow();
    });
  });
});