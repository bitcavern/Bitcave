import { getDb } from './database';
import { Fact, Conversation, ConversationMessage } from './types';
import { v4 as uuidv4 } from 'uuid';
import { EmbeddingService } from './embedding-service';
import { FactExtractor } from './fact-extractor';

export class MemoryService {
  private db;
  private embeddingService: EmbeddingService;
  private factExtractor: FactExtractor;

  constructor() {
    this.db = getDb();
    this.embeddingService = new EmbeddingService();
    this.factExtractor = new FactExtractor(this);
    this.initialize();
  }

  private async initialize() {
    await this.embeddingService.initialize();
  }

  public async maybeExtractFacts(conversationId: string) {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) {
      return;
    }

    // Trigger extraction every 3 messages, and only if there are more than 2 messages
    if (conversation.message_count > 2 && conversation.message_count % 3 === 0) {
      const messages = await this.getMessagesForConversation(conversationId);
      // Get the last 6 messages for context
      const recentMessages = messages.slice(-6);
      await this.factExtractor.extractFacts(recentMessages, conversationId);
    }
  }

  //- C O N V E R S A T I O N S

  public async createConversation(title: string, projectId?: string): Promise<Conversation> {
    const conversation: Conversation = {
      id: uuidv4(),
      title,
      project_id: projectId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      message_count: 0,
    };
    const stmt = this.db.prepare(
      'INSERT INTO conversations (id, title, project_id, created_at, updated_at, message_count) VALUES (?, ?, ?, ?, ?, ?)',
    );
    stmt.run(conversation.id, conversation.title, conversation.project_id, conversation.created_at, conversation.updated_at, conversation.message_count);
    return conversation;
  }

  public async getConversation(id: string): Promise<Conversation | null> {
    const stmt = this.db.prepare('SELECT * FROM conversations WHERE id = ?');
    const conversation = stmt.get(id) as Conversation | undefined;
    return conversation || null;
  }

  public async updateConversation(id: string, updates: Partial<Conversation>): Promise<void> {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    const stmt = this.db.prepare(`UPDATE conversations SET ${fields} WHERE id = ?`);
    stmt.run(...values, id);
  }

  public async deleteConversation(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM conversations WHERE id = ?');
    stmt.run(id);
  }

  //- M E S S A G E S

  public async addMessageToConversation(conversationId: string, role: 'user' | 'assistant', content: string): Promise<ConversationMessage> {
    const message: ConversationMessage = {
      id: 0, // This will be auto-incremented by the database
      conversation_id: conversationId,
      role,
      content,
      timestamp: new Date().toISOString(),
      processed_for_facts: false,
    };

    const stmt = this.db.prepare(
      'INSERT INTO conversation_messages (conversation_id, role, content, timestamp, processed_for_facts) VALUES (?, ?, ?, ?, ?)',
    );
    const result = stmt.run(message.conversation_id, message.role, message.content, message.timestamp, message.processed_for_facts ? 1 : 0);
    message.id = result.lastInsertRowid as number;

    // Update the message_count and updated_at in the conversations table
    this.db.prepare('UPDATE conversations SET message_count = message_count + 1, updated_at = ? WHERE id = ?').run(new Date().toISOString(), conversationId);

    // Trigger fact extraction if needed
    this.maybeExtractFacts(conversationId);

    return message;
  }

  public async getMessagesForConversation(conversationId: string): Promise<ConversationMessage[]> {
    const stmt = this.db.prepare('SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY timestamp ASC');
    return stmt.all(conversationId) as ConversationMessage[];
  }

  //- F A C T S

  public async addFact(fact: Omit<Fact, 'id' | 'created_at' | 'updated_at' | 'vec_id'>): Promise<Fact> {
    const embedding = await this.embeddingService.generateEmbedding(fact.content);

    const vecResult = this.db.prepare('INSERT INTO vec_facts (fact_embedding) VALUES (?)').run(embedding);
    const vecId = vecResult.lastInsertRowid;

    const newFact: Fact = {
      ...fact,
      id: 0, // auto-incremented
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      vec_id: vecId as number,
    };

    const stmt = this.db.prepare(
      'INSERT INTO facts (content, category, confidence, source_conversation_id, project_id, vec_id) VALUES (?, ?, ?, ?, ?, ?)',
    );
    const result = stmt.run(newFact.content, newFact.category, newFact.confidence, newFact.source_conversation_id, newFact.project_id, newFact.vec_id);
    newFact.id = result.lastInsertRowid as number;
    return newFact;
  }

  public async searchFacts(query: string, limit: number = 10): Promise<(Fact & { distance: number })[]> {
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);

    const stmt = this.db.prepare(`
      SELECT
        f.*,
        vec_distance_l2(vf.fact_embedding, ?) as distance
      FROM vec_facts vf
      JOIN facts f ON f.vec_id = vf.rowid
      ORDER BY distance ASC
      LIMIT ?
    `);

    const results = stmt.all(queryEmbedding, limit) as (Fact & { distance: number })[];
    return results;
  }

  public async getFact(id: number): Promise<Fact | null> {
    const stmt = this.db.prepare('SELECT * FROM facts WHERE id = ?');
    const fact = stmt.get(id) as Fact | undefined;
    return fact || null;
  }

  public async updateFact(id: number, updates: Partial<Fact>): Promise<void> {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    const stmt = this.db.prepare(`UPDATE facts SET ${fields} WHERE id = ?`);
    stmt.run(...values, id);
  }

  public async deleteFact(id: number): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM facts WHERE id = ?');
    stmt.run(id);
  }

}
