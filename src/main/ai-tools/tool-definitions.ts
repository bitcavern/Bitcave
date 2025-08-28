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
    name: "createArtifact",
    description: "Create a new interactive artifact (web application/component). Use this for creating interactive tools like calculators, games, demos, data visualizations, MIDI controllers, todo apps, etc. This creates complete web applications with HTML, CSS, and JavaScript that run in a sandboxed environment.",
    parameters: {
      title: { type: "string", required: true, description: "Descriptive title for the artifact (e.g. 'MIDI Controller', 'Todo App', 'Calculator')" },
      description: { type: "string", required: true, description: "What this artifact does and its key features" },
      html: { type: "string", required: true, description: "Complete HTML structure with semantic elements, forms, buttons, etc. Include all necessary DOM elements for interactivity." },
      css: { type: "string", required: false, description: "CSS styles for layout, appearance, animations, and responsive design. Use modern CSS features." },
      javascript: { type: "string", required: false, description: "JavaScript code for interactivity, event handlers, data manipulation, and dynamic behavior. Can use modern ES6+ features." },
      dataTemplates: { type: "array", required: false, description: "Array of data template objects for persistent data storage (e.g. user settings, saved data, recorded tracks)" },
      dependencies: { type: "array", required: false, description: "External JavaScript library URLs (e.g. ['https://cdn.jsdelivr.net/npm/chart.js', 'https://unpkg.com/react@18/umd/react.production.min.js'])" },
    },
    openRouterTool: {
      type: "function",
      function: {
        name: "createArtifact",
        description: "Create a new interactive artifact (web application/component). Use this for creating interactive tools like calculators, games, demos, data visualizations, MIDI controllers, todo apps, etc. This creates complete web applications with HTML, CSS, and JavaScript that run in a sandboxed environment.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Descriptive title for the artifact (e.g. 'MIDI Controller', 'Todo App', 'Calculator')" },
            description: { type: "string", description: "What this artifact does and its key features" },
            html: { type: "string", description: "Complete HTML structure with semantic elements, forms, buttons, etc. Include all necessary DOM elements for interactivity." },
            css: { type: "string", description: "CSS styles for layout, appearance, animations, and responsive design. Use modern CSS features." },
            javascript: { type: "string", description: "JavaScript code for interactivity, event handlers, data manipulation, and dynamic behavior. Can use modern ES6+ features." },
            dataTemplates: { type: "array", items: { type: "object" }, description: "Array of data template objects for persistent data storage (e.g. user settings, saved data, recorded tracks)" },
            dependencies: { type: "array", items: { type: "string" }, description: "External JavaScript library URLs (e.g. ['https://cdn.jsdelivr.net/npm/chart.js', 'https://unpkg.com/react@18/umd/react.production.min.js'])" },
          },
          required: ["title", "description", "html"],
        },
      },
    },
  },
  {
    name: "createArtifactWindow",
    description: "**PRIMARY TOOL** Create and display an interactive web application in a window. Use this when users ask for: calculators, games, tools, widgets, MIDI controllers, todo apps, timers, charts, demos, or any interactive functionality. This creates a complete HTML/CSS/JS application and immediately shows it to the user in a dedicated window. ALWAYS use this instead of createArtifact when the user wants to see/use the artifact.",
    parameters: {
      title: { type: "string", required: true, description: "Clear, descriptive title (e.g. 'MIDI Piano Controller', 'Pomodoro Timer', 'Scientific Calculator')" },
      description: { type: "string", required: true, description: "Detailed explanation of what this artifact does and its key features" },
      html: { type: "string", required: true, description: "Complete HTML structure with all UI elements, buttons, forms, displays, etc. Use semantic HTML5 elements." },
      css: { type: "string", required: false, description: "Modern CSS for styling, layout, animations, hover effects, and responsive design. Make it look polished and professional." },
      javascript: { type: "string", required: false, description: "JavaScript for all interactivity, event handling, calculations, animations, and dynamic behavior. Use modern ES6+ syntax." },
      dataTemplates: { type: "array", required: false, description: "Data templates for persistent storage (e.g. [{id: 'settings', name: 'User Settings', defaultValue: {theme: 'dark'}, access: 'readwrite'}])" },
      dependencies: { type: "array", required: false, description: "CDN URLs for external libraries if needed (e.g. Chart.js, D3, Tone.js)" },
      windowPosition: { type: "object", required: false, description: "Window position as {x: number, y: number}, defaults to {x: 100, y: 100}" },
    },
    openRouterTool: {
      type: "function",
      function: {
        name: "createArtifactWindow",
        description: "**PRIMARY TOOL** Create and display an interactive web application in a window. Use this when users ask for: calculators, games, tools, widgets, MIDI controllers, todo apps, timers, charts, demos, or any interactive functionality. This creates a complete HTML/CSS/JS application and immediately shows it to the user in a dedicated window. ALWAYS use this instead of createArtifact when the user wants to see/use the artifact.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Clear, descriptive title (e.g. 'MIDI Piano Controller', 'Pomodoro Timer', 'Scientific Calculator')" },
            description: { type: "string", description: "Detailed explanation of what this artifact does and its key features" },
            html: { type: "string", description: "Complete HTML structure with all UI elements, buttons, forms, displays, etc. Use semantic HTML5 elements." },
            css: { type: "string", description: "Modern CSS for styling, layout, animations, hover effects, and responsive design. Make it look polished and professional." },
            javascript: { type: "string", description: "JavaScript for all interactivity, event handling, calculations, animations, and dynamic behavior. Use modern ES6+ syntax." },
            dataTemplates: { type: "array", items: { type: "object" }, description: "Data templates for persistent storage (e.g. [{id: 'settings', name: 'User Settings', defaultValue: {theme: 'dark'}, access: 'readwrite'}])" },
            dependencies: { type: "array", items: { type: "string" }, description: "CDN URLs for external libraries if needed (e.g. Chart.js, D3, Tone.js)" },
            windowPosition: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, description: "Window position as {x: number, y: number}, defaults to {x: 100, y: 100}" },
          },
          required: ["title", "description", "html"],
        },
      },
    },
  },
  {
    name: "createTextWindow",
    description:
      "Create a new text window with a label and optional initial content",
    parameters: {
      label: {
        type: "string",
        required: true,
        description: "Label/title for the text window",
      },
      content: {
        type: "string",
        required: false,
        description: "Initial content for the text window",
      },
    },
    openRouterTool: {
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
      mode: {
        type: "string",
        required: false,
        description: "How to apply content: replace, append, prepend",
      },
    },
    openRouterTool: {
      type: "function",
      function: {
        name: "updateTextByLabel",
        description:
          "Update the content of a specific text window identified by label",
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
      windowId: {
        type: "string",
        required: false,
        description: "Optional window id",
      },
      label: { type: "string", required: false, description: "Current label" },
      newLabel: { type: "string", required: true, description: "New label" },
    },
    openRouterTool: {
      type: "function",
      function: {
        name: "updateTextLabel",
        description:
          "Rename a text window label (and title) by id or current label",
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
      content: {
        type: "string",
        required: true,
        description: "New text content",
      },
      mode: {
        type: "string",
        required: false,
        description: "How to apply content: replace, append, prepend",
      },
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
      config: {
        type: "object",
        required: false,
        description: "Window configuration",
      },
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
    description:
      "Execute Python or JavaScript code in a secure sandbox environment. This tool automatically creates a code execution window (if needed), fills it with your code, runs the code, and returns the output. Perfect for running calculations, data processing, or testing code snippets.",
    parameters: {
      language: {
        type: "string",
        required: true,
        description:
          "Programming language to execute: 'python' or 'javascript'",
      },
      code: {
        type: "string",
        required: true,
        description: "The code to execute. Can be multiple lines.",
      },
      description: {
        type: "string",
        required: false,
        description:
          "Optional description of what the code does (will be used as window title)",
      },
    },
    openRouterTool: {
      type: "function",
      function: {
        name: "executeCode",
        description:
          "Execute Python or JavaScript code in a secure sandbox environment. This tool automatically creates a code execution window (if needed), fills it with your code, runs the code, and returns the output. Perfect for running calculations, data processing, or testing code snippets.",
        parameters: {
          type: "object",
          properties: {
            language: {
              type: "string",
              enum: ["python", "javascript", "js"],
              description:
                "Programming language to execute: 'python' or 'javascript'",
            },
            code: {
              type: "string",
              description: "The code to execute. Can be multiple lines.",
            },
            description: {
              type: "string",
              description:
                "Optional description of what the code does (will be used as window title)",
            },
          },
          required: ["language", "code"],
        },
      },
    },
  },
  {
    name: "parseWebviewContent",
    description:
      "Parse and extract readable content from a webview window. This tool fetches the HTML content from a webview, removes scripts and styles, and converts it to clean markdown text that can be easily read and analyzed.",
    parameters: {
      windowId: {
        type: "string",
        required: true,
        description: "ID of the webview window to parse",
      },
    },
    openRouterTool: {
      type: "function",
      function: {
        name: "parseWebviewContent",
        description:
          "Parse and extract readable content from a webview window. This tool fetches the HTML content from a webview, removes scripts and styles, and converts it to clean markdown text that can be easily read and analyzed.",
        parameters: {
          type: "object",
          properties: {
            windowId: {
              type: "string",
              description: "The ID of the webview window to parse",
            },
          },
          required: ["windowId"],
        },
      },
    },
  },
  {
    name: "setWebviewUrl",
    description:
      "Set the URL for a webview window to navigate to a specific webpage",
    parameters: {
      windowId: {
        type: "string",
        required: true,
        description: "ID of the webview window",
      },
      url: {
        type: "string",
        required: true,
        description: "URL to navigate to",
      },
    },
    openRouterTool: {
      type: "function",
      function: {
        name: "setWebviewUrl",
        description:
          "Set the URL for a webview window to navigate to a specific webpage",
        parameters: {
          type: "object",
          properties: {
            windowId: {
              type: "string",
              description: "The ID of the webview window",
            },
            url: {
              type: "string",
              description: "The URL to navigate to",
            },
          },
          required: ["windowId", "url"],
        },
      },
    },
  },
  {
    name: "multiStepPlan",
    description:
      "Create a multi-step plan for complex tasks that require multiple tool calls. Use this when you need to break down a complex task into sequential steps.",
    parameters: {
      task: {
        type: "string",
        required: true,
        description: "The task to create a plan for",
      },
      steps: {
        type: "array",
        required: true,
        description: "Array of step descriptions",
      },
    },
    openRouterTool: {
      type: "function",
      function: {
        name: "multiStepPlan",
        description:
          "Create a multi-step plan for complex tasks that require multiple tool calls. Use this when you need to break down a complex task into sequential steps.",
        parameters: {
          type: "object",
          properties: {
            task: {
              type: "string",
              description: "The task to create a plan for",
            },
            steps: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Array of step descriptions",
            },
          },
          required: ["task", "steps"],
        },
      },
    },
  },
];

/**
 * Get all tool definitions in OpenRouter format for use with AI chat completions
 */
export function getOpenRouterToolDefinitions(): Tool[] {
  return TOOL_DEFINITIONS.map((def) => def.openRouterTool);
}

/**
 * Get a specific tool definition by name
 */
export function getToolDefinition(name: string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS.find((def) => def.name === name);
}

/**
 * Get all available tool names
 */
export function getAvailableToolNames(): string[] {
  return TOOL_DEFINITIONS.map((def) => def.name);
}
