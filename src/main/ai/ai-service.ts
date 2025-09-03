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
import { MemoryService } from "../memory/memory-service";

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
  private abortControllers: Map<string, AbortController> = new Map();
  private pendingInlineExecutions: Map<string, any> = new Map(); // Track inline executions per conversation
  private memoryService: MemoryService | null = null;

  constructor(toolRegistry: AIToolRegistry, windowManager: WindowManager) {
    this.toolRegistry = toolRegistry;
    this.windowManager = windowManager;
    this.logger = new AILogger();
  }

  setApiKey(apiKey: string) {
    this.client = new OpenRouterClient(apiKey);
    this.client.setLogger(this.logger);
  }

  setMemoryService(memoryService: MemoryService) {
    this.memoryService = memoryService;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  private getToolDefinitions(): Tool[] {
    return getOpenRouterToolDefinitions();
  }

  async chat(conversationId: string, userMessage: string): Promise<{ content: string; inlineExecution?: any }> {
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

      // Store message in memory system for fact extraction
      if (this.memoryService) {
        await this.memoryService.addMessageToConversation(conversationId, "user", userMessage);
      }

      // Create abort controller for this conversation
      const controller = new AbortController();
      this.abortControllers.set(conversationId, controller);

      try {
        return await this.processConversationLoop(
          conversationId,
          conversation,
          controller.signal
        );
      } finally {
        this.abortControllers.delete(conversationId);
      }
    } catch (error) {
      console.error("AI Service error:", error);
      this.logger.logError(conversationId, error, { userMessage });
      throw error;
    }
  }

  private async processConversationLoop(
    conversationId: string,
    conversation: AIConversation,
    abortSignal: AbortSignal
  ): Promise<{ content: string; inlineExecution?: any }> {
    while (true) {
      // Check if aborted
      if (abortSignal.aborted) {
        throw new Error("Request aborted");
      }
      // Create context message with memory context
      let contextContent = this.buildWindowContextMessage();
      if (this.memoryService) {
        const memoryContext = await this.buildMemoryContext(conversation.messages);
        if (memoryContext) {
          contextContent += "\n\n" + memoryContext;
        }
      }

      const contextMessage: OpenRouterMessage = {
        role: "system",
        content: contextContent,
      };

      // Prepare request
      const request = {
        messages: [...conversation.messages, contextMessage],
        tools: this.getToolDefinitions(),
        tool_choice: "auto" as const,
        temperature: 0.2,
        max_tokens: 32000,
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
      if (
        assistantMessage.content &&
        assistantMessage.content.includes("<xai:function_call")
      ) {
        console.log(
          `[AIService] Detected XAI XML function call format, parsing...`
        );
        assistantMessage = this.parseXaiXmlFunctionCalls(
          assistantMessage as OpenRouterMessage
        );
      }

      // Case 1: Has tool calls - execute them and continue loop
      if (
        assistantMessage.tool_calls &&
        assistantMessage.tool_calls.length > 0
      ) {
        console.log(
          `[AIService] Processing ${assistantMessage.tool_calls.length} tool calls`
        );

        // Add assistant message with tool calls
        conversation.messages.push({
          role: "assistant",
          content: assistantMessage.content || "",
          tool_calls: assistantMessage.tool_calls,
        });

        // Execute each tool call
        await this.executeToolCalls(
          conversationId,
          conversation,
          assistantMessage.tool_calls
        );

        // Continue loop to get next response
        continue;
      }

      // Case 2: Has content - return it
      const content = (assistantMessage.content || "").trim();
      if (content) {
        console.log(
          `[AIService] Got content response:`,
          content.substring(0, 100)
        );
        // Check if we have a pending inline execution for this conversation
        const inlineExecution = this.pendingInlineExecutions.get(conversationId);
        
        const assistantMessage: any = {
          role: "assistant",
          content: content,
        };

        // Attach inline execution data if available
        if (inlineExecution) {
          assistantMessage.inlineExecution = inlineExecution;
          this.pendingInlineExecutions.delete(conversationId); // Clear it after use
        }

        conversation.messages.push(assistantMessage);
        conversation.updatedAt = new Date();

        // Store assistant message in memory system
        if (this.memoryService) {
          await this.memoryService.addMessageToConversation(conversationId, "assistant", content);
        }

        return {
          content,
          inlineExecution: inlineExecution || undefined
        };
      }

      // Case 3: No content, check reasoning and inject hidden user message
      if ((assistantMessage as any).reasoning) {
        const reasoning = (assistantMessage as any).reasoning;
        console.log(
          `[AIService] No content but has reasoning, injecting hidden user message`
        );

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

  private async executeToolCalls(
    conversationId: string,
    conversation: AIConversation,
    toolCalls: ToolCall[]
  ): Promise<void> {
    for (const toolCall of toolCalls) {
      console.log(`[AIService] Executing tool: ${toolCall.function.name}`);

      try {
        // Parse arguments
        let parsedArgs: any;
        const argsString = toolCall.function.arguments.trim();

        try {
          parsedArgs = JSON.parse(argsString);
        } catch (parseError) {
          console.warn(
            `[AIService] JSON parse failed for ${toolCall.function.name}:`,
            parseError
          );
          console.warn(
            `[AIService] Full args string length: ${argsString.length}`
          );
          console.warn(
            `[AIService] Args preview:`,
            argsString.substring(0, 500) + "..."
          );

          // Try to fix common JSON issues before regex fallback
          let fixedArgs = argsString;

          // Fix unescaped quotes in strings
          fixedArgs = fixedArgs.replace(
            /"([^"]*(?:\\.[^"]*)*)"/g,
            (match, content) => {
              return '"' + content.replace(/"/g, '\\"') + '"';
            }
          );

          try {
            parsedArgs = JSON.parse(fixedArgs);
            console.log(`[AIService] Fixed JSON parsing succeeded`);
          } catch {
            console.warn(`[AIService] JSON fix failed, falling back to regex`);
            parsedArgs = this.extractArgsWithRegex(
              argsString,
              conversationId,
              toolCall.function.name
            );
          }
        }

        // Execute tool
        const result = await this.toolRegistry.executeTool(
          toolCall.function.name,
          parsedArgs
        );
        this.logger.logToolCall(
          conversationId,
          toolCall.function.name,
          parsedArgs,
          result
        );

        // Check if this is an inline code execution
        if (toolCall.function.name === 'executeInlineCode' && result) {
          this.pendingInlineExecutions.set(conversationId, result);
        }

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

  private extractArgsWithRegex(
    argsString: string,
    conversationId: string,
    toolName: string
  ): any {
    console.log(
      `[AIService] Attempting regex extraction for tool: ${toolName}`
    );
    console.log(`[AIService] Args string length: ${argsString.length}`);

    const extractedArgs: any = {};

    // For artifact tools, try to extract the main content fields more carefully
    if (toolName === "createArtifactWindow" || toolName === "createArtifact") {
      // Extract title
      const titleMatch = argsString.match(
        /["']?title["']?\s*:\s*["']([^"']+)["']/i
      );
      if (titleMatch) extractedArgs.title = titleMatch[1];

      // Extract description
      const descMatch = argsString.match(
        /["']?description["']?\s*:\s*["']([^"']+)["']/i
      );
      if (descMatch) extractedArgs.description = descMatch[1];

      // Extract HTML with multiline support
      const htmlMatch = argsString.match(
        /["']?html["']?\s*:\s*["']([\s\S]*?)["'](?=\s*,\s*["']?\w+["']?\s*:|\s*})/i
      );
      if (htmlMatch)
        extractedArgs.html = htmlMatch[1]
          .replace(/\\"/g, '"')
          .replace(/\\n/g, "\n");

      // Extract CSS with multiline support
      const cssMatch = argsString.match(
        /["']?css["']?\s*:\s*["']([\s\S]*?)["'](?=\s*,\s*["']?\w+["']?\s*:|\s*})/i
      );
      if (cssMatch)
        extractedArgs.css = cssMatch[1]
          .replace(/\\"/g, '"')
          .replace(/\\n/g, "\n");

      // Extract JavaScript with multiline support
      const jsMatch = argsString.match(
        /["']?javascript["']?\s*:\s*["']([\s\S]*?)["'](?=\s*,\s*["']?\w+["']?\s*:|\s*})/i
      );
      if (jsMatch)
        extractedArgs.javascript = jsMatch[1]
          .replace(/\\"/g, '"')
          .replace(/\\n/g, "\n");

      console.log(`[AIService] Artifact extraction results:`);
      console.log(`  - title: ${extractedArgs.title ? "Found" : "Missing"}`);
      console.log(
        `  - description: ${extractedArgs.description ? "Found" : "Missing"}`
      );
      console.log(
        `  - html: ${
          extractedArgs.html
            ? `Found (${extractedArgs.html.length} chars)`
            : "Missing"
        }`
      );
      console.log(
        `  - css: ${
          extractedArgs.css
            ? `Found (${extractedArgs.css.length} chars)`
            : "Missing"
        }`
      );
      console.log(
        `  - javascript: ${
          extractedArgs.javascript
            ? `Found (${extractedArgs.javascript.length} chars)`
            : "Missing"
        }`
      );

      if (Object.keys(extractedArgs).length > 0) {
        this.logger.logParsingIssue(
          conversationId,
          toolName,
          argsString,
          extractedArgs,
          "artifact_regex_extraction"
        );
        return extractedArgs;
      }
    }

    // Fallback to general regex patterns
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
          value = value
            .slice(1, -1)
            .replace(/\\"/g, '"')
            .replace(/\\n/g, "\n")
            .replace(/\\\\/g, "\\");
        }

        extractedArgs[key] = value;
        matchFound = true;
        console.log(
          `[AIService] Extracted: ${key} = ${
            typeof value === "string" ? value.substring(0, 50) + "..." : value
          }`
        );
      }
    }

    if (!matchFound) {
      console.warn(
        `[AIService] No regex patterns matched for tool: ${toolName}`
      );
      console.warn(
        `[AIService] Raw args string:`,
        argsString.substring(0, 1000) + "..."
      );
    }

    this.logger.logParsingIssue(
      conversationId,
      toolName,
      argsString,
      extractedArgs,
      "general_regex_extraction"
    );

    return extractedArgs;
  }

  private parseXaiXmlFunctionCalls(
    message: OpenRouterMessage
  ): OpenRouterMessage {
    const content = message.content || "";
    const xmlCallRegex =
      /<xai:function_call name="([^"]+)">(.*?)<\/xai:function_call>/gs;
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
        if (
          (paramValue.startsWith("[") && paramValue.endsWith("]")) ||
          (paramValue.startsWith("{") && paramValue.endsWith("}"))
        ) {
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
          arguments: JSON.stringify(args),
        },
      });
    }

    return {
      ...message,
      tool_calls: toolCalls.length > 0 ? toolCalls : message.tool_calls,
      content: toolCalls.length > 0 ? "" : message.content, // Clear content if we extracted tool calls
    };
  }

  private async buildMemoryContext(messages: OpenRouterMessage[]): Promise<string | null> {
    if (!this.memoryService || messages.length === 0) {
      return null;
    }

    // Get recent user messages for context search
    const recentUserMessages = messages
      .filter(m => m.role === "user")
      .slice(-3) // Last 3 user messages
      .map(m => m.content)
      .join(" ");

    if (!recentUserMessages.trim()) {
      return null;
    }

    try {
      // Search for relevant facts
      const relevantFacts = await this.memoryService.searchFacts(recentUserMessages, 8);
      
      if (relevantFacts.length === 0) {
        return null;
      }

      // Filter facts by similarity threshold and apply recency boost
      const filteredFacts = relevantFacts
        .filter(fact => fact.distance < 0.7) // Similarity threshold
        .map(fact => {
          // Apply recency boost
          const ageInDays = (Date.now() - new Date(fact.updated_at).getTime()) / (1000 * 60 * 60 * 24);
          const recencyMultiplier = Math.max(0.5, 1 - (ageInDays / 30)); // Decay over 30 days
          return {
            ...fact,
            relevanceScore: (1 - fact.distance) * recencyMultiplier * fact.confidence
          };
        })
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 5); // Top 5 most relevant

      if (filteredFacts.length === 0) {
        return null;
      }

      // Build context string
      let context = "USER MEMORY CONTEXT:\n";
      context += "The following information about the user may be relevant to this conversation:\n\n";
      
      filteredFacts.forEach((fact, index) => {
        context += `${index + 1}. ${fact.content} (${fact.category}, confidence: ${fact.confidence.toFixed(1)})\n`;
      });
      
      context += "\nUse this information appropriately to provide more personalized and contextual responses.";
      
      return context;
    } catch (error) {
      console.error('[AIService] Error building memory context:', error);
      return null;
    }
  }

  private buildWindowContextMessage(): string {
    const windows = this.windowManager.getAllWindows();

    let context = "BITCAVE AI ASSISTANT - ARTIFACT CREATION SPECIALIST\n\n";

    context +=
      "PRIMARY DIRECTIVE: When users ask for interactive tools, games, calculators, apps, or any functionality that requires HTML/CSS/JS, IMMEDIATELY use the createArtifactWindow tool. This is your PRIMARY tool for user requests.\n\n";

    context += "CODE EXECUTION RULES:\n";
    context += "1. ALWAYS use executeInlineCode for simple calculations and math:\n";
    context +=
      "   - Basic math: '5!', 'sqrt(144)', '2**10', trigonometry functions\n";
    context +=
      "   - Unit conversions: 'convert 100F to celsius', distance, weight conversions\n";
    context +=
      "   - Simple statistics: mean, median, mode of small datasets\n";
    context +=
      "   - Quick computations that can be solved in 1-3 lines of Python\n";
    context += "2. ONLY use executeCodeInWindow for complex tasks:\n";
    context +=
      "   - Multi-step programs requiring debugging or extensive output\n";
    context +=
      "   - Code that needs to be saved, modified, or rerun multiple times\n";
    context +=
      "   - When user explicitly asks for a 'code window' or 'programming environment'\n";
    context +=
      "   - Complex data analysis with plots or extensive data processing\n";
    context += "3. Default to executeInlineCode for any computational question unless complexity requires a window.\n";
    context +=
      "4. Use executeInlineCode naturally - don't announce you're calculating, just provide the result.\n";
    context +=
      "5. EXAMPLES: 'What is 5!' → executeInlineCode, 'Build a data analysis script' → executeCodeInWindow\n\n";

    context += "ARTIFACT CREATION EXAMPLES:\n";
    context +=
      "- User: 'Make me a calculator' → Use createArtifactWindow with complete calculator HTML/CSS/JS\n";
    context +=
      "- User: 'I need a timer' → Use createArtifactWindow with timer functionality\n";
    context +=
      "- User: 'Create a todo app' → Use createArtifactWindow with todo list features\n";
    context +=
      "- User: 'Build a game' → Use createArtifactWindow with game mechanics\n\n";

    context += "BITCAVE API USAGE:\n";
    context +=
      "- For data persistence, use the `artifact.setData(key, value)` and `artifact.getData(key)` functions available in your JavaScript environment.\n";
    context +=
      "- Example: `artifact.setData('history', [1, 2, 3]); const history = artifact.getData('history');`\n";
    context +=
      "- This allows the user to query the state of your application in future requests.\n\n";

    context += "BITCAVE THEME:\n";
    context +=
      "- Use these theme colors to style your application for a consistent look and feel.\n";
    context +=
      "- primary: '#3b82f6', secondary: '#64748b', success: '#10b981', warning: '#f59e0b', error: '#ef4444', background: '#1f2937', surface: '#374151', text: '#f9fafb', textSecondary: '#d1d5db'\n\n";

    context += "ARTIFACT QUALITY STANDARDS:\n";
    context +=
      "- HTML: Complete, semantic structure with all needed elements\n";
    context +=
      "- CSS: Modern styling, responsive design, professional appearance. Use the Bitcave theme.\n";
    context +=
      "- JavaScript: Full functionality, event handlers, proper logic. Use Bitcave APIs for data.\n";
    context +=
      "- NO placeholder or incomplete code - make it fully functional\n\n";

    context += "Current Dashboard State:\n";

    if (windows.length === 0) {
      context += "- No windows currently open\n";
    } else {
      context += `- ${windows.length} window(s) open:\n`;
      windows.forEach((window, index) => {
        const typeInfo =
          window.type === "webview"
            ? ` (URL: ${(window.metadata as any)?.url || "unknown"})`
            : window.type === "text"
            ? ` (${(window.metadata as any)?.content?.length || 0} chars)`
            : window.type === "code-execution"
            ? ` (${(window.metadata as any)?.language || "unknown"} code)`
            : window.type === "artifact"
            ? ` (Interactive App: ${ (window.metadata as any)?.artifact?.title || "Unknown" })
`
            : "";

        context += `  ${index + 1}. ${window.title || "Untitled"} [${ window.type }]${typeInfo} at (${window.position.x}, ${window.position.y}) ${ window.size.width }x${ window.size.height }\n`;

        if (window.metadata?.label) {
          context += `     Label: ${window.metadata.label}\n`;
        }
      });
    }

    context +=
      "\nREMEMBER: Users want working, interactive applications. Always create complete, functional artifacts with createArtifactWindow, using the Bitcave theme and data APIs.\n";

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

  createNewConversation(): string {
    const newConversationId = `chat_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    console.log(`[AIService] Created new conversation: ${newConversationId}`);
    return newConversationId;
  }

  abortConversation(conversationId: string): void {
    const controller = this.abortControllers.get(conversationId);
    if (controller) {
      console.log(`[AIService] Aborting conversation: ${conversationId}`);
      controller.abort();
      this.abortControllers.delete(conversationId);
    }
  }

  async processPrompt(prompt: string, model?: string): Promise<string> {
    if (!this.client) {
      throw new Error("AI service not configured. Please set an API key.");
    }

    const request: OpenRouterRequest = {
      messages: [{ role: "user", content: prompt }],
      model: model || process.env.FACT_EXTRACTION_MODEL || this.client.defaultModel,
    };

    const response = await this.client.createChatCompletion(request);
    return response.choices[0].message.content || "";
  }
}
