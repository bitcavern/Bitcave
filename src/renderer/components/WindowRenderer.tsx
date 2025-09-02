import React, { useState, useRef, useCallback } from "react";
import type {
  BaseWindow,
  CodeExecutionRequest,
  CodeExecutionResult,
} from "@/shared/types";
import { WINDOW_CONFIGS, APP_CONFIG } from "@/shared/constants";
import CodeExecutionWindow from "../windows/CodeExecutionWindow";
import { WebviewWindow } from "../windows/WebviewWindow";
import { ArtifactWindow } from "../windows/ArtifactWindow";
import { GlobalArtifactsModal } from "./GlobalArtifactsModal";

interface WindowRendererProps {
  window: BaseWindow;
  windows: BaseWindow[];
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onMove: (position: { x: number; y: number }) => void;
  onResize: (size: { width: number; height: number }) => void;
  onUpdate: (updates: Partial<BaseWindow>) => void;
  onExecuteCode?: (
    request: CodeExecutionRequest
  ) => Promise<CodeExecutionResult>;
  snapToGrid?: boolean;
}

// Grid snapping utility function
const snapToGrid = (value: number, gridSize: number): number => {
  return Math.round(value / gridSize) * gridSize;
};

const findNearestEmptySpace = (draggedWindow: BaseWindow, windows: BaseWindow[]): { x: number, y: number } => {
  const { x, y, width, height } = draggedWindow.position;
  const otherWindows = windows.filter(w => w.id !== draggedWindow.id);

  let bestPosition = { x, y };
  let minDistance = Infinity;
  let isOverlapping = false;

  for (const w of otherWindows) {
    if (
      x < w.position.x + w.size.width &&
      x + width > w.position.x &&
      y < w.position.y + w.size.height &&
      y + height > w.position.y
    ) {
      isOverlapping = true;

      // Calculate potential snap positions
      const snapPositions = [
        { x: w.position.x + w.size.width, y: w.position.y }, // Right
        { x: w.position.x - width, y: w.position.y }, // Left
        { x: w.position.x, y: w.position.y + w.size.height }, // Bottom
        { x: w.position.x, y: w.position.y - height }, // Top
      ];

      for (const pos of snapPositions) {
        const distance = Math.sqrt(Math.pow(pos.x - x, 2) + Math.pow(pos.y - y, 2));
        if (distance < minDistance) {
          minDistance = distance;
          bestPosition = pos;
        }
      }
    }
  }

  return isOverlapping ? bestPosition : { x, y };
};

export const WindowRenderer: React.FC<WindowRendererProps> = ({
  window,
  isSelected,
  onSelect,
  onDelete,
  onMove,
  onResize,
  onUpdate,
  onExecuteCode,
  snapToGrid: snapToGridEnabled = APP_CONFIG.grid.snapEnabled,
  windows,
}) => {
  const windowRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [opacity, setOpacity] = useState(1);
  const [showGlobalArtifactsModal, setShowGlobalArtifactsModal] = useState(false);
  const [dragStart, setDragStart] = useState({
    x: 0,
    y: 0,
    windowX: 0,
    windowY: 0,
  });
  const [resizeStart, setResizeStart] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    direction: "",
  });
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(window.title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const windowConfig = WINDOW_CONFIGS[window.type];

  // Handle title editing
  const handleTitleClick = useCallback(() => {
    if (window.isLocked) return;
    setIsEditingTitle(true);
    setEditTitle(window.title);
    setTimeout(() => titleInputRef.current?.focus(), 0);
  }, [window.isLocked, window.title]);

  const handleTitleSubmit = useCallback(() => {
    if (editTitle.trim() && editTitle !== window.title) {
      onUpdate({
        title: editTitle.trim(),
        metadata: {
          ...window.metadata,
          label: editTitle.trim(),
        },
      });
    }
    setIsEditingTitle(false);
  }, [editTitle, window.title, window.metadata, onUpdate]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleTitleSubmit();
      } else if (e.key === "Escape") {
        setEditTitle(window.title);
        setIsEditingTitle(false);
      }
    },
    [handleTitleSubmit, window.title]
  );

  // Update local title when window title changes
  React.useEffect(() => {
    setEditTitle(window.title);
  }, [window.title]);

  // Handle title bar drag for moving
  const handleTitleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (window.isLocked) return;

      event.stopPropagation();
      setIsDragging(true);
      setDragStart({
        x: event.clientX,
        y: event.clientY,
        windowX: window.position.x,
        windowY: window.position.y,
      });
      onSelect();
    },
    [window.isLocked, window.position, onSelect]
  );

  // Handle resize handle drag
  const handleResizeMouseDown = useCallback(
    (event: React.MouseEvent, direction: string) => {
      if (window.isLocked) return;

      event.stopPropagation();
      setIsResizing(true);
      setResizeStart({
        x: event.clientX,
        y: event.clientY,
        width: window.size.width,
        height: window.size.height,
        direction,
      });
      onSelect();
    },
    [window.isLocked, window.size, onSelect]
  );

  // Handle mouse move for dragging and resizing
  React.useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (isDragging) {
        const deltaX = event.clientX - dragStart.x;
        const deltaY = event.clientY - dragStart.y;
        let newX = dragStart.windowX + deltaX;
        let newY = dragStart.windowY + deltaY;
        
        // Apply grid snapping if enabled
        if (snapToGridEnabled) {
          newX = snapToGrid(newX, APP_CONFIG.grid.size);
          newY = snapToGrid(newY, APP_CONFIG.grid.size);
        }

        // Check for collisions
        let colliding = false;
        for (const w of windows) {
          if (w.id === window.id) continue;
          if (
            newX < w.position.x + w.size.width &&
            newX + window.size.width > w.position.x &&
            newY < w.position.y + w.size.height &&
            newY + window.size.height > w.position.y
          ) {
            colliding = true;
            break;
          }
        }

        setOpacity(colliding ? 0.5 : 1);
        
        onMove({ x: newX, y: newY });
      } else if (isResizing) {
        const deltaX = event.clientX - resizeStart.x;
        const deltaY = event.clientY - resizeStart.y;

        let newWidth = resizeStart.width;
        let newHeight = resizeStart.height;

        if (resizeStart.direction.includes("e")) {
          newWidth = Math.max(
            windowConfig.minSize.width,
            resizeStart.width + deltaX
          );
        }
        if (resizeStart.direction.includes("s")) {
          newHeight = Math.max(
            windowConfig.minSize.height,
            resizeStart.height + deltaY
          );
        }
        if (resizeStart.direction.includes("w")) {
          newWidth = Math.max(
            windowConfig.minSize.width,
            resizeStart.width - deltaX
          );
        }
        if (resizeStart.direction.includes("n")) {
          newHeight = Math.max(
            windowConfig.minSize.height,
            resizeStart.height - deltaY
          );
        }

        // Apply grid snapping to resize if enabled
        if (snapToGridEnabled) {
          newWidth = snapToGrid(newWidth, APP_CONFIG.grid.size);
          newHeight = snapToGrid(newHeight, APP_CONFIG.grid.size);
          // Ensure minimum size after snapping
          newWidth = Math.max(windowConfig.minSize.width, newWidth);
          newHeight = Math.max(windowConfig.minSize.height, newHeight);
        }

        onResize({ width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        const newPosition = findNearestEmptySpace(window, windows);
        onMove(newPosition);
      }
      setIsDragging(false);
      setIsResizing(false);
      setOpacity(1);
    };

    if (isDragging || isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [
    isDragging,
    isResizing,
    dragStart,
    resizeStart,
    onMove,
    onResize,
    windowConfig.minSize,
  ]);

  if (window.isMinimized) {
    return null; // Don't render minimized windows
  }

  return (
    <div
      ref={windowRef}
      className="window"
      style={{
        position: "absolute",
        left: window.position.x,
        top: window.position.y,
        width: window.size.width,
        height: window.size.height,
        zIndex: isDragging ? 1000 : window.zIndex,
        backgroundColor: "#374151",
        border: isSelected ? "2px solid #3b82f6" : "1px solid #4b5563",
        borderRadius: "8px",
        boxShadow:
          "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        overflow: "hidden",
        userSelect: "none",
        opacity: isDragging ? opacity : (window.isLocked ? 0.8 : 1),
      }}
      onClick={onSelect}
      onMouseDown={(e) => {
        if (e.button === 2) { // Right click
          handleTitleMouseDown(e);
        }
      }}
    >
      {/* Title Bar */}
      <div
        style={{
          height: "32px",
          backgroundColor: "#4b5563",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          cursor: window.isLocked ? "default" : "move",
          borderBottom: "1px solid #6b7280",
        }}
        onMouseDown={handleTitleMouseDown}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flex: 1,
            minWidth: 0,
          }}
        >
          <span style={{ fontSize: "16px" }}>{windowConfig.icon}</span>
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={handleTitleKeyDown}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                fontSize: "14px",
                fontWeight: "500",
                color: "#f9fafb",
                background: "#1f2937",
                border: "1px solid #3b82f6",
                borderRadius: "4px",
                padding: "2px 6px",
                outline: "none",
                minWidth: 0,
                flex: 1,
              }}
            />
          ) : (
            <span
              onClick={handleTitleClick}
              style={{
                fontSize: "14px",
                fontWeight: "500",
                color: "#f9fafb",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                cursor: window.isLocked ? "default" : "pointer",
                flex: 1,
                minWidth: 0,
                padding: "2px 4px",
                borderRadius: "4px",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) => {
                if (!window.isLocked) {
                  e.currentTarget.style.backgroundColor =
                    "rgba(59, 130, 246, 0.2)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
              title={window.isLocked ? undefined : "Click to edit title"}
            >
              {window.title}
            </span>
          )}
          {window.isLocked && (
            <span style={{ fontSize: "12px", color: "#9ca3af" }}>🔒</span>
          )}
        </div>

        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          {/* Artifact management buttons */}
          {window.type === 'artifact' && (
            <>
              <button
                style={{
                  background: "rgba(34, 197, 94, 0.2)",
                  border: "1px solid rgba(34, 197, 94, 0.3)",
                  borderRadius: "4px",
                  padding: "2px 6px",
                  fontSize: "10px",
                  color: "#22c55e",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "2px"
                }}
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const artifactId = window.metadata?.artifact?.id;
                    if (artifactId) {
                      const result = await (window as any).electronAPI.invoke('artifact:save-globally', {
                        artifactId,
                        name: window.title
                      });
                      if (result.success) {
                        // Show success feedback
                        const button = e.currentTarget;
                        const originalText = button.textContent;
                        button.textContent = '✓ Saved!';
                        button.style.backgroundColor = 'rgba(34, 197, 94, 0.3)';
                        setTimeout(() => {
                          button.textContent = originalText;
                          button.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
                        }, 2000);
                      }
                    } else {
                      // Show error feedback
                      const button = e.currentTarget;
                      const originalText = button.textContent;
                      button.textContent = '❌ No artifact';
                      button.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                      button.style.color = '#ef4444';
                      setTimeout(() => {
                        button.textContent = originalText;
                        button.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
                        button.style.color = '#22c55e';
                      }, 2000);
                    }
                  } catch (error) {
                    console.error('Failed to save artifact globally:', error);
                    // Show error feedback
                    const button = e.currentTarget;
                    const originalText = button.textContent;
                    button.textContent = '❌ Error';
                    button.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                    button.style.color = '#ef4444';
                    setTimeout(() => {
                      button.textContent = originalText;
                      button.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
                      button.style.color = '#22c55e';
                    }, 2000);
                  }
                }}
                title="Save artifact globally for use in other projects"
              >
                💾 Save
              </button>
              <button
                style={{
                  background: "rgba(59, 130, 246, 0.2)",
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                  borderRadius: "4px",
                  padding: "2px 6px",
                  fontSize: "10px",
                  color: "#3b82f6",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "2px"
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowGlobalArtifactsModal(true);
                }}
                title="Browse and import global artifacts"
              >
                📚 Library
              </button>
            </>
          )}
          
          <button
            style={{
              width: "16px",
              height: "16px",
              borderRadius: "50%",
              border: "none",
              backgroundColor: "#f59e0b",
              cursor: "pointer",
            }}
            onClick={(e) => {
              e.stopPropagation();
              onUpdate({ isMinimized: true });
            }}
            title="Minimize"
          />
          <button
            style={{
              width: "16px",
              height: "16px",
              borderRadius: "50%",
              border: "none",
              backgroundColor: "#ef4444",
              cursor: "pointer",
            }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Close"
          />
        </div>
      </div>

      {/* Window Content */}
      <div
        style={{
          flex: 1,
          height: "calc(100% - 32px)",
          backgroundColor: "#1f2937",
          color: "#f9fafb",
          padding: "16px",
          overflow: "auto",
        }}
      >
        <WindowContent
          window={window}
          onUpdate={onUpdate}
          onExecuteCode={onExecuteCode}
        />
      </div>

      {/* Resize Handles */}
      {!window.isLocked && windowConfig.resizable && (
        <>
          {/* Corner handles */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: "12px",
              height: "12px",
              cursor: "se-resize",
              backgroundColor: "transparent",
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, "se")}
          />
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              width: "12px",
              height: "12px",
              cursor: "sw-resize",
              backgroundColor: "transparent",
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, "sw")}
          />
          <div
            style={{
              position: "absolute",
              top: 32,
              right: 0,
              width: "12px",
              height: "12px",
              cursor: "ne-resize",
              backgroundColor: "transparent",
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, "ne")}
          />
          <div
            style={{
              position: "absolute",
              top: 32,
              left: 0,
              width: "12px",
              height: "12px",
              cursor: "nw-resize",
              backgroundColor: "transparent",
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, "nw")}
          />

          {/* Edge handles */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: "12px",
              right: "12px",
              height: "4px",
              cursor: "s-resize",
              backgroundColor: "transparent",
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, "s")}
          />
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "44px",
              bottom: "12px",
              width: "4px",
              cursor: "e-resize",
              backgroundColor: "transparent",
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, "e")}
          />
        </>
      )}
      
      {/* Global Artifacts Modal */}
      {showGlobalArtifactsModal && (
        <GlobalArtifactsModal
          isOpen={showGlobalArtifactsModal}
          onClose={() => setShowGlobalArtifactsModal(false)}
          onImportArtifact={(artifactId) => {
            // Handle imported artifact - create a new artifact window
            console.log('Imported artifact:', artifactId);
            // The modal handles the actual import through IPC
          }}
        />
      )}
    </div>
  );
};

// Window content component based on window type
const WindowContent: React.FC<{
  window: BaseWindow;
  onUpdate: (updates: Partial<BaseWindow>) => void;
  onExecuteCode?: (
    request: CodeExecutionRequest
  ) => Promise<CodeExecutionResult>;
}> = ({ window, onUpdate, onExecuteCode }) => {
  switch (window.type) {
    case "webview":
    case "reference-webview":
      return (
        <WebviewWindow
          window={window}
          onUpdateWindow={(windowId, updates) => onUpdate(updates)}
        />
      );

    case "markdown-editor":
      return (
        <div>
          <h3>Markdown Editor</h3>
          <textarea
            style={{
              width: "100%",
              height: "200px",
              backgroundColor: "#111827",
              color: "#f9fafb",
              border: "1px solid #4b5563",
              borderRadius: "4px",
              padding: "8px",
              resize: "none",
              fontFamily: "monospace",
            }}
            placeholder="Enter markdown content..."
            defaultValue={window.metadata?.content || ""}
          />
        </div>
      );

    case "chat":
      return (
        <div>
          <h3>Bit Chat</h3>
          <div
            style={{
              height: "200px",
              border: "1px solid #4b5563",
              borderRadius: "4px",
              padding: "8px",
              backgroundColor: "#111827",
              marginBottom: "8px",
              overflowY: "auto",
            }}
          >
            <p style={{ color: "#9ca3af", fontSize: "14px" }}>
              Chat messages will appear here...
            </p>
          </div>
          <input
            type="text"
            placeholder="Type a message..."
            style={{
              width: "100%",
              padding: "8px",
              backgroundColor: "#111827",
              color: "#f9fafb",
              border: "1px solid #4b5563",
              borderRadius: "4px",
            }}
          />
        </div>
      );

    case "code-execution":
      return (
        <CodeExecutionWindow
          window={window}
          onUpdateWindow={(windowId, updates) => onUpdate(updates)}
          onExecuteCode={onExecuteCode}
        />
      );
    case "artifact":
      // For artifact windows, the artifact data should be in window.metadata.artifact
      if (window.metadata?.artifact) {
        return (
          <ArtifactWindow
            artifact={window.metadata.artifact}
            onDataChange={(templateKey, data) => {
              // Notify about data changes for potential AI tool interactions
              console.log(`Artifact ${window.metadata.artifact.id} data changed:`, templateKey, data);
            }}
            onNotify={(message) => {
              // Send toast notification to user
              (window as any).electronAPI.invoke("ui:toast", message);
            }}
          />
        );
      } else {
        return (
          <div style={{ padding: "16px", color: "#6b7280", textAlign: "center" }}>
            No artifact data found. Use AI tools to create an artifact for this window.
          </div>
        );
      }

    case "text":
      return (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "12px",
              paddingBottom: "8px",
              borderBottom: "1px solid #374151",
              gap: 8,
            }}
          >
            <input
              type="text"
              value={window.metadata?.label || ""}
              onChange={(e) => {
                onUpdate({
                  title: e.target.value || "Untitled",
                  metadata: { ...window.metadata, label: e.target.value },
                });
              }}
              placeholder="Window label"
              style={{
                margin: 0,
                fontSize: "14px",
                fontWeight: 500,
                color: "#f9fafb",
                backgroundColor: "#111827",
                border: "1px solid #4b5563",
                borderRadius: 6,
                padding: "6px 8px",
                outline: "none",
                width: "60%",
              }}
            />
            <span
              style={{
                fontSize: "12px",
                color: "#9ca3af",
                fontFamily: "monospace",
              }}
            >
              ID: {window.id.slice(0, 8)}
            </span>
          </div>
          <textarea
            style={{
              width: "100%",
              height: "calc(100% - 60px)",
              backgroundColor: "#111827",
              color: "#f9fafb",
              border: "1px solid #4b5563",
              borderRadius: "4px",
              padding: "12px",
              fontSize: "14px",
              lineHeight: "1.5",
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              resize: "none",
              outline: "none",
            }}
            placeholder="Enter your text content here..."
            value={window.metadata?.content || ""}
            onChange={(e) => {
              onUpdate({
                metadata: {
                  ...window.metadata,
                  content: e.target.value,
                  lastModified: new Date().toISOString(),
                },
              });
            }}
          />
        </div>
      );

    default:
      return (
        <div>
          <h3>
            {window.type.charAt(0).toUpperCase() + window.type.slice(1)} Window
          </h3>
          <p>Window ID: {window.id}</p>
          <p>Created: {window.createdAt.toLocaleString()}</p>
          <p>This window type is not yet implemented.</p>
        </div>
      );
  }
};
