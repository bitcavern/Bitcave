import type { Tool } from "../ai/openrouter-client";

/**
 * Centralized tool definitions for AI integration.
 * This ensures consistency between AIToolRegistry implementations and AIService tool descriptions.
 */

export interface ToolDefinition {
  // Registry info - used by AIToolRegistry
  name: string;
  description: string;
  parameters: Record<string, any>;
  
  // OpenRouter format - used by AIService
  openRouterTool: Tool;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "createTextWindow",
    description: "Create a new text window with a label and optional initial content",
    parameters: {
      label: { type: "string", required: true, description: "Label/title for the text window" },
      content: { type: "string", required: false, description: "Initial content for the text window" },
    },
    openRouterTool: {
      type: "function",
      function: {
        name: "createTextWindow",
        description: "Create a new text window with a label and optional initial content",
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
  },
  {
    name: "readTextByLabel",
    description: "Read the content from a text window by label",
    parameters: {
      label: { type: "string", required: true, description: "Window label" },
    },
    openRouterTool: {
      type: "function",
      function: {
        name: "readTextByLabel",
        description: "Read the content from a text window by label",
        parameters: {
          type: "object",
          properties: {
            label: {
              type: "string",
              description: "The label of the text window to read from",
            },
          },
          required: ["label"],
        },
      },
    },
  },
  {
    name: "updateTextByLabel",
    description: "Update the content of a text window identified by label",
    parameters: {
      label: { type: "string", required: true, description: "Window label" },
      content: { type: "string", required: true, description: "Content" },
      mode: { type: "string", required: false, description: "How to apply content: replace, append, prepend" },
    },
    openRouterTool: {
      type: "function",
      function: {
        name: "updateTextByLabel",
        description: "Update the content of a specific text window identified by label",
        parameters: {
          type: "object",
          properties: {
            label: {
              type: "string",
              description: "The label of the text window to update",
            },
            content: {
              type: "string",
              description: "The new content for the text window",
            },
            mode: {
              type: "string",
              enum: ["replace", "append", "prepend"],
              description: "How to apply the content update",
            },
          },
          required: ["label", "content"],
        },
      },
    },
  },
  {
    name: "updateTextLabel",
    description: "Update the label (and title) of a text window by id or label",
    parameters: {
      windowId: { type: "string", required: false, description: "Optional window id" },
      label: { type: "string", required: false, description: "Current label" },
      newLabel: { type: "string", required: true, description: "New label" },
    },
    openRouterTool: {
      type: "function",
      function: {
        name: "updateTextLabel",
        description: "Rename a text window label (and title) by id or current label",
        parameters: {
          type: "object",
          properties: {
            windowId: { type: "string", description: "Optional window id" },
            label: { type: "string", description: "Current label" },
            newLabel: { type: "string", description: "New label" },
          },
          required: ["newLabel"],
        },
      },
    },
  },
  {
    name: "listTextWindows",
    description: "Get a list of all text windows with their labels and IDs",
    parameters: {},
    openRouterTool: {
      type: "function",
      function: {
        name: "listTextWindows",
        description: "Get a list of all text windows with their labels and IDs",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    },
  },
  {
    name: "readTextContent",
    description: "Read the content from a text window",
    parameters: {
      windowId: { type: "string", required: true, description: "Window ID" },
    },
    openRouterTool: {
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
  },
  {
    name: "updateTextContent",
    description: "Update the content of a text window",
    parameters: {
      windowId: { type: "string", required: true, description: "Window ID" },
      content: { type: "string", required: true, description: "New text content" },
      mode: { type: "string", required: false, description: "How to apply content: replace, append, prepend" },
    },
    openRouterTool: {
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
  },
  {
    name: "getWindowList",
    description: "Get a list of all windows and their states",
    parameters: {},
    openRouterTool: {
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
  },
  {
    name: "createWindow",
    description: "Create a new window of the specified type",
    parameters: {
      type: { type: "string", required: true, description: "Window type" },
      config: { type: "object", required: false, description: "Window configuration" },
    },
    openRouterTool: {
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
  },
  {
    name: "executeCode",
    description: "Execute Python or JavaScript code in a secure sandbox environment. This tool automatically creates a code execution window (if needed), fills it with your code, runs the code, and returns the output. Perfect for running calculations, data processing, or testing code snippets.",
    parameters: {
      language: {
        type: "string",
        required: true,
        description: "Programming language to execute: 'python' or 'javascript'",
      },
      code: {
        type: "string", 
        required: true,
        description: "The code to execute. Can be multiple lines.",
      },
      description: {
        type: "string",
        required: false,
        description: "Optional description of what the code does (will be used as window title)",
      },
    },
    openRouterTool: {
      type: "function",
      function: {
        name: "executeCode",
        description: "Execute Python or JavaScript code in a secure sandbox environment. This tool automatically creates a code execution window (if needed), fills it with your code, runs the code, and returns the output. Perfect for running calculations, data processing, or testing code snippets.",
        parameters: {
          type: "object",
          properties: {
            language: {
              type: "string",
              enum: ["python", "javascript", "js"],
              description: "Programming language to execute: 'python' or 'javascript'",
            },
            code: {
              type: "string",
              description: "The code to execute. Can be multiple lines.",
            },
            description: {
              type: "string",
              description: "Optional description of what the code does (will be used as window title)",
            },
          },
          required: ["language", "code"],
        },
      },
    },
  },
];

/**
 * Get all tool definitions in OpenRouter format for use with AI chat completions
 */
export function getOpenRouterToolDefinitions(): Tool[] {
  return TOOL_DEFINITIONS.map(def => def.openRouterTool);
}

/**
 * Get a specific tool definition by name
 */
export function getToolDefinition(name: string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS.find(def => def.name === name);
}

/**
 * Get all available tool names
 */
export function getAvailableToolNames(): string[] {
  return TOOL_DEFINITIONS.map(def => def.name);
}