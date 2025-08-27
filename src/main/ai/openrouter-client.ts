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
  private defaultModel = "qwen/qwen3-235b-a22b:free";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async createChatCompletion(
    request: OpenRouterRequest
  ): Promise<OpenRouterResponse> {
    const url = `${this.baseUrl}/chat/completions`;

    const payload = {
      model: request.model || this.defaultModel,
      messages: request.messages,
      tools: request.tools,
      tool_choice: request.tool_choice || "auto",
      temperature: request.temperature || 0.7,
      max_tokens: request.max_tokens || 1000,
    };

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
      throw new Error(
        `OpenRouter API error: ${response.status} - ${
          errorData.error?.message || response.statusText
        }`
      );
    }

    return (await response.json()) as OpenRouterResponse;
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  setModel(model: string) {
    this.defaultModel = model;
  }
}
