import {
  OpenRouterClient,
  OpenRouterMessage,
  Tool,
  ToolCall,
} from "./openrouter-client";
import { AIToolRegistry } from "../ai-tools/registry";
import { BrowserWindow } from "electron";

export interface AIConversation {
  id: string;
  messages: OpenRouterMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export class AIService {
  private client: OpenRouterClient | null = null;
  private toolRegistry: AIToolRegistry;
  private conversations: Map<string, AIConversation> = new Map();

  constructor(toolRegistry: AIToolRegistry) {
    this.toolRegistry = toolRegistry;
  }

  setApiKey(apiKey: string) {
    this.client = new OpenRouterClient(apiKey);
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  private getToolDefinitions(): Tool[] {
    return [
      {
        type: "function",
        function: {
          name: "createTextWindow",
          description:
            "Create a new text window with a label and optional initial content",
          parameters: {
            type: "object",
            properties: {
              label: {
                type: "string",
                description: "The label/title for the text window",
              },
              content: {
                type: "string",
                description: "Initial content for the text window (optional)",
              },
            },
            required: ["label"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "listTextWindows",
          description:
            "Get a list of all text windows with their labels and IDs",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "readTextContent",
          description: "Read the content from a specific text window",
          parameters: {
            type: "object",
            properties: {
              windowId: {
                type: "string",
                description: "The ID of the text window to read from",
              },
            },
            required: ["windowId"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "updateTextContent",
          description: "Update the content of a specific text window",
          parameters: {
            type: "object",
            properties: {
              windowId: {
                type: "string",
                description: "The ID of the text window to update",
              },
              content: {
                type: "string",
                description: "The new content for the text window",
              },
            },
            required: ["windowId", "content"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "getWindowList",
          description: "Get a list of all windows currently open",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "createWindow",
          description: "Create a new window of a specific type",
          parameters: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: [
                  "text",
                  "webview",
                  "markdown-editor",
                  "graph",
                  "chat",
                  "code-execution",
                ],
                description: "The type of window to create",
              },
              config: {
                type: "object",
                description: "Configuration for the window (optional)",
              },
            },
            required: ["type"],
          },
        },
      },
    ];
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
      console.log(
        `[AIService] Making API call with ${
          conversation.messages.length
        } messages and ${this.getToolDefinitions().length} tools`
      );

      // Make API call with tools
      const response = await this.client.createChatCompletion({
        messages: conversation.messages,
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

        // Get final response after tool execution
        const finalResponse = await this.client.createChatCompletion({
          messages: conversation.messages,
          tools: this.getToolDefinitions(),
          tool_choice: "auto",
          temperature: 0.7,
          max_tokens: 1000,
        });

        const finalChoice = finalResponse.choices[0];
        if (finalChoice && finalChoice.message.content) {
          conversation.messages.push({
            role: "assistant",
            content: finalChoice.message.content,
          });
          conversation.updatedAt = new Date();
          return finalChoice.message.content;
        }
      }

      // No tool calls, just return the content
      if (assistantMessage.content) {
        conversation.messages.push({
          role: "assistant",
          content: assistantMessage.content || "",
        });
        conversation.updatedAt = new Date();
        return assistantMessage.content || "";
      }

      throw new Error("No content in AI response");
    } catch (error) {
      console.error("AI Service error:", error);
      throw error;
    }
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

  private notifyWindowCreated(window: any): void {
    console.log(`[AIService] Notifying frontend of new window:`, window.id);

    // Get the main window and send the event
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      // Send the window data directly to the renderer
      mainWindow.webContents.send("window:created", window);
      console.log(`[AIService] Sent window:created event to renderer`);
    } else {
      console.error(`[AIService] No main window found to send event`);
    }
  }
}
