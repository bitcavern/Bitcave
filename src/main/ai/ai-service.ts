import {
  OpenRouterClient,
  OpenRouterMessage,
  Tool,
  ToolCall,
} from "./openrouter-client";
import { AIToolRegistry } from "../ai-tools/registry";
import { getOpenRouterToolDefinitions } from "../ai-tools/tool-definitions";
import type { WindowManager } from "../window-manager";
import { AILogger } from "./logger";

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
  private logger: AILogger;

  constructor(toolRegistry: AIToolRegistry, windowManager: WindowManager) {
    this.toolRegistry = toolRegistry;
    this.windowManager = windowManager;
    this.logger = new AILogger();
  }

  setApiKey(apiKey: string) {
    this.client = new OpenRouterClient(apiKey);
    this.client.setLogger(this.logger);
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

    try {
      // Get or create conversation
      let conversation = this.conversations.get(conversationId);
      if (!conversation) {
        conversation = {
          id: conversationId,
          messages: [],
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

      return await this.processConversationLoop(conversationId, conversation);
    } catch (error) {
      console.error("AI Service error:", error);
      this.logger.logError(conversationId, error, { userMessage });
      throw error;
    }
  }

  private async processConversationLoop(conversationId: string, conversation: AIConversation): Promise<string> {
    while (true) {
      // Create context message
      const contextMessage: OpenRouterMessage = {
        role: "system",
        content: this.buildWindowContextMessage(),
      };

      // Prepare request
      const request = {
        messages: [...conversation.messages, contextMessage],
        tools: this.getToolDefinitions(),
        tool_choice: "auto" as const,
        temperature: 0.7,
        max_tokens: 1000,
      };

      // Log request and make API call
      this.logger.logRequest(conversationId, request);
      const response = await this.client!.createChatCompletion(request);
      this.logger.logResponse(conversationId, response);

      const choice = response.choices[0];
      if (!choice) {
        throw new Error("No response from AI");
      }

      let assistantMessage = choice.message;

      // Check for XAI XML function calls
      if (assistantMessage.content && assistantMessage.content.includes("<xai:function_call")) {
        console.log(`[AIService] Detected XAI XML function call format, parsing...`);
        assistantMessage = this.parseXaiXmlFunctionCalls(assistantMessage as OpenRouterMessage);
      }

      // Case 1: Has tool calls - execute them and continue loop
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        console.log(`[AIService] Processing ${assistantMessage.tool_calls.length} tool calls`);
        
        // Add assistant message with tool calls
        conversation.messages.push({
          role: "assistant",
          content: assistantMessage.content || "",
          tool_calls: assistantMessage.tool_calls,
        });

        // Execute each tool call
        await this.executeToolCalls(conversationId, conversation, assistantMessage.tool_calls);
        
        // Continue loop to get next response
        continue;
      }

      // Case 2: Has content - return it
      const content = (assistantMessage.content || "").trim();
      if (content) {
        console.log(`[AIService] Got content response:`, content.substring(0, 100));
        conversation.messages.push({
          role: "assistant",
          content: content,
        });
        conversation.updatedAt = new Date();
        return content;
      }

      // Case 3: No content, check reasoning and inject hidden user message
      if ((assistantMessage as any).reasoning) {
        const reasoning = (assistantMessage as any).reasoning;
        console.log(`[AIService] No content but has reasoning, injecting hidden user message`);
        
        // Add assistant message with reasoning (for history)
        conversation.messages.push({
          role: "assistant",
          content: reasoning,
        });

        // Add hidden user message to trigger continuation
        conversation.messages.push({
          role: "user",
          content: "Use a tool call to continue this plan.",
        });

        // Continue loop
        continue;
      }

      // Case 4: No content, no reasoning - this shouldn't happen but handle gracefully
      console.warn(`[AIService] Response has no content and no reasoning`);
      throw new Error("AI response has no content");
    }
  }

  private async executeToolCalls(conversationId: string, conversation: AIConversation, toolCalls: ToolCall[]): Promise<void> {
    for (const toolCall of toolCalls) {
      console.log(`[AIService] Executing tool: ${toolCall.function.name}`);

      try {
        // Parse arguments
        let parsedArgs: any;
        const argsString = toolCall.function.arguments.trim();
        
        try {
          parsedArgs = JSON.parse(argsString);
        } catch (parseError) {
          console.warn(`[AIService] JSON parse failed, using regex fallback`);
          parsedArgs = this.extractArgsWithRegex(argsString, conversationId, toolCall.function.name);
        }

        // Execute tool
        const result = await this.toolRegistry.executeTool(toolCall.function.name, parsedArgs);
        this.logger.logToolCall(conversationId, toolCall.function.name, parsedArgs, result);

        // Add tool result to conversation
        const serializedResult = JSON.stringify(result, null, 2);
        conversation.messages.push({
          role: "tool",
          content: serializedResult,
          tool_call_id: toolCall.id,
        });
      } catch (error) {
        console.error(`[AIService] Tool execution error:`, error);
        this.logger.logError(conversationId, error, {
          toolName: toolCall.function.name,
          toolCallId: toolCall.id,
        });

        // Add error result
        const errorResult = {
          error: error instanceof Error ? error.message : String(error),
          tool: toolCall.function.name,
          timestamp: new Date().toISOString(),
        };

        conversation.messages.push({
          role: "tool",
          content: JSON.stringify(errorResult),
          tool_call_id: toolCall.id,
        });
      }
    }
  }

  private extractArgsWithRegex(argsString: string, conversationId: string, toolName: string): any {
    console.log(`[AIService] Attempting regex extraction for tool: ${toolName}`);
    
    const extractedArgs: any = {};
    
    // Improved regex patterns that handle escaped quotes and newlines better
    const patterns = [
      // Match "key": "value" (with potential escapes)
      /"(\w+)":\s*"([^"\\]*(\\.[^"\\]*)*)"/g,
      // Match "key": value (non-string values)
      /"(\w+)":\s*([^,}\s]+)/g,
      // Match key: "value" (without quotes around key)
      /(\w+):\s*"([^"\\]*(\\.[^"\\]*)*)"/g,
      // Match key: value (simple case)
      /(\w+):\s*([^,}\s]+)/g,
    ];

    let matchFound = false;

    for (const pattern of patterns) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      
      while ((match = regex.exec(argsString)) !== null) {
        const key = match[1];
        let value = match[2];
        
        // Try to parse the value appropriately
        if (value === "true" || value === "false") {
          extractedArgs[key] = value === "true";
          continue;
        } else if (/^\d+$/.test(value)) {
          extractedArgs[key] = parseInt(value, 10);
          continue;
        } else if (/^\d*\.\d+$/.test(value)) {
          extractedArgs[key] = parseFloat(value);
          continue;
        } else if (value.startsWith('"') && value.endsWith('"')) {
          // Remove surrounding quotes and handle escaped characters
          value = value.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
        }
        
        extractedArgs[key] = value;
        matchFound = true;
        console.log(`[AIService] Extracted: ${key} = ${typeof value === 'string' ? value.substring(0, 50) + '...' : value}`);
      }
    }

    if (!matchFound) {
      console.warn(`[AIService] No regex patterns matched for tool: ${toolName}`);
      console.warn(`[AIService] Raw args string:`, argsString);
    }

    this.logger.logParsingIssue(conversationId, toolName, argsString, extractedArgs, "regex_extraction");
    
    return extractedArgs;
  }

  private parseXaiXmlFunctionCalls(message: OpenRouterMessage): OpenRouterMessage {
    const content = message.content || "";
    const xmlCallRegex = /<xai:function_call name="([^"]+)">(.*?)<\/xai:function_call>/gs;
    const toolCalls: ToolCall[] = [];
    
    let match;
    let callId = 1;
    
    while ((match = xmlCallRegex.exec(content)) !== null) {
      const functionName = match[1];
      const parametersXml = match[2];
      
      // Extract parameters from XML
      const parameterRegex = /<parameter name="([^"]+)">(.*?)<\/parameter>/gs;
      const args: any = {};
      
      let paramMatch;
      while ((paramMatch = parameterRegex.exec(parametersXml)) !== null) {
        const paramName = paramMatch[1];
        let paramValue = paramMatch[2].trim();
        
        // Try to parse as JSON if it looks like JSON
        if ((paramValue.startsWith('[') && paramValue.endsWith(']')) ||
            (paramValue.startsWith('{') && paramValue.endsWith('}'))) {
          try {
            paramValue = JSON.parse(paramValue);
          } catch {
            // Keep as string if JSON parsing fails
          }
        }
        
        args[paramName] = paramValue;
      }
      
      toolCalls.push({
        id: `xai_call_${callId++}`,
        type: "function",
        function: {
          name: functionName,
          arguments: JSON.stringify(args)
        }
      });
    }
    
    return {
      ...message,
      tool_calls: toolCalls.length > 0 ? toolCalls : message.tool_calls,
      content: toolCalls.length > 0 ? "" : message.content // Clear content if we extracted tool calls
    };
  }

  private buildWindowContextMessage(): string {
    const windows = this.windowManager.getAllWindows();
    
    let context = "Current Dashboard State:\n";
    
    if (windows.length === 0) {
      context += "- No windows currently open\n";
    } else {
      context += `- ${windows.length} window(s) open:\n`;
      windows.forEach((window, index) => {
        const typeInfo = window.type === 'webview' 
          ? ` (URL: ${(window.metadata as any)?.url || 'unknown'})` 
          : window.type === 'text'
          ? ` (${(window.metadata as any)?.content?.length || 0} chars)`
          : window.type === 'code-execution'
          ? ` (${(window.metadata as any)?.language || 'unknown'} code)`
          : '';
          
        context += `  ${index + 1}. ${window.title || 'Untitled'} [${window.type}]${typeInfo} at (${window.position.x}, ${window.position.y}) ${window.size.width}x${window.size.height}\n`;
        
        if (window.metadata?.label) {
          context += `     Label: ${window.metadata.label}\n`;
        }
      });
    }
    
    context += "\nAvailable Actions:\n";
    context += "- Create windows (webview, text, code, markdown, graph, chat)\n";
    context += "- Modify window content, position, size\n";
    context += "- Execute code in sandboxed environments\n";
    context += "- Search and manipulate window data\n";
    context += "- Get system information and metrics\n";
    
    return context;
  }

  getConversations(): AIConversation[] {
    return Array.from(this.conversations.values());
  }

  clearConversation(conversationId: string): void {
    this.conversations.delete(conversationId);
  }

  clearAllConversations(): void {
    this.conversations.clear();
  }
}