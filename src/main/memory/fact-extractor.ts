import { ConversationMessage } from './types';
import { MemoryService } from './memory-service';

// This is a placeholder for the actual AI service
const aiService = {
  processPrompt: async (prompt: string) => {
    console.log('AI Service processing prompt:', prompt);
    return '[{"fact": "Teddy is a good boy", "category": "personal"}]';
  }
};

export class FactExtractor {
  private memoryService: MemoryService;

  constructor(memoryService: MemoryService) {
    this.memoryService = memoryService;
  }

  public async extractFacts(messages: ConversationMessage[], conversationId: string): Promise<void> {
    const context = messages.map(m => `${m.role}: ${m.content}`).join('\n');

    const prompt = `
      Extract key factual information about the user from this conversation.
      Return as JSON array of facts with categories:
      - personal (relationships, family, pets, location)
      - preferences (technologies, approaches, styles)
      - professional (job, skills, projects)
      - interests (hobbies, topics)

      Format: [{