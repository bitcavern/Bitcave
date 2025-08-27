import React, { useState } from "react";
import type { CanvasState, WindowType } from "@/shared/types";
import { WINDOW_CONFIGS } from "@/shared/constants";

interface ToolbarProps {
  onCreateWindow: (type: WindowType) => void;
  selectedWindowId: string | null;
  windowCount: number;
  canvasState: CanvasState;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onCreateWindow,
  selectedWindowId,
  windowCount,
  canvasState,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const windowTypes: { type: WindowType; label: string }[] = [
    { type: "text", label: "Text Document" },
    { type: "webview", label: "Webview" },
    { type: "reference-webview", label: "Reference" },
    { type: "markdown-editor", label: "Markdown" },
    { type: "graph", label: "Graph" },
    { type: "chat", label: "AI Chat" },
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
        top: "20px",
        left: "20px",
        zIndex: 100,
        backgroundColor: "rgba(31, 41, 55, 0.95)",
        backdropFilter: "blur(10px)",
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
            fontFamily: "monospace",
          }}
        >
          <span>Windows: {windowCount}</span>
          <span>Zoom: {Math.round(canvasState.viewport.zoom * 100)}%</span>
          {selectedWindowId && (
            <span style={{ color: "#3b82f6" }}>
              Selected: {selectedWindowId.slice(0, 8)}...
            </span>
          )}
        </div>

        {/* AI Status Indicator */}
        <div
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
          <span>AI Ready</span>
        </div>
      </div>

      {/* Click outside to close dropdown */}
      {isExpanded && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: -1,
          }}
          onClick={() => setIsExpanded(false)}
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
