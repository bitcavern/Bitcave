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

// Full integration test that tests the entire memory system end-to-end
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
import { MemoryService } from '../../src/main/memory/memory-service';
import { AIService } from '../../src/main/ai/ai-service';
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

const mockToolRegistry = { executeTool: jest.fn() };
const mockWindowManager = { getAllWindows: jest.fn().mockReturnValue([]) };

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

describe('Memory System End-to-End Integration', () => {
  let memoryService: MemoryService;
  let aiService: AIService;
  let mockAI: MockAIService;

  beforeEach(() => {
    mockAI = new MockAIService();
    memoryService = new MemoryService(mockAI as any);
    aiService = new AIService(mockToolRegistry as any, mockWindowManager as any);
    aiService.setMemoryService(memoryService);

    // Mock OpenRouter client
    (aiService as any).client = {
      createChatCompletion: jest.fn().mockResolvedValue({
        choices: [{
          message: {
            role: 'assistant',
            content: 'I understand your preferences and will help accordingly.'
          }
        }]
      }),
      setLogger: jest.fn()
    };

    aiService.setApiKey('mock-api-key');
  });

  afterEach(() => {
    const db = memoryService.getDatabase();
    db.exec('DELETE FROM facts');
    db.exec('DELETE FROM conversations');
    db.exec('DELETE FROM conversation_messages');
    db.exec('DELETE FROM vec_facts');
  });

  describe('Full Memory Lifecycle', () => {
    test('should demonstrate complete memory system workflow', async () => {
      const conversationId = generateTestId();

      // Configure mock AI to extract meaningful facts
      mockAI.processPrompt = jest.fn().mockImplementation((prompt) => {
        if (prompt.includes('Extract key factual information')) {
          return Promise.resolve(JSON.stringify([
            {
              content: 'User is a senior React developer with 5 years experience',
              category: 'professional'
            },
            {
              content: 'User prefers TypeScript over JavaScript for type safety',
              category: 'preferences'
            },
            {
              content: 'User works at a fintech startup',
              category: 'professional'
            }
          ]));
        }
        return Promise.resolve('Standard AI response');
      });

      // Step 1: Start a conversation that will build memory
      console.log('Step 1: Initial conversation to build memory...');
      
      await aiService.chat(conversationId, 'Hi! I\'m a senior React developer with 5 years of experience.');
      await aiService.chat(conversationId, 'Great to meet you! What technologies do you work with?');
      await aiService.chat(conversationId, 'I prefer TypeScript over JavaScript for the type safety, especially in large projects.');

      // Wait for fact extraction
      await delay(300);

      // Step 2: Verify facts were extracted
      console.log('Step 2: Verifying fact extraction...');
      
      const extractedFacts = await memoryService.searchFacts('React developer TypeScript', 10);
      expect(extractedFacts.length).toBeGreaterThan(0);
      
      const developerFact = extractedFacts.find(f => f.content.includes('React developer'));
      const typescriptFact = extractedFacts.find(f => f.content.includes('TypeScript'));
      
      expect(developerFact).toBeDefined();
      expect(typescriptFact).toBeDefined();
      expect(developerFact?.category).toBe('professional');
      expect(typescriptFact?.category).toBe('preferences');

      // Step 3: Start new conversation that should use memory context
      console.log('Step 3: New conversation leveraging memory...');
      
      const newConversationId = generateTestId();
      
      let contextInjected = false;
      (aiService as any).client.createChatCompletion = jest.fn().mockImplementation((request) => {
        const systemMessage = request.messages.find((m: any) => m.role === 'system');
        if (systemMessage && systemMessage.content.includes('USER MEMORY CONTEXT')) {
          contextInjected = true;
          expect(systemMessage.content).toContain('React developer');
          expect(systemMessage.content).toContain('TypeScript');
        }
        
        return Promise.resolve({
          choices: [{
            message: {
              role: 'assistant',
              content: 'Based on your experience as a senior React developer who prefers TypeScript, I recommend...'
            }
          }]
        });
      });

      await aiService.chat(newConversationId, 'What frontend framework should I use for my next project?');
      
      expect(contextInjected).toBe(true);

      // Step 4: Test memory management operations
      console.log('Step 4: Testing memory management...');
      
      // Update a fact
      const factToUpdate = extractedFacts[0];
      await memoryService.updateFact(factToUpdate.id, {
        content: 'User is a senior React developer with 6 years experience (updated)',
        confidence: 1.5
      });

      const updatedFact = await memoryService.getFact(factToUpdate.id);
      expect(updatedFact?.content).toContain('6 years');
      expect(updatedFact?.confidence).toBe(1.5);

      // Delete a fact
      const factToDelete = extractedFacts[1];
      await memoryService.deleteFact(factToDelete.id);
      
      const deletedFact = await memoryService.getFact(factToDelete.id);
      expect(deletedFact).toBeNull();

      // Step 5: Verify conversation history
      console.log('Step 5: Verifying conversation history...');
      
      const conversations = await Promise.all([
        memoryService.getConversation(conversationId),
        memoryService.getConversation(newConversationId)
      ]);

      expect(conversations[0]).toBeTruthy();
      expect(conversations[1]).toBeTruthy();
      expect(conversations[0]?.message_count).toBeGreaterThan(0);

      const messages = await memoryService.getMessagesForConversation(conversationId);
      expect(messages.length).toBeGreaterThanOrEqual(3);
      expect(messages.some(m => m.processed_for_facts)).toBe(true);

      console.log('✅ Full memory system integration test completed successfully!');
    });

    test('should handle multiple users/projects with isolated memory', async () => {
      const user1ConvId = generateTestId();
      const user2ConvId = generateTestId();

      // Configure different responses for different conversations
      mockAI.processPrompt = jest.fn().mockImplementation((prompt) => {
        if (prompt.includes('Extract key factual information')) {
          if (prompt.includes('Python')) {
            return Promise.resolve(JSON.stringify([
              { content: 'User prefers Python for backend development', category: 'preferences' }
            ]));
          } else if (prompt.includes('Java')) {
            return Promise.resolve(JSON.stringify([
              { content: 'User prefers Java for enterprise applications', category: 'preferences' }
            ]));
          }
        }
        return Promise.resolve('AI response');
      });

      // User 1 conversation
      await aiService.chat(user1ConvId, 'I love Python for backend development');
      await aiService.chat(user1ConvId, 'That\'s interesting');
      await aiService.chat(user1ConvId, 'Python is so versatile');

      // User 2 conversation  
      await aiService.chat(user2ConvId, 'I prefer Java for enterprise applications');
      await aiService.chat(user2ConvId, 'Java is very robust');
      await aiService.chat(user2ConvId, 'Enterprise development needs Java');

      await delay(300);

      // Verify facts are properly attributed
      const pythonFacts = await memoryService.searchFacts('Python', 10);
      const javaFacts = await memoryService.searchFacts('Java', 10);

      expect(pythonFacts.length).toBeGreaterThan(0);
      expect(javaFacts.length).toBeGreaterThan(0);

      const pythonFact = pythonFacts.find(f => f.content.includes('Python'));
      const javaFact = javaFacts.find(f => f.content.includes('Java'));

      expect(pythonFact?.source_conversation_id).toBe(user1ConvId);
      expect(javaFact?.source_conversation_id).toBe(user2ConvId);
    });

    test('should demonstrate memory persistence and search capabilities', async () => {
      // Add facts across different categories and conversations
      const facts = [
        {
          content: 'User is passionate about machine learning and AI research',
          category: 'interests',
          confidence: 1.0,
          source_conversation_id: 'conv1'
        },
        {
          content: 'User has a PhD in Computer Science from Stanford',
          category: 'professional', 
          confidence: 1.0,
          source_conversation_id: 'conv1'
        },
        {
          content: 'User enjoys hiking in the mountains on weekends',
          category: 'personal',
          confidence: 0.8,
          source_conversation_id: 'conv2'
        },
        {
          content: 'User prefers clean, functional programming approaches',
          category: 'preferences',
          confidence: 0.9,
          source_conversation_id: 'conv2'
        },
        {
          content: 'User has published research papers on neural networks',
          category: 'professional',
          confidence: 1.0,
          source_conversation_id: 'conv3'
        }
      ];

      // Add all facts
      for (const fact of facts) {
        await memoryService.addFact({
          content: fact.content,
          category: fact.category,
          confidence: fact.confidence,
          source_conversation_id: fact.source_conversation_id,
          project_id: undefined
        });
      }

      // Test various search queries
      const searches = [
        { query: 'machine learning research', expectedResults: ['machine learning', 'neural networks'] },
        { query: 'education background', expectedResults: ['PhD', 'Stanford'] },
        { query: 'outdoor activities', expectedResults: ['hiking'] },
        { query: 'programming style', expectedResults: ['functional programming'] }
      ];

      for (const search of searches) {
        const results = await memoryService.searchFacts(search.query, 5);
        expect(results.length).toBeGreaterThan(0);
        
        // Check if expected content appears in results
        const resultContents = results.map(r => r.content.toLowerCase()).join(' ');
        for (const expected of search.expectedResults) {
          expect(resultContents).toContain(expected.toLowerCase());
        }
      }

      // Test category-based analysis
      const db = memoryService.getDatabase();
      const categoryCounts = db.prepare(`
        SELECT category, COUNT(*) as count 
        FROM facts 
        GROUP BY category
      `).all() as { category: string, count: number }[];

      expect(categoryCounts.length).toBeGreaterThan(0);
      
      const categoryMap = Object.fromEntries(categoryCounts.map(c => [c.category, c.count]));
      expect(categoryMap.professional).toBe(2);
      expect(categoryMap.interests).toBe(1);
      expect(categoryMap.personal).toBe(1);
      expect(categoryMap.preferences).toBe(1);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large conversation efficiently', async () => {
      const conversationId = generateTestId();
      
      // Create conversation with many messages
      await memoryService.createConversation('Performance Test');
      
      const startTime = Date.now();
      
      // Add 50 messages
      for (let i = 0; i < 50; i++) {
        await memoryService.addMessageToConversation(
          conversationId,
          i % 2 === 0 ? 'user' : 'assistant',
          `Message ${i}: This is test content for performance testing`
        );
      }
      
      const messageTime = Date.now() - startTime;
      expect(messageTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Retrieve all messages
      const retrieveStartTime = Date.now();
      const messages = await memoryService.getMessagesForConversation(conversationId);
      const retrieveTime = Date.now() - retrieveStartTime;
      
      expect(messages.length).toBe(50);
      expect(retrieveTime).toBeLessThan(1000); // Should retrieve within 1 second
    });

    test('should handle many facts with efficient search', async () => {
      const startTime = Date.now();
      
      // Add 100 facts
      const categories = ['personal', 'professional', 'preferences', 'interests'];
      for (let i = 0; i < 100; i++) {
        await memoryService.addFact({
          content: `Test fact ${i}: This is fact content about various topics`,
          category: categories[i % categories.length],
          confidence: Math.random(),
          source_conversation_id: `conv${i % 10}`,
          project_id: undefined
        });
      }
      
      const addTime = Date.now() - startTime;
      expect(addTime).toBeLessThan(10000); // Should complete within 10 seconds
      
      // Test search performance
      const searchStartTime = Date.now();
      const results = await memoryService.searchFacts('fact content', 20);
      const searchTime = Date.now() - searchStartTime;
      
      expect(results.length).toBeGreaterThan(0);
      expect(searchTime).toBeLessThan(2000); // Search should be fast
    });
  });
});