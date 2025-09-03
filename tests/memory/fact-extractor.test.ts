// Mock the embedding service before importing anything else
jest.mock("../../src/main/memory/embedding-service", () => {
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
      const embeddings: Float32Array[] = [];
      for (const text of texts) {
        embeddings.push(await this.generateEmbedding(text));
      }
      return embeddings;
    }

    private simpleHash(str: string): number {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
      }
      return Math.abs(hash);
    }
  }

  return { EmbeddingService: MockEmbeddingService };
});

// Mock the database module
jest.mock("../../src/main/memory/database", () => {
  const Database = require("better-sqlite3");
  let testDb: any;

  return {
    getDb: () => {
      if (!testDb) {
        testDb = new Database(":memory:");
        setupTestDatabase(testDb);
      }
      return testDb;
    },
  };
});

// Now import the modules after mocking
import { FactExtractor } from "../../src/main/memory/fact-extractor";
import { MemoryService } from "../../src/main/memory/memory-service";
import { mockMessages, generateTestId } from "../utils/test-helpers";
import { ConversationMessage } from "../../src/main/memory/types";

// Mock AI service
class MockAIService {
  async processPrompt(prompt: string): Promise<string> {
    if (
      prompt.includes("Extract key factual information") ||
      prompt.includes("fact extraction assistant")
    ) {
      return JSON.stringify([
        {
          content: "User prefers React for frontend development",
          category: "preferences",
        },
        {
          content: "User has 5 years of programming experience",
          category: "professional",
        },
      ]);
    }
    return "Mock AI response";
  }
}

function setupTestDatabase(db: any) {
  // Enable pragma settings
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("temp_store = MEMORY");

  // Create mock vector table
  db.exec(`
    CREATE TABLE IF NOT EXISTS vec_facts (
      rowid INTEGER PRIMARY KEY AUTOINCREMENT,
      fact_embedding TEXT -- Store as JSON string for tests
    );
  `);

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
  });

  createTables();
}

describe("FactExtractor", () => {
  let factExtractor: FactExtractor;
  let memoryService: MemoryService;
  let mockAIService: MockAIService;

  beforeEach(() => {
    mockAIService = new MockAIService();
    memoryService = new MemoryService(mockAIService as any);
    factExtractor = new FactExtractor(memoryService, mockAIService as any);
  });

  afterEach(() => {
    // Clean up test database
    const db = memoryService.getDatabase();
    db.exec("DELETE FROM facts");
    db.exec("DELETE FROM conversations");
    db.exec("DELETE FROM conversation_messages");
    db.exec("DELETE FROM vec_facts");
  });

  describe("Fact Extraction", () => {
    test("should extract facts from conversation messages", async () => {
      const conversationId = generateTestId();
      const messages: ConversationMessage[] = [
        {
          id: 1,
          conversation_id: conversationId,
          role: "user",
          content:
            "I love working with React and TypeScript for frontend development",
          timestamp: new Date().toISOString(),
          processed_for_facts: false,
        },
        {
          id: 2,
          conversation_id: conversationId,
          role: "assistant",
          content:
            "That's a great combination! React and TypeScript work really well together.",
          timestamp: new Date().toISOString(),
          processed_for_facts: false,
        },
        {
          id: 3,
          conversation_id: conversationId,
          role: "user",
          content: "I have been programming professionally for 5 years now",
          timestamp: new Date().toISOString(),
          processed_for_facts: false,
        },
      ];

      await factExtractor.extractFacts(messages, conversationId);

      // Check if facts were extracted and stored
      const facts = await memoryService.searchFacts("React", 10);
      expect(facts.length).toBeGreaterThan(0);

      // Verify fact content matches our mock AI response
      const reactFact = facts.find((f) => f.content.includes("React"));
      expect(reactFact).toBeDefined();
      expect(reactFact?.category).toBe("preferences");
      expect(reactFact?.source_conversation_id).toBe(conversationId);
    });

    test("should handle empty messages array", async () => {
      const conversationId = generateTestId();

      await expect(
        factExtractor.extractFacts([], conversationId)
      ).resolves.not.toThrow();

      // Should not extract any facts
      const facts = await memoryService.searchFacts("test", 10);
      expect(facts).toHaveLength(0);
    });

    test("should handle AI service errors gracefully", async () => {
      const conversationId = generateTestId();
      const messages: ConversationMessage[] = [
        {
          id: 1,
          conversation_id: conversationId,
          role: "user",
          content: "Test message",
          timestamp: new Date().toISOString(),
          processed_for_facts: false,
        },
      ];

      // Mock AI service to throw error
      mockAIService.processPrompt = jest
        .fn()
        .mockRejectedValue(new Error("AI service error"));

      await expect(
        factExtractor.extractFacts(messages, conversationId)
      ).resolves.not.toThrow();

      // Should not have extracted any facts due to error
      const facts = await memoryService.searchFacts("test", 10);
      expect(facts).toHaveLength(0);
    });

    test("should handle invalid JSON response from AI", async () => {
      const conversationId = generateTestId();
      const messages: ConversationMessage[] = [
        {
          id: 1,
          conversation_id: conversationId,
          role: "user",
          content: "Test message",
          timestamp: new Date().toISOString(),
          processed_for_facts: false,
        },
      ];

      // Mock AI service to return invalid JSON
      mockAIService.processPrompt = jest
        .fn()
        .mockResolvedValue("invalid json response");

      await expect(
        factExtractor.extractFacts(messages, conversationId)
      ).resolves.not.toThrow();

      // Should not have extracted any facts due to JSON parse error
      const facts = await memoryService.searchFacts("test", 10);
      expect(facts).toHaveLength(0);
    });

    test("should skip facts with missing required fields", async () => {
      const conversationId = generateTestId();
      const messages: ConversationMessage[] = [
        {
          id: 1,
          conversation_id: conversationId,
          role: "user",
          content: "Test message",
          timestamp: new Date().toISOString(),
          processed_for_facts: false,
        },
      ];

      // Mock AI service to return facts with missing fields
      mockAIService.processPrompt = jest.fn().mockResolvedValue(
        JSON.stringify([
          {
            content: "Valid fact",
            category: "preferences",
          },
          {
            content: "", // Missing content
            category: "personal",
          },
          {
            // Missing category
            content: "Fact without category",
          },
          {
            content: "Another valid fact",
            category: "interests",
          },
        ])
      );

      await factExtractor.extractFacts(messages, conversationId);

      // Should only have extracted the valid facts
      const facts = await memoryService.searchFacts("fact", 10);
      expect(facts).toHaveLength(2);
    });
  });

  describe("Deduplication", () => {
    test("should not create duplicate facts", async () => {
      const conversationId = generateTestId();

      // First, add a fact manually
      await memoryService.addFact({
        content: "User prefers React for frontend development",
        category: "preferences",
        confidence: 1.0,
        source_conversation_id: conversationId,
        project_id: undefined,
      });

      // Mock AI service to return a very similar fact
      mockAIService.processPrompt = jest.fn().mockResolvedValue(
        JSON.stringify([
          {
            content: "User prefers React for frontend development",
            category: "preferences",
          },
        ])
      );

      const messages: ConversationMessage[] = [
        {
          id: 1,
          conversation_id: conversationId,
          role: "user",
          content: "I really like using React for frontend work",
          timestamp: new Date().toISOString(),
          processed_for_facts: false,
        },
      ];

      await factExtractor.extractFacts(messages, conversationId);

      // Should not have created a duplicate
      const facts = await memoryService.searchFacts("React", 10);
      expect(facts).toHaveLength(1);

      // But confidence might have been updated
      expect(facts[0].confidence).toBeGreaterThanOrEqual(1.0);
    });

    test("should update confidence of similar existing facts", async () => {
      const conversationId = generateTestId();

      // Add initial fact
      const initialFact = await memoryService.addFact({
        content: "User likes TypeScript",
        category: "preferences",
        confidence: 0.8,
        source_conversation_id: conversationId,
        project_id: undefined,
      });

      // Mock similar fact from AI
      mockAIService.processPrompt = jest.fn().mockResolvedValue(
        JSON.stringify([
          {
            content: "User likes TypeScript programming",
            category: "preferences",
          },
        ])
      );

      const messages: ConversationMessage[] = [
        {
          id: 1,
          conversation_id: conversationId,
          role: "user",
          content: "I really enjoy TypeScript development",
          timestamp: new Date().toISOString(),
          processed_for_facts: false,
        },
      ];

      await factExtractor.extractFacts(messages, conversationId);

      // Check if confidence was updated
      const updatedFact = await memoryService.getFact(initialFact.id);
      expect(updatedFact?.confidence).toBeGreaterThan(0.8);
      expect(updatedFact?.confidence).toBeLessThanOrEqual(2.0); // Max confidence cap
    });
  });

  describe("Message Processing", () => {
    test("should mark messages as processed", async () => {
      const conversationId = generateTestId();

      // Create conversation and add messages
      await memoryService.createConversation(
        conversationId,
        "Test Conversation"
      );
      const message1 = await memoryService.addMessageToConversation(
        conversationId,
        "user",
        "Test message 1"
      );
      const message2 = await memoryService.addMessageToConversation(
        conversationId,
        "assistant",
        "Test response 1"
      );

      const messages = await memoryService.getMessagesForConversation(
        conversationId
      );

      // Verify messages are not processed initially
      expect(messages.every((m) => !m.processed_for_facts)).toBe(true);

      await factExtractor.extractFacts(messages, conversationId);

      // Verify messages are marked as processed
      const updatedMessages = await memoryService.getMessagesForConversation(
        conversationId
      );
      expect(updatedMessages.every((m) => m.processed_for_facts)).toBe(true);
    });

    test("should handle different message roles", async () => {
      const conversationId = generateTestId();
      const messages: ConversationMessage[] = [
        {
          id: 1,
          conversation_id: conversationId,
          role: "user",
          content: "I work as a software engineer",
          timestamp: new Date().toISOString(),
          processed_for_facts: false,
        },
        {
          id: 2,
          conversation_id: conversationId,
          role: "assistant",
          content: "That sounds like an interesting career!",
          timestamp: new Date().toISOString(),
          processed_for_facts: false,
        },
      ];

      await factExtractor.extractFacts(messages, conversationId);

      // Both user and assistant messages should be included in the context
      expect(mockAIService.processPrompt).toHaveBeenCalledWith(
        expect.stringContaining("user: I work as a software engineer")
      );
      expect(mockAIService.processPrompt).toHaveBeenCalledWith(
        expect.stringContaining(
          "assistant: That sounds like an interesting career!"
        )
      );
    });
  });

  describe("Categories", () => {
    test("should extract facts with correct categories", async () => {
      const conversationId = generateTestId();

      // Mock specific response for category testing
      mockAIService.processPrompt = jest.fn().mockResolvedValue(
        JSON.stringify([
          {
            content: "User works as a software engineer",
            category: "professional",
          },
          {
            content: "User has a pet dog",
            category: "personal",
          },
          {
            content: "User enjoys hiking",
            category: "interests",
          },
          {
            content: "User prefers dark mode",
            category: "preferences",
          },
        ])
      );

      const messages: ConversationMessage[] = [
        {
          id: 1,
          conversation_id: conversationId,
          role: "user",
          content:
            "I'm a software engineer who loves hiking with my dog, and I always use dark mode",
          timestamp: new Date().toISOString(),
          processed_for_facts: false,
        },
      ];

      await factExtractor.extractFacts(messages, conversationId);

      // Verify all categories were extracted
      const facts = await memoryService.searchFacts("user", 10);
      const categories = facts.map((f) => f.category);

      expect(categories).toContain("professional");
      expect(categories).toContain("personal");
      expect(categories).toContain("interests");
      expect(categories).toContain("preferences");
    });
  });
});
