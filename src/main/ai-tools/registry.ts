import type { AIToolResponse, WindowType } from "@/shared/types";
import type { WindowManager } from "../window-manager";
import { BrowserWindow } from "electron";
import { WINDOW_CONFIGS } from "@/shared/constants";

export interface AITool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (params: any, windowId?: string) => Promise<any>;
}

export class AIToolRegistry {
  private tools: Map<string, AITool> = new Map();
  private windowManager: WindowManager;

  constructor(windowManager: WindowManager) {
    this.windowManager = windowManager;
    this.registerDefaultTools();
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

        const safeLabel = this.safeString(params?.label, "Untitled", issues, {
          field: "label",
        });
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
      },
      execute: async (params) => {
        const window = this.windowManager.getWindow(params.windowId);
        if (!window) {
          throw new Error(`Window with id ${params.windowId} not found`);
        }

        if (window.type !== "text") {
          throw new Error(`Window ${params.windowId} is not a text window`);
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
}
