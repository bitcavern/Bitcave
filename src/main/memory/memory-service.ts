import { getDb } from "./database";
import { Fact, Conversation, ConversationMessage } from "./types";
import { EmbeddingService } from "./embedding-service";
import { FactExtractor } from "./fact-extractor";
import { AIService } from "../ai/ai-service";
import type Database from "better-sqlite3";

export class MemoryService {
  private db: Database.Database | null;
  private embeddingService: EmbeddingService;
  private factExtractor: FactExtractor;

  constructor(aiService: AIService) {
    try {
      this.db = getDb();
      this.embeddingService = new EmbeddingService();
      this.factExtractor = new FactExtractor(this, aiService);
      this.initialize();
    } catch (error) {
      console.error("[MemoryService] Failed to initialize:", error);
      // Initialize with a null db to prevent crashes
      this.db = null;
      this.embeddingService = new EmbeddingService();
      this.factExtractor = new FactExtractor(this, aiService);
    }
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
    if (
      conversation.message_count > 2 &&
      conversation.message_count % 3 === 0
    ) {
      const messages = await this.getMessagesForConversation(conversationId);
      // Get the last 6 messages for context
      const recentMessages = messages.slice(-6);
      await this.factExtractor.extractFacts(recentMessages, conversationId);
    }
  }

  //- C O N V E R S A T I O N S

  public async createConversation(
    id: string,
    title: string,
    projectId?: string
  ): Promise<Conversation> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const conversation: Conversation = {
      id,
      title,
      project_id: projectId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      message_count: 0,
    };
    const stmt = this.db.prepare(
      "INSERT INTO conversations (id, title, project_id, created_at, updated_at, message_count) VALUES (?, ?, ?, ?, ?, ?)"
    );
    stmt.run(
      conversation.id,
      conversation.title,
      conversation.project_id,
      conversation.created_at,
      conversation.updated_at,
      conversation.message_count
    );
    return conversation;
  }

  public async getConversation(id: string): Promise<Conversation | null> {
    if (!this.db) {
      return null;
    }

    const stmt = this.db.prepare("SELECT * FROM conversations WHERE id = ?");
    const conversation = stmt.get(id) as Conversation | undefined;
    return conversation || null;
  }

  public async updateConversation(
    id: string,
    updates: Partial<Conversation>
  ): Promise<void> {
    if (!this.db) {
      return;
    }

    const fields = Object.keys(updates)
      .map((key) => `${key} = ?`)
      .join(", ");
    const values = Object.values(updates);
    const stmt = this.db.prepare(
      `UPDATE conversations SET ${fields} WHERE id = ?`
    );
    stmt.run(...values, id);
  }

  public async deleteConversation(id: string): Promise<void> {
    if (!this.db) {
      return;
    }

    const stmt = this.db.prepare("DELETE FROM conversations WHERE id = ?");
    stmt.run(id);
  }

  //- M E S S A G E S

  public async addMessageToConversation(
    conversationId: string,
    role: "user" | "assistant",
    content: string
  ): Promise<ConversationMessage> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const message: ConversationMessage = {
      id: 0, // This will be auto-incremented by the database
      conversation_id: conversationId,
      role,
      content,
      timestamp: new Date().toISOString(),
      processed_for_facts: false,
    };

    const stmt = this.db.prepare(
      "INSERT INTO conversation_messages (conversation_id, role, content, timestamp, processed_for_facts) VALUES (?, ?, ?, ?, ?)"
    );
    const result = stmt.run(
      message.conversation_id,
      message.role,
      message.content,
      message.timestamp,
      message.processed_for_facts ? 1 : 0
    );
    message.id = result.lastInsertRowid as number;

    // Update the message_count and updated_at in the conversations table
    this.db
      .prepare(
        "UPDATE conversations SET message_count = message_count + 1, updated_at = ? WHERE id = ?"
      )
      .run(new Date().toISOString(), conversationId);

    // Trigger fact extraction if needed
    this.maybeExtractFacts(conversationId);

    return message;
  }

  public async getMessagesForConversation(
    conversationId: string
  ): Promise<ConversationMessage[]> {
    if (!this.db) {
      return [];
    }

    const stmt = this.db.prepare(
      "SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY timestamp ASC"
    );
    return stmt.all(conversationId) as ConversationMessage[];
  }

  //- F A C T S

  public async addFact(
    fact: Omit<Fact, "id" | "created_at" | "updated_at" | "vec_id">
  ): Promise<Fact> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    // Generate embedding first (this is async)
    const embedding = await this.embeddingService.generateEmbedding(
      fact.content
    );

    // Wrap the database operations in a transaction to ensure atomicity
    return this.db.transaction(() => {
      // Insert into vec_facts first
      const vecResult = this.db!.prepare(
        "INSERT INTO vec_facts (fact_embedding) VALUES (?)"
      ).run(embedding);
      const vecId = vecResult.lastInsertRowid;

      if (!vecId) {
        throw new Error("Failed to insert embedding into vec_facts");
      }

      // Verify the vec_facts record exists before proceeding
      const vecCheck = this.db!.prepare(
        "SELECT COUNT(*) as count FROM vec_facts WHERE rowid = ?"
      ).get(vecId) as { count: number } | undefined;

      if (!vecCheck || vecCheck.count === 0) {
        throw new Error("vec_facts record not found after insertion");
      }

      const newFact: Fact = {
        ...fact,
        id: 0, // auto-incremented
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        vec_id: vecId as number,
      };

      // Insert into facts table
      const stmt = this.db!.prepare(
        "INSERT INTO facts (content, category, confidence, source_conversation_id, project_id, vec_id) VALUES (?, ?, ?, ?, ?, ?)"
      );
      const result = stmt.run(
        newFact.content,
        newFact.category,
        newFact.confidence,
        newFact.source_conversation_id,
        newFact.project_id,
        newFact.vec_id
      );

      newFact.id = result.lastInsertRowid as number;
      return newFact;
    })();
  }

  public async searchFacts(
    query: string,
    limit: number = 10
  ): Promise<(Fact & { distance: number })[]> {
    if (!this.db) {
      return [];
    }

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

    const results = stmt.all(queryEmbedding, limit) as (Fact & {
      distance: number;
    })[];
    return results;
  }

  public async getFact(id: number): Promise<Fact | null> {
    if (!this.db) {
      return null;
    }

    const stmt = this.db.prepare("SELECT * FROM facts WHERE id = ?");
    const fact = stmt.get(id) as Fact | undefined;
    return fact || null;
  }

  public async updateFact(id: number, updates: Partial<Fact>): Promise<void> {
    if (!this.db) {
      return;
    }

    // Load the current fact
    const current = this.db
      .prepare("SELECT * FROM facts WHERE id = ?")
      .get(id) as Fact | undefined;
    if (!current) return;

    // If content changes, generate embedding outside of the transaction
    let newEmbedding: Float32Array | null = null;
    if (
      typeof updates.content === "string" &&
      updates.content !== current.content
    ) {
      newEmbedding = await this.embeddingService.generateEmbedding(
        updates.content
      );
    }

    // Apply DB changes atomically
    this.db.transaction(() => {
      if (newEmbedding) {
        this.db!.prepare(
          "UPDATE vec_facts SET fact_embedding = ? WHERE rowid = ?"
        ).run(newEmbedding, current.vec_id);
      }

      if (Object.keys(updates).length > 0) {
        const fields = Object.keys(updates)
          .map((key) => `${key} = ?`)
          .join(", ");
        const values = Object.values(updates);
        const stmt = this.db!.prepare(
          `UPDATE facts SET ${fields} WHERE id = ?`
        );
        stmt.run(...values, id);
      }
    })();
  }

  public async deleteFact(id: number): Promise<void> {
    if (!this.db) {
      return;
    }

    // Wrap the delete operations in a transaction to ensure atomicity
    this.db.transaction(() => {
      // Get fact to find associated vector
      const fact = this.db!.prepare("SELECT * FROM facts WHERE id = ?").get(
        id
      ) as Fact | undefined;

      if (fact && fact.vec_id) {
        // Delete from vector table first
        this.db!.prepare("DELETE FROM vec_facts WHERE rowid = ?").run(
          fact.vec_id
        );
      }

      // Delete from facts table
      const stmt = this.db!.prepare("DELETE FROM facts WHERE id = ?");
      stmt.run(id);
    })();
  }

  public getDatabase() {
    return this.db;
  }

  public isDatabaseAvailable(): boolean {
    return this.db !== null && (this.db as any).open;
  }

  public async reinitializeDatabase(): Promise<void> {
    try {
      this.db = getDb();
      console.log("[MemoryService] Database reinitialized successfully");
    } catch (error) {
      console.error("[MemoryService] Failed to reinitialize database:", error);
      this.db = null;
    }
  }
}
