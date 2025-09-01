import React, { useState, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import type { BaseWindow, ChatMessage, InlineExecution } from "@/shared/types";
import { InlineExecution as InlineExecutionComponent } from "./InlineExecution";

// Component for messages with hover functionality
interface MessageWithHoverProps {
  message: ChatMessage;
  onCreateCodeWindow: (executionId: string) => void;
  renderFormattedMessage: (content: string) => ReactNode;
}

const MessageWithHover: React.FC<MessageWithHoverProps> = ({
  message,
  onCreateCodeWindow,
  renderFormattedMessage,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);

  const handleCreateCodeWindow = () => {
    if (message.inlineExecution?.data) {
      console.log('Frontend: Creating code window with execution ID:', message.inlineExecution.data.executionId);
      console.log('Frontend: Full inline execution data:', message.inlineExecution.data);
      onCreateCodeWindow(message.inlineExecution.data.executionId);
    } else {
      console.log('Frontend: No inline execution data found in message');
      console.log('Frontend: Available inlineExecution:', message.inlineExecution);
    }
  };

  const handleMouseEnter = () => {
    if (message.inlineExecution?.data) {
      // Clear any existing timeout
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        setHoverTimeout(null);
      }
      setShowMenu(true);
    }
  };

  const handleMouseLeave = () => {
    // Add a delay before hiding the menu
    const timeout = setTimeout(() => {
      setShowMenu(false);
    }, 300); // 300ms delay
    setHoverTimeout(timeout);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
    };
  }, [hoverTimeout]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        paddingBottom: "40px", // Extra space for the button area
        marginBottom: "8px", // Extra margin to ensure hover area
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div style={{ overflowX: "auto" }}>
        {renderFormattedMessage(message.content)}
      </div>
      
      {/* Small Icon Button Below Message */}
      {showMenu && message.inlineExecution?.data && (
        <button
          onClick={handleCreateCodeWindow}
          style={{
            position: "absolute",
            top: "100%",
            right: "8px",
            marginTop: "4px",
            background: "#3b82f6",
            border: "none",
            borderRadius: "50%",
            width: "24px",
            height: "24px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
            color: "white",
            boxShadow: "0 2px 8px rgba(59, 130, 246, 0.3)",
            transition: "all 0.2s ease",
            zIndex: 1000,
            animation: "fadeIn 0.2s ease-in-out",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.4)";
            // Keep menu visible when hovering the button and clear any hide timeout
            if (hoverTimeout) {
              clearTimeout(hoverTimeout);
              setHoverTimeout(null);
            }
            setShowMenu(true);
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(59, 130, 246, 0.3)";
            // Start the hide timeout when leaving the button
            handleMouseLeave();
          }}
          title="Open source in code editor"
        >
          📝
        </button>
      )}

      <style>
        {`
          @keyframes fadeIn {
            0% { 
              opacity: 0; 
              transform: translateY(-4px); 
            }
            100% { 
              opacity: 1; 
              transform: translateY(0); 
            }
          }
        `}
      </style>
    </div>
  );
};

interface AISidebarProps {
  windows: BaseWindow[];
  onCreateTextWindow: (label: string, content?: string) => void;
  onWidthChange?: (width: number) => void;
}


interface APIKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (apiKey: string) => void;
}

// Lightweight formatter for basic markdown-like syntax: headings, bold, italics,
// inline code, and fenced code blocks. Purposefully minimal to avoid heavy deps.
const renderInline = (text: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let keyCounter = 0;

  // Inline code first: `code`
  const codeRegex = /`([^`]+)`/g;
  let match: RegExpExecArray | null;
  while ((match = codeRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const segment = text.slice(lastIndex, match.index);
      nodes.push(...applyBoldItalic(segment, () => keyCounter++));
    }
    nodes.push(
      <code
        key={`inline-code-${keyCounter++}`}
        style={{
          backgroundColor: "#1f2937",
          padding: "2px 6px",
          borderRadius: 4,
          border: "1px solid #374151",
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontStyle: "italic",
          color: "#d1d5db",
        }}
      >
        {match[1]}
      </code>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    nodes.push(...applyBoldItalic(text.slice(lastIndex), () => keyCounter++));
  }
  return nodes;
};

const applyBoldItalic = (text: string, nextKey: () => number): ReactNode[] => {
  const result: ReactNode[] = [];
  const boldRegex = /\*\*([^*]+)\*\*/g;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = boldRegex.exec(text)) !== null) {
    if (m.index > start) {
      result.push(...applyItalic(text.slice(start, m.index), nextKey));
    }
    result.push(
      <strong key={`b-${nextKey()}`}>{applyItalic(m[1], nextKey)}</strong>
    );
    start = m.index + m[0].length;
  }
  if (start < text.length) {
    result.push(...applyItalic(text.slice(start), nextKey));
  }
  return result;
};

const applyItalic = (text: string, nextKey: () => number): ReactNode[] => {
  const parts: ReactNode[] = [];
  const italicRegex = /\*([^*]+)\*|_([^_]+)_/g;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = italicRegex.exec(text)) !== null) {
    if (m.index > start) {
      parts.push(text.slice(start, m.index));
    }
    const content = m[1] || m[2] || "";
    parts.push(<em key={`i-${nextKey()}`}>{content}</em>);
    start = m.index + m[0].length;
  }
  if (start < text.length) {
    parts.push(text.slice(start));
  }
  return parts;
};

const renderFormattedMessage = (content: string): ReactNode => {
  const lines = content.split("\n");
  const nodes: ReactNode[] = [];
  let i = 0;
  let keyCounter = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine ?? "";

    // Fenced code block: ``` or ~~~
    if (line.trim().startsWith("```") || line.trim().startsWith("~~~")) {
      const fence = line.trim().slice(0, 3);
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith(fence)) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith(fence)) {
        i++;
      }
      const codeText = codeLines.join("\n");
      nodes.push(
        <div
          key={`code-${keyCounter++}`}
          style={{
            backgroundColor: "#1f2937",
            border: "1px solid #374151",
            borderRadius: 8,
            padding: 12,
            color: "#d1d5db",
            fontStyle: "italic",
            overflowX: "auto",
          }}
        >
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            <code
              style={{
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: 13,
              }}
            >
              {codeText}
            </code>
          </pre>
        </div>
      );
      continue;
    }

    // Skip blank lines
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Headings
    const h3 = line.match(/^\s*###\s+(.+)/);
    if (h3) {
      nodes.push(
        <div
          key={`h3-${keyCounter++}`}
          style={{ fontSize: 16, fontWeight: 600, margin: "6px 0" }}
        >
          {renderInline(h3[1])}
        </div>
      );
      i++;
      continue;
    }
    const h2 = line.match(/^\s*##\s+(.+)/);
    if (h2) {
      nodes.push(
        <div
          key={`h2-${keyCounter++}`}
          style={{ fontSize: 18, fontWeight: 700, margin: "8px 0" }}
        >
          {renderInline(h2[1])}
        </div>
      );
      i++;
      continue;
    }
    const h1 = line.match(/^\s*#\s+(.+)/);
    if (h1) {
      nodes.push(
        <div
          key={`h1-${keyCounter++}`}
          style={{ fontSize: 20, fontWeight: 700, margin: "10px 0" }}
        >
          {renderInline(h1[1])}
        </div>
      );
      i++;
      continue;
    }

    // Paragraph: collect consecutive lines until blank/fence
    const paraLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].trim().startsWith("~~~")
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    const paraText = paraLines.join(" ").trim();
    nodes.push(
      <p key={`p-${keyCounter++}`} style={{ margin: "8px 0" }}>
        {renderInline(paraText)}
      </p>
    );
  }

  return <>{nodes}</>;
};

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
          Enter your OpenRouter API key to enable Bit features. You can get one
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
  // windows,
  // onCreateTextWindow,
  onWidthChange,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [showAPIKeyModal, setShowAPIKeyModal] = useState(false);
  const [conversationId, setConversationId] = useState("main"); // Current conversation ID
  const [isResizing, setIsResizing] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(380);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(380);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const startNewChat = async () => {
    try {
      const result = await (window as any).electronAPI.invoke(
        "ai:new-conversation"
      );
      if (result.success) {
        const newConversationId = result.data;
        setConversationId(newConversationId);
        setMessages([]);

        // Add welcome message for new conversation
        if (isConfigured) {
          setMessages([
            {
              id: "welcome",
              role: "system",
              content:
                "🔑 Bit Assistant ready! I can help you create and manage text windows, read content, and organize your workspace. What would you like to do?",
              timestamp: new Date(),
            },
          ]);
        }
      }
    } catch (error) {
      console.error("Failed to start new chat:", error);
    }
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
                  "🔑 Bit Assistant ready! I can help you create and manage text windows, read content, and organize your workspace. What would you like to do?",
                timestamp: new Date(),
              },
            ]);
          }
        }
      } catch (error) {
        console.error("Failed to check Bit configuration:", error);
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
          320,
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
              "Bit Assistant ready! I can help you create and manage text windows, read content, and organize your workspace. What would you like to do?",
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error) {
      console.error("Failed to set API key:", error);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
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

    // Create abort controller for this request
    const controller = new AbortController();
    setAbortController(controller);

    try {
      const result = await window.electronAPI.invoke("ai:chat", {
        conversationId,
        message: userMessage.content,
      });

      if (result.success) {
        const responseData = result.data as { content: string; inlineExecution?: any };
        console.log('AISidebar: Response data received:', responseData);
        
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: responseData.content.replace(/^\s+/, ""),
          timestamp: new Date(),
          inlineExecution: responseData.inlineExecution,
        };
        console.log('AISidebar: Assistant message created:', assistantMessage);
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
      if ((error as Error).name !== "AbortError") {
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "system",
          content: `Failed to communicate with Bit: ${
            (error as Error).message
          }`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } finally {
      setIsProcessing(false);
      setAbortController(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCreateCodeWindow = async (executionId: string) => {
    console.log('AISidebar: handleCreateCodeWindow called with executionId:', executionId);
    try {
      const result = await window.electronAPI.invoke("ai:execute-tool", {
        toolName: "createCodeWindowFromInline",
        parameters: {
          executionId,
          windowPosition: { x: 150, y: 150 },
        },
      });

      console.log('AISidebar: Tool execution result:', result);

      if (!result.success) {
        console.error("Failed to create code window:", result.error);
      }
    } catch (error) {
      console.error("Failed to create code window:", error);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: "52px",
        right: "12px",
        width: `${sidebarWidth}px`,
        height: "calc(100vh - 64px)",
        backdropFilter: "blur(10px)",
        backgroundColor: "rgba(31, 41, 55, 0.2)",
        border: "1px solid #374151",
        borderRadius: "12px", // macOS window border radius
        display: "flex",
        flexDirection: "column",
        zIndex: 150,
        boxShadow:
          "0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)",
        transition: "width 0.2s ease-out, box-shadow 0.2s ease-out",
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
          borderTopLeftRadius: "12px",
          borderBottomLeftRadius: "12px",
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
          borderTopLeftRadius: "12px",
          borderTopRightRadius: "12px",
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
              Bit Assistant
            </h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={startNewChat}
              style={{
                padding: "4px 8px",
                borderRadius: "4px",
                border: "1px solid #374151",
                backgroundColor: "transparent",
                color: "#9ca3af",
                fontSize: "12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#374151";
                e.currentTarget.style.color = "#f3f4f6";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "#9ca3af";
              }}
              title="Start New Chat"
            >
              <span>➕</span>
              <span>New Chat</span>
            </button>
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
        </div>
        <p
          style={{
            margin: 0,
            fontSize: "12px",
            color: "#9ca3af",
          }}
        >
          {isConfigured
            ? `🔑 Ready to assist with windows and content • Chat: ${
                conversationId === "main" ? "Main" : "New"
              }`
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
              padding: "12px 16px",
              borderRadius: "12px",
              backgroundColor:
                message.role === "user"
                  ? "#3b82f6"
                  : message.role === "system"
                  ? "#374151"
                  : "#374151",
              color: "#f9fafb",
              fontSize: "14px",
              lineHeight: "1.5",
              alignSelf: message.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
              border: `1px solid ${
                message.role === "user"
                  ? "rgba(59, 130, 246, 0.3)"
                  : "rgba(55, 65, 81, 0.3)"
              }`,
            }}
          >
            <MessageWithHover 
              message={message}
              onCreateCodeWindow={handleCreateCodeWindow}
              renderFormattedMessage={renderFormattedMessage}
            />
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
            Bit is thinking...
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
          borderBottomLeftRadius: "12px",
          borderBottomRightRadius: "12px",
          backgroundColor: "#111827",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isConfigured
                ? "Move with me..."
                : "Configure API key to start chatting..."
            }
            disabled={isProcessing || !isConfigured}
            style={{
              width: "100%",
              maxHeight: "160px",
              minHeight: "64px",
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid #374151",
              backgroundColor: "#1f2937",
              color: "#f9fafb",
              fontSize: "14px",
              outline: "none",
              resize: "none",
              lineHeight: 1.4,
              overflowY: "auto",
              boxSizing: "border-box",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#3b82f6";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#374151";
            }}
          />
          <div
            style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}
          >
            {isProcessing && abortController && (
              <button
                type="button"
                onClick={async () => {
                  abortController.abort();
                  setAbortController(null);
                  setIsProcessing(false);

                  // Also abort on the backend
                  try {
                    await window.electronAPI.invoke("ai:abort", {
                      conversationId,
                    });
                  } catch (error) {
                    console.error("Failed to abort on backend:", error);
                  }

                  const abortMessage: ChatMessage = {
                    id: (Date.now() + 1).toString(),
                    role: "system",
                    content: "Request aborted by user",
                    timestamp: new Date(),
                  };
                  setMessages((prev) => [...prev, abortMessage]);
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#dc2626",
                  color: "#f9fafb",
                  fontSize: "14px",
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                  fontWeight: "500",
                }}
              >
                Abort
              </button>
            )}
            <button
              type="submit"
              disabled={!inputValue.trim() || isProcessing || !isConfigured}
              style={{
                padding: "8px 16px",
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
                fontWeight: "500",
              }}
            >
              {isConfigured ? "Send" : "Config"}
            </button>
          </div>
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
