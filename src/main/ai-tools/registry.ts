import type {
  AIToolResponse,
  WindowType,
  CodeExecutionRequest,
} from "@/shared/types";
import type { WindowManager } from "../window-manager";
import { BrowserWindow } from "electron";
import { WINDOW_CONFIGS } from "@/shared/constants";
import { CodeExecutionSandbox } from "../code-execution/sandbox";
import * as cheerio from "cheerio";
import TurndownService from "turndown";

export interface AITool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (params: any, windowId?: string) => Promise<any>;
}

export class AIToolRegistry {
  private tools: Map<string, AITool> = new Map();
  private windowManager: WindowManager;
  private codeExecutionSandbox: CodeExecutionSandbox;
  private mainWindow: BrowserWindow | null = null;
  private multiStepPlans: Map<
    string,
    {
      task: string;
      steps: string[];
      currentStep: number;
      results: any[];
    }
  > = new Map();

  constructor(windowManager: WindowManager) {
    this.windowManager = windowManager;
    this.codeExecutionSandbox = new CodeExecutionSandbox();
    this.registerDefaultTools();
  }

  public setMainWindow(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;
    this.codeExecutionSandbox.setMainWindow(mainWindow);
  }

  public registerTool(tool: AITool): void {
    this.tools.set(tool.name, tool);
  }

  public async executeTool(
    toolName: string,
    parameters: any,
    windowId?: string
  ): Promise<AIToolResponse> {
    console.log(
      `[AIToolRegistry] Executing tool: ${toolName} with parameters:`,
      parameters
    );

    const tool = this.tools.get(toolName);
    console.log(`[AIToolRegistry] Tool found:`, !!tool);

    if (!tool) {
      return {
        success: false,
        data: null,
        error: `Tool '${toolName}' not found`,
        timestamp: new Date().toISOString(),
        windowId: windowId || null,
      };
    }

    try {
      console.log(`[AIToolRegistry] Executing tool function for: ${toolName}`);
      const result = await tool.execute(parameters, windowId);
      console.log(
        `[AIToolRegistry] Tool execution successful for ${toolName}:`,
        result
      );

      return {
        success: true,
        data: result,
        error: null,
        timestamp: new Date().toISOString(),
        windowId: windowId || null,
      };
    } catch (error) {
      console.error(
        `[AIToolRegistry] Tool execution failed for ${toolName}:`,
        error
      );
      return {
        success: false,
        data: null,
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
        windowId: windowId || null,
      };
    }
  }

  public getAvailableTools(): string[] {
    return Array.from(this.tools.keys());
  }

  public getToolDescription(toolName: string): AITool | undefined {
    return this.tools.get(toolName);
  }

  public dispose(): void {
    this.codeExecutionSandbox.dispose();
  }

  private registerDefaultTools(): void {
    // Window Management Tools
    this.registerTool({
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
      execute: async (params) => {
        const issues: string[] = [];

        // Validate type, fallback to "text" if invalid
        const requestedType = String(params?.type ?? "");
        const isValidType = requestedType in WINDOW_CONFIGS;
        const type: WindowType = (
          isValidType ? requestedType : "text"
        ) as WindowType;
        if (!isValidType) {
          issues.push(
            `Invalid window type '${requestedType}'. Falling back to 'text'.`
          );
        }

        // Sanitize config
        const sanitized = this.sanitizeWindowConfig(
          type,
          params?.config,
          issues
        );

        // Ensure proper labeling for all window types
        if (
          !sanitized.title ||
          sanitized.title === `${type[0].toUpperCase()}${type.slice(1)} Window`
        ) {
          const generateUntitledLabel = (windowType: WindowType): string => {
            const existingWindows =
              this.windowManager.getWindowsByType(windowType);
            let index = 1;
            let proposedName = `Untitled ${index}`;

            // Find the next available number
            while (
              existingWindows.some(
                (w) =>
                  w.title === proposedName || w.metadata?.label === proposedName
              )
            ) {
              index++;
              proposedName = `Untitled ${index}`;
            }

            return proposedName;
          };

          const untitledLabel = generateUntitledLabel(type);
          sanitized.title = untitledLabel;
          sanitized.metadata = {
            ...sanitized.metadata,
            label: untitledLabel,
          };
        }

        const window = await this.windowManager.createWindow(type, sanitized);

        if (issues.length > 0) {
          console.warn(
            "[AIToolRegistry] createWindow sanitization issues:",
            issues
          );
          this.showToast(
            "AI provided invalid window config. Used safe defaults (see console)."
          );
        }

        this.triggerWindowCreated(window);
        return window;
      },
    });

    this.registerTool({
      name: "deleteWindow",
      description: "Delete a window by ID",
      parameters: {
        windowId: {
          type: "string",
          required: true,
          description: "Window ID to delete",
        },
      },
      execute: async (params) => {
        await this.windowManager.deleteWindow(params.windowId);
        return { deleted: true };
      },
    });

    this.registerTool({
      name: "moveWindow",
      description: "Move a window to a new position",
      parameters: {
        windowId: { type: "string", required: true, description: "Window ID" },
        position: {
          type: "object",
          required: true,
          description: "New position {x, y}",
        },
      },
      execute: async (params) => {
        return await this.windowManager.moveWindow(
          params.windowId,
          params.position
        );
      },
    });

    this.registerTool({
      name: "resizeWindow",
      description: "Resize a window",
      parameters: {
        windowId: { type: "string", required: true, description: "Window ID" },
        size: {
          type: "object",
          required: true,
          description: "New size {width, height}",
        },
      },
      execute: async (params) => {
        return await this.windowManager.resizeWindow(
          params.windowId,
          params.size
        );
      },
    });

    this.registerTool({
      name: "setWindowTitle",
      description: "Set the title of a window",
      parameters: {
        windowId: { type: "string", required: true, description: "Window ID" },
        title: { type: "string", required: true, description: "New title" },
      },
      execute: async (params) => {
        return await this.windowManager.setWindowTitle(
          params.windowId,
          params.title
        );
      },
    });

    this.registerTool({
      name: "lockWindow",
      description: "Lock a window to prevent user modifications",
      parameters: {
        windowId: { type: "string", required: true, description: "Window ID" },
      },
      execute: async (params) => {
        return await this.windowManager.lockWindow(params.windowId);
      },
    });

    this.registerTool({
      name: "unlockWindow",
      description: "Unlock a window to allow user modifications",
      parameters: {
        windowId: { type: "string", required: true, description: "Window ID" },
      },
      execute: async (params) => {
        return await this.windowManager.unlockWindow(params.windowId);
      },
    });

    this.registerTool({
      name: "minimizeWindow",
      description: "Minimize a window",
      parameters: {
        windowId: { type: "string", required: true, description: "Window ID" },
      },
      execute: async (params) => {
        return await this.windowManager.minimizeWindow(params.windowId);
      },
    });

    this.registerTool({
      name: "restoreWindow",
      description: "Restore a minimized window",
      parameters: {
        windowId: { type: "string", required: true, description: "Window ID" },
      },
      execute: async (params) => {
        return await this.windowManager.restoreWindow(params.windowId);
      },
    });

    this.registerTool({
      name: "bringToFront",
      description: "Bring a window to the front",
      parameters: {
        windowId: { type: "string", required: true, description: "Window ID" },
      },
      execute: async (params) => {
        return await this.windowManager.bringToFront(params.windowId);
      },
    });

    this.registerTool({
      name: "tileWindows",
      description: "Arrange multiple windows in a tiled layout",
      parameters: {
        windowIds: {
          type: "array",
          required: true,
          description: "Array of window IDs",
        },
        layout: {
          type: "string",
          required: false,
          description: "Layout type: grid, horizontal, vertical",
        },
      },
      execute: async (params) => {
        return await this.windowManager.tileWindows(
          params.windowIds,
          params.layout || "grid"
        );
      },
    });

    // State Query Tools
    this.registerTool({
      name: "getWindowList",
      description: "Get a list of all windows and their states",
      parameters: {},
      execute: async () => {
        return this.windowManager.getAllWindows();
      },
    });

    this.registerTool({
      name: "getWindowContent",
      description: "Get the content of a specific window",
      parameters: {
        windowId: { type: "string", required: true, description: "Window ID" },
      },
      execute: async (params) => {
        const window = this.windowManager.getWindow(params.windowId);
        if (!window) {
          throw new Error(`Window with id ${params.windowId} not found`);
        }
        return window;
      },
    });

    this.registerTool({
      name: "searchWindows",
      description: "Search for windows by title, type, or metadata",
      parameters: {
        query: { type: "string", required: true, description: "Search query" },
      },
      execute: async (params) => {
        return this.windowManager.searchWindows(params.query);
      },
    });

    this.registerTool({
      name: "exportWindowState",
      description: "Export the complete state of a window",
      parameters: {
        windowId: { type: "string", required: true, description: "Window ID" },
      },
      execute: async (params) => {
        return this.windowManager.exportWindowState(params.windowId);
      },
    });

    this.registerTool({
      name: "getSystemMetrics",
      description: "Get system performance and usage metrics",
      parameters: {},
      execute: async () => {
        return this.windowManager.getSystemMetrics();
      },
    });

    // Canvas Tools
    this.registerTool({
      name: "getCanvasState",
      description: "Get the current canvas viewport and state",
      parameters: {},
      execute: async () => {
        // This would normally get the actual canvas state
        // For now, return a default state
        return {
          viewport: { x: 0, y: 0, zoom: 1.0 },
          dimensions: { width: 1400, height: 900 },
          windowCount: this.windowManager.getAllWindows().length,
        };
      },
    });

    // Content Manipulation Tools (placeholders for now)
    this.registerTool({
      name: "setWebviewUrl",
      description: "Set the URL of a webview window",
      parameters: {
        windowId: { type: "string", required: true, description: "Window ID" },
        url: { type: "string", required: true, description: "URL to load" },
      },
      execute: async (params) => {
        // This will be implemented when we have webview windows
        const window = this.windowManager.getWindow(params.windowId);
        if (!window) {
          throw new Error(`Window with id ${params.windowId} not found`);
        }

        if (window.type !== "webview" && window.type !== "reference-webview") {
          throw new Error(`Window ${params.windowId} is not a webview window`);
        }

        // Update window metadata with the URL
        return await this.windowManager.updateWindow(params.windowId, {
          metadata: {
            ...window.metadata,
            url: params.url,
            lastLoaded: new Date().toISOString(),
          },
        });
      },
    });

    this.registerTool({
      name: "updateMarkdownContent",
      description: "Update the content of a markdown editor window",
      parameters: {
        windowId: { type: "string", required: true, description: "Window ID" },
        content: {
          type: "string",
          required: true,
          description: "Markdown content",
        },
      },
      execute: async (params) => {
        const window = this.windowManager.getWindow(params.windowId);
        if (!window) {
          throw new Error(`Window with id ${params.windowId} not found`);
        }

        if (window.type !== "markdown-editor") {
          throw new Error(
            `Window ${params.windowId} is not a markdown editor window`
          );
        }

        return await this.windowManager.updateWindow(params.windowId, {
          metadata: {
            ...window.metadata,
            content: params.content,
            lastModified: new Date().toISOString(),
          },
        });
      },
    });

    this.registerTool({
      name: "createTextWindow",
      description: "Create a new text window with optional label and content",
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
      execute: async (params) => {
        const issues: string[] = [];

        // Generate numbered untitled labels
        const generateUntitledLabel = (): string => {
          const textWindows = this.windowManager.getWindowsByType("text");
          let index = 1;
          let proposedName = `Untitled ${index}`;

          // Find the next available number
          while (
            textWindows.some(
              (w) =>
                w.title === proposedName || w.metadata?.label === proposedName
            )
          ) {
            index++;
            proposedName = `Untitled ${index}`;
          }

          return proposedName;
        };

        const safeLabel =
          params?.label && String(params.label).trim()
            ? this.safeString(params.label, "Untitled", issues, {
                field: "label",
              })
            : generateUntitledLabel();

        const safeContent = this.safeString(params?.content, "", issues, {
          field: "content",
        });

        const window = await this.windowManager.createWindow("text", {
          title: safeLabel,
          metadata: {
            label: safeLabel,
            content: safeContent,
          },
        });

        if (issues.length > 0) {
          console.warn(
            "[AIToolRegistry] createTextWindow sanitization issues:",
            issues
          );
          this.showToast(
            "AI provided invalid text window data. Used safe defaults (see console)."
          );
        }

        this.triggerWindowCreated(window);
        return window;
      },
    });

    this.registerTool({
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
      execute: async (params) => {
        const window = this.windowManager.getWindow(params.windowId);
        if (!window) {
          throw new Error(`Window with id ${params.windowId} not found`);
        }

        if (window.type !== "text") {
          throw new Error(`Window ${params.windowId} is not a text window`);
        }

        const existing = String(window.metadata?.content || "");
        const mode = (params.mode as string) || "replace";
        let nextContent = String(params.content);
        if (mode === "append") nextContent = existing + nextContent;
        if (mode === "prepend") nextContent = nextContent + existing;

        const updated = await this.windowManager.updateWindow(params.windowId, {
          metadata: {
            ...window.metadata,
            content: nextContent,
            lastModified: new Date().toISOString(),
          },
        });
        this.triggerWindowUpdated(updated);
        return updated;
      },
    });

    this.registerTool({
      name: "readTextContent",
      description: "Read the content from a text window",
      parameters: {
        windowId: { type: "string", required: true, description: "Window ID" },
      },
      execute: async (params) => {
        const window = this.windowManager.getWindow(params.windowId);
        if (!window) {
          throw new Error(`Window with id ${params.windowId} not found`);
        }

        if (window.type !== "text") {
          throw new Error(`Window ${params.windowId} is not a text window`);
        }

        return {
          windowId: window.id,
          label: window.metadata?.label || "Untitled",
          content: window.metadata?.content || "",
          lastModified: window.metadata?.lastModified,
        };
      },
    });

    // Read text by label
    this.registerTool({
      name: "readTextByLabel",
      description: "Read the content from a text window by its label",
      parameters: {
        label: { type: "string", required: true, description: "Window label" },
      },
      execute: async (params) => {
        const match = this.findTextWindowByLabel(params.label);
        if (!match)
          throw new Error(`No text window found with label '${params.label}'`);
        return {
          windowId: match.id,
          label: match.metadata?.label || "Untitled",
          content: match.metadata?.content || "",
          lastModified: match.metadata?.lastModified,
        };
      },
    });

    this.registerTool({
      name: "listTextWindows",
      description: "Get a list of all text windows with their labels and IDs",
      parameters: {},
      execute: async () => {
        const textWindows = this.windowManager.getWindowsByType("text");
        return textWindows.map((window) => ({
          id: window.id,
          label: window.metadata?.label || "Untitled",
          title: window.title,
          hasContent: !!(
            window.metadata?.content && window.metadata.content.trim()
          ),
          lastModified: window.metadata?.lastModified,
        }));
      },
    });

    // Update text by label
    this.registerTool({
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
      execute: async (params) => {
        const match = this.findTextWindowByLabel(params.label);
        if (!match)
          throw new Error(`No text window found with label '${params.label}'`);
        const existing = String(match.metadata?.content || "");
        const mode = (params.mode as string) || "replace";
        let nextContent = String(params.content);
        if (mode === "append") nextContent = existing + nextContent;
        if (mode === "prepend") nextContent = nextContent + existing;
        const updated = await this.windowManager.updateWindow(match.id, {
          metadata: {
            ...match.metadata,
            content: nextContent,
            lastModified: new Date().toISOString(),
          },
        });
        this.triggerWindowUpdated(updated);
        return updated;
      },
    });

    // Update text label (by id or label)
    this.registerTool({
      name: "updateTextLabel",
      description:
        "Update the label (and title) of a text window by id or label",
      parameters: {
        windowId: { type: "string", required: false, description: "Window ID" },
        label: {
          type: "string",
          required: false,
          description: "Current label",
        },
        newLabel: { type: "string", required: true, description: "New label" },
      },
      execute: async (params) => {
        let target = null as any;
        if (params.windowId) {
          target = this.windowManager.getWindow(params.windowId);
          if (!target) throw new Error(`Window ${params.windowId} not found`);
        } else if (params.label) {
          target = this.findTextWindowByLabel(params.label);
          if (!target)
            throw new Error(
              `No text window found with label '${params.label}'`
            );
        } else {
          throw new Error("Provide windowId or label");
        }
        if (target.type !== "text")
          throw new Error(`Window ${target.id} is not a text window`);
        const newLabel = String(params.newLabel);
        const updated = await this.windowManager.updateWindow(target.id, {
          title: newLabel,
          metadata: { ...target.metadata, label: newLabel },
        });
        this.triggerWindowUpdated(updated);
        return updated;
      },
    });

    // Code Execution Tool
    this.registerTool({
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
      execute: async (params) => {
        // Validate language
        const language = params.language?.toLowerCase();
        if (!language || !["python", "javascript", "js"].includes(language)) {
          throw new Error("Language must be 'python' or 'javascript'");
        }

        // Normalize language
        const normalizedLanguage = language === "js" ? "javascript" : language;

        // Validate code
        const code = params.code;
        if (!code || typeof code !== "string" || !code.trim()) {
          throw new Error("Code is required and must be a non-empty string");
        }

        // Create execution request
        const request: CodeExecutionRequest = {
          language: normalizedLanguage as "python" | "javascript",
          code: code.trim(),
          timeout: normalizedLanguage === "python" ? 10000 : 5000, // 10s for Python, 5s for JS
          memoryLimit: normalizedLanguage === "python" ? 256 : 128, // 256MB for Python, 128MB for JS
        };

        // Execute code
        const result = await this.codeExecutionSandbox.executeCode(request);

        // Generate smart label from code content
        const generateLabel = (
          code: string,
          language: string,
          description?: string
        ): string => {
          if (description) return description;

          // Extract meaningful information from code
          const firstLine = code.trim().split("\n")[0];
          const codeSnippet =
            firstLine.length > 40
              ? firstLine.substring(0, 37) + "..."
              : firstLine;

          // Look for common patterns
          if (code.includes("import ") || code.includes("from ")) {
            return `${language} Analysis`;
          } else if (
            code.includes("plot") ||
            code.includes("graph") ||
            code.includes("chart")
          ) {
            return `${language} Visualization`;
          } else if (code.includes("def ") || code.includes("function ")) {
            return `${language} Function`;
          } else if (
            codeSnippet.includes("print") ||
            codeSnippet.includes("console.log")
          ) {
            return `${language} Output`;
          } else {
            return `${language}: ${codeSnippet}`;
          }
        };

        // Check for existing code execution window or create new one
        const existingCodeWindows =
          this.windowManager.getWindowsByType("code-execution");
        let window;

        if (existingCodeWindows.length > 0) {
          // Reuse the most recent code execution window
          window = existingCodeWindows[existingCodeWindows.length - 1];

          // Update the window with new code and results
          const label = generateLabel(
            request.code,
            normalizedLanguage.charAt(0).toUpperCase() +
              normalizedLanguage.slice(1),
            params.description
          );
          const updatedHistory = [
            {
              id: Date.now().toString(),
              request,
              result,
              timestamp: new Date(),
            },
            ...(window.metadata?.history || []).slice(0, 9), // Keep last 10 executions
          ];

          await this.windowManager.updateWindow(window.id, {
            title: label,
            metadata: {
              ...window.metadata,
              label: label,
              code: request.code,
              language: request.language,
              lastExecution: {
                request,
                result,
                timestamp: new Date().toISOString(),
              },
              history: updatedHistory,
            },
          });

          // Get the updated window
          window = await this.windowManager.getWindow(window.id);

          // Trigger window updated event so frontend refreshes
          this.triggerWindowUpdated(window);
        } else {
          // Create new code execution window
          const label = generateLabel(
            request.code,
            normalizedLanguage.charAt(0).toUpperCase() +
              normalizedLanguage.slice(1),
            params.description
          );
          window = await this.windowManager.createWindow("code-execution", {
            title: label,
            metadata: {
              label: label,
              code: request.code,
              language: request.language,
              lastExecution: {
                request,
                result,
                timestamp: new Date().toISOString(),
              },
              history: [
                {
                  id: Date.now().toString(),
                  request,
                  result,
                  timestamp: new Date(),
                },
              ],
            },
          });

          this.triggerWindowCreated(window);
        }

        // Return execution result with window info
        if (!window) {
          throw new Error("Failed to create or update code execution window");
        }

        return {
          success: result.success,
          output: result.output,
          error: result.error,
          executionTime: result.executionTime,
          windowId: window.id,
          language: request.language,
          code: request.code,
          timestamp: new Date().toISOString(),
        };
      },
    });

    // Web Content Parser Tool
    this.registerTool({
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
      execute: async (params) => {
        const window = this.windowManager.getWindow(params.windowId);
        if (!window) {
          throw new Error(`Window with id ${params.windowId} not found`);
        }

        if (window.type !== "webview" && window.type !== "reference-webview") {
          throw new Error(`Window ${params.windowId} is not a webview window`);
        }

        const url = window.metadata?.url;
        if (!url) {
          throw new Error(`Webview window ${params.windowId} has no URL set`);
        }

        try {
          // Get the HTML content directly from the BrowserView
          const { bitcaveApp } = require("../main");
          const webviewManager = bitcaveApp?.getWebviewManager();
          if (!webviewManager) {
            throw new Error("Webview manager not available");
          }

          const html = await webviewManager.getWebviewContent(params.windowId);

          // Parse HTML with cheerio
          const $ = cheerio.load(html);

          // Remove only truly non-content elements
          $("script").remove();
          $("style").remove();
          $("noscript").remove();
          $("iframe").remove();
          $("svg").remove(); // Remove SVG icons that might clutter content

          // Remove only obvious ad containers, not content that might have "ad" in class names
          $('[class*="advertisement"]').remove();
          $('[class*="adsense"]').remove();
          $('[class*="google-ad"]').remove();
          $('[id*="google-ad"]').remove();
          $('[id*="adsense"]').remove();

          // Get the cleaned HTML - prefer body content, fallback to full HTML
          const cleanedHtml = $("body").html() || $("html").html() || html;

          // Convert to markdown with more content preservation
          const turndownService = new TurndownService({
            headingStyle: "atx",
            codeBlockStyle: "fenced",
            emDelimiter: "*",
            bulletListMarker: "-",
            strongDelimiter: "**",
            linkStyle: "inlined",
            linkReferenceStyle: "full",
          });

          // Configure turndown to handle common elements
          turndownService.addRule("codeBlocks", {
            filter: ["pre"],
            replacement: function (content, node) {
              const element = node as HTMLElement;
              const firstChild = element.children?.[0] as HTMLElement;
              const code =
                firstChild?.tagName === "code"
                  ? firstChild.textContent || ""
                  : content;
              const language =
                firstChild?.className?.match(/language-(\w+)/)?.[1] || "";
              return `\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;
            },
          });

          const markdown = turndownService.turndown(cleanedHtml);

          // Minimal markdown cleaning - preserve most content
          const cleanedMarkdown = markdown
            .replace(/\n{4,}/g, "\n\n\n") // Only remove excessive newlines (4+ becomes 3)
            .replace(/^\s+|\s+$/g, ""); // Trim whitespace
          // Preserve all links, formatting, and content structure

          const output = cleanedMarkdown;

          return {
            windowId: window.id,
            url: url,
            title: window.title,
            format: "markdown",
            content: output,
            contentLength: output.length,
            originalLength: html.length,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          throw new Error(
            `Failed to parse webview content: ${(error as Error).message}`
          );
        }
      },
    });

    // Set Webview URL Tool
    this.registerTool({
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
      execute: async (params) => {
        const window = this.windowManager.getWindow(params.windowId);
        if (!window) {
          throw new Error(`Window with id ${params.windowId} not found`);
        }

        if (window.type !== "webview" && window.type !== "reference-webview") {
          throw new Error(`Window ${params.windowId} is not a webview window`);
        }

        // Validate URL
        let url = params.url;
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
          url = "https://" + url;
        }

        try {
          new URL(url);
        } catch {
          throw new Error(`Invalid URL: ${params.url}`);
        }

        // Update window metadata with the URL
        const updated = await this.windowManager.updateWindow(params.windowId, {
          metadata: {
            ...window.metadata,
            url: url,
            lastLoaded: new Date().toISOString(),
          },
        });

        // Load the URL in the webview manager
        try {
          const { bitcaveApp } = require("../main");
          const webviewManager = bitcaveApp?.getWebviewManager();
          if (webviewManager) {
            // Create the webview if it doesn't exist
            const existingWebview = webviewManager.getWebview(params.windowId);
            if (!existingWebview) {
              await webviewManager.createWebview(params.windowId, url);
            } else {
              await webviewManager.loadURL(params.windowId, url);
            }
          }
        } catch (error) {
          console.error("Failed to load URL in webview manager:", error);
        }

        this.triggerWindowUpdated(updated);
        return updated;
      },
    });

    // Multi-Step Planning Tool
    this.registerTool({
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
      execute: async (params) => {
        const planId = `plan_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        // Store the plan
        this.multiStepPlans.set(planId, {
          task: params.task,
          steps: params.steps,
          currentStep: 0,
          results: [],
        });

        // Return the first step
        const plan = this.multiStepPlans.get(planId)!;
        const currentStep = plan.steps[0];

        const response = {
          planId: planId,
          task: plan.task,
          totalSteps: plan.steps.length,
          currentStep: 1,
          nextStep: currentStep,
          message: `Plan created with ${plan.steps.length} steps. Here's step 1: ${currentStep}`,
        };

        // Validate response is serializable
        try {
          JSON.stringify(response);
        } catch (error) {
          console.error(
            "[AIToolRegistry] Multi-step plan response not serializable:",
            error
          );
          throw new Error("Failed to create serializable plan response");
        }

        return response;
      },
    });

    // Multi-Step Execution Tool (internal)
    this.registerTool({
      name: "executeNextStep",
      description:
        "Execute the next step in a multi-step plan and return the next step",
      parameters: {
        planId: {
          type: "string",
          required: true,
          description: "ID of the plan to execute",
        },
        stepResult: {
          type: "string",
          required: false,
          description: "Result from the previous step",
        },
      },
      execute: async (params) => {
        const plan = this.multiStepPlans.get(params.planId);
        if (!plan) {
          throw new Error(`Plan with id ${params.planId} not found`);
        }

        // Store the result from the previous step
        if (params.stepResult) {
          plan.results.push(params.stepResult);
        }

        // Move to next step
        plan.currentStep++;

        if (plan.currentStep >= plan.steps.length) {
          // Plan completed
          const completedPlan = {
            planId: params.planId,
            task: plan.task,
            totalSteps: plan.steps.length,
            completedSteps: plan.steps,
            results: plan.results,
            message: "All steps completed successfully!",
          };

          // Clean up the plan
          this.multiStepPlans.delete(params.planId);

          return completedPlan;
        } else {
          // Return next step
          const nextStep = plan.steps[plan.currentStep];
          const response = {
            planId: params.planId,
            task: plan.task,
            totalSteps: plan.steps.length,
            currentStep: plan.currentStep + 1,
            nextStep: nextStep,
            previousResult: params.stepResult,
            message: `Step ${plan.currentStep} completed. Here's step ${
              plan.currentStep + 1
            }: ${nextStep}`,
          };

          // Validate response is serializable
          try {
            JSON.stringify(response);
          } catch (error) {
            console.error(
              "[AIToolRegistry] Execute next step response not serializable:",
              error
            );
            throw new Error("Failed to create serializable step response");
          }

          return response;
        }
      },
    });
  }

  private triggerWindowCreated(window: any): void {
    console.log(
      `[AIToolRegistry] Triggering window:created event for window:`,
      window.id
    );

    // Get the main window and send the event to the renderer
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      mainWindow.webContents.send("window:created", window);
      console.log(`[AIToolRegistry] Sent window:created event to renderer`);
    } else {
      console.error(`[AIToolRegistry] No main window found to send event`);
    }
  }

  private triggerWindowUpdated(window: any): void {
    try {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        mainWindow.webContents.send("window:updated", window);
      }
    } catch (e) {
      console.error("[AIToolRegistry] Failed to emit window:updated:", e);
    }
  }

  private showToast(message: string): void {
    try {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        mainWindow.webContents.send("ui:toast", message);
      }
    } catch (error) {
      console.error("[AIToolRegistry] Failed to send toast:", error);
    }
  }

  private findTextWindowByLabel(label: string): any | null {
    const textWindows = this.windowManager.getWindowsByType("text");
    const normalized = String(label).trim().toLowerCase();
    return (
      textWindows.find(
        (w) =>
          String(w.metadata?.label || "")
            .trim()
            .toLowerCase() === normalized
      ) || null
    );
  }

  private safeString(
    value: any,
    fallback: string,
    issues: string[],
    options?: { field?: string }
  ): string {
    if (typeof value === "string") return value;
    if (value == null) return fallback;
    try {
      const asString = String(value);
      issues.push(
        `${options?.field || "value"} coerced to string from ${typeof value}`
      );
      return asString;
    } catch {
      issues.push(
        `${options?.field || "value"} invalid (${Object.prototype.toString.call(
          value
        )}), using fallback`
      );
      return fallback;
    }
  }

  private sanitizeWindowConfig(
    type: WindowType,
    raw: any,
    issues: string[]
  ): any {
    const defaults = WINDOW_CONFIGS[type];
    const cfg: any = typeof raw === "object" && raw !== null ? raw : {};

    // title
    const title = this.safeString(
      cfg.title,
      `${type[0].toUpperCase()}${type.slice(1)} Window`,
      issues,
      { field: "title" }
    );

    // position
    const pos = cfg.position || {};
    const posX = Number.isFinite(pos.x) ? pos.x : 100;
    const posY = Number.isFinite(pos.y) ? pos.y : 100;
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) {
      issues.push("position invalid, using defaults {x:100,y:100}");
    }

    // size
    const size = cfg.size || {};
    const width = Number.isFinite(size.width)
      ? size.width
      : defaults.defaultSize.width;
    const height = Number.isFinite(size.height)
      ? size.height
      : defaults.defaultSize.height;
    if (!Number.isFinite(size.width) || !Number.isFinite(size.height)) {
      issues.push(
        `size invalid, using defaults {w:${defaults.defaultSize.width},h:${defaults.defaultSize.height}}`
      );
    }

    // metadata - sanitize shallowly to serializable primitives/arrays/objects
    const metadata = this.makeSerializable(cfg.metadata, issues, "metadata");

    return {
      title,
      position: { x: posX, y: posY },
      size: { width, height },
      metadata,
    };
  }

  private makeSerializable(value: any, issues: string[], field: string): any {
    const seen = new WeakSet();

    const sanitize = (v: any): any => {
      if (
        v === null ||
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean"
      ) {
        return v;
      }
      if (typeof v === "bigint") return v.toString();
      if (v instanceof Date) return v.toISOString();
      if (Array.isArray(v)) return v.map((item) => sanitize(item));
      if (typeof v === "object") {
        if (seen.has(v)) {
          issues.push(
            `${field} contains circular references; replacing with null`
          );
          return null;
        }
        seen.add(v);
        const out: any = {};
        for (const key of Object.keys(v)) {
          const val = (v as any)[key];
          if (typeof val === "function" || typeof val === "symbol") {
            issues.push(`${field}.${key} is non-serializable; dropped`);
            continue;
          }
          out[key] = sanitize(val);
        }
        return out;
      }
      issues.push(`${field} had unsupported type ${typeof v}; set to null`);
      return null;
    };

    try {
      const sanitized = sanitize(value);
      // Final check: ensure JSON serializable
      JSON.stringify(sanitized);
      return sanitized;
    } catch (e) {
      issues.push(`${field} not JSON-serializable; replaced with {}`);
      return {};
    }
  }

  private markdownToText(markdown: string): string {
    return (
      markdown
        // Remove headers
        .replace(/^#{1,6}\s+.*$/gm, "")
        // Remove code blocks
        .replace(/```[\s\S]*?```/g, "")
        // Remove inline code
        .replace(/`([^`]+)`/g, "$1")
        // Remove links, keep text
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        // Remove bold and italic
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        // Remove strikethrough
        .replace(/~~([^~]+)~~/g, "$1")
        // Remove blockquotes
        .replace(/^>\s+.*$/gm, "")
        // Remove list markers
        .replace(/^[\s]*[-*+]\s+/gm, "")
        .replace(/^[\s]*\d+\.\s+/gm, "")
        // Remove horizontal rules
        .replace(/^[\s]*[-*_]{3,}[\s]*$/gm, "")
        // Clean up whitespace
        .replace(/\n{3,}/g, "\n\n")
        .replace(/^\s+|\s+$/g, "")
    );
  }
}
