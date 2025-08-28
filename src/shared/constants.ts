// Application constants
export const APP_CONFIG = {
  name: "Bitcave",
  version: "0.1.0",
  minWindowSize: { width: 300, height: 200 },
  maxWindows: 100,
  defaultWindowSize: { width: 600, height: 400 },
  canvasDefaults: {
    zoom: 1.0,
    minZoom: 0.1,
    maxZoom: 5.0,
    viewport: { x: 0, y: 0, zoom: 1.0 },
  },
  grid: {
    size: 20,
    enabled: true,
    snapEnabled: true,
  },
} as const;

// Window type configurations
export const WINDOW_CONFIGS = {
  webview: {
    defaultSize: { width: 800, height: 600 },
    minSize: { width: 400, height: 300 },
    resizable: true,
    icon: "🌐",
    name: "Webview",
  },
  "reference-webview": {
    defaultSize: { width: 600, height: 800 },
    minSize: { width: 300, height: 400 },
    resizable: true,
    icon: "📖",
    name: "Reference",
  },
  "markdown-editor": {
    defaultSize: { width: 700, height: 500 },
    minSize: { width: 400, height: 300 },
    resizable: true,
    icon: "📝",
    name: "Markdown",
  },
  graph: {
    defaultSize: { width: 600, height: 400 },
    minSize: { width: 300, height: 200 },
    resizable: true,
    icon: "📊",
    name: "Graph",
  },
  chat: {
    defaultSize: { width: 400, height: 600 },
    minSize: { width: 300, height: 400 },
    resizable: true,
    icon: "💬",
    name: "Chat",
  },
  "code-execution": {
    defaultSize: { width: 800, height: 600 },
    minSize: { width: 500, height: 450 },
    resizable: true,
    icon: "⚡",
    name: "Code",
  },
  artifact: {
    defaultSize: { width: 600, height: 400 },
    minSize: { width: 300, height: 200 },
    resizable: true,
    icon: "🎨",
    name: "Artifact",
  },
  "file-explorer": {
    defaultSize: { width: 300, height: 500 },
    minSize: { width: 250, height: 300 },
    resizable: true,
    icon: "📁",
    name: "Files",
  },
  terminal: {
    defaultSize: { width: 700, height: 400 },
    minSize: { width: 400, height: 200 },
    resizable: true,
    icon: "💻",
    name: "Terminal",
  },
  "image-viewer": {
    defaultSize: { width: 500, height: 400 },
    minSize: { width: 200, height: 200 },
    resizable: true,
    icon: "🖼️",
    name: "Image",
  },
  "video-player": {
    defaultSize: { width: 640, height: 480 },
    minSize: { width: 320, height: 240 },
    resizable: true,
    icon: "🎥",
    name: "Video",
  },
  memory: {
    defaultSize: { width: 500, height: 600 },
    minSize: { width: 300, height: 400 },
    resizable: true,
    icon: "🧠",
    name: "Memory",
  },
  text: {
    defaultSize: { width: 500, height: 400 },
    minSize: { width: 300, height: 200 },
    resizable: true,
    icon: "📄",
    name: "Text",
  },
  custom: {
    defaultSize: { width: 400, height: 300 },
    minSize: { width: 200, height: 150 },
    resizable: true,
    icon: "🔧",
    name: "Custom",
  },
} as const;

// Code execution constants
export const CODE_EXECUTION = {
  defaultTimeout: 30000, // 30 seconds
  maxTimeout: 300000, // 5 minutes
  defaultMemoryLimit: 512 * 1024 * 1024, // 512MB
  maxMemoryLimit: 2 * 1024 * 1024 * 1024, // 2GB
  supportedLanguages: ["javascript", "python"] as const,
  sandboxPorts: {
    javascript: 3001,
    python: 3002,
  },
} as const;

// AI tool constants
export const AI_TOOLS = {
  categories: {
    windowManagement: [
      "createWindow",
      "deleteWindow",
      "moveWindow",
      "resizeWindow",
      "setWindowTitle",
      "lockWindow",
      "unlockWindow",
      "minimizeWindow",
      "restoreWindow",
      "bringToFront",
      "tileWindows",
    ],
    contentManipulation: [
      "setWebviewUrl",
      "executeWebviewScript",
      "updateMarkdownContent",
      "createGraph",
      "updateGraphData",
      "sendChatMessage",
      "uploadFile",
      "executeCode",
      "createArtifact",
      "updateArtifact",
      "installPackage",
    ],
    stateQuery: [
      "getWindowList",
      "getWindowContent",
      "getCanvasState",
      "searchWindows",
      "exportWindowState",
      "getSystemMetrics",
      "getProjectFiles",
      "readProjectFile",
      "searchMemory",
      "getMemoryContext",
      "getArtifactData",
    ],
  },
} as const;

// Memory system constants
export const MEMORY_SYSTEM = {
  chunkSize: 1000, // characters
  maxChunks: 10000,
  embeddingDimension: 1536, // OpenAI embedding dimension
  similarityThreshold: 0.7,
  maxContextMemories: 10,
  memoryTypes: [
    "conversation",
    "document",
    "code",
    "insight",
    "reference",
  ] as const,
} as const;

// File system constants
export const FILE_SYSTEM = {
  supportedCodeExtensions: [
    ".js",
    ".ts",
    ".tsx",
    ".jsx",
    ".py",
    ".html",
    ".css",
    ".json",
    ".md",
  ],
  supportedDocExtensions: [".pdf", ".txt", ".docx", ".rtf"],
  supportedImageExtensions: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"],
  supportedVideoExtensions: [".mp4", ".webm", ".ogg", ".mov"],
  maxFileSize: 100 * 1024 * 1024, // 100MB
  watchIgnorePatterns: ["node_modules", ".git", "dist", ".DS_Store"],
} as const;

// UI constants
export const UI = {
  colors: {
    primary: "#3b82f6",
    secondary: "#64748b",
    success: "#10b981",
    warning: "#f59e0b",
    error: "#ef4444",
    background: "#1f2937",
    surface: "#374151",
    text: "#f9fafb",
    textSecondary: "#d1d5db",
  },
  zIndex: {
    canvas: 1,
    windows: 10,
    toolbar: 100,
    modal: 1000,
    tooltip: 10000,
  },
  animation: {
    duration: {
      fast: 150,
      normal: 300,
      slow: 500,
    },
    easing: "cubic-bezier(0.4, 0, 0.2, 1)",
  },
} as const;
