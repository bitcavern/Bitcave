import React, { useState } from "react";
import type { CanvasState, WindowType, BaseWindow } from "@/shared/types";
import { WINDOW_CONFIGS } from "@/shared/constants";

interface ToolbarProps {
  onCreateWindow: (type: WindowType) => void;
  selectedWindowId: string | null;
  windowCount: number;
  canvasState: CanvasState;
  windows: BaseWindow[];
  onRestoreWindow?: (windowId: string) => void;
  snapToGrid?: boolean;
  onToggleSnapToGrid?: () => void;
  leftSidebarVisible?: boolean;
  onToggleLeftSidebar?: () => void;
  leftSidebarWidth?: number;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onCreateWindow,
  selectedWindowId,
  windowCount,
  canvasState,
  windows,
  onRestoreWindow,
  snapToGrid = false,
  onToggleSnapToGrid,
  leftSidebarVisible = false,
  onToggleLeftSidebar,
  leftSidebarWidth = 400,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMinimized, setShowMinimized] = useState(false);

  const selectedWindow = selectedWindowId
    ? windows.find((w) => w.id === selectedWindowId)
    : null;
  const minimizedWindows = windows.filter((w) => w.isMinimized);
  const openWindows = windows.filter((w) => !w.isMinimized);
  const totalWindows = windows.length;

  const getWindowLabel = (window: BaseWindow): string => {
    // Try to get label from metadata first
    if (window.metadata?.label && typeof window.metadata.label === "string") {
      return window.metadata.label;
    }

    // Fall back to title
    if (window.title && window.title !== "Untitled Window") {
      return window.title;
    }

    // Generate untitled label with number
    const sameTypeWindows = windows.filter((w) => w.type === window.type);
    const index = sameTypeWindows.findIndex((w) => w.id === window.id) + 1;
    return `Untitled ${index}`;
  };

  const windowTypes: { type: WindowType; label: string }[] = [
    { type: "text", label: "Text Document" },
    { type: "webview", label: "Webview" },
    { type: "reference-webview", label: "Reference" },
    { type: "markdown-editor", label: "Markdown" },
    { type: "graph", label: "Graph" },
    { type: "chat", label: "Bit Chat" },
    { type: "code-execution", label: "Code" },
    { type: "artifact", label: "Artifact" },
    { type: "file-explorer", label: "Files" },
    { type: "terminal", label: "Terminal" },
    { type: "memory", label: "Memory" },
  ];

  return (
    <div
      style={{
        position: "fixed",
        top: "48px", // Account for 32px title bar + 16px spacing
        left: leftSidebarVisible ? `${leftSidebarWidth + 20}px` : "20px",
        zIndex: 100,
        transition: "left 0.3s ease",
        backdropFilter: "blur(10px)",
        backgroundColor: "rgba(31, 41, 55, 0.2)",
        border: "1px solid #4b5563",
        borderRadius: "12px",
        padding: "12px",
        boxShadow:
          "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
      }}
    >
      {/* Main toolbar buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {/* Add Window Button */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 12px",
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#2563eb";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#3b82f6";
            }}
          >
            <span>+</span>
            <span>Add Window</span>
            <span
              style={{
                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
              }}
            >
              ▼
            </span>
          </button>

          {/* Window type dropdown */}
          {isExpanded && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                marginTop: "8px",
                backgroundColor: "#374151",
                border: "1px solid #4b5563",
                borderRadius: "8px",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                minWidth: "200px",
                zIndex: 1000,
              }}
            >
              <div style={{ padding: "8px 0" }}>
                {windowTypes.map(({ type, label }) => {
                  const config = WINDOW_CONFIGS[type];
                  return (
                    <button
                      key={type}
                      onClick={() => {
                        onCreateWindow(type);
                        setIsExpanded(false);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        width: "100%",
                        padding: "8px 16px",
                        backgroundColor: "transparent",
                        color: "#f9fafb",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "14px",
                        textAlign: "left",
                        transition: "background-color 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#4b5563";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <span style={{ fontSize: "16px" }}>{config.icon}</span>
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Separator */}
        <div
          style={{
            width: "1px",
            height: "24px",
            backgroundColor: "#4b5563",
          }}
        />

        {/* Status Info */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            color: "#d1d5db",
            fontSize: "12px",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowMinimized(!showMinimized)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                backgroundColor: "#374151",
                color: "#f9fafb",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "500",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#4b5563";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#374151";
              }}
            >
              <span>
                Windows {openWindows.length}/{totalWindows}
              </span>
              <span
                style={{
                  transform: showMinimized ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                }}
              >
                ▼
              </span>
            </button>

            {/* Unified windows dropdown */}
            {showMinimized && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  marginTop: "8px",
                  backgroundColor: "#374151",
                  border: "1px solid #4b5563",
                  borderRadius: "8px",
                  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
                  minWidth: "240px",
                  zIndex: 1000,
                  maxHeight: "400px",
                  overflowY: "auto",
                }}
              >
                {/* Minimized windows section */}
                {minimizedWindows.length > 0 && (
                  <>
                    <div
                      style={{
                        padding: "8px 16px",
                        fontSize: "11px",
                        fontWeight: "600",
                        color: "#9ca3af",
                        borderBottom: "1px solid #4b5563",
                      }}
                    >
                      MINIMIZED ({minimizedWindows.length})
                    </div>
                    <div style={{ padding: "4px 0" }}>
                      {minimizedWindows.map((window) => {
                        const config = WINDOW_CONFIGS[window.type];
                        return (
                          <button
                            key={window.id}
                            onClick={() => {
                              if (onRestoreWindow) {
                                onRestoreWindow(window.id);
                              }
                              setShowMinimized(false);
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              width: "100%",
                              padding: "8px 16px",
                              backgroundColor: "transparent",
                              color: "#f9fafb",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "13px",
                              textAlign: "left",
                              transition: "background-color 0.2s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "#4b5563";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                "transparent";
                            }}
                          >
                            <span style={{ fontSize: "14px", opacity: 0.6 }}>
                              {config.icon}
                            </span>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "2px",
                              }}
                            >
                              <span style={{ fontWeight: "500", opacity: 0.8 }}>
                                {getWindowLabel(window)}
                              </span>
                              <span
                                style={{ fontSize: "11px", color: "#9ca3af" }}
                              >
                                {config.name}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Separator */}
                {minimizedWindows.length > 0 && openWindows.length > 0 && (
                  <div
                    style={{
                      height: "1px",
                      backgroundColor: "#4b5563",
                      margin: "4px 0",
                    }}
                  />
                )}

                {/* Open windows section */}
                {openWindows.length > 0 && (
                  <>
                    <div
                      style={{
                        padding: "8px 16px",
                        fontSize: "11px",
                        fontWeight: "600",
                        color: "#9ca3af",
                        borderBottom:
                          minimizedWindows.length > 0
                            ? "none"
                            : "1px solid #4b5563",
                      }}
                    >
                      OPEN ({openWindows.length})
                    </div>
                    <div style={{ padding: "4px 0" }}>
                      {openWindows.map((window) => {
                        const config = WINDOW_CONFIGS[window.type];
                        const isSelected = selectedWindowId === window.id;
                        return (
                          <button
                            key={window.id}
                            onClick={() => {
                              // TODO: Add smooth animation to center on window
                              setShowMinimized(false);
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              width: "100%",
                              padding: "8px 16px",
                              backgroundColor: isSelected
                                ? "#3b82f6"
                                : "transparent",
                              color: "#f9fafb",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "13px",
                              textAlign: "left",
                              transition: "background-color 0.2s",
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.backgroundColor =
                                  "#4b5563";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.backgroundColor =
                                  "transparent";
                              }
                            }}
                          >
                            <span style={{ fontSize: "14px" }}>
                              {config.icon}
                            </span>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "2px",
                              }}
                            >
                              <span style={{ fontWeight: "500" }}>
                                {getWindowLabel(window)}
                              </span>
                              <span
                                style={{ fontSize: "11px", color: "#9ca3af" }}
                              >
                                {config.name}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          {selectedWindow && (
            <span style={{ color: "#3b82f6", fontWeight: "500" }}>
              Selected: {getWindowLabel(selectedWindow)}
            </span>
          )}
        </div>

        {/* Left Sidebar Toggle */}
        {onToggleLeftSidebar && (
          <button
            onClick={onToggleLeftSidebar}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 10px",
              backgroundColor: leftSidebarVisible ? "#3b82f6" : "#374151",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "500",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = leftSidebarVisible ? "#2563eb" : "#4b5563";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = leftSidebarVisible ? "#3b82f6" : "#374151";
            }}
            title={leftSidebarVisible ? "Hide webview sidebar" : "Show webview sidebar"}
          >
            <span style={{ fontSize: "14px" }}>🌐</span>
            <span>Browser</span>
          </button>
        )}

        {/* Grid Snap Toggle */}
        {onToggleSnapToGrid && (
          <button
            onClick={onToggleSnapToGrid}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 10px",
              backgroundColor: snapToGrid ? "#059669" : "#374151",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "500",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = snapToGrid ? "#047857" : "#4b5563";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = snapToGrid ? "#059669" : "#374151";
            }}
            title={snapToGrid ? "Disable grid snapping" : "Enable grid snapping"}
          >
            <span style={{ fontSize: "14px" }}>⊞</span>
            <span>{snapToGrid ? "Grid ON" : "Grid OFF"}</span>
          </button>
        )}

        {/* Bit Status Indicator */}
        {/* <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 8px",
            backgroundColor: "#10b981",
            borderRadius: "12px",
            fontSize: "12px",
            color: "white",
          }}
        >
          <div
            style={{
              width: "6px",
              height: "6px",
              backgroundColor: "white",
              borderRadius: "50%",
              animation: "pulse 2s infinite",
            }}
          />
          <span>Bit Ready</span>
        </div> */}
      </div>

      {/* Click outside to close dropdowns */}
      {(isExpanded || showMinimized) && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: -1,
          }}
          onClick={() => {
            setIsExpanded(false);
            setShowMinimized(false);
          }}
        />
      )}

      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </div>
  );
};
