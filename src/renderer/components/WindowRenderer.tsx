import React, { useState, useRef, useCallback } from "react";
import type { BaseWindow } from "@/shared/types";
import { WINDOW_CONFIGS } from "@/shared/constants";

interface WindowRendererProps {
  window: BaseWindow;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onMove: (position: { x: number; y: number }) => void;
  onResize: (size: { width: number; height: number }) => void;
  onUpdate: (updates: Partial<BaseWindow>) => void;
}

export const WindowRenderer: React.FC<WindowRendererProps> = ({
  window,
  isSelected,
  onSelect,
  onDelete,
  onMove,
  onResize,
  onUpdate,
}) => {
  const windowRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
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

  const windowConfig = WINDOW_CONFIGS[window.type];

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
        onMove({
          x: dragStart.windowX + deltaX,
          y: dragStart.windowY + deltaY,
        });
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

        onResize({ width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
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
        zIndex: window.zIndex,
        backgroundColor: "#374151",
        border: isSelected ? "2px solid #3b82f6" : "1px solid #4b5563",
        borderRadius: "8px",
        boxShadow:
          "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        overflow: "hidden",
        userSelect: "none",
        opacity: window.isLocked ? 0.8 : 1,
      }}
      onClick={onSelect}
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
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "16px" }}>{windowConfig.icon}</span>
          <span
            style={{
              fontSize: "14px",
              fontWeight: "500",
              color: "#f9fafb",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {window.title}
          </span>
          {window.isLocked && (
            <span style={{ fontSize: "12px", color: "#9ca3af" }}>🔒</span>
          )}
        </div>

        <div style={{ display: "flex", gap: "4px" }}>
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
        <WindowContent window={window} onUpdate={onUpdate} />
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
    </div>
  );
};

// Window content component based on window type
const WindowContent: React.FC<{
  window: BaseWindow;
  onUpdate: (updates: Partial<BaseWindow>) => void;
}> = ({ window, onUpdate }) => {
  switch (window.type) {
    case "webview":
    case "reference-webview":
      return (
        <div>
          <h3>Webview Window</h3>
          <p>URL: {window.metadata?.url || "No URL set"}</p>
          <p>This will be a webview component once implemented.</p>
        </div>
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
          <h3>AI Chat</h3>
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
        <div>
          <h3>Code Execution</h3>
          <select
            style={{
              marginBottom: "8px",
              padding: "4px",
              backgroundColor: "#111827",
              color: "#f9fafb",
              border: "1px solid #4b5563",
              borderRadius: "4px",
            }}
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
          </select>
          <textarea
            style={{
              width: "100%",
              height: "150px",
              backgroundColor: "#111827",
              color: "#f9fafb",
              border: "1px solid #4b5563",
              borderRadius: "4px",
              padding: "8px",
              fontFamily: "monospace",
              fontSize: "14px",
            }}
            placeholder="Enter code to execute..."
          />
          <button
            style={{
              marginTop: "8px",
              padding: "8px 16px",
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Run Code
          </button>
        </div>
      );

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
