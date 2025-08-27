import { BrowserWindow, BrowserView } from "electron";
import type { BaseWindow } from "@/shared/types";

interface WebviewInstance {
  windowId: string;
  url: string;
  title: string;
  bounds: { x: number; y: number; width: number; height: number };
  browserView: BrowserView | null;
  isActive: boolean;
}

export class WebviewManager {
  private webviews: Map<string, WebviewInstance> = new Map();
  private mainWindow: BrowserWindow | null = null;

  constructor() {}

  public setMainWindow(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;
  }

  public async createWebview(windowId: string, url: string): Promise<void> {
    if (!this.mainWindow) {
      throw new Error("Main window not available");
    }

    // Create BrowserView
    const browserView = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false, // Allow cross-origin requests
        allowRunningInsecureContent: true,
      },
    });

    // Set up event listeners
    this.setupBrowserViewListeners(windowId, browserView);

    // Create webview instance
    const webviewInstance: WebviewInstance = {
      windowId,
      url,
      title: "",
      bounds: { x: 0, y: 0, width: 800, height: 600 },
      browserView,
      isActive: false,
    };

    this.webviews.set(windowId, webviewInstance);

    // Load the URL
    await browserView.webContents.loadURL(url);
  }

  public async loadURL(windowId: string, url: string): Promise<void> {
    const webview = this.webviews.get(windowId);
    if (!webview) {
      throw new Error(`Webview ${windowId} not found`);
    }

    // Update the webview instance
    webview.url = url;

    // Load the URL in the BrowserView
    if (webview.browserView) {
      await webview.browserView.webContents.loadURL(url);
    }
  }

  public setBounds(
    windowId: string,
    bounds: { x: number; y: number; width: number; height: number }
  ): void {
    const webview = this.webviews.get(windowId);
    if (!webview) {
      throw new Error(`Webview ${windowId} not found`);
    }

    webview.bounds = bounds;

    // Update BrowserView position if it exists
    if (webview.browserView && this.mainWindow) {
      try {
        // Add to main window if not already added
        const browserViews = this.mainWindow.getBrowserViews();
        if (!browserViews.includes(webview.browserView)) {
          this.mainWindow.addBrowserView(webview.browserView);
        }

        // Calculate adjusted bounds to account for window title bar and UI elements
        const titleBarHeight = 40; // Approximate height of window title bar
        const navigationBarHeight = 60; // Approximate height of navigation bar in webview window

        const adjustedBounds = {
          x: bounds.x,
          y: bounds.y + titleBarHeight + navigationBarHeight,
          width: bounds.width,
          height: bounds.height - titleBarHeight - navigationBarHeight,
        };

        // Set the bounds
        webview.browserView.setBounds(adjustedBounds);
      } catch (error) {
        console.error("Failed to set BrowserView bounds:", error);
      }
    }
  }

  public updateCanvasOffset(offsetX: number, offsetY: number): void {
    // Update all BrowserView positions to account for canvas panning
    for (const [windowId, webview] of this.webviews) {
      if (webview.browserView && this.mainWindow) {
        try {
          const titleBarHeight = 40;
          const navigationBarHeight = 60;

          const adjustedBounds = {
            x: webview.bounds.x + offsetX,
            y:
              webview.bounds.y + offsetY + titleBarHeight + navigationBarHeight,
            width: webview.bounds.width,
            height:
              webview.bounds.height - titleBarHeight - navigationBarHeight,
          };

          webview.browserView.setBounds(adjustedBounds);
        } catch (error) {
          console.error("Failed to update BrowserView canvas offset:", error);
        }
      }
    }
  }

  public async goBack(windowId: string): Promise<void> {
    const webview = this.webviews.get(windowId);
    if (!webview || !webview.browserView) {
      throw new Error(`Webview ${windowId} not found`);
    }

    if (webview.browserView.webContents.canGoBack()) {
      webview.browserView.webContents.goBack();
    }
  }

  public async goForward(windowId: string): Promise<void> {
    const webview = this.webviews.get(windowId);
    if (!webview || !webview.browserView) {
      throw new Error(`Webview ${windowId} not found`);
    }

    if (webview.browserView.webContents.canGoForward()) {
      webview.browserView.webContents.goForward();
    }
  }

  public async reload(windowId: string): Promise<void> {
    const webview = this.webviews.get(windowId);
    if (!webview || !webview.browserView) {
      throw new Error(`Webview ${windowId} not found`);
    }

    webview.browserView.webContents.reload();
  }

  public async getWebviewContent(windowId: string): Promise<string> {
    const webview = this.webviews.get(windowId);
    if (!webview || !webview.browserView) {
      throw new Error(`Webview ${windowId} not found`);
    }

    // Get the HTML content directly from the BrowserView
    return await webview.browserView.webContents.executeJavaScript(`
      document.documentElement.outerHTML;
    `);
  }

  public getWebview(windowId: string): WebviewInstance | undefined {
    return this.webviews.get(windowId);
  }

  public getAllWebviews(): WebviewInstance[] {
    return Array.from(this.webviews.values());
  }

  public removeWebview(windowId: string): void {
    const webview = this.webviews.get(windowId);
    if (webview) {
      // Remove from main window
      if (webview.browserView && this.mainWindow) {
        try {
          this.mainWindow.removeBrowserView(webview.browserView);
        } catch (error) {
          // BrowserView might not be attached
        }
      }

      // Close the BrowserView
      if (webview.browserView) {
        webview.browserView.webContents.close();
      }

      this.webviews.delete(windowId);
    }
  }

  public dispose(): void {
    // Clean up all webviews
    for (const [windowId] of this.webviews) {
      this.removeWebview(windowId);
    }
    this.webviews.clear();
  }

  private setupBrowserViewListeners(
    windowId: string,
    browserView: BrowserView
  ): void {
    browserView.webContents.on("did-start-loading", () => {
      this.emitWebviewEvent(windowId, "did-start-loading");
    });

    browserView.webContents.on("did-stop-loading", () => {
      this.emitWebviewEvent(windowId, "did-stop-loading");
    });

    browserView.webContents.on("did-navigate", (event, navigationUrl) => {
      // Update the webview instance URL
      const webview = this.webviews.get(windowId);
      if (webview) {
        webview.url = navigationUrl;
      }
      this.emitWebviewEvent(windowId, "did-navigate", { url: navigationUrl });
    });

    browserView.webContents.on("page-title-updated", (event, title) => {
      // Update the webview instance title
      const webview = this.webviews.get(windowId);
      if (webview) {
        webview.title = title;
      }
      this.emitWebviewEvent(windowId, "page-title-updated", { title });
    });

    browserView.webContents.on("did-navigate-in-page", (event, url) => {
      this.emitWebviewEvent(windowId, "did-navigate-in-page", {
        url,
        canGoBack: browserView.webContents.canGoBack(),
        canGoForward: browserView.webContents.canGoForward(),
      });
    });
  }

  private emitWebviewEvent(
    windowId: string,
    type: string,
    data: any = {}
  ): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send("webview:event", {
        windowId,
        type,
        ...data,
      });
    }
  }
}
