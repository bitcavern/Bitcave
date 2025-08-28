import { v4 as uuidv4 } from "uuid";
import type { BaseWindow, WindowType } from "@/shared/types";
import { WINDOW_CONFIGS } from "@/shared/constants";

export class WindowManager {
  private windows: Map<string, BaseWindow> = new Map();
  private nextZIndex = 1;

  public async createWindow(
    type: WindowType,
    config: Partial<BaseWindow> = {}
  ): Promise<BaseWindow> {
    console.log(
      `[WindowManager] Creating window of type: ${type} with config:`,
      config
    );

    const windowConfig = WINDOW_CONFIGS[type];
    const id = uuidv4();

    console.log(`[WindowManager] Generated window ID: ${id}`);

    const window: BaseWindow = {
      id,
      type,
      title:
        config.title ||
        `${type.charAt(0).toUpperCase() + type.slice(1)} Window`,
      position: config.position || {
        x: 100 + this.windows.size * 20,
        y: 100 + this.windows.size * 20,
      },
      size: config.size || windowConfig.defaultSize,
      zIndex: this.nextZIndex++,
      isLocked: config.isLocked || false,
      isMinimized: config.isMinimized || false,
      metadata: {
        ...config.metadata,
        windowConfig: windowConfig,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.windows.set(id, window);
    console.log(
      `[WindowManager] Window created successfully. Total windows: ${this.windows.size}`
    );

    return window;
  }

  public async deleteWindow(windowId: string): Promise<void> {
    if (!this.windows.has(windowId)) {
      throw new Error(`Window with id ${windowId} not found`);
    }

    this.windows.delete(windowId);
  }

  public async updateWindow(
    windowId: string,
    updates: Partial<BaseWindow>
  ): Promise<BaseWindow> {
    const window = this.windows.get(windowId);
    if (!window) {
      throw new Error(`Window with id ${windowId} not found`);
    }

    const updatedWindow: BaseWindow = {
      ...window,
      ...updates,
      id: window.id, // Prevent ID changes
      updatedAt: new Date(),
    };

    this.windows.set(windowId, updatedWindow);
    return updatedWindow;
  }

  public async moveWindow(
    windowId: string,
    position: { x: number; y: number }
  ): Promise<BaseWindow> {
    return this.updateWindow(windowId, { position });
  }

  public async resizeWindow(
    windowId: string,
    size: { width: number; height: number }
  ): Promise<BaseWindow> {
    const window = this.windows.get(windowId);
    if (!window) {
      throw new Error(`Window with id ${windowId} not found`);
    }

    const windowConfig = WINDOW_CONFIGS[window.type];

    // Enforce minimum size constraints
    const constrainedSize = {
      width: Math.max(size.width, windowConfig.minSize.width),
      height: Math.max(size.height, windowConfig.minSize.height),
    };

    return this.updateWindow(windowId, { size: constrainedSize });
  }

  public async bringToFront(windowId: string): Promise<BaseWindow> {
    return this.updateWindow(windowId, { zIndex: this.nextZIndex++ });
  }

  public async lockWindow(windowId: string): Promise<BaseWindow> {
    return this.updateWindow(windowId, { isLocked: true });
  }

  public async unlockWindow(windowId: string): Promise<BaseWindow> {
    return this.updateWindow(windowId, { isLocked: false });
  }

  public async minimizeWindow(windowId: string): Promise<BaseWindow> {
    return this.updateWindow(windowId, { isMinimized: true });
  }

  public async restoreWindow(windowId: string): Promise<BaseWindow> {
    return this.updateWindow(windowId, { isMinimized: false });
  }

  public async setWindowTitle(
    windowId: string,
    title: string
  ): Promise<BaseWindow> {
    return this.updateWindow(windowId, { title });
  }

  public getWindow(windowId: string): BaseWindow | undefined {
    return this.windows.get(windowId);
  }

  public getAllWindows(): BaseWindow[] {
    return Array.from(this.windows.values()).sort(
      (a, b) => a.zIndex - b.zIndex
    );
  }

  public getWindowsByType(type: WindowType): BaseWindow[] {
    return this.getAllWindows().filter((window) => window.type === type);
  }

  public searchWindows(query: string): BaseWindow[] {
    const searchTerm = query.toLowerCase();
    return this.getAllWindows().filter(
      (window) =>
        window.title.toLowerCase().includes(searchTerm) ||
        window.type.toLowerCase().includes(searchTerm) ||
        JSON.stringify(window.metadata).toLowerCase().includes(searchTerm)
    );
  }

  public async tileWindows(
    windowIds: string[],
    layout: "grid" | "horizontal" | "vertical" = "grid"
  ): Promise<BaseWindow[]> {
    const windows = windowIds
      .map((id) => this.windows.get(id))
      .filter(Boolean) as BaseWindow[];
    if (windows.length === 0) return [];

    const canvasWidth = 1400; // Should come from canvas state
    const canvasHeight = 900;
    const padding = 20;

    let updatedWindows: BaseWindow[] = [];

    switch (layout) {
      case "grid": {
        const cols = Math.ceil(Math.sqrt(windows.length));
        const rows = Math.ceil(windows.length / cols);
        const windowWidth = (canvasWidth - padding * (cols + 1)) / cols;
        const windowHeight = (canvasHeight - padding * (rows + 1)) / rows;

        for (let i = 0; i < windows.length; i++) {
          const row = Math.floor(i / cols);
          const col = i % cols;
          const x = padding + col * (windowWidth + padding);
          const y = padding + row * (windowHeight + padding);

          const updated = await this.updateWindow(windows[i].id, {
            position: { x, y },
            size: { width: windowWidth, height: windowHeight },
          });
          updatedWindows.push(updated);
        }
        break;
      }
      case "horizontal": {
        const windowWidth =
          (canvasWidth - padding * (windows.length + 1)) / windows.length;
        const windowHeight = canvasHeight - padding * 2;

        for (let i = 0; i < windows.length; i++) {
          const x = padding + i * (windowWidth + padding);
          const y = padding;

          const updated = await this.updateWindow(windows[i].id, {
            position: { x, y },
            size: { width: windowWidth, height: windowHeight },
          });
          updatedWindows.push(updated);
        }
        break;
      }
      case "vertical": {
        const windowWidth = canvasWidth - padding * 2;
        const windowHeight =
          (canvasHeight - padding * (windows.length + 1)) / windows.length;

        for (let i = 0; i < windows.length; i++) {
          const x = padding;
          const y = padding + i * (windowHeight + padding);

          const updated = await this.updateWindow(windows[i].id, {
            position: { x, y },
            size: { width: windowWidth, height: windowHeight },
          });
          updatedWindows.push(updated);
        }
        break;
      }
    }

    return updatedWindows;
  }

  public exportWindowState(windowId: string): any {
    const window = this.windows.get(windowId);
    if (!window) {
      throw new Error(`Window with id ${windowId} not found`);
    }

    return {
      ...window,
      exportedAt: new Date().toISOString(),
    };
  }

  public clearAllWindows(): void {
    this.windows.clear();
    this.nextZIndex = 1;
  }

  public getSystemMetrics() {
    return {
      totalWindows: this.windows.size,
      windowsByType: Object.fromEntries(
        Array.from(
          new Set(Array.from(this.windows.values()).map((w) => w.type))
        ).map((type) => [type, this.getWindowsByType(type).length])
      ),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
