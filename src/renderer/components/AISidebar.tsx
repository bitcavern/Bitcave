import React, { useState, useRef, useEffect } from "react";
import type { BaseWindow } from "@/shared/types";

interface AISidebarProps {
  windows: BaseWindow[];
  onCreateTextWindow: (label: string, content?: string) => void;
  onWidthChange?: (width: number) => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

interface APIKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (apiKey: string) => void;
}

// API Key Modal Component
const APIKeyModal: React.FC<APIKeyModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [apiKey, setApiKey] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      onSave(apiKey.trim());
      setApiKey("");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#1f2937",
          border: "1px solid #374151",
          borderRadius: "12px",
          padding: "24px",
          width: "400px",
          maxWidth: "90vw",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 16px 0", color: "#f9fafb" }}>
          Configure OpenRouter API Key
        </h3>
        <p style={{ margin: "0 0 16px 0", color: "#9ca3af", fontSize: "14px" }}>
          Enter your OpenRouter API key to enable AI features. You can get one
          at{" "}
          <a
            href="https://openrouter.ai"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#3b82f6" }}
          >
            openrouter.ai
          </a>
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-or-v1-..."
            style={{
              width: "100%",
              padding: "12px",
              marginBottom: "16px",
              borderRadius: "6px",
              border: "1px solid #374151",
              backgroundColor: "#111827",
              color: "#f9fafb",
              fontSize: "14px",
              outline: "none",
            }}
            autoFocus
          />
          <div
            style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "1px solid #374151",
                backgroundColor: "transparent",
                color: "#9ca3af",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!apiKey.trim()}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: apiKey.trim() ? "#3b82f6" : "#374151",
                color: "#f9fafb",
                cursor: apiKey.trim() ? "pointer" : "not-allowed",
              }}
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const AISidebar: React.FC<AISidebarProps> = ({
  windows,
  onCreateTextWindow,
  onWidthChange,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [showAPIKeyModal, setShowAPIKeyModal] = useState(false);
  const [conversationId] = useState("main"); // Single conversation for now
  const [isResizing, setIsResizing] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(300);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Check if AI is configured on mount
  useEffect(() => {
    const checkConfiguration = async () => {
      try {
        const result = await window.electronAPI.invoke("ai:is-configured");
        if (result.success) {
          setIsConfigured(result.data);
          if (result.data && messages.length === 0) {
            // Add welcome message if configured
            setMessages([
              {
                id: "welcome",
                role: "system",
                content:
                  "🔑 AI Assistant ready! I can help you create and manage text windows, read content, and organize your workspace. What would you like to do?",
                timestamp: new Date(),
              },
            ]);
          }
        }
      } catch (error) {
        console.error("Failed to check AI configuration:", error);
      }
    };

    checkConfiguration();
  }, [messages.length]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle resize functionality
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.target === sidebarRef.current) {
        setIsResizing(true);
        resizeStartX.current = e.clientX;
        resizeStartWidth.current = sidebarWidth;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const deltaX = resizeStartX.current - e.clientX;
        const newWidth = Math.max(
          260,
          Math.min(600, resizeStartWidth.current + deltaX)
        );
        setSidebarWidth(newWidth);
        if (onWidthChange) {
          onWidthChange(newWidth);
        }
      }
    };

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    const sidebar = sidebarRef.current;
    if (sidebar) {
      sidebar.addEventListener("mousedown", handleMouseDown);
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      if (sidebar) {
        sidebar.removeEventListener("mousedown", handleMouseDown);
      }
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, sidebarWidth, onWidthChange]);

  const handleAPIKeySave = async (apiKey: string) => {
    try {
      const result = await window.electronAPI.invoke("ai:set-api-key", {
        apiKey,
      });
      if (result.success) {
        setIsConfigured(true);
        setMessages([
          {
            id: "welcome",
            role: "system",
            content:
              "AI Assistant ready! I can help you create and manage text windows, read content, and organize your workspace. What would you like to do?",
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error) {
      console.error("Failed to set API key:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isProcessing) return;

    if (!isConfigured) {
      setShowAPIKeyModal(true);
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsProcessing(true);

    try {
      const result = await window.electronAPI.invoke("ai:chat", {
        conversationId,
        message: userMessage.content,
      });

      if (result.success) {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: (result.data as string).replace(/^\s+/, ""),
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "system",
          content: `Error: ${result.error}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "system",
        content: `Failed to communicate with AI: ${(error as Error).message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: `${sidebarWidth}px`,
        height: "100vh",
        backgroundColor: "#1f2937",
        borderLeft: "1px solid #374151",
        display: "flex",
        flexDirection: "column",
        zIndex: 150,
      }}
    >
      {/* Resize handle */}
      <div
        ref={sidebarRef}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "4px",
          height: "100%",
          cursor: "col-resize",
          backgroundColor: "transparent",
          zIndex: 160,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "rgba(59, 130, 246, 0.3)";
        }}
        onMouseLeave={(e) => {
          if (!isResizing) {
            e.currentTarget.style.backgroundColor = "transparent";
          }
        }}
      />

      {/* Header */}
      <div
        style={{
          padding: "16px",
          borderBottom: "1px solid #374151",
          backgroundColor: "#111827",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "8px",
                height: "8px",
                backgroundColor: isConfigured ? "#10b981" : "#f59e0b",
                borderRadius: "50%",
                animation: isConfigured ? "pulse 2s infinite" : "none",
              }}
            />
            <h3
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: "600",
                color: "#f9fafb",
              }}
            >
              AI Assistant
            </h3>
          </div>
          <button
            onClick={() => setShowAPIKeyModal(true)}
            style={{
              padding: "4px 8px",
              borderRadius: "4px",
              border: "1px solid #374151",
              backgroundColor: "transparent",
              color: "#9ca3af",
              fontSize: "12px",
              cursor: "pointer",
            }}
            title="Configure API Key"
          >
            ⚙️
          </button>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: "12px",
            color: "#9ca3af",
          }}
        >
          {isConfigured
            ? "🔑 Ready to assist with windows and content"
            : "Click ⚙️ to configure API key"}
        </p>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          padding: "16px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              backgroundColor:
                message.role === "user"
                  ? "#3b82f6"
                  : message.role === "system"
                  ? "#374151"
                  : "#059669",
              color: "#f9fafb",
              fontSize: "14px",
              lineHeight: "1.4",
              alignSelf: message.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              whiteSpace: "pre-wrap",
            }}
          >
            {message.content}
          </div>
        ))}

        {isProcessing && (
          <div
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              backgroundColor: "#374151",
              color: "#9ca3af",
              fontSize: "14px",
              alignSelf: "flex-start",
              maxWidth: "85%",
            }}
          >
            AI is thinking...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        style={{
          padding: "16px",
          borderTop: "1px solid #374151",
          backgroundColor: "#111827",
        }}
      >
        <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              isConfigured
                ? "Ask AI to create or read text windows..."
                : "Configure API key to start chatting..."
            }
            disabled={isProcessing || !isConfigured}
            style={{
              flex: 1,
              maxHeight: "160px",
              minHeight: "38px",
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid #374151",
              backgroundColor: "#1f2937",
              color: "#f9fafb",
              fontSize: "14px",
              outline: "none",
              resize: "vertical",
              lineHeight: 1.4,
              overflowY: "auto",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#3b82f6";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#374151";
            }}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isProcessing || !isConfigured}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "none",
              backgroundColor:
                inputValue.trim() && !isProcessing && isConfigured
                  ? "#3b82f6"
                  : "#374151",
              color: "#f9fafb",
              fontSize: "14px",
              cursor:
                inputValue.trim() && !isProcessing && isConfigured
                  ? "pointer"
                  : "not-allowed",
              transition: "background-color 0.2s",
            }}
          >
            {isConfigured ? "Send" : "Config"}
          </button>
        </div>
      </form>

      <APIKeyModal
        isOpen={showAPIKeyModal}
        onClose={() => setShowAPIKeyModal(false)}
        onSave={handleAPIKeySave}
      />

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
