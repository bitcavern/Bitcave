import * as fs from "fs";
import * as path from "path";

export class AILogger {
  private logDir: string;
  private globalLogFile: string;
  private globalErrorLogFile: string;
  private conversationLogFiles: Map<string, {
    structuredLog: string;
    plaintextLog: string;
    errorLog: string;
  }> = new Map();

  constructor() {
    // Create logs directory in the app's user data directory
    this.logDir = path.join(
      process.env.APPDATA || process.env.HOME || ".",
      "bitcave",
      "logs"
    );
    this.globalLogFile = path.join(this.logDir, "ai-interactions-global.log");
    this.globalErrorLogFile = path.join(this.logDir, "ai-errors-global.log");

    // Ensure log directory exists
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
      // Log the file locations on startup
      console.log(`[AILogger] Logging to directory: ${this.logDir}`);
      console.log(`[AILogger] - Global structured logs: ${this.globalLogFile}`);
      console.log(`[AILogger] - Global error logs: ${this.globalErrorLogFile}`);
      console.log(`[AILogger] - Per-conversation logs will be created as needed`);
    } catch (error) {
      console.error("Failed to create log directory:", error);
    }
  }

  private getConversationLogFiles(conversationId: string): {
    structuredLog: string;
    plaintextLog: string;
    errorLog: string;
  } {
    if (!this.conversationLogFiles.has(conversationId)) {
      const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp
      const safeConversationId = conversationId.replace(/[^a-zA-Z0-9-_]/g, '_');
      
      const logFiles = {
        structuredLog: path.join(this.logDir, `conversation-${safeConversationId}-${timestamp}.log`),
        plaintextLog: path.join(this.logDir, `conversation-${safeConversationId}-${timestamp}-plaintext.log`),
        errorLog: path.join(this.logDir, `conversation-${safeConversationId}-${timestamp}-errors.log`)
      };
      
      this.conversationLogFiles.set(conversationId, logFiles);
      
      console.log(`[AILogger] Created log files for conversation ${conversationId}:`);
      console.log(`[AILogger] - Structured: ${logFiles.structuredLog}`);
      console.log(`[AILogger] - Plaintext: ${logFiles.plaintextLog}`);
      console.log(`[AILogger] - Errors: ${logFiles.errorLog}`);
    }
    
    return this.conversationLogFiles.get(conversationId)!;
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private writeToFile(filePath: string, content: string): void {
    try {
      fs.appendFileSync(filePath, content + "\n", "utf8");
    } catch (error) {
      console.error(`Failed to write to log file ${filePath}:`, error);
    }
  }

  private writeToConversationFiles(conversationId: string, type: 'structured' | 'plaintext' | 'error', content: string): void {
    const logFiles = this.getConversationLogFiles(conversationId);
    
    let targetFile: string;
    switch (type) {
      case 'structured':
        targetFile = logFiles.structuredLog;
        break;
      case 'plaintext':
        targetFile = logFiles.plaintextLog;
        break;
      case 'error':
        targetFile = logFiles.errorLog;
        break;
    }
    
    this.writeToFile(targetFile, content);
    
    // Also write to global log for centralized overview
    const globalFile = type === 'error' ? this.globalErrorLogFile : this.globalLogFile;
    this.writeToFile(globalFile, content);
  }

  logRequest(conversationId: string, request: any): void {
    const logEntry = {
      timestamp: this.getTimestamp(),
      type: "REQUEST",
      conversationId,
      messageCount: request.messages?.length || 0,
      toolCount: request.tools?.length || 0,
      temperature: request.temperature,
      maxTokens: request.max_tokens,
      toolChoice: request.tool_choice,
      // Log message summary without full content for brevity
      messageSummary: request.messages?.map((msg: any, index: number) => ({
        index,
        role: msg.role,
        contentLength: msg.content?.length || 0,
        contentPreview: msg.content?.substring(0, 100) || "",
        hasToolCalls: !!msg.tool_calls,
        toolCallsCount: msg.tool_calls?.length || 0
      })),
      // Log tool names only (not full definitions)
      toolNames: request.tools?.map((tool: any) => tool.function.name) || [],
      data: request, // Full request for detailed analysis if needed
    };

    console.log(`[AILogger] REQUEST - Conversation: ${conversationId}, Messages: ${request.messages?.length}, Tools: ${request.tools?.length}`);
    this.writeToConversationFiles(conversationId, 'structured', JSON.stringify(logEntry, null, 2) + "\n" + "=".repeat(80));
    
    // Also log the full conversation to plaintext file for easier debugging
    if (request.messages && request.messages.length > 0) {
      const conversationEntry = [
        "=".repeat(100),
        `TIMESTAMP: ${this.getTimestamp()}`,
        `CONVERSATION: ${conversationId}`,
        `REQUEST TYPE: ${request.tool_choice || "auto"}`,
        `MESSAGE COUNT: ${request.messages.length}`,
        `TOOL COUNT: ${request.tools?.length || 0}`,
        `TEMPERATURE: ${request.temperature}`,
        `MAX TOKENS: ${request.max_tokens}`,
        "-".repeat(50),
        "FULL CONVERSATION BEING SENT:",
        "",
      ];
      
      // Add each message with clear formatting
      request.messages.forEach((msg: any, index: number) => {
        conversationEntry.push(`MESSAGE ${index + 1} [${msg.role.toUpperCase()}]:`);
        conversationEntry.push(`Content Length: ${msg.content?.length || 0} chars`);
        if (msg.tool_calls) {
          conversationEntry.push(`Tool Calls: ${msg.tool_calls.length}`);
          msg.tool_calls.forEach((tc: any, tcIndex: number) => {
            conversationEntry.push(`  Tool ${tcIndex + 1}: ${tc.function.name}`);
            conversationEntry.push(`  Args: ${tc.function.arguments.substring(0, 200)}${tc.function.arguments.length > 200 ? "..." : ""}`);
          });
        }
        if (msg.tool_call_id) {
          conversationEntry.push(`Tool Call ID: ${msg.tool_call_id}`);
        }
        conversationEntry.push("-".repeat(30));
        conversationEntry.push(msg.content || "(no content)");
        conversationEntry.push("-".repeat(30));
        conversationEntry.push("");
      });
      
      // Add available tools
      if (request.tools && request.tools.length > 0) {
        conversationEntry.push("AVAILABLE TOOLS:");
        request.tools.forEach((tool: any, index: number) => {
          conversationEntry.push(`${index + 1}. ${tool.function.name}: ${tool.function.description}`);
        });
        conversationEntry.push("");
      }
      
      conversationEntry.push("=".repeat(100));
      conversationEntry.push("");
      
      this.writeToConversationFiles(conversationId, 'plaintext', conversationEntry.join("\n"));
    }
  }

  logResponse(conversationId: string, response: any): void {
    const choice = response.choices?.[0];
    const message = choice?.message;
    
    const logEntry = {
      timestamp: this.getTimestamp(),
      type: "RESPONSE",
      conversationId,
      status: response.status || "unknown",
      choiceCount: response.choices?.length || 0,
      usage: response.usage,
      finishReason: choice?.finish_reason,
      message: {
        role: message?.role,
        contentLength: message?.content?.length || 0,
        contentPreview: message?.content?.substring(0, 200) || "",
        hasToolCalls: !!message?.tool_calls,
        toolCallsCount: message?.tool_calls?.length || 0,
        hasReasoning: !!(message as any)?.reasoning,
        reasoningLength: (message as any)?.reasoning?.length || 0,
        reasoningPreview: (message as any)?.reasoning?.substring(0, 100) || "",
        toolCalls: message?.tool_calls?.map((tc: any) => ({
          id: tc.id,
          type: tc.type,
          functionName: tc.function?.name,
          argsLength: tc.function?.arguments?.length || 0,
          argsPreview: tc.function?.arguments?.substring(0, 100) || ""
        })) || []
      },
      data: response, // Full response for detailed analysis
    };

    console.log(`[AILogger] RESPONSE - Conversation: ${conversationId}, Content: ${message?.content?.length || 0} chars, Tool calls: ${message?.tool_calls?.length || 0}`);
    this.writeToConversationFiles(conversationId, 'structured', JSON.stringify(logEntry, null, 2) + "\n" + "=".repeat(80));
    
    // Also log the raw response content to plaintext file for easier debugging
    if (message?.content) {
      const plaintextEntry = [
        "=".repeat(100),
        `TIMESTAMP: ${this.getTimestamp()}`,
        `CONVERSATION: ${conversationId}`,
        `CONTENT LENGTH: ${message.content.length}`,
        `HAS TOOL CALLS: ${!!message.tool_calls}`,
        `TOOL CALLS COUNT: ${message.tool_calls?.length || 0}`,
        "-".repeat(50),
        "RAW CONTENT:",
        message.content,
        "=".repeat(100),
        ""
      ].join("\n");
      
      this.writeToConversationFiles(conversationId, 'plaintext', plaintextEntry);
    }
  }

  logToolCall(
    conversationId: string,
    toolName: string,
    args: any,
    result: any
  ): void {
    const logEntry = {
      timestamp: this.getTimestamp(),
      type: "TOOL_CALL",
      conversationId,
      toolName,
      success: result?.success !== false,
      // Summarize args without potentially sensitive data
      argsSummary: {
        keys: args && typeof args === "object" ? Object.keys(args) : [],
        argsCount: args && typeof args === "object" ? Object.keys(args).length : 0,
        hasCode: !!args?.code,
        codeLength: args?.code?.length || 0,
        hasContent: !!args?.content,
        contentLength: args?.content?.length || 0,
        windowId: args?.windowId,
        language: args?.language,
        url: args?.url?.substring(0, 100), // Truncate URLs
      },
      // Summarize result
      resultSummary: {
        success: result?.success,
        hasData: result?.data !== undefined && result?.data !== null,
        dataType: typeof result?.data,
        error: result?.error,
        timestamp: result?.timestamp,
        windowId: result?.windowId,
        executionTime: result?.executionTime,
        outputLength: result?.output?.length || result?.data?.output?.length || 0,
      },
      args, // Full args for detailed analysis
      result, // Full result for detailed analysis
    };

    console.log(`[AILogger] TOOL_CALL - ${toolName}, Success: ${result?.success !== false}, Args: ${Object.keys(args || {}).join(", ")}`);
    this.writeToConversationFiles(conversationId, 'structured', JSON.stringify(logEntry, null, 2) + "\n" + "-".repeat(80));
  }

  logError(conversationId: string, error: any, context?: any): void {
    const logEntry = {
      timestamp: this.getTimestamp(),
      type: "ERROR",
      conversationId,
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : error,
      context: {
        ...context,
        // Add system context
        platform: process.platform,
        nodeVersion: process.version,
        pid: process.pid,
      },
    };

    console.error(`[AILogger] ERROR - Conversation: ${conversationId}, Error: ${error instanceof Error ? error.message : String(error)}`);
    this.writeToConversationFiles(conversationId, 'error', JSON.stringify(logEntry, null, 2) + "\n" + "!".repeat(80));
    
    // Also log to structured log for correlation
    const correlationEntry = `ERROR: ${JSON.stringify({
      timestamp: this.getTimestamp(),
      conversationId,
      errorMessage: error instanceof Error ? error.message : String(error),
      context: context?.toolName || context?.userMessage || "unknown"
    })}\n`;
    this.writeToConversationFiles(conversationId, 'structured', correlationEntry);
  }

  logMessage(conversationId: string, message: string, data?: any): void {
    const logEntry = {
      timestamp: this.getTimestamp(),
      type: "MESSAGE",
      conversationId,
      message,
      data,
    };

    this.writeToConversationFiles(conversationId, 'structured', JSON.stringify(logEntry, null, 2));
  }

  // Get the log file paths for debugging
  // New method to log JSON parsing issues
  logParsingIssue(conversationId: string, toolName: string, originalArgs: string, extractedArgs: any, method: string): void {
    const logEntry = {
      timestamp: this.getTimestamp(),
      type: "PARSING_ISSUE",
      conversationId,
      toolName,
      originalArgsLength: originalArgs.length,
      originalArgsPreview: originalArgs.substring(0, 200),
      extractedArgsKeys: Object.keys(extractedArgs),
      extractionMethod: method,
      data: {
        originalArgs,
        extractedArgs
      }
    };

    console.warn(`[AILogger] PARSING_ISSUE - ${toolName}, Method: ${method}, Extracted: ${Object.keys(extractedArgs).join(", ")}`);
    this.writeToConversationFiles(conversationId, 'structured', JSON.stringify(logEntry, null, 2) + "\n" + "?".repeat(80));
  }

  // New method to log response recovery attempts
  logResponseRecovery(conversationId: string, attempt: number, method: string, success: boolean, contentLength?: number): void {
    const logEntry = {
      timestamp: this.getTimestamp(),
      type: "RESPONSE_RECOVERY",
      conversationId,
      attempt,
      method,
      success,
      contentLength: contentLength || 0
    };

    console.log(`[AILogger] RESPONSE_RECOVERY - Attempt ${attempt}, Method: ${method}, Success: ${success}, Content: ${contentLength || 0} chars`);
    this.writeToConversationFiles(conversationId, 'structured', JSON.stringify(logEntry, null, 2) + "\n" + "~".repeat(80));
  }

  // New method to log session summary
  logSessionSummary(conversationId: string, stats: {
    totalRequests: number;
    totalToolCalls: number;
    totalErrors: number;
    parsingIssues: number;
    recoveryAttempts: number;
  }): void {
    const logEntry = {
      timestamp: this.getTimestamp(),
      type: "SESSION_SUMMARY",
      conversationId,
      stats
    };

    console.log(`[AILogger] SESSION_SUMMARY - Requests: ${stats.totalRequests}, Tools: ${stats.totalToolCalls}, Errors: ${stats.totalErrors}, Parsing Issues: ${stats.parsingIssues}`);
    this.writeToConversationFiles(conversationId, 'structured', JSON.stringify(logEntry, null, 2) + "\n" + "#".repeat(80));
  }

  // New method to log HTTP-level details
  logHttpExchange(conversationId: string, type: "REQUEST" | "RESPONSE", data: {
    url?: string;
    method?: string;
    status?: number;
    headers?: Record<string, string>;
    body?: any;
    timing?: number;
  }): void {
    const logEntry = {
      timestamp: this.getTimestamp(),
      type: `HTTP_${type}`,
      conversationId,
      ...data
    };

    console.log(`[AILogger] HTTP_${type} - ${data.method || 'GET'} ${data.url || 'unknown'} - Status: ${data.status || 'pending'}`);
    this.writeToConversationFiles(conversationId, 'structured', JSON.stringify(logEntry, null, 2) + "\n" + "*".repeat(80));
  }

  getLogPaths(): { globalLogFile: string; globalErrorLogFile: string } {
    return {
      globalLogFile: this.globalLogFile,
      globalErrorLogFile: this.globalErrorLogFile,
    };
  }

  getConversationLogPaths(conversationId: string): {
    structuredLog: string;
    plaintextLog: string;
    errorLog: string;
  } {
    return this.getConversationLogFiles(conversationId);
  }

  // Method to list all conversation log files
  listAllConversationLogs(): string[] {
    try {
      const files = fs.readdirSync(this.logDir);
      return files.filter(file => file.startsWith('conversation-')).sort();
    } catch (error) {
      console.error('Failed to list conversation logs:', error);
      return [];
    }
  }
}
