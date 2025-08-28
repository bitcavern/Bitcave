import React, { useState, useRef, useEffect } from "react";

interface LeftSidebarProps {
  isVisible: boolean;
  onToggle: () => void;
  onWidthChange?: (width: number) => void;
  initialWidth?: number;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  isVisible,
  onToggle,
  onWidthChange,
  initialWidth = 400,
}) => {
  const [width, setWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const webviewRef = useRef<any>(null);
  const [currentUrl, setCurrentUrl] = useState("https://www.google.com");
  const [urlInput, setUrlInput] = useState(currentUrl);
  const [isLoading, setIsLoading] = useState(false);

  // Handle resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = e.clientX;
      if (newWidth >= 250 && newWidth <= 800) {
        setWidth(newWidth);
        onWidthChange?.(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, onWidthChange]);

  // Handle webview events
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleLoadStart = () => setIsLoading(true);
    const handleLoadStop = () => setIsLoading(false);

    webview.addEventListener("dom-ready", handleLoadStop);
    webview.addEventListener("did-start-loading", handleLoadStart);
    webview.addEventListener("did-stop-loading", handleLoadStop);
    webview.addEventListener("did-fail-load", handleLoadStop);

    return () => {
      if (webview) {
        webview.removeEventListener("dom-ready", handleLoadStop);
        webview.removeEventListener("did-start-loading", handleLoadStart);
        webview.removeEventListener("did-stop-loading", handleLoadStop);
        webview.removeEventListener("did-fail-load", handleLoadStop);
      }
    };
  }, [currentUrl]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let url = urlInput.trim();

    // Add https:// if no protocol is specified
    if (url && !url.match(/^https?:\/\//)) {
      url = `https://${url}`;
    }

    if (url) {
      setIsLoading(true);
      setCurrentUrl(url);
      setUrlInput(url);
    }
  };

  const handleRefresh = () => {
    // Force refresh by setting URL again
    setCurrentUrl("");
    setTimeout(() => setCurrentUrl(urlInput), 10);
  };

  const handleBack = () => {
    // For now, we'll implement a simple history later
    console.log("Back clicked - history navigation to be implemented");
  };

  const handleForward = () => {
    // For now, we'll implement a simple history later
    console.log("Forward clicked - history navigation to be implemented");
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        style={{
          position: "fixed",
          left: isVisible ? width - 1 : 0,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 1001,
          width: "24px",
          height: "48px",
          background: "#374151",
          border: "none",
          borderRadius: isVisible ? "0 8px 8px 0" : "0 8px 8px 0",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#9ca3af",
          fontSize: "12px",
          transition: "all 0.2s ease",
          boxShadow: "2px 0 8px rgba(0,0,0,0.1)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#4b5563";
          e.currentTarget.style.color = "#f3f4f6";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "#374151";
          e.currentTarget.style.color = "#9ca3af";
        }}
        title={isVisible ? "Hide webview sidebar" : "Show webview sidebar"}
      >
        {isVisible ? "◀" : "▶"}
      </button>

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        style={{
          position: "fixed",
          left: isVisible ? 0 : -width,
          top: 0,
          bottom: 0,
          width: `${width}px`,
          background: "#1f2937",
          borderRight: "none", // Remove the full border
          transition: "left 0.3s ease",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          boxShadow: isVisible ? "2px 0 8px rgba(0,0,0,0.1)" : "none",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "12px",
            marginTop: "40px", // Account for title bar
            borderBottom: "1px solid #374151",
            borderRight: "1px solid #374151", // Start the border here
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#111827",
          }}
        >
          <h3
            style={{
              margin: 0,
              color: "#f3f4f6",
              fontSize: "14px",
              fontWeight: "600",
            }}
          >
            Web Browser
          </h3>
        </div>

        {/* Navigation Bar */}
        <div
          style={{
            padding: "8px",
            borderBottom: "1px solid #374151",
            borderRight: "1px solid #374151", // Continue the border
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "#111827",
          }}
        >
          <button
            onClick={handleBack}
            style={{
              width: "32px",
              height: "28px",
              border: "1px solid #374151",
              background: "#374151",
              color: "#9ca3af",
              borderRadius: "4px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#4b5563";
              e.currentTarget.style.color = "#f3f4f6";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#374151";
              e.currentTarget.style.color = "#9ca3af";
            }}
            title="Back"
          >
            ←
          </button>

          <button
            onClick={handleForward}
            style={{
              width: "32px",
              height: "28px",
              border: "1px solid #374151",
              background: "#374151",
              color: "#9ca3af",
              borderRadius: "4px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#4b5563";
              e.currentTarget.style.color = "#f3f4f6";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#374151";
              e.currentTarget.style.color = "#9ca3af";
            }}
            title="Forward"
          >
            →
          </button>

          <button
            onClick={handleRefresh}
            style={{
              width: "32px",
              height: "28px",
              border: "1px solid #374151",
              background: "#374151",
              color: "#9ca3af",
              borderRadius: "4px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#4b5563";
              e.currentTarget.style.color = "#f3f4f6";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#374151";
              e.currentTarget.style.color = "#9ca3af";
            }}
            title="Refresh"
          >
            ↻
          </button>

          <form onSubmit={handleUrlSubmit} style={{ flex: 1 }}>
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Enter URL..."
              style={{
                width: "100%",
                height: "28px",
                padding: "0 8px",
                border: "1px solid #374151",
                borderRadius: "4px",
                background: "#374151",
                color: "#f3f4f6",
                fontSize: "12px",
                boxSizing: "border-box",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#3b82f6";
                e.currentTarget.style.background = "#4b5563";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#374151";
                e.currentTarget.style.background = "#374151";
              }}
            />
          </form>
        </div>

        {/* Webview Content */}
        <div style={{ 
          flex: 1, 
          position: "relative", 
          background: "#1f2937",
          borderRight: "1px solid #374151", // Continue the border
        }}>
          {currentUrl ? (
            <>
              <webview
                ref={webviewRef}
                src={currentUrl}
                style={{
                  width: "100%",
                  height: "100vh",
                  border: "none",
                  display: isLoading ? "none" : "flex",
                }}
              />
              {isLoading && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#1f2937",
                    color: "#9ca3af",
                    fontSize: "14px",
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        width: "24px",
                        height: "24px",
                        border: "2px solid #374151",
                        borderTop: "2px solid #3b82f6",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                        margin: "0 auto 8px",
                      }}
                    ></div>
                    Loading...
                  </div>
                </div>
              )}
            </>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "#9ca3af",
                fontSize: "14px",
              }}
            >
              Enter a URL to browse the web
            </div>
          )}
        </div>

        {/* Resize Handle */}
        <div
          onMouseDown={handleResizeStart}
          style={{
            position: "absolute",
            right: -2,
            top: 0,
            bottom: 0,
            width: "4px",
            background: "transparent",
            cursor: "col-resize",
            zIndex: 1001,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#3b82f6";
          }}
          onMouseLeave={(e) => {
            if (!isResizing) {
              e.currentTarget.style.background = "transparent";
            }
          }}
        />
      </div>

      {/* Overlay when resizing */}
      {isResizing && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.1)",
            zIndex: 999,
            cursor: "col-resize",
          }}
        />
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};
