import { AILogger } from "./logger";

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface Tool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, any>;
      required: string[];
    };
  };
}

export interface OpenRouterRequest {
  model?: string;
  messages: OpenRouterMessage[];
  tools?: Tool[];
  tool_choice?:
    | "auto"
    | "none"
    | { type: "function"; function: { name: string } };
  temperature?: number;
  max_tokens?: number;
}

export interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenRouterClient {
  private apiKey: string;
  private baseUrl = "https://openrouter.ai/api/v1";
  // private defaultModel = "z-ai/glm-4.5-air:free";
  // private defaultModel = "x-ai/grok-code-fast-1";
  private defaultModel = "anthropic/claude-sonnet-4";
  private logger?: AILogger;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  setLogger(logger: AILogger) {
    this.logger = logger;
  }

  async createChatCompletion(
    request: OpenRouterRequest
  ): Promise<OpenRouterResponse> {
    const url = `${this.baseUrl}/chat/completions`;

    const payload = {
      model: request.model || this.defaultModel,
      reasoning: {
        type: "disabled",
      },
      messages: request.messages,
      tools: request.tools,
      tool_choice: request.tool_choice || "auto",
      temperature: request.temperature || 0.7,
      max_tokens: request.max_tokens || 1000,
    };

    // Log the raw API request
    if (this.logger) {
      this.logger.logMessage("openrouter", "API Request", {
        url,
        model: payload.model,
        messageCount: payload.messages.length,
        toolCount: payload.tools?.length || 0,
        temperature: payload.temperature,
        maxTokens: payload.max_tokens,
        toolChoice: payload.tool_choice,
        reasoning: payload.reasoning,
        fullPayload: payload, // Complete payload for detailed analysis
        headers: {
          Authorization: "Bearer [REDACTED]",
          "Content-Type": "application/json",
          "HTTP-Referer": "https://bitcave.app",
          "X-Title": "Bitcave AI Dashboard",
        },
      });
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://bitcave.app", // Optional: for analytics
        "X-Title": "Bitcave AI Dashboard", // Optional: for analytics
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as any;
      const error = new Error(
        `OpenRouter API error: ${response.status} - ${
          errorData.error?.message || response.statusText
        }`
      );

      // Log the error
      if (this.logger) {
        this.logger.logError("openrouter", error, {
          status: response.status,
          statusText: response.statusText,
          errorData,
        });
      }

      throw error;
    }

    const responseData = (await response.json()) as OpenRouterResponse;

    // Log the raw API response
    if (this.logger) {
      const choice = responseData.choices?.[0];
      const message = choice?.message;

      this.logger.logMessage("openrouter", "API Response", {
        status: response.status,
        model: responseData.model,
        id: responseData.id,
        created: responseData.created,
        usage: responseData.usage,
        finishReason: choice?.finish_reason,
        contentLength: message?.content?.length || 0,
        hasToolCalls: !!message?.tool_calls,
        toolCallsCount: message?.tool_calls?.length || 0,
        contentPreview: message?.content?.substring(0, 200) || "",
        fullResponse: responseData, // Complete response for detailed analysis
      });
    }

    return responseData;
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  setModel(model: string) {
    this.defaultModel = model;
  }
}
