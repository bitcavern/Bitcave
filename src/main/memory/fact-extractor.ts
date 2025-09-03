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

    const prompt = `You are a fact extraction assistant. Your task is to extract key factual information about the user from the conversation below.

IMPORTANT: You must respond with ONLY valid JSON. No other text, no explanations, no markdown formatting.

Extract facts and categorize them into these categories:
- personal (relationships, family, pets, location, personal details)
- preferences (technologies, approaches, styles, likes/dislikes)
- professional (job, skills, projects, work-related information)
- interests (hobbies, topics, things they care about)

Return the facts as a JSON array with this exact format:
[{"content": "fact description", "category": "category_name"}]

Example response:
[{"content": "User has Edifier MR4 studio monitors", "category": "preferences"}, {"content": "User works on coding projects", "category": "professional"}]

Conversation context:
${context}

Remember: ONLY return valid JSON, nothing else.`;

    try {
      const response = await this.aiService.processPrompt(prompt);

      // Clean the response to extract JSON
      let cleanedResponse = response.trim();

      // Try to find JSON in the response if it's wrapped in other text
      const jsonMatch = cleanedResponse.match(/\[.*\]/s);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }

      // Remove any markdown code blocks
      cleanedResponse = cleanedResponse
        .replace(/```json\s*/, "")
        .replace(/```\s*$/, "");

      let facts;
      try {
        facts = JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.warn(
          "[FactExtractor] Failed to parse AI response as JSON:",
          parseError
        );
        console.warn("[FactExtractor] Raw response:", response);
        console.warn("[FactExtractor] Cleaned response:", cleanedResponse);

        // Try to extract facts manually from the response
        facts = this.extractFactsFromText(response);
        if (facts.length === 0) {
          console.warn(
            "[FactExtractor] Could not extract facts from response, skipping"
          );
          return;
        }
      }

      // Validate facts structure
      if (!Array.isArray(facts)) {
        console.warn("[FactExtractor] Response is not an array, skipping");
        return;
      }

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

  /**
   * Fallback method to extract facts from text when JSON parsing fails
   */
  private extractFactsFromText(
    text: string
  ): Array<{ content: string; category: string }> {
    const facts: Array<{ content: string; category: string }> = [];

    // Simple pattern matching to extract potential facts
    const lines = text.split("\n").filter((line) => line.trim().length > 0);

    for (const line of lines) {
      // Look for lines that might contain factual information
      if (line.includes(":") || line.includes("-") || line.includes("•")) {
        const content = line.replace(/^[-•\s]+/, "").trim();
        if (content.length > 10 && content.length < 200) {
          // Try to categorize based on keywords
          let category = "interests"; // default

          if (
            content.toLowerCase().includes("work") ||
            content.toLowerCase().includes("job") ||
            content.toLowerCase().includes("skill") ||
            content.toLowerCase().includes("project")
          ) {
            category = "professional";
          } else if (
            content.toLowerCase().includes("like") ||
            content.toLowerCase().includes("prefer") ||
            content.toLowerCase().includes("use") ||
            content.toLowerCase().includes("monitor") ||
            content.toLowerCase().includes("subwoofer")
          ) {
            category = "preferences";
          } else if (
            content.toLowerCase().includes("family") ||
            content.toLowerCase().includes("pet") ||
            content.toLowerCase().includes("live") ||
            content.toLowerCase().includes("home")
          ) {
            category = "personal";
          }

          facts.push({ content, category });
        }
      }
    }

    return facts;
  }
}
