import {
  OpenRouterClient,
  OpenRouterMessage,
  Tool,
  ToolCall,
} from "./openrouter-client";
import { AIToolRegistry } from "../ai-tools/registry";
import { getOpenRouterToolDefinitions } from "../ai-tools/tool-definitions";
import type { WindowManager } from "../window-manager";

export interface AIConversation {
  id: string;
  messages: OpenRouterMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export class AIService {
  private client: OpenRouterClient | null = null;
  private toolRegistry: AIToolRegistry;
  private windowManager: WindowManager;
  private conversations: Map<string, AIConversation> = new Map();

  constructor(toolRegistry: AIToolRegistry, windowManager: WindowManager) {
    this.toolRegistry = toolRegistry;
    this.windowManager = windowManager;
  }

  setApiKey(apiKey: string) {
    this.client = new OpenRouterClient(apiKey);
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  private getToolDefinitions(): Tool[] {
    return getOpenRouterToolDefinitions();
  }

  async chat(conversationId: string, userMessage: string): Promise<string> {
    console.log(
      `[AIService] Starting chat - conversationId: ${conversationId}, message: "${userMessage}"`
    );

    if (!this.client) {
      console.error("[AIService] Client not configured");
      throw new Error("AI service not configured. Please set an API key.");
    }

    // Get or create conversation
    let conversation = this.conversations.get(conversationId);
    if (!conversation) {
      conversation = {
        id: conversationId,
        messages: [
          {
            role: "system",
            content: `You are an AI assistant for Bitcave, a dashboard application with an infinite canvas where users can create and manage different types of windows.

Your primary capabilities include:
- Creating and managing text windows with custom labels
- Reading and updating content in text windows
- Listing and organizing windows
- Creating other types of windows (webview, markdown, graphs, etc.)

You should be helpful, concise, and proactive in using the available tools to assist users. When users ask you to create content, actually create the windows and populate them. Always use the tools available to you rather than just describing what you would do.

The user interface shows windows on an infinite canvas that can be moved and resized. Each text window has a clear label and ID for easy reference.`,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.conversations.set(conversationId, conversation);
    }

    // Add user message
    conversation.messages.push({
      role: "user",
      content: userMessage,
    });

    try {
      const contextMessage: OpenRouterMessage = {
        role: "system",
        content: this.buildWindowContextMessage(),
      };

      console.log(
        `[AIService] Making API call with ${
          conversation.messages.length
        } messages (+1 context) and ${this.getToolDefinitions().length} tools`
      );

      // Make API call with tools and dynamic context
      const response = await this.client.createChatCompletion({
        messages: [...conversation.messages, contextMessage],
        tools: this.getToolDefinitions(),
        tool_choice: "auto",
        temperature: 0.7,
        max_tokens: 1000,
      });

      console.log(
        `[AIService] Received API response with ${response.choices.length} choices`
      );

      const choice = response.choices[0];
      if (!choice) {
        console.error("[AIService] No response choice from AI");
        throw new Error("No response from AI");
      }

      const assistantMessage = choice.message;
      console.log(`[AIService] Assistant message:`, {
        role: assistantMessage.role,
        content: assistantMessage.content?.substring(0, 100) + "...",
        has_tool_calls: !!assistantMessage.tool_calls,
        tool_calls_count: assistantMessage.tool_calls?.length || 0,
      });

      // Handle tool calls if present
      if (
        assistantMessage.tool_calls &&
        assistantMessage.tool_calls.length > 0
      ) {
        // Add the assistant message with tool calls
        conversation.messages.push({
          role: "assistant",
          content: assistantMessage.content || "",
          tool_calls: assistantMessage.tool_calls,
        });

        console.log(
          `[AIService] Executing ${assistantMessage.tool_calls.length} tool calls`
        );

        // Execute each tool call
        for (const toolCall of assistantMessage.tool_calls) {
          console.log(
            `[AIService] Executing tool: ${toolCall.function.name} with args:`,
            toolCall.function.arguments
          );

          try {
            const parsedArgs = JSON.parse(toolCall.function.arguments);
            console.log(`[AIService] Parsed args:`, parsedArgs);

            const result = await this.toolRegistry.executeTool(
              toolCall.function.name,
              parsedArgs
            );

            console.log(`[AIService] Tool execution result:`, result);

            // Add tool result message
            conversation.messages.push({
              role: "tool",
              content: JSON.stringify(result),
              tool_call_id: toolCall.id,
            });
          } catch (error) {
            console.error(
              `[AIService] Tool execution error for ${toolCall.function.name}:`,
              error
            );

            // Add error message
            conversation.messages.push({
              role: "tool",
              content: JSON.stringify({ error: (error as Error).message }),
              tool_call_id: toolCall.id,
            });
          }
        }

        // Get final response after tool execution (refresh context)
        const finalContext: OpenRouterMessage = {
          role: "system",
          content: this.buildWindowContextMessage(),
        };
        const finalResponse = await this.client.createChatCompletion({
          messages: [...conversation.messages, finalContext],
          tools: this.getToolDefinitions(),
          tool_choice: "auto",
          temperature: 0.7,
          max_tokens: 1000,
        });

        const finalChoice = finalResponse.choices[0];
        if (finalChoice) {
          const cleaned = (finalChoice.message.content || "").replace(
            /^\s+/,
            ""
          );
          if (cleaned) {
            conversation.messages.push({ role: "assistant", content: cleaned });
            conversation.updatedAt = new Date();
            return cleaned;
          }
          // Auto-continue once if empty
          const continueMsg: OpenRouterMessage = {
            role: "user",
            content: "Continue.",
          };
          const contResp = await this.client.createChatCompletion({
            messages: [...conversation.messages, continueMsg, finalContext],
            tools: this.getToolDefinitions(),
            tool_choice: "auto",
            temperature: 0.7,
            max_tokens: 1000,
          });
          const contChoice = contResp.choices[0];
          const contClean = (contChoice?.message.content || "").replace(
            /^\s+/,
            ""
          );
          if (contClean) {
            conversation.messages.push({
              role: "assistant",
              content: contClean,
            });
            conversation.updatedAt = new Date();
            return contClean;
          }
        }
      }

      // No tool calls, just return the content
      const cleanedInitial = (assistantMessage.content || "").replace(
        /^\s+/,
        ""
      );
      if (cleanedInitial) {
        conversation.messages.push({
          role: "assistant",
          content: cleanedInitial,
        });
        conversation.updatedAt = new Date();
        return cleanedInitial;
      }
      // If empty, try one auto-continue
      const contextMessage2: OpenRouterMessage = {
        role: "system",
        content: this.buildWindowContextMessage(),
      };
      const contResp2 = await this.client.createChatCompletion({
        messages: [
          ...conversation.messages,
          { role: "user", content: "Continue." },
          contextMessage2,
        ],
        tools: this.getToolDefinitions(),
        tool_choice: "auto",
        temperature: 0.7,
        max_tokens: 1000,
      });
      const contChoice2 = contResp2.choices[0];
      const contClean2 = (contChoice2?.message.content || "").replace(
        /^\s+/,
        ""
      );
      if (contClean2) {
        conversation.messages.push({ role: "assistant", content: contClean2 });
        conversation.updatedAt = new Date();
        return contClean2;
      }

      throw new Error("No content in AI response");
    } catch (error) {
      console.error("AI Service error:", error);
      throw error;
    }
  }

  private buildWindowContextMessage(): string {
    const windows = (global as any)?.bitcaveApp
      ? (global as any).bitcaveApp["windowManager"].getAllWindows?.() || []
      : this.windowManager?.getAllWindows?.() || [];

    const summary = windows.map((w: any) => ({
      id: w.id,
      type: w.type,
      title: w.title,
      label: w.metadata?.label || null,
      position: w.position,
      size: w.size,
      isLocked: w.isLocked,
      isMinimized: w.isMinimized,
      lastModified: w.metadata?.lastModified || null,
      contentInfo:
        typeof w.metadata?.content === "string"
          ? { chars: w.metadata.content.length }
          : undefined,
    }));

    const instruction =
      "Context: This is the current open window state. Do NOT assume in-memory content is fresh. If you need the current text, explicitly call readTextContent/readTextByLabel before answering.";

    return `{"windows": ${JSON.stringify(summary)}, "note": ${JSON.stringify(
      instruction
    )}}`;
  }

  getConversation(conversationId: string): AIConversation | undefined {
    return this.conversations.get(conversationId);
  }

  clearConversation(conversationId: string): void {
    this.conversations.delete(conversationId);
  }

  getAllConversations(): AIConversation[] {
    return Array.from(this.conversations.values());
  }

}
