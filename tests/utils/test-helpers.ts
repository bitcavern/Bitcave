import * as path from 'path';
import * as fs from 'fs';
import { Fact, Conversation, ConversationMessage } from '../../src/main/memory/types';

// Mock database setup for tests
export function createTestDatabase(testId: string) {
  const testDbPath = path.join(process.env.TEST_DB_DIR!, `test-${testId}.db`);
  return testDbPath;
}

export function cleanupTestDatabase(dbPath: string) {
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
  // Also clean up WAL and SHM files
  const walPath = dbPath + '-wal';
  const shmPath = dbPath + '-shm';
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
}

// Mock data generators
export const mockFacts: Omit<Fact, 'id' | 'created_at' | 'updated_at' | 'vec_id'>[] = [
  {
    content: "User prefers TypeScript over JavaScript for large projects",
    category: "preferences",
    confidence: 1.0,
    source_conversation_id: "conv1",
    project_id: null
  },
  {
    content: "User works as a software engineer at a tech startup",
    category: "professional",
    confidence: 0.9,
    source_conversation_id: "conv1",
    project_id: null
  },
  {
    content: "User has a pet cat named Whiskers",
    category: "personal",
    confidence: 1.0,
    source_conversation_id: "conv2",
    project_id: null
  },
  {
    content: "User is interested in AI and machine learning",
    category: "interests",
    confidence: 0.8,
    source_conversation_id: "conv2",
    project_id: null
  },
  {
    content: "User lives in San Francisco",
    category: "personal",
    confidence: 0.7,
    source_conversation_id: "conv3",
    project_id: null
  }
];

export const mockConversations: Omit<Conversation, 'created_at' | 'updated_at'>[] = [
  {
    id: "conv1",
    title: "Project Discussion",
    project_id: null,
    message_count: 6
  },
  {
    id: "conv2",
    title: "Personal Chat",
    project_id: null,
    message_count: 4
  },
  {
    id: "conv3",
    title: "Location Discussion",
    project_id: null,
    message_count: 2
  }
];

export const mockMessages: Omit<ConversationMessage, 'id' | 'timestamp'>[] = [
  {
    conversation_id: "conv1",
    role: "user",
    content: "I really prefer TypeScript for large projects because of the type safety",
    processed_for_facts: true
  },
  {
    conversation_id: "conv1",
    role: "assistant",
    content: "That's a great choice! TypeScript definitely helps catch errors early.",
    processed_for_facts: true
  },
  {
    conversation_id: "conv2",
    role: "user",
    content: "My cat Whiskers is being particularly playful today",
    processed_for_facts: true
  },
  {
    conversation_id: "conv2",
    role: "assistant", 
    content: "Cats can be so entertaining! What's Whiskers up to?",
    processed_for_facts: true
  }
];

// Mock embedding service
export class MockEmbeddingService {
  async initialize() {
    // No-op for tests
  }

  async generateEmbedding(text: string): Promise<Float32Array> {
    // Generate a simple mock embedding based on text hash
    const hash = this.simpleHash(text);
    const embedding = new Float32Array(384); // Match all-MiniLM-L6-v2 dimensions
    
    // Fill with deterministic values based on hash
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
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

// Mock AI service for fact extraction tests
export class MockAIService {
  async processPrompt(prompt: string): Promise<string> {
    // Mock response based on prompt content
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

// Helper to wait for async operations
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper to generate unique test IDs
export function generateTestId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}