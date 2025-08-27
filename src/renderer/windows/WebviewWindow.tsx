import React, { useState, useRef, useEffect } from "react";
import type { BaseWindow } from "@/shared/types";

interface WebviewWindowProps {
  window: BaseWindow;
  onUpdateWindow: (windowId: string, updates: Partial<BaseWindow>) => void;
}

export const WebviewWindow: React.FC<WebviewWindowProps> = ({
  window,
  onUpdateWindow,
}) => {
  const [url, setUrl] = useState(window.metadata?.url || "");
  const [isLoading, setIsLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isWebviewCreated, setIsWebviewCreated] = useState(false);

  // Update window metadata when URL changes
  useEffect(() => {
    if (url !== window.metadata?.url) {
      onUpdateWindow(window.id, {
        metadata: {
          ...window.metadata,
          url,
          lastModified: new Date().toISOString(),
        },
      });
    }
  }, [url, window.metadata?.url, window.id, onUpdateWindow]);

  // Update window title when webview title changes
  useEffect(() => {
    if (title && title !== window.title) {
      onUpdateWindow(window.id, {
        title,
        metadata: {
          ...window.metadata,
          label: title,
        },
      });
    }
  }, [title, window.title, window.id, onUpdateWindow]);

  // Create webview when component mounts if URL is set
  useEffect(() => {
    const createWebview = async () => {
      if (url && !isWebviewCreated) {
        try {
          const electronAPI = (globalThis as any).electronAPI;
          if (electronAPI) {
            await electronAPI.invoke("webview:create", {
              windowId: window.id,
              url: url,
            });
            setIsWebviewCreated(true);
          }
        } catch (error) {
          console.error("Failed to create webview:", error);
          setError("Failed to create webview");
        }
      }
    };

    createWebview();
  }, [url, window.id, isWebviewCreated]);

  // Update BrowserView bounds when window position/size changes
  useEffect(() => {
    const updateBounds = async () => {
      if (isWebviewCreated) {
        try {
          const electronAPI = (globalThis as any).electronAPI;
          if (electronAPI) {
            await electronAPI.invoke("webview:set-bounds", {
              windowId: window.id,
              bounds: {
                x: window.position.x,
                y: window.position.y,
                width: window.size.width,
                height: window.size.height,
              },
            });
          }
        } catch (error) {
          console.error("Failed to update webview bounds:", error);
        }
      }
    };

    updateBounds();
  }, [
    window.position.x,
    window.position.y,
    window.size.width,
    window.size.height,
    window.id,
    isWebviewCreated,
  ]);

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      setIsLoading(true);
      setError(null);
      try {
        // Use the setWebviewUrl tool to navigate
        const electronAPI = (globalThis as any).electronAPI;
        if (electronAPI) {
          await electronAPI.invoke("ai:execute-tool", {
            toolName: "setWebviewUrl",
            parameters: {
              windowId: window.id,
              url: url.trim(),
            },
          });

          // Create webview if it doesn't exist
          if (!isWebviewCreated) {
            await electronAPI.invoke("webview:create", {
              windowId: window.id,
              url: url.trim(),
            });
            setIsWebviewCreated(true);
          }
        }
      } catch (error) {
        console.error("Failed to navigate:", error);
        setError("Failed to navigate to the specified URL");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleGoBack = async () => {
    try {
      const electronAPI = (globalThis as any).electronAPI;
      if (electronAPI) {
        await electronAPI.invoke("webview:go-back", {
          windowId: window.id,
        });
      }
    } catch (error) {
      console.error("Failed to go back:", error);
      setError("Failed to navigate back");
    }
  };

  const handleGoForward = async () => {
    try {
      const electronAPI = (globalThis as any).electronAPI;
      if (electronAPI) {
        await electronAPI.invoke("webview:go-forward", {
          windowId: window.id,
        });
      }
    } catch (error) {
      console.error("Failed to go forward:", error);
      setError("Failed to navigate forward");
    }
  };

  const handleRefresh = async () => {
    try {
      const electronAPI = (globalThis as any).electronAPI;
      if (electronAPI) {
        await electronAPI.invoke("webview:reload", {
          windowId: window.id,
        });
      }
    } catch (error) {
      console.error("Failed to refresh:", error);
      setError("Failed to refresh the page");
    }
  };

  // Listen for webview events
  useEffect(() => {
    const handleWebviewEvent = (event: any, data: any) => {
      if (data.windowId === window.id) {
        switch (data.type) {
          case "did-start-loading":
            setIsLoading(true);
            setError(null);
            break;
          case "did-stop-loading":
            setIsLoading(false);
            break;
          case "did-navigate":
            setUrl(data.url);
            break;
          case "page-title-updated":
            setTitle(data.title);
            break;
          case "did-navigate-in-page":
            setCanGoBack(data.canGoBack);
            setCanGoForward(data.canGoForward);
            break;
        }
      }
    };

    // Access electronAPI from the global window object
    const electronAPI = (globalThis as any).electronAPI;
    if (electronAPI) {
      electronAPI.on("webview:event", handleWebviewEvent);

      return () => {
        electronAPI.removeAllListeners("webview:event");
      };
    }
  }, [window.id]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: "#1f2937",
      }}
    >
      {/* Navigation Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "12px",
          backgroundColor: "#374151",
          borderBottom: "1px solid #4b5563",
        }}
      >
        {/* Navigation Buttons */}
        <button
          onClick={handleGoBack}
          disabled={!canGoBack}
          style={{
            padding: "6px 8px",
            backgroundColor: canGoBack ? "#4b5563" : "#374151",
            color: "#f9fafb",
            border: "none",
            borderRadius: "4px",
            cursor: canGoBack ? "pointer" : "not-allowed",
            fontSize: "12px",
          }}
          title="Go Back"
        >
          ←
        </button>
        <button
          onClick={handleGoForward}
          disabled={!canGoForward}
          style={{
            padding: "6px 8px",
            backgroundColor: canGoForward ? "#4b5563" : "#374151",
            color: "#f9fafb",
            border: "none",
            borderRadius: "4px",
            cursor: canGoForward ? "pointer" : "not-allowed",
            fontSize: "12px",
          }}
          title="Go Forward"
        >
          →
        </button>
        <button
          onClick={handleRefresh}
          style={{
            padding: "6px 8px",
            backgroundColor: "#4b5563",
            color: "#f9fafb",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
          }}
          title="Refresh"
        >
          ↻
        </button>

        {/* URL Bar */}
        <form onSubmit={handleUrlSubmit} style={{ flex: 1, display: "flex" }}>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter URL (e.g., https://example.com)"
            style={{
              flex: 1,
              padding: "8px 12px",
              backgroundColor: "#1f2937",
              color: "#f9fafb",
              border: "1px solid #4b5563",
              borderRadius: "4px",
              fontSize: "14px",
              outline: "none",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#3b82f6";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#4b5563";
            }}
          />
          <button
            type="submit"
            disabled={!url.trim() || isLoading}
            style={{
              marginLeft: "8px",
              padding: "8px 16px",
              backgroundColor: url.trim() && !isLoading ? "#3b82f6" : "#374151",
              color: "#f9fafb",
              border: "none",
              borderRadius: "4px",
              cursor: url.trim() && !isLoading ? "pointer" : "not-allowed",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            {isLoading ? "Loading..." : "Go"}
          </button>
        </form>
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            padding: "8px 12px",
            backgroundColor: "#dc2626",
            color: "#f9fafb",
            fontSize: "12px",
            borderBottom: "1px solid #4b5563",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Webview Content Area */}
      <div style={{ flex: 1, position: "relative" }}>
        {url ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "#9ca3af",
              textAlign: "center",
              padding: "32px",
            }}
          >
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🌐</div>
            <h3 style={{ margin: "0 0 8px 0", color: "#f9fafb" }}>
              Webview Active
            </h3>
            <p style={{ margin: 0, fontSize: "14px" }}>
              Content is displayed in a movable BrowserView
            </p>
            <div
              style={{ marginTop: "16px", fontSize: "12px", color: "#6b7280" }}
            >
              This webview uses Electron's BrowserView for full content access.
              <br />
              The content appears as an overlay on the main window.
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "#9ca3af",
              textAlign: "center",
              padding: "32px",
            }}
          >
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🌐</div>
            <h3 style={{ margin: "0 0 8px 0", color: "#f9fafb" }}>
              Webview Ready
            </h3>
            <p style={{ margin: 0, fontSize: "14px" }}>
              Enter a URL above to start browsing
            </p>
            <div
              style={{ marginTop: "16px", fontSize: "12px", color: "#6b7280" }}
            >
              This webview uses Electron's BrowserView for full content access.
              <br />
              Content will appear as an overlay on the main window.
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(31, 41, 55, 0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
                color: "#f9fafb",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  border: "3px solid #374151",
                  borderTop: "3px solid #3b82f6",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
              <span style={{ fontSize: "14px" }}>Loading...</span>
            </div>
          </div>
        )}
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};
