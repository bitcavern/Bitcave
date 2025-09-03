import React, { useState, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import type {
  BaseWindow,
  ChatMessage,
  InlineExecution,
  FileReference,
} from "@/shared/types";
import { InlineExecution as InlineExecutionComponent } from "./InlineExecution";
import { FilePicker } from "./FilePicker";
import { Paperclip, X, File } from "lucide-react";

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
      console.log(
        "Frontend: Creating code window with execution ID:",
        message.inlineExecution.data.executionId
      );
      console.log(
        "Frontend: Full inline execution data:",
        message.inlineExecution.data
      );
      onCreateCodeWindow(message.inlineExecution.data.executionId);
    } else {
      console.log("Frontend: No inline execution data found in message");
      console.log(
        "Frontend: Available inlineExecution:",
        message.inlineExecution
      );
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
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div style={{ overflowX: "auto", paddingBottom: "16px" }}>
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
            e.currentTarget.style.boxShadow =
              "0 4px 12px rgba(59, 130, 246, 0.4)";
            // Keep menu visible when hovering the button and clear any hide timeout
            if (hoverTimeout) {
              clearTimeout(hoverTimeout);
              setHoverTimeout(null);
            }
            setShowMenu(true);
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow =
              "0 2px 8px rgba(59, 130, 246, 0.3)";
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
  const [conversationId, setConversationId] = useState(() => 
    `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  ); // Current conversation ID
  const [isResizing, setIsResizing] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(380);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<FileReference[]>([]);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionFiles, setMentionFiles] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{
    id: string;
    title: string;
    lastMessage: Date;
    messageCount: number;
  }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(380);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadConversationHistory = async () => {
    try {
      const result = await (window as any).electronAPI.invoke("ai:get-conversations");
      if (result.success) {
        console.log("[Frontend] Raw conversation data:", result.data);
        const conversations = result.data.map((conv: any) => {
          console.log("[Frontend] Processing conversation:", conv);
          const processedConv = {
            id: conv.id,
            title: conv.title || "New conversation",
            lastMessage: new Date(conv.updated_at),
            messageCount: conv.message_count || 0,
          };
          console.log("[Frontend] Processed conversation:", processedConv);
          return processedConv;
        });
        setConversationHistory(conversations);
      }
    } catch (error) {
      console.error("Failed to load conversation history:", error);
    }
  };

  const loadConversation = async (convId: string) => {
    try {
      const result = await (window as any).electronAPI.invoke("ai:get-conversation-messages", { conversationId: convId });
      if (result.success) {
        console.log("[Frontend] Raw message data:", result.data);
        const messages = result.data.map((msg: any) => ({
          id: `loaded_${msg.id}`,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
        }));
        console.log("[Frontend] Processed messages:", messages);
        setConversationId(convId);
        setMessages(messages);
        setShowHistory(false);
      }
    } catch (error) {
      console.error("Failed to load conversation:", error);
    }
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
        setShowHistory(false);

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
        
        // Refresh conversation history
        await loadConversationHistory();
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

  // Handle clicking outside to close mention dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showMentionDropdown &&
        textareaRef.current &&
        !textareaRef.current.contains(event.target as Node)
      ) {
        setShowMentionDropdown(false);
        setMentionQuery("");
      }
    };

    if (showMentionDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMentionDropdown]);

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

  const loadMentionFiles = async () => {
    try {
      const result = await (window as any).electronAPI.invoke("files:list");
      if (result.success) {
        setMentionFiles(result.data || []);
      }
    } catch (error) {
      console.error("Failed to load files for mentions:", error);
    }
  };

  const flattenFiles = (files: any[]): any[] => {
    const flat: any[] = [];
    files.forEach((file) => {
      if (!file.isDirectory) {
        flat.push(file);
      }
      if (file.children) {
        flat.push(...flattenFiles(file.children));
      }
    });
    return flat;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    setInputValue(value);

    // Check for @ mentions
    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@([^@\s]*)$/);

    if (atMatch) {
      const query = atMatch[1];
      setMentionQuery(query);
      setShowMentionDropdown(true);

      // Load files if not already loaded
      if (mentionFiles.length === 0) {
        loadMentionFiles();
      }
    } else {
      setShowMentionDropdown(false);
      setMentionQuery("");
    }
  };

  const handleMentionSelect = async (file: any) => {
    console.log("handleMentionSelect called with:", file);

    try {
      // Read the file
      console.log("Reading file:", file.path);
      const result = await (window as any).electronAPI.invoke(
        "files:read",
        file.path
      );
      console.log("File read result:", result);

      if (result.success) {
        const fileRef: FileReference = result.data;
        console.log("Adding file to attachedFiles:", fileRef);
        setAttachedFiles((prev) => {
          console.log("Previous attached files:", prev);
          const newFiles = [...prev, fileRef];
          console.log("New attached files:", newFiles);
          return newFiles;
        });

        // Replace the @mention with just the filename
        const textarea = textareaRef.current;
        if (textarea) {
          const cursorPos = textarea.selectionStart;
          const textBeforeCursor = inputValue.slice(0, cursorPos);
          const textAfterCursor = inputValue.slice(cursorPos);

          // Find and replace the @mention
          const atMatch = textBeforeCursor.match(/@([^@\s]*)$/);
          if (atMatch) {
            const newTextBefore = textBeforeCursor.slice(0, -atMatch[0].length);
            const newValue = `${newTextBefore}@${file.name} ${textAfterCursor}`;
            console.log(
              "Updating input value from:",
              inputValue,
              "to:",
              newValue
            );
            setInputValue(newValue);

            // Set cursor position after the mention
            setTimeout(() => {
              const newCursorPos = newTextBefore.length + file.name.length + 2;
              textarea.setSelectionRange(newCursorPos, newCursorPos);
              textarea.focus();
            }, 0);
          }
        }
      } else {
        console.error("Failed to read file:", result.error);
      }
    } catch (error) {
      console.error("Error selecting mentioned file:", error);
    }

    setShowMentionDropdown(false);
    setMentionQuery("");
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isProcessing) return;

    if (!isConfigured) {
      setShowAPIKeyModal(true);
      return;
    }

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
      fileReferences: attachedFiles.length > 0 ? [...attachedFiles] : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setAttachedFiles([]); // Clear attached files after sending
    setIsProcessing(true);

    // Create abort controller for this request
    const controller = new AbortController();
    setAbortController(controller);

    try {
      // Prepare the message with file context
      let messageWithFiles = userMessage.content;
      if (attachedFiles.length > 0) {
        const fileContext = attachedFiles
          .map(
            (file) =>
              `\n\n--- File: ${file.fileName} (${file.relativePath}) ---\n${file.content}\n--- End of ${file.fileName} ---`
          )
          .join("");
        messageWithFiles = `${userMessage.content}${fileContext}`;
      }

      // Prepare a live assistant message placeholder for streaming
      const liveId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setMessages((prev) => [
        ...prev,
        {
          id: liveId,
          role: "assistant",
          content: "Bit is thinking...",
          timestamp: new Date(),
          isThinking: true, // Flag to indicate this is a placeholder
        } as any,
      ]);

      // Subscribe to stream deltas
      const onDelta = (
        _event: any,
        payload: { conversationId: string; delta: string }
      ) => {
        if (payload?.conversationId !== conversationId) return;
        console.log(`[Frontend] Received delta: "${payload.delta}" (${payload.delta.length} chars)`);
        setMessages((prev) => {
          const copy = [...prev];
          const idx = copy.findIndex((m) => m.id === liveId);
          if (idx !== -1) {
            const currentMessage = copy[idx] as any;
            copy[idx] = {
              ...currentMessage,
              content: currentMessage.isThinking ? payload.delta : (currentMessage.content || "") + payload.delta,
              isThinking: false, // Clear the thinking flag when real content arrives
            };
          }
          return copy;
        });
      };
      window.electronAPI.on("ai:chat-stream-delta", onDelta);

      const result = await window.electronAPI.invoke("ai:chat-stream", {
        conversationId,
        message: messageWithFiles,
      });

      // Unsubscribe
      window.electronAPI.off("ai:chat-stream-delta", onDelta);

      if (result.success) {
        const responseData = result.data as {
          content: string;
          inlineExecution?: any;
        };
        setMessages((prev) => {
          const copy = [...prev];
          const idx = copy.findIndex((m) => m.id === liveId);
          if (idx !== -1) {
            copy[idx] = {
              ...copy[idx],
              content: (responseData.content || "").replace(/^\s+/, ""),
              inlineExecution: responseData.inlineExecution,
            } as any;
          }
          return copy;
        });
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== liveId));
        const errorMessage: ChatMessage = {
          id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          role: "system",
          content: `Error: ${result.error}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        const errorMessage: ChatMessage = {
          id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
    console.log(
      "AISidebar: handleCreateCodeWindow called with executionId:",
      executionId
    );
    try {
      const result = await window.electronAPI.invoke("ai:execute-tool", {
        toolName: "createCodeWindowFromInline",
        parameters: {
          executionId,
          windowPosition: { x: 150, y: 150 },
        },
      });

      console.log("AISidebar: Tool execution result:", result);

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
              onClick={async () => {
                await loadConversationHistory();
                setShowHistory(!showHistory);
              }}
              style={{
                padding: "4px 8px",
                borderRadius: "4px",
                border: "1px solid #374151",
                backgroundColor: showHistory ? "#374151" : "transparent",
                color: showHistory ? "#f3f4f6" : "#9ca3af",
                fontSize: "12px",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                if (!showHistory) {
                  e.currentTarget.style.backgroundColor = "#374151";
                  e.currentTarget.style.color = "#f3f4f6";
                }
              }}
              onMouseLeave={(e) => {
                if (!showHistory) {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#9ca3af";
                }
              }}
              title="Conversation History"
            >
              📋
            </button>
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
              <span>New</span>
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
            ? `🔑 Ready to assist • ${messages.length} messages`
            : "Click ⚙️ to configure API key"}
        </p>
      </div>

      {/* Conversation History Sidebar */}
      {showHistory && (
        <div
          style={{
            borderTop: "1px solid #374151",
            borderBottom: "1px solid #374151",
            backgroundColor: "#111827",
            maxHeight: "200px",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              padding: "8px 16px",
              fontSize: "12px",
              color: "#9ca3af",
              borderBottom: "1px solid #374151",
            }}
          >
            Conversation History ({conversationHistory.length})
          </div>
          {conversationHistory.length === 0 ? (
            <div
              style={{
                padding: "16px",
                textAlign: "center",
                color: "#6b7280",
                fontSize: "14px",
              }}
            >
              No previous conversations
            </div>
          ) : (
            conversationHistory
              .sort((a, b) => b.lastMessage.getTime() - a.lastMessage.getTime())
              .map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => loadConversation(conv.id)}
                  style={{
                    padding: "8px 16px",
                    cursor: "pointer",
                    borderBottom: "1px solid #374151",
                    backgroundColor: conv.id === conversationId ? "#374151" : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (conv.id !== conversationId) {
                      e.currentTarget.style.backgroundColor = "#2d3748";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (conv.id !== conversationId) {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }
                  }}
                >
                  <div
                    style={{
                      fontSize: "14px",
                      color: "#f9fafb",
                      marginBottom: "4px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {conv.title.length > 30 ? `${conv.title.substring(0, 30)}...` : conv.title}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#9ca3af",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{conv.messageCount} messages</span>
                    <span>{conv.lastMessage.toLocaleDateString()}</span>
                  </div>
                </div>
              ))
          )}
        </div>
      )}

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
            {/* File References */}
            {message.fileReferences && message.fileReferences.length > 0 && (
              <div
                style={{
                  marginBottom: "8px",
                  padding: "8px",
                  backgroundColor: "rgba(0, 0, 0, 0.2)",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
              >
                <div style={{ marginBottom: "4px", opacity: 0.8 }}>
                  📎 Attached files:
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {message.fileReferences.map((file, index) => (
                    <span
                      key={index}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "2px 6px",
                        backgroundColor: "rgba(255, 255, 255, 0.1)",
                        borderRadius: "3px",
                        fontSize: "11px",
                      }}
                    >
                      <File size={10} />
                      {file.fileName}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <MessageWithHover
              message={message}
              onCreateCodeWindow={handleCreateCodeWindow}
              renderFormattedMessage={renderFormattedMessage}
            />
          </div>
        ))}


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
          {/* Attached Files Display */}
          {attachedFiles.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                padding: "8px",
                backgroundColor: "#374151",
                borderRadius: "6px",
                border: "1px solid #4b5563",
              }}
            >
              {attachedFiles.map((file, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 8px",
                    backgroundColor: "#1f2937",
                    borderRadius: "4px",
                    fontSize: "12px",
                    color: "#f1f5f9",
                    border: "1px solid #6b7280",
                  }}
                >
                  <File size={14} color="#9ca3af" />
                  <span>{file.fileName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachedFiles((prev) =>
                        prev.filter((_, i) => i !== index)
                      );
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#9ca3af",
                      cursor: "pointer",
                      padding: "2px",
                      borderRadius: "2px",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Chat Input Container */}
          <div style={{ position: "relative" }}>
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInputChange}
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

            {/* Attach File Button */}
            <button
              type="button"
              onClick={() => setShowFilePicker(true)}
              disabled={isProcessing || !isConfigured}
              style={{
                position: "absolute",
                bottom: "8px",
                right: "8px",
                width: "32px",
                height: "32px",
                backgroundColor: "#374151",
                border: "1px solid #4b5563",
                borderRadius: "6px",
                cursor:
                  isProcessing || !isConfigured ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                if (!isProcessing && isConfigured) {
                  e.currentTarget.style.backgroundColor = "#4b5563";
                  e.currentTarget.style.borderColor = "#6b7280";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#374151";
                e.currentTarget.style.borderColor = "#4b5563";
              }}
              title="Attach files"
            >
              <Paperclip
                size={16}
                color={isProcessing || !isConfigured ? "#6b7280" : "#9ca3af"}
              />
            </button>

            {/* @ Mention Dropdown - Positioned relative to input container */}
            {showMentionDropdown && (
              <div
                style={{
                  position: "absolute",
                  left: "0px",
                  bottom: "100%", // Position above the textarea
                  marginBottom: "8px",
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                  boxShadow:
                    "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                  maxHeight: "200px",
                  overflowY: "auto",
                  zIndex: 1002,
                  minWidth: "200px",
                  width: "100%",
                }}
              >
                <div
                  onClick={(e) => {
                    console.log("Dropdown container clicked:", e);
                  }}
                  style={{ padding: "4px 0" }}
                >
                  {(() => {
                    const allFiles = flattenFiles(mentionFiles);
                    const filteredFiles = allFiles.filter((file) =>
                      file.name
                        .toLowerCase()
                        .includes(mentionQuery.toLowerCase())
                    );

                    console.log("Rendering files:", filteredFiles);

                    return filteredFiles.length > 0 ? (
                      filteredFiles.slice(0, 10).map((file, index) => (
                        <div
                          key={`file-${index}-${file.path}`}
                          onMouseDown={(e) => {
                            console.log("Mouse down on file!", file);
                            // Try handling on mouse down instead of click
                            e.preventDefault();
                            e.stopPropagation();
                            console.log(
                              "Calling handleMentionSelect from mouseDown"
                            );
                            handleMentionSelect(file);
                          }}
                          onClick={(e) => {
                            console.log("File div clicked!", file, e);
                          }}
                          style={{
                            padding: "8px 12px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            fontSize: "14px",
                            color: "#f1f5f9",
                            borderBottom:
                              index < filteredFiles.length - 1
                                ? "1px solid #374151"
                                : "none",
                            backgroundColor: "transparent",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#374151";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor =
                              "transparent";
                          }}
                        >
                          <File size={14} color="#9ca3af" />
                          <span>{file.name}</span>
                          <span
                            style={{
                              fontSize: "12px",
                              color: "#6b7280",
                              marginLeft: "auto",
                            }}
                          >
                            {file.path.split("/").slice(-2, -1)[0] || ""}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div
                        style={{
                          padding: "8px 12px",
                          fontSize: "14px",
                          color: "#9ca3af",
                          textAlign: "center",
                        }}
                      >
                        {mentionQuery ? "No matching files" : "No files found"}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

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
                    id: `abort_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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

      <FilePicker
        isOpen={showFilePicker}
        onClose={() => setShowFilePicker(false)}
        onSelectFiles={(files) => {
          setAttachedFiles((prev) => [...prev, ...files]);
        }}
        multiSelect={true}
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
