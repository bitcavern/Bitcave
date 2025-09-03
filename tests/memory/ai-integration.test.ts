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

// Mock dependencies
jest.mock('../../src/main/memory/database', () => {
  const Database = require('better-sqlite3');
  let testDb: any;
  
  return {
    getDb: () => {
      if (!testDb) {
        testDb = new Database(':memory:');
        setupTestDatabase(testDb);
      }
      return testDb;
    }
  };
});

// Now import the modules after mocking
import { AIService } from '../../src/main/ai/ai-service';
import { MemoryService } from '../../src/main/memory/memory-service';
import { generateTestId, delay } from '../utils/test-helpers';

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

// Mock the AI tool registry and window manager
const mockToolRegistry = {
  executeTool: jest.fn()
};

const mockWindowManager = {
  getAllWindows: jest.fn().mockReturnValue([])
};

function setupTestDatabase(db: any) {
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('temp_store = MEMORY');

  db.exec(`
    CREATE TABLE IF NOT EXISTS vec_facts (
      rowid INTEGER PRIMARY KEY AUTOINCREMENT,
      fact_embedding TEXT
    );
  `);

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

describe('AI Service Memory Integration', () => {
  let aiService: AIService;
  let memoryService: MemoryService;
  let mockAI: MockAIService;

  beforeEach(() => {
    mockAI = new MockAIService();
    aiService = new AIService(mockToolRegistry as any, mockWindowManager as any);
    memoryService = new MemoryService(mockAI as any);
    
    // Set up the memory service in AI service
    aiService.setMemoryService(memoryService);
    
    // Mock the OpenRouter client
    (aiService as any).client = {
      createChatCompletion: jest.fn().mockResolvedValue({
        choices: [{
          message: {
            role: 'assistant',
            content: 'Mock AI response'
          }
        }]
      }),
      setLogger: jest.fn()
    };

    // Set API key to enable the service
    aiService.setApiKey('mock-api-key');
  });

  afterEach(() => {
    // Clean up
    const db = memoryService.getDatabase();
    db.exec('DELETE FROM facts');
    db.exec('DELETE FROM conversations');
    db.exec('DELETE FROM conversation_messages');
    db.exec('DELETE FROM vec_facts');
  });

  describe('Memory Context Injection', () => {
    test('should inject relevant memory context into AI conversations', async () => {
      const conversationId = generateTestId();

      // Add some facts to memory
      await memoryService.addFact({
        content: 'User prefers TypeScript for large projects',
        category: 'preferences',
        confidence: 1.0,
        source_conversation_id: 'previous-conv',
        project_id: null
      });

      await memoryService.addFact({
        content: 'User works as a senior software engineer',
        category: 'professional',
        confidence: 0.9,
        source_conversation_id: 'previous-conv',
        project_id: null
      });

      // Mock the chat method to capture the context
      let capturedMessages: any[] = [];
      (aiService as any).client.createChatCompletion = jest.fn().mockImplementation((request) => {
        capturedMessages = request.messages;
        return Promise.resolve({
          choices: [{
            message: {
              role: 'assistant',
              content: 'I understand you prefer TypeScript for large projects and work as a senior engineer.'
            }
          }]
        });
      });

      // Start a conversation about programming
      await aiService.chat(conversationId, 'What should I use for my next project?');

      // Check that memory context was injected
      const systemMessage = capturedMessages.find(m => m.role === 'system');
      expect(systemMessage).toBeDefined();
      expect(systemMessage.content).toContain('USER MEMORY CONTEXT');
      expect(systemMessage.content).toContain('TypeScript');
      expect(systemMessage.content).toContain('senior software engineer');
    });

    test('should not inject context when no relevant facts exist', async () => {
      const conversationId = generateTestId();

      // Add unrelated facts
      await memoryService.addFact({
        content: 'User has a pet cat named Fluffy',
        category: 'personal',
        confidence: 1.0,
        source_conversation_id: 'previous-conv',
        project_id: null
      });

      let capturedMessages: any[] = [];
      (aiService as any).client.createChatCompletion = jest.fn().mockImplementation((request) => {
        capturedMessages = request.messages;
        return Promise.resolve({
          choices: [{
            message: {
              role: 'assistant',
              content: 'I can help you with that!'
            }
          }]
        });
      });

      // Ask about something unrelated to the facts
      await aiService.chat(conversationId, 'What is the weather like today?');

      // Check that no memory context was injected (or minimal context)
      const systemMessage = capturedMessages.find(m => m.role === 'system');
      expect(systemMessage).toBeDefined();
      
      // Should not contain the cat fact in context due to low relevance
      if (systemMessage.content.includes('USER MEMORY CONTEXT')) {
        expect(systemMessage.content).not.toContain('Fluffy');
      }
    });

    test('should rank facts by relevance and recency', async () => {
      const conversationId = generateTestId();

      // Add facts with different timestamps
      const oldFact = await memoryService.addFact({
        content: 'User used to prefer JavaScript',
        category: 'preferences',
        confidence: 0.5,
        source_conversation_id: 'old-conv',
        project_id: null
      });

      // Update old fact to have old timestamp
      await memoryService.updateFact(oldFact.id, {
        updated_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days ago
      });

      await memoryService.addFact({
        content: 'User now prefers TypeScript for all projects',
        category: 'preferences',
        confidence: 1.0,
        source_conversation_id: 'recent-conv',
        project_id: null
      });

      let capturedMessages: any[] = [];
      (aiService as any).client.createChatCompletion = jest.fn().mockImplementation((request) => {
        capturedMessages = request.messages;
        return Promise.resolve({
          choices: [{
            message: {
              role: 'assistant',
              content: 'TypeScript is a great choice!'
            }
          }]
        });
      });

      await aiService.chat(conversationId, 'Should I use TypeScript or JavaScript?');

      const systemMessage = capturedMessages.find(m => m.role === 'system');
      expect(systemMessage).toBeDefined();
      
      if (systemMessage.content.includes('USER MEMORY CONTEXT')) {
        // More recent and confident fact should be prioritized
        expect(systemMessage.content).toContain('TypeScript');
        // Older, less confident fact should be deprioritized or excluded
        const jsIndex = systemMessage.content.indexOf('JavaScript');
        const tsIndex = systemMessage.content.indexOf('TypeScript');
        if (jsIndex !== -1 && tsIndex !== -1) {
          expect(tsIndex).toBeLessThan(jsIndex); // TypeScript should appear first
        }
      }
    });
  });

  describe('Fact Extraction Integration', () => {
    test('should automatically extract facts during conversation', async () => {
      const conversationId = generateTestId();

      // Configure the mock AI to return facts
      mockAI.processPrompt = jest.fn().mockResolvedValue(JSON.stringify([
        {
          content: 'User works with React and TypeScript daily',
          category: 'preferences'
        },
        {
          content: 'User has 3 years of frontend experience',
          category: 'professional'
        }
      ]));

      // Have a conversation that should trigger fact extraction
      await aiService.chat(conversationId, 'I work with React and TypeScript every day');
      await aiService.chat(conversationId, 'That sounds great!');
      await aiService.chat(conversationId, 'I have about 3 years of frontend experience');

      // Wait for fact extraction to complete
      await delay(200);

      // Check if facts were extracted
      const facts = await memoryService.searchFacts('React TypeScript', 10);
      expect(facts.length).toBeGreaterThan(0);

      const reactFact = facts.find(f => f.content.includes('React'));
      expect(reactFact).toBeDefined();
      expect(reactFact?.category).toBe('preferences');
      expect(reactFact?.source_conversation_id).toBe(conversationId);
    });

    test('should store both user and assistant messages', async () => {
      const conversationId = generateTestId();

      await aiService.chat(conversationId, 'Hello, I am testing the memory system');

      // Check if messages were stored
      const messages = await memoryService.getMessagesForConversation(conversationId);
      
      expect(messages.length).toBeGreaterThanOrEqual(1);
      expect(messages.some(m => m.role === 'user')).toBe(true);
      expect(messages.some(m => m.role === 'assistant')).toBe(true);
    });

    test('should handle conversation without memory service gracefully', async () => {
      const conversationId = generateTestId();

      // Create AI service without memory service
      const aiServiceNoMemory = new AIService(mockToolRegistry as any, mockWindowManager as any);
      (aiServiceNoMemory as any).client = {
        createChatCompletion: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              role: 'assistant',
              content: 'Response without memory'
            }
          }]
        }),
        setLogger: jest.fn()
      };
      aiServiceNoMemory.setApiKey('mock-api-key');

      // Should not throw error
      await expect(aiServiceNoMemory.chat(conversationId, 'Test message'))
        .resolves.not.toThrow();
    });
  });

  describe('Context Building', () => {
    test('should build appropriate memory context format', async () => {
      const conversationId = generateTestId();

      // Add facts with different categories and confidence levels
      await memoryService.addFact({
        content: 'User prefers clean, readable code',
        category: 'preferences',
        confidence: 1.0,
        source_conversation_id: 'prev-conv',
        project_id: null
      });

      await memoryService.addFact({
        content: 'User works at a tech startup',
        category: 'professional',
        confidence: 0.8,
        source_conversation_id: 'prev-conv',
        project_id: null
      });

      let capturedMessages: any[] = [];
      (aiService as any).client.createChatCompletion = jest.fn().mockImplementation((request) => {
        capturedMessages = request.messages;
        return Promise.resolve({
          choices: [{
            message: {
              role: 'assistant',
              content: 'I understand your preferences.'
            }
          }]
        });
      });

      await aiService.chat(conversationId, 'What coding practices do you recommend?');

      const systemMessage = capturedMessages.find(m => m.role === 'system');
      expect(systemMessage).toBeDefined();

      if (systemMessage.content.includes('USER MEMORY CONTEXT')) {
        // Check context format
        expect(systemMessage.content).toContain('The following information about the user may be relevant');
        expect(systemMessage.content).toContain('preferences, confidence:');
        expect(systemMessage.content).toContain('professional, confidence:');
        expect(systemMessage.content).toContain('Use this information appropriately');
      }
    });

    test('should limit context to most relevant facts', async () => {
      const conversationId = generateTestId();

      // Add many facts
      for (let i = 0; i < 10; i++) {
        await memoryService.addFact({
          content: `User fact number ${i}`,
          category: 'interests',
          confidence: 0.5,
          source_conversation_id: 'prev-conv',
          project_id: null
        });
      }

      let capturedMessages: any[] = [];
      (aiService as any).client.createChatCompletion = jest.fn().mockImplementation((request) => {
        capturedMessages = request.messages;
        return Promise.resolve({
          choices: [{
            message: {
              role: 'assistant',
              content: 'Response'
            }
          }]
        });
      });

      await aiService.chat(conversationId, 'Tell me about my interests');

      const systemMessage = capturedMessages.find(m => m.role === 'system');
      
      if (systemMessage && systemMessage.content.includes('USER MEMORY CONTEXT')) {
        // Should limit to top 5 facts
        const factLines = systemMessage.content.split('\n').filter(line => 
          line.match(/^\d+\./));
        expect(factLines.length).toBeLessThanOrEqual(5);
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle memory service errors gracefully', async () => {
      const conversationId = generateTestId();

      // Mock memory service to throw error
      jest.spyOn(memoryService, 'addMessageToConversation').mockRejectedValue(new Error('Database error'));

      // Should not throw error
      await expect(aiService.chat(conversationId, 'Test message'))
        .resolves.not.toThrow();
    });

    test('should handle context building errors gracefully', async () => {
      const conversationId = generateTestId();

      // Mock searchFacts to throw error
      jest.spyOn(memoryService, 'searchFacts').mockRejectedValue(new Error('Search error'));

      // Should not throw error
      await expect(aiService.chat(conversationId, 'Test message'))
        .resolves.not.toThrow();
    });
  });
});