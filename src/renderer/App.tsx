import React, { useState, useEffect } from "react";
import { Canvas } from "./canvas/Canvas";
import { Toolbar } from "./components/Toolbar";
import { WindowRenderer } from "./components/WindowRenderer";
import { AISidebar } from "./components/AISidebar";
import { LeftSidebar } from "./components/LeftSidebar";
import { ProjectLauncher } from "./components/ProjectLauncher";
import { ProjectIndicator } from "./components/ProjectIndicator";
import type {
  BaseWindow,
  CanvasState,
  WindowType,
  CodeExecutionRequest,
  CodeExecutionResult,
} from "@/shared/types";
import { APP_CONFIG } from "@/shared/constants";

// Grid snapping utility function
const snapToGrid = (value: number, gridSize: number): number => {
  return Math.round(value / gridSize) * gridSize;
};

export const App: React.FC = () => {
  const [currentProject, setCurrentProject] = useState<string | null>(null);
  const [windows, setWindows] = useState<BaseWindow[]>([]);
  const [canvasState, setCanvasState] = useState<CanvasState>({
    viewport: APP_CONFIG.canvasDefaults.viewport,
    dimensions: { width: window.innerWidth, height: window.innerHeight },
  });
  const [sidebarWidth, setSidebarWidth] = useState<number>(300);
  const [selectedWindowId, setSelectedWindowId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState<{ id: string; message: string }[]>([]);
  const [snapToGridEnabled, setSnapToGridEnabled] = useState<boolean>(APP_CONFIG.grid.snapEnabled);
  const [leftSidebarVisible, setLeftSidebarVisible] = useState(false);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(400);

  // Code execution function
  const executeCode = async (
    request: CodeExecutionRequest
  ): Promise<CodeExecutionResult> => {
    try {
      const response = await (window as any).electronAPI.invoke(
        "code:execute",
        request
      );
      if (!response.success) {
        throw new Error(response.error);
      }
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  // Initialize the app and check for current project
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Check if there's a current project
        const projectResult = await window.electronAPI.invoke("projects:current");
        if (projectResult.success && projectResult.data) {
          setCurrentProject(projectResult.data.id);
          
          // Load existing windows from main process
          const windowsResult = await window.electronAPI.invoke("windows:get-all");
          if (windowsResult.success) {
            setWindows(windowsResult.data || []);
          }
        }
      } catch (error) {
        console.error("Failed to load app state:", error);
      } finally {
        setIsLoading(false);
      }
    };

    // Listen for window creation events from Bit tools
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

  // Toast listener for errors/info from main process (e.g., Bit sanitization)
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
          width: window.innerWidth - (leftSidebarVisible ? leftSidebarWidth : 0),
          height: window.innerHeight,
        },
      }));
    };

    window.addEventListener("resize", handleResize);
    
    // Update dimensions when sidebar state changes
    handleResize();
    
    return () => window.removeEventListener("resize", handleResize);
  }, [leftSidebarVisible, leftSidebarWidth]);

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
      const baseX = canvasState.viewport.x + 100;
      const baseY = canvasState.viewport.y + 100;
      
      // Snap initial position to grid if enabled
      const x = snapToGridEnabled 
        ? snapToGrid(baseX, APP_CONFIG.grid.size)
        : baseX;
      const y = snapToGridEnabled
        ? snapToGrid(baseY, APP_CONFIG.grid.size) 
        : baseY;
      
      const result = await window.electronAPI.invoke("window:create", {
        type,
        config: {
          position: { x, y },
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

  const handleRestoreWindow = async (windowId: string) => {
    try {
      const result = await window.electronAPI.invoke("window:restore", {
        windowId,
      });

      if (result.success) {
        setWindows((prev) =>
          prev.map((w) => (w.id === windowId ? result.data : w))
        );
      }
    } catch (error) {
      console.error("Failed to restore window:", error);
    }
  };

  const handleCanvasViewportChange = (viewport: CanvasState["viewport"]) => {
    setCanvasState((prev) => ({ ...prev, viewport }));
    // Optionally save to main process
    window.electronAPI.invoke("canvas:update-viewport", { viewport });

    // Update webview positions to account for canvas panning
    const updateWebviewOffset = async () => {
      try {
        await window.electronAPI.invoke("webview:update-canvas-offset", {
          offsetX: viewport.x,
          offsetY: viewport.y,
        });
      } catch (error) {
        console.error("Failed to update webview canvas offset:", error);
      }
    };

    updateWebviewOffset();
  };

  const handleCreateTextWindow = async (label: string, content?: string) => {
    try {
      const baseX = canvasState.viewport.x + 100;
      const baseY = canvasState.viewport.y + 100;
      
      // Snap initial position to grid if enabled
      const x = snapToGridEnabled 
        ? snapToGrid(baseX, APP_CONFIG.grid.size)
        : baseX;
      const y = snapToGridEnabled
        ? snapToGrid(baseY, APP_CONFIG.grid.size) 
        : baseY;
      
      const result = await window.electronAPI.invoke("window:create", {
        type: "text",
        config: {
          title: label,
          position: { x, y },
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

  const handleProjectOpen = async (projectId: string) => {
    try {
      setIsLoading(true);
      
      const result = await window.electronAPI.invoke("projects:open", { projectId });
      if (result.success) {
        setCurrentProject(projectId);
        
        // Load windows for the opened project
        const windowsResult = await window.electronAPI.invoke("windows:get-all");
        if (windowsResult.success) {
          setWindows(windowsResult.data || []);
        }
      }
    } catch (error) {
      console.error("Failed to open project:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update selected window in main process when it changes
  useEffect(() => {
    const updateSelectedWindow = async () => {
      try {
        await window.electronAPI.invoke("window:set-selected", {
          windowId: selectedWindowId,
        });
      } catch (error) {
        console.error("Failed to update selected window:", error);
      }
    };

    updateSelectedWindow();
  }, [selectedWindowId]);

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

  // Show project launcher if no project is selected
  if (!currentProject) {
    return <ProjectLauncher onProjectOpen={handleProjectOpen} />;
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* Project Indicator */}
      <ProjectIndicator
        leftSidebarVisible={leftSidebarVisible}
        leftSidebarWidth={leftSidebarWidth}
        onProjectChange={(projectId) => {
          if (projectId) {
            handleProjectOpen(projectId);
          } else {
            setCurrentProject(null);
            setWindows([]);
          }
        }}
      />

      <div 
        style={{ 
          width: "100%", 
          height: "100%",
          marginLeft: leftSidebarVisible ? `${leftSidebarWidth}px` : "0",
          transition: "margin-left 0.3s ease"
        }}
      >
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
              snapToGrid={snapToGridEnabled}
            />
          ))}
        </Canvas>
      </div>

      <Toolbar
        onCreateWindow={handleCreateWindow}
        selectedWindowId={selectedWindowId}
        windowCount={windows.length}
        canvasState={canvasState}
        windows={windows}
        onRestoreWindow={handleRestoreWindow}
        snapToGrid={snapToGridEnabled}
        onToggleSnapToGrid={() => setSnapToGridEnabled(!snapToGridEnabled)}
        leftSidebarVisible={leftSidebarVisible}
        onToggleLeftSidebar={() => setLeftSidebarVisible(!leftSidebarVisible)}
        leftSidebarWidth={leftSidebarWidth}
      />

      <LeftSidebar
        isVisible={leftSidebarVisible}
        onToggle={() => setLeftSidebarVisible(!leftSidebarVisible)}
        onWidthChange={(w) => setLeftSidebarWidth(Math.round(w))}
        initialWidth={leftSidebarWidth}
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
