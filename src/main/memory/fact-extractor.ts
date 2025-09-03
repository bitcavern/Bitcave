import { ConversationMessage } from "./types";
import { MemoryService } from "./memory-service";
import { AIService } from "../ai/ai-service";

export class FactExtractor {
  private memoryService: MemoryService;
  private aiService: AIService;

  constructor(memoryService: MemoryService, aiService: AIService) {
    this.memoryService = memoryService;
    this.aiService = aiService;
  }

  public async extractFacts(
    messages: ConversationMessage[],
    conversationId: string
  ): Promise<void> {
    const context = messages.map((m) => `${m.role}: ${m.content}`).join("\n");

    const prompt = `
      Extract key factual information about the user from this conversation.
      Return as JSON array of facts with categories:
      - personal (relationships, family, pets, location)
      - preferences (technologies, approaches, styles)
      - professional (job, skills, projects)
      - interests (hobbies, topics)

      Format: [{"content": "fact text", "category": "personal|preferences|professional|interests"}]

      Context:
      ${context}
    `;

    try {
      const response = await this.aiService.processPrompt(prompt);
      const facts = JSON.parse(response.trim());

      // Process and store facts with deduplication
      if (!this.memoryService.isDatabaseAvailable()) {
        console.warn(
          "[FactExtractor] Memory service not available, skipping fact extraction"
        );
        return;
      }

      for (const factData of facts) {
        if (!factData.content || !factData.category) continue;

        try {
          // Check for similar existing facts
          const similarFacts = await this.memoryService.searchFacts(
            factData.content,
            3
          );
          const isDuplicate = similarFacts.some(
            (existing) => existing.distance < 0.3
          ); // High similarity threshold

          if (!isDuplicate) {
            await this.memoryService.addFact({
              content: factData.content,
              category: factData.category,
              confidence: 1.0,
              source_conversation_id: conversationId,
              project_id: undefined,
            });
          } else {
            // Update confidence of existing similar fact
            const mostSimilar = similarFacts[0];
            if (mostSimilar) {
              await this.memoryService.updateFact(mostSimilar.id, {
                confidence: Math.min(mostSimilar.confidence + 0.1, 2.0),
                updated_at: new Date().toISOString(),
              });
            }
          }
        } catch (error) {
          console.warn(
            "[FactExtractor] Failed to process fact:",
            factData.content,
            error
          );
        }
      }

      // Mark messages as processed
      if (this.memoryService.isDatabaseAvailable()) {
        try {
          const messageIds = messages.map((m) => m.id);
          for (const messageId of messageIds) {
            const db = this.memoryService.getDatabase();
            db.prepare(
              "UPDATE conversation_messages SET processed_for_facts = 1 WHERE id = ?"
            ).run(messageId);
          }
        } catch (error) {
          console.warn(
            "[FactExtractor] Failed to mark messages as processed:",
            error
          );
        }
      }
    } catch (error) {
      console.error("[FactExtractor] Error extracting facts:", error);
    }
  }
}
