import { app, BrowserWindow, ipcMain, globalShortcut, dialog } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as dotenv from "dotenv";
import { WindowManager } from "./window-manager";
import { AIToolRegistry } from "./ai-tools/registry";
import { AIService } from "./ai/ai-service";
import { WebviewManager } from "./webview-manager";
import { ProjectManager } from "./projects/project-manager";
import { ArtifactManager } from "./artifacts/artifact-manager";
import { UserManager } from "./user/user-manager";
import { MemoryService } from "./memory/memory-service";
import type { IPCEventName, IPCEventData, UserSettings } from "@/shared/types";

// Load environment variables
dotenv.config();

class BitcaveApp {
  private mainWindow: BrowserWindow | null = null;
  private windowManager: WindowManager;
  private aiToolRegistry: AIToolRegistry;
  private aiService: AIService;
  private webviewManager: WebviewManager;
  private projectManager: ProjectManager;
  private userManager: UserManager;
  private memoryService: MemoryService;
  private artifactManager: ArtifactManager | null = null;
  private selectedWindowId: string | null = null;

  constructor() {
    this.windowManager = new WindowManager();
    this.aiToolRegistry = new AIToolRegistry(this.windowManager);
    this.aiService = new AIService(this.aiToolRegistry, this.windowManager);
    this.webviewManager = new WebviewManager();
    this.projectManager = new ProjectManager();
    this.userManager = new UserManager();

    // Don't initialize MemoryService in constructor - wait until app is ready
    this.memoryService = null as any;

    // Initialize with environment API key if available
    const envApiKey = process.env.OPENROUTER_API_KEY;
    if (envApiKey) {
      console.log("Using OpenRouter API key from environment variable");
      this.aiService.setApiKey(envApiKey);
    }
  }

  public async initialize(): Promise<void> {
    await app.whenReady();

    // Initialize project manager first
    await this.projectManager.initialize();
    this.projectManager.setWindowManager(this.windowManager);

    // Initialize MemoryService after app is ready
    try {
      this.memoryService = new MemoryService(this.aiService);
      this.aiService.setMemoryService(this.memoryService);
      console.log("[BitcaveApp] MemoryService initialized successfully");
    } catch (error) {
      console.error("[BitcaveApp] Failed to initialize MemoryService:", error);
      // Continue without memory service
      this.memoryService = null as any;
    }

    this.createMainWindow();
    this.setupIPCHandlers();
    await this.setupHotReload();
    this.setupEventHandlers();
    this.setupResetShortcut();
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
        webviewTag: true, // Enable webview tags
        preload: path.join(__dirname, "preload.js"),
      },
      titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
      frame: process.platform === "win32" ? false : true,
      show: false, // Don't show until ready
    });

    // Load the renderer
    if (process.env.NODE_ENV === "development") {
      this.mainWindow.loadURL("http://localhost:3000");
      this.mainWindow.webContents.openDevTools();

      // Enable hot reload for renderer process
      this.mainWindow.webContents.on("did-fail-load", () => {
        console.log("Renderer failed to load, retrying...");
        setTimeout(() => {
          this.mainWindow?.loadURL("http://localhost:3000");
        }, 1000);
      });
    } else {
      this.mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
    }

    // Show window when ready
    this.mainWindow.once("ready-to-show", () => {
      this.mainWindow?.show();
      // Pass main window to AI tool registry for Python execution
      if (this.mainWindow) {
        this.aiToolRegistry.setMainWindow(this.mainWindow);
        this.webviewManager.setMainWindow(this.mainWindow);
      }
    });

    // Handle window closed
    this.mainWindow.on("closed", () => {
      this.mainWindow = null;
    });
  }

  private async setupHotReload(): Promise<void> {
    if (process.env.NODE_ENV === "development") {
      // Watch for main process file changes and restart
      const chokidar = await import("chokidar");
      const watcher = chokidar.watch(
        [path.join(__dirname, "**/*.js"), path.join(__dirname, "**/*.js.map")],
        {
          ignored: /node_modules/,
          persistent: true,
        }
      );

      watcher.on("change", (filePath: string) => {
        console.log(`Main process file changed: ${filePath}`);
        console.log("Restarting main process...");
        app.relaunch();
        app.exit(0);
      });

      // Handle renderer process hot reload
      if (this.mainWindow) {
        this.mainWindow.webContents.on("did-finish-load", () => {
          console.log("Renderer loaded successfully");
        });
      }
    }
  }

  private setupEventHandlers(): void {
    app.on("window-all-closed", () => {
      // Clean up resources
      this.aiToolRegistry.dispose();
      this.webviewManager.dispose();

      if (process.platform !== "darwin") {
        app.quit();
      }
    });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createMainWindow();
      }
    });

    app.on("before-quit", async () => {
      // Clean up resources before quitting
      await this.projectManager.closeProject(true); // Save current project before quitting
      this.aiToolRegistry.dispose();
      this.webviewManager.dispose();
    });
  }

  private setupResetShortcut(): void {
    // Only enable in development mode
    if (process.env.NODE_ENV === "development") {
      const isEnabled = process.env.ENABLE_RESET_SHORTCUT === "true";

      if (isEnabled) {
        // Register Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
        const shortcut =
          process.platform === "darwin" ? "Cmd+Shift+R" : "Ctrl+Shift+R";

        const success = globalShortcut.register(shortcut, () => {
          console.log(`[Main] Reset shortcut triggered: ${shortcut}`);
          console.log("[Main] Restarting application...");

          // Clean up resources
          this.aiToolRegistry.dispose();
          this.webviewManager.dispose();

          // Relaunch the app
          app.relaunch();
          app.exit(0);
        });

        if (success) {
          console.log(`[Main] Reset shortcut registered: ${shortcut}`);
        } else {
          console.log(`[Main] Failed to register reset shortcut: ${shortcut}`);
        }
      } else {
        console.log(
          "[Main] Reset shortcut disabled (set ENABLE_RESET_SHORTCUT=true to enable)"
        );
      }
    }
  }

  private setupIPCHandlers(): void {
    // User settings handlers
    ipcMain.handle("user:get-settings", async () => {
      try {
        const settings = await this.userManager.getUserSettings();
        return { success: true, data: settings };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle(
      "user:save-settings",
      async (event, settings: UserSettings) => {
        try {
          await this.userManager.saveUserSettings(settings);
          return { success: true };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );

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

    ipcMain.handle(
      "window:restore",
      async (event, data: IPCEventData<"window:restore">) => {
        try {
          const window = await this.windowManager.updateWindow(data.windowId, {
            isMinimized: false,
          });
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
      "ai:abort",
      async (event, { conversationId }: { conversationId: string }) => {
        try {
          this.aiService.abortConversation(conversationId);
          return { success: true };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );

    ipcMain.handle(
      "ai:get-conversation",
      async (event, conversationId: string) => {
        try {
          const conversations = this.aiService.getConversations();
          const conversation = conversations.find(
            (c) => c.id === conversationId
          );
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

    ipcMain.handle("ai:new-conversation", async () => {
      try {
        const newConversationId = this.aiService.createNewConversation();
        return { success: true, data: newConversationId };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // Project management handlers
    ipcMain.handle("projects:list", async () => {
      try {
        const projects = await this.projectManager.listProjects();
        return { success: true, data: projects };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle("projects:recent", async () => {
      try {
        const projects = await this.projectManager.getRecentProjects();
        return { success: true, data: projects };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // Alternative handler name for modal component
    ipcMain.handle("project:list-recent", async () => {
      try {
        const projects = await this.projectManager.getRecentProjects();
        return projects;
      } catch (error) {
        console.error("Failed to get recent projects:", error);
        return [];
      }
    });

    ipcMain.handle("projects:current", async () => {
      try {
        const project = this.projectManager.getCurrentProject();
        return { success: true, data: project };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle("projects:create", async (event, request) => {
      try {
        const project = await this.projectManager.createProject(request);
        return { success: true, data: project };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle(
      "projects:open",
      async (event, data: { projectId: string }) => {
        try {
          await this.projectManager.openProject(data.projectId);

          // Initialize artifact manager for the opened project
          const project = this.projectManager.getCurrentProject();
          if (project) {
            const projectPath = await this.projectManager.getProjectPath();
            if (projectPath) {
              this.artifactManager = new ArtifactManager(projectPath);
              await this.artifactManager.loadExistingArtifacts();

              // Set artifact manager in AI tools registry
              this.aiToolRegistry.setArtifactManager(this.artifactManager);

              console.log(
                "[Main] Artifact manager initialized for project:",
                project.name
              );
            }
          }

          return { success: true };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );

    ipcMain.handle(
      "projects:close",
      async (event, data: { save?: boolean } = {}) => {
        try {
          await this.projectManager.closeProject(data.save ?? true);
          return { success: true };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );

    ipcMain.handle("projects:save", async () => {
      try {
        await this.projectManager.saveWorkspace();
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle("projects:delete", async (event, projectId: string) => {
      try {
        await this.projectManager.deleteProject(projectId);
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // Dialog handlers
    ipcMain.handle("dialog:select-folder", async () => {
      if (!this.mainWindow) return null;

      try {
        const result = await dialog.showOpenDialog(this.mainWindow, {
          properties: ["openDirectory", "createDirectory"],
          title: "Select Project Folder",
        });
        return result;
      } catch (error) {
        console.error("Failed to show folder dialog:", error);
        return { canceled: true, filePaths: [] };
      }
    });

    ipcMain.handle("files:list", async () => {
      try {
        const projectRoot = await this.projectManager.getProjectRoot();
        if (!projectRoot) {
          return { success: true, data: [] };
        }

        // List of internal Bitcave files and folders to hide from file explorer
        const isInternalBitcaveFile = (name: string): boolean => {
          const hiddenFiles = ["project.json", "workspace.json"];
          const hiddenFolders = [
            "artifacts",
            "memory",
            "ai-conversations",
            "assets",
            ".bitcave",
          ];

          return hiddenFiles.includes(name) || hiddenFolders.includes(name);
        };

        const readDir = async (dir: string): Promise<any[]> => {
          const entries = await require("fs/promises").readdir(dir, {
            withFileTypes: true,
          });
          const files = await Promise.all(
            entries.map(async (entry: fs.Dirent) => {
              // Hide files/folders starting with "." or internal Bitcave files
              if (
                entry.name.startsWith(".") ||
                isInternalBitcaveFile(entry.name)
              ) {
                return null;
              }
              const fullPath = require("path").join(dir, entry.name);
              if (entry.isDirectory()) {
                return {
                  name: entry.name,
                  path: fullPath,
                  isDirectory: true,
                  children: await readDir(fullPath),
                };
              } else {
                return {
                  name: entry.name,
                  path: fullPath,
                  isDirectory: false,
                };
              }
            })
          );
          return files.filter((file) => file !== null);
        };

        const files = await readDir(projectRoot);
        return { success: true, data: files };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle("files:read", async (event, filePath: string) => {
      try {
        const projectRoot = await this.projectManager.getProjectRoot();
        if (!projectRoot) {
          return { success: false, error: "No project is currently open" };
        }

        // Ensure the file is within the project directory for security
        const path = require("path");
        const fs = require("fs/promises");
        const resolvedFilePath = path.resolve(filePath);
        const resolvedProjectRoot = path.resolve(projectRoot);

        if (!resolvedFilePath.startsWith(resolvedProjectRoot)) {
          return { success: false, error: "File is outside project directory" };
        }

        // Check if file exists
        const stats = await fs.stat(resolvedFilePath);
        if (!stats.isFile()) {
          return { success: false, error: "Path is not a file" };
        }

        // Read file content (only for text files, limit file size)
        const MAX_FILE_SIZE = 1024 * 1024; // 1MB limit
        if (stats.size > MAX_FILE_SIZE) {
          return { success: false, error: "File too large (max 1MB)" };
        }

        // Check file extension for text formats
        const textExtensions = [
          ".txt",
          ".md",
          ".json",
          ".js",
          ".ts",
          ".jsx",
          ".tsx",
          ".py",
          ".html",
          ".css",
          ".xml",
          ".yaml",
          ".yml",
          ".csv",
          ".log",
        ];
        const fileExt = path.extname(resolvedFilePath).toLowerCase();

        if (!textExtensions.includes(fileExt)) {
          return { success: false, error: `Unsupported file type: ${fileExt}` };
        }

        const content = await fs.readFile(resolvedFilePath, "utf-8");
        const relativePath = path.relative(projectRoot, resolvedFilePath);

        return {
          success: true,
          data: {
            content,
            fileName: path.basename(resolvedFilePath),
            relativePath,
            size: stats.size,
            extension: fileExt,
          },
        };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // Code execution handler
    ipcMain.handle(
      "code:execute",
      async (event, data: IPCEventData<"code:execute">) => {
        try {
          // Use the code execution sandbox through the AI tool registry
          const result = await this.aiToolRegistry.executeTool("executeCode", {
            language: data.language,
            code: data.code,
            timeout: data.timeout,
            memoryLimit: data.memoryLimit,
          });

          if (result.success) {
            return { success: true, data: result.data };
          } else {
            return { success: false, error: result.error };
          }
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );

    // Selected window handler
    ipcMain.handle(
      "window:set-selected",
      async (event, { windowId }: { windowId: string | null }) => {
        try {
          this.selectedWindowId = windowId;
          return { success: true };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );

    ipcMain.handle("window:get-selected", async () => {
      try {
        return { success: true, data: this.selectedWindowId };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // Webview handlers
    ipcMain.handle(
      "webview:create",
      async (event, data: IPCEventData<"webview:create">) => {
        try {
          await this.webviewManager.createWebview(data.windowId, data.url);
          return { success: true };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );

    ipcMain.handle(
      "webview:get-content",
      async (event, data: IPCEventData<"webview:get-content">) => {
        try {
          const content = await this.webviewManager.getWebviewContent(
            data.windowId
          );
          return { success: true, data: content };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );

    ipcMain.handle(
      "webview:set-bounds",
      async (event, data: IPCEventData<"webview:set-bounds">) => {
        try {
          this.webviewManager.setBounds(data.windowId, data.bounds);
          return { success: true };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );

    ipcMain.handle(
      "webview:go-back",
      async (event, data: IPCEventData<"webview:go-back">) => {
        try {
          await this.webviewManager.goBack(data.windowId);
          return { success: true };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );

    ipcMain.handle(
      "webview:go-forward",
      async (event, data: IPCEventData<"webview:go-forward">) => {
        try {
          await this.webviewManager.goForward(data.windowId);
          return { success: true };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );

    ipcMain.handle(
      "webview:reload",
      async (event, data: IPCEventData<"webview:reload">) => {
        try {
          await this.webviewManager.reload(data.windowId);
          return { success: true };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );

    ipcMain.handle(
      "webview:update-canvas-offset",
      async (event, data: IPCEventData<"webview:update-canvas-offset">) => {
        try {
          this.webviewManager.updateCanvasOffset(data.offsetX, data.offsetY);
          return { success: true };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );

    // Artifact management handlers
    ipcMain.handle(
      "artifact:create",
      async (event, data: IPCEventData<"artifact:create">) => {
        try {
          if (!this.artifactManager) {
            throw new Error(
              "Artifact manager not initialized - no project open"
            );
          }
          const artifact = await this.artifactManager.createArtifact(data);
          return { success: true, data: artifact };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );

    ipcMain.handle(
      "artifact:update",
      async (event, data: IPCEventData<"artifact:update">) => {
        try {
          if (!this.artifactManager) {
            throw new Error(
              "Artifact manager not initialized - no project open"
            );
          }
          const artifact = await this.artifactManager.updateArtifact(
            data.artifactId,
            data.updates
          );
          return { success: true, data: artifact };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );

    ipcMain.handle(
      "artifact:get-data",
      async (event, data: IPCEventData<"artifact:get-data">) => {
        try {
          if (!this.artifactManager) {
            throw new Error(
              "Artifact manager not initialized - no project open"
            );
          }
          const artifactData = await this.artifactManager.getArtifactData(
            data.artifactId,
            data.templateKey
          );
          return { success: true, data: artifactData };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );

    ipcMain.handle(
      "artifact:set-data",
      async (event, data: IPCEventData<"artifact:set-data">) => {
        try {
          if (!this.artifactManager) {
            throw new Error(
              "Artifact manager not initialized - no project open"
            );
          }
          await this.artifactManager.setArtifactData(
            data.artifactId,
            data.templateKey,
            data.data
          );
          return { success: true };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );

    ipcMain.handle(
      "artifact:destroy",
      async (event, data: IPCEventData<"artifact:destroy">) => {
        try {
          if (!this.artifactManager) {
            throw new Error(
              "Artifact manager not initialized - no project open"
            );
          }
          await this.artifactManager.destroyArtifact(data.artifactId);
          return { success: true };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );

    // Global artifact management handlers
    ipcMain.handle(
      "artifact:save-globally",
      async (event, data: { artifactId: string; name?: string }) => {
        try {
          if (!this.artifactManager) {
            throw new Error(
              "Artifact manager not initialized - no project open"
            );
          }
          await this.artifactManager.saveArtifactGlobally(
            data.artifactId,
            data.name
          );
          return { success: true };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );

    ipcMain.handle("artifact:list-global", async () => {
      try {
        if (!this.artifactManager) {
          throw new Error("Artifact manager not initialized - no project open");
        }
        const globalArtifacts =
          await this.artifactManager.loadGlobalArtifacts();
        return { success: true, data: globalArtifacts };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle(
      "artifact:import-global",
      async (event, data: { globalArtifactId: string }) => {
        try {
          if (!this.artifactManager) {
            throw new Error(
              "Artifact manager not initialized - no project open"
            );
          }
          const artifact = await this.artifactManager.importGlobalArtifact(
            data.globalArtifactId
          );
          return { success: true, data: artifact };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );

    // Memory management handlers
    ipcMain.handle("memory:get-facts", async () => {
      try {
        if (!this.memoryService || !this.memoryService.isDatabaseAvailable()) {
          return { success: false, error: "Memory service not available" };
        }

        const db = this.memoryService.getDatabase();
        const facts = db
          .prepare("SELECT * FROM facts ORDER BY updated_at DESC")
          .all();
        return { success: true, data: facts };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle("memory:get-stats", async () => {
      try {
        if (!this.memoryService || !this.memoryService.isDatabaseAvailable()) {
          return { success: false, error: "Memory service not available" };
        }

        const db = this.memoryService.getDatabase();

        const totalFacts = db
          .prepare("SELECT COUNT(*) as count FROM facts")
          .get() as { count: number };
        const avgConfidence = db
          .prepare("SELECT AVG(confidence) as avg FROM facts")
          .get() as { avg: number };
        const categoryCounts = db
          .prepare(
            "SELECT category, COUNT(*) as count FROM facts GROUP BY category"
          )
          .all() as { category: string; count: number }[];

        // Recent facts (last 7 days)
        const sevenDaysAgo = new Date(
          Date.now() - 7 * 24 * 60 * 60 * 1000
        ).toISOString();
        const recentFacts = db
          .prepare("SELECT COUNT(*) as count FROM facts WHERE updated_at > ?")
          .get(sevenDaysAgo) as { count: number };

        const stats = {
          totalFacts: totalFacts.count,
          averageConfidence: avgConfidence.avg || 0,
          recentFacts: recentFacts.count,
          categoryCounts: categoryCounts.reduce((acc, row) => {
            acc[row.category] = row.count;
            return acc;
          }, {} as { [key: string]: number }),
        };

        return { success: true, data: stats };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle(
      "memory:delete-fact",
      async (event, data: { factId: number }) => {
        try {
          if (
            !this.memoryService ||
            !this.memoryService.isDatabaseAvailable()
          ) {
            return { success: false, error: "Memory service not available" };
          }

          await this.memoryService.deleteFact(data.factId);
          return { success: true };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );

    ipcMain.handle(
      "memory:update-fact",
      async (
        event,
        data: {
          factId: number;
          content?: string;
          category?: string;
          confidence?: number;
          updated_at?: string;
        }
      ) => {
        try {
          if (
            !this.memoryService ||
            !this.memoryService.isDatabaseAvailable()
          ) {
            return { success: false, error: "Memory service not available" };
          }

          await this.memoryService.updateFact(data.factId, data);
          return { success: true };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );

    ipcMain.handle(
      "memory:search-facts",
      async (event, data: { query: string; limit?: number }) => {
        try {
          if (
            !this.memoryService ||
            !this.memoryService.isDatabaseAvailable()
          ) {
            return { success: false, error: "Memory service not available" };
          }

          const results = await this.memoryService.searchFacts(
            data.query,
            data.limit || 10
          );
          return { success: true, data: results };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );
  }

  public getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  public getSelectedWindowId(): string | null {
    return this.selectedWindowId;
  }

  public getWebviewManager(): WebviewManager {
    return this.webviewManager;
  }
}

// Initialize the application
const bitcaveApp = new BitcaveApp();
bitcaveApp.initialize().catch((error) => {
  console.error("Failed to initialize Bitcave:", error);
  app.quit();
});

export { bitcaveApp };
