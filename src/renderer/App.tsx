import React, { useState, useEffect } from "react";
import { Canvas } from "./canvas/Canvas";
import { Toolbar } from "./components/Toolbar";
import { WindowRenderer } from "./components/WindowRenderer";
import { AISidebar } from "./components/AISidebar";
import type { BaseWindow, CanvasState, WindowType, CodeExecutionRequest, CodeExecutionResult } from "@/shared/types";
import { APP_CONFIG } from "@/shared/constants";

export const App: React.FC = () => {
  const [windows, setWindows] = useState<BaseWindow[]>([]);
  const [canvasState, setCanvasState] = useState<CanvasState>({
    viewport: APP_CONFIG.canvasDefaults.viewport,
    dimensions: { width: window.innerWidth, height: window.innerHeight }, // Full width since sidebar is floating
  });
  const [sidebarWidth, setSidebarWidth] = useState<number>(300);
  const [selectedWindowId, setSelectedWindowId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState<{ id: string; message: string }[]>([]);

  // Code execution function
  const executeCode = async (request: CodeExecutionRequest): Promise<CodeExecutionResult> => {
    try {
      const response = await (window as any).electronAPI.invoke('code:execute', request);
      if (!response.success) {
        throw new Error(response.error);
      }
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  // Initialize the app and load existing windows
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Load existing windows from main process
        const result = await window.electronAPI.invoke("windows:get-all");
        if (result.success) {
          setWindows(result.data || []);
        }
      } catch (error) {
        console.error("Failed to load windows:", error);
      } finally {
        setIsLoading(false);
      }
    };

    // Listen for window creation events from AI tools
    const handleWindowCreated = (_event: any, window: BaseWindow) => {
      console.log("[App] Received window:created event:", window.id);
      addWindowToState(window);
    };

    console.log("[App] Setting up window:created event listener");
    window.electronAPI.on("window:created", handleWindowCreated);
    window.electronAPI.on(
      "window:updated",
      (_event: any, updated: BaseWindow) => {
        setWindows((prev) =>
          prev.map((w) => (w.id === updated.id ? updated : w))
        );
      }
    );

    initializeApp();

    return () => {
      console.log("[App] Cleaning up window:created event listener");
      window.electronAPI.removeAllListeners("window:created");
      window.electronAPI.removeAllListeners("window:updated");
    };
  }, []);

  // Toast listener for errors/info from main process (e.g., AI sanitization)
  useEffect(() => {
    const handleToast = (_event: unknown, message: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev, { id, message }]);
      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    };

    window.electronAPI.on(
      "ui:toast",
      handleToast as unknown as (event: any, ...args: any[]) => void
    );

    return () => {
      window.electronAPI.removeAllListeners("ui:toast");
    };
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setCanvasState((prev) => ({
        ...prev,
        dimensions: {
          width: window.innerWidth,
          height: window.innerHeight,
        }, // Full width since sidebar is floating
      }));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const addWindowToState = (newWindow: BaseWindow) => {
    setWindows((prev) => {
      if (prev.some((w) => w.id === newWindow.id)) {
        return prev;
      }
      return [...prev, newWindow];
    });
    setSelectedWindowId(newWindow.id);
  };

  const handleCreateWindow = async (type: WindowType) => {
    try {
      const result = await window.electronAPI.invoke("window:create", {
        type,
        config: {
          position: {
            x: canvasState.viewport.x + 100,
            y: canvasState.viewport.y + 100,
          },
        },
      });

      if (result.success) {
        addWindowToState(result.data);
      }
    } catch (error) {
      console.error("Failed to create window:", error);
    }
  };

  const handleDeleteWindow = async (windowId: string) => {
    try {
      const result = await window.electronAPI.invoke("window:delete", {
        windowId,
      });
      if (result.success) {
        setWindows((prev) => prev.filter((w) => w.id !== windowId));
        if (selectedWindowId === windowId) {
          setSelectedWindowId(null);
        }
      }
    } catch (error) {
      console.error("Failed to delete window:", error);
    }
  };

  const handleUpdateWindow = async (
    windowId: string,
    updates: Partial<BaseWindow>
  ) => {
    try {
      const result = await window.electronAPI.invoke("window:update", {
        windowId,
        updates,
      });

      if (result.success) {
        setWindows((prev) =>
          prev.map((w) => (w.id === windowId ? result.data : w))
        );
      }
    } catch (error) {
      console.error("Failed to update window:", error);
    }
  };

  const handleMoveWindow = async (
    windowId: string,
    position: { x: number; y: number }
  ) => {
    try {
      const result = await window.electronAPI.invoke("window:move", {
        windowId,
        position,
      });

      if (result.success) {
        setWindows((prev) =>
          prev.map((w) => (w.id === windowId ? result.data : w))
        );
      }
    } catch (error) {
      console.error("Failed to move window:", error);
    }
  };

  const handleResizeWindow = async (
    windowId: string,
    size: { width: number; height: number }
  ) => {
    try {
      const result = await window.electronAPI.invoke("window:resize", {
        windowId,
        size,
      });

      if (result.success) {
        setWindows((prev) =>
          prev.map((w) => (w.id === windowId ? result.data : w))
        );
      }
    } catch (error) {
      console.error("Failed to resize window:", error);
    }
  };

  const handleCanvasViewportChange = (viewport: CanvasState["viewport"]) => {
    setCanvasState((prev) => ({ ...prev, viewport }));
    // Optionally save to main process
    window.electronAPI.invoke("canvas:update-viewport", { viewport });
  };

  const handleCreateTextWindow = async (label: string, content?: string) => {
    try {
      const result = await window.electronAPI.invoke("window:create", {
        type: "text",
        config: {
          title: label,
          position: {
            x: canvasState.viewport.x + 100,
            y: canvasState.viewport.y + 100,
          },
          metadata: {
            label,
            content: content || "",
          },
        },
      });

      if (result.success) {
        addWindowToState(result.data);
      }
    } catch (error) {
      console.error("Failed to create text window:", error);
    }
  };

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          background: "#1f2937",
          color: "#f9fafb",
          fontSize: "18px",
        }}
      >
        Loading Bitcave...
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* Grabbable title bar area */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0, // Full width since sidebar is floating
          height: "40px",
          backgroundColor: "rgba(31, 41, 55, 0.2)",
          backdropFilter: "blur(10px)",
          zIndex: 200,
          // @ts-ignore - WebkitAppRegion is a valid CSS property for Electron
          WebkitAppRegion: "drag",
          borderBottom: "1px solid rgba(75, 85, 99, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#9ca3af",
          fontSize: "14px",
          fontWeight: "500",
        }}
      >
        Bitcave!
      </div>

      <div style={{ width: "100%", height: "100%" }}>
        <Canvas
          state={canvasState}
          onViewportChange={handleCanvasViewportChange}
        >
          {windows.map((window) => (
            <WindowRenderer
              key={window.id}
              window={window}
              isSelected={selectedWindowId === window.id}
              onSelect={() => setSelectedWindowId(window.id)}
              onDelete={() => handleDeleteWindow(window.id)}
              onMove={(position) => handleMoveWindow(window.id, position)}
              onResize={(size) => handleResizeWindow(window.id, size)}
              onUpdate={(updates) => handleUpdateWindow(window.id, updates)}
              onExecuteCode={executeCode}
            />
          ))}
        </Canvas>
      </div>

      <Toolbar
        onCreateWindow={handleCreateWindow}
        selectedWindowId={selectedWindowId}
        windowCount={windows.length}
        canvasState={canvasState}
      />

      <AISidebar
        windows={windows}
        onCreateTextWindow={handleCreateTextWindow}
        onWidthChange={(w) => setSidebarWidth(Math.round(w))}
      />

      {/* Toasts */}
      <div
        style={{
          position: "fixed",
          bottom: 16,
          right: 16,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          zIndex: 10000,
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              backgroundColor: "#111827",
              color: "#f9fafb",
              border: "1px solid #374151",
              borderRadius: 8,
              padding: "10px 12px",
              boxShadow:
                "0 10px 15px -3px rgba(0,0,0,0.5), 0 4px 6px -2px rgba(0,0,0,0.5)",
              maxWidth: 360,
              fontSize: 13,
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
};
