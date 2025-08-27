import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import * as dotenv from "dotenv";
import { WindowManager } from "./window-manager";
import { AIToolRegistry } from "./ai-tools/registry";
import { AIService } from "./ai/ai-service";

// Load environment variables
dotenv.config();
import type { IPCEventName, IPCEventData } from "@/shared/types";

class BitcaveApp {
  private mainWindow: BrowserWindow | null = null;
  private windowManager: WindowManager;
  private aiToolRegistry: AIToolRegistry;
  private aiService: AIService;

  constructor() {
    this.windowManager = new WindowManager();
    this.aiToolRegistry = new AIToolRegistry(this.windowManager);
    this.aiService = new AIService(this.aiToolRegistry);

    // Initialize with environment API key if available
    const envApiKey = process.env.OPENROUTER_API_KEY;
    if (envApiKey) {
      console.log("Using OpenRouter API key from environment variable");
      this.aiService.setApiKey(envApiKey);
    }

    this.setupEventHandlers();
  }

  public async initialize(): Promise<void> {
    await app.whenReady();
    this.createMainWindow();
    this.setupIPCHandlers();
  }

  private createMainWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"),
      },
      titleBarStyle: "hiddenInset",
      show: false, // Don't show until ready
    });

    // Load the renderer
    if (process.env.NODE_ENV === "development") {
      this.mainWindow.loadURL("http://localhost:3000");
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
    }

    // Show window when ready
    this.mainWindow.once("ready-to-show", () => {
      this.mainWindow?.show();
    });

    // Handle window closed
    this.mainWindow.on("closed", () => {
      this.mainWindow = null;
    });
  }

  private setupEventHandlers(): void {
    app.on("window-all-closed", () => {
      if (process.platform !== "darwin") {
        app.quit();
      }
    });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createMainWindow();
      }
    });
  }

  private setupIPCHandlers(): void {
    // Window management handlers
    ipcMain.handle(
      "window:create",
      async (event, data: IPCEventData<"window:create">) => {
        console.log(`[Main] IPC window:create called with:`, data);

        try {
          const window = await this.windowManager.createWindow(
            data.type,
            data.config
          );
          console.log(`[Main] Window created via IPC:`, window.id);

          return { success: true, data: window };
        } catch (error) {
          console.error(`[Main] IPC window:create error:`, error);
          return { success: false, error: (error as Error).message };
        }
      }
    );

    ipcMain.handle(
      "window:delete",
      async (event, data: IPCEventData<"window:delete">) => {
        try {
          await this.windowManager.deleteWindow(data.windowId);
          return { success: true };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );

    ipcMain.handle(
      "window:update",
      async (event, data: IPCEventData<"window:update">) => {
        try {
          const window = await this.windowManager.updateWindow(
            data.windowId,
            data.updates
          );
          return { success: true, data: window };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );

    ipcMain.handle(
      "window:move",
      async (event, data: IPCEventData<"window:move">) => {
        try {
          const window = await this.windowManager.moveWindow(
            data.windowId,
            data.position
          );
          return { success: true, data: window };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );

    ipcMain.handle(
      "window:resize",
      async (event, data: IPCEventData<"window:resize">) => {
        try {
          const window = await this.windowManager.resizeWindow(
            data.windowId,
            data.size
          );
          return { success: true, data: window };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );

    // AI tool handlers
    ipcMain.handle(
      "ai:execute-tool",
      async (event, data: IPCEventData<"ai:execute-tool">) => {
        try {
          const result = await this.aiToolRegistry.executeTool(
            data.toolName,
            data.parameters,
            data.windowId
          );
          return result;
        } catch (error) {
          return {
            success: false,
            data: null,
            error: (error as Error).message,
            timestamp: new Date().toISOString(),
            windowId: data.windowId || null,
          };
        }
      }
    );

    // Canvas handlers
    ipcMain.handle(
      "canvas:update-viewport",
      async (event, data: IPCEventData<"canvas:update-viewport">) => {
        // Store viewport state for persistence
        // This could be saved to a database or file
        return { success: true, data: data.viewport };
      }
    );

    // Get all windows
    ipcMain.handle("windows:get-all", async () => {
      try {
        const windows = this.windowManager.getAllWindows();
        return { success: true, data: windows };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // AI Service handlers
    ipcMain.handle(
      "ai:set-api-key",
      async (event, { apiKey }: { apiKey: string }) => {
        try {
          this.aiService.setApiKey(apiKey);
          return { success: true };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );

    ipcMain.handle("ai:is-configured", async () => {
      try {
        return { success: true, data: this.aiService.isConfigured() };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle(
      "ai:chat",
      async (
        event,
        { conversationId, message }: { conversationId: string; message: string }
      ) => {
        try {
          const response = await this.aiService.chat(conversationId, message);
          return { success: true, data: response };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );

    ipcMain.handle(
      "ai:get-conversation",
      async (event, conversationId: string) => {
        try {
          const conversation = this.aiService.getConversation(conversationId);
          return { success: true, data: conversation };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );

    ipcMain.handle(
      "ai:clear-conversation",
      async (event, conversationId: string) => {
        try {
          this.aiService.clearConversation(conversationId);
          return { success: true };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );
  }

  public getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }
}

// Initialize the application
const bitcaveApp = new BitcaveApp();
bitcaveApp.initialize().catch((error) => {
  console.error("Failed to initialize Bitcave:", error);
  app.quit();
});

export { bitcaveApp };
