// Core window system types
export interface BaseWindow {
  id: string;
  type: WindowType;
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  isLocked: boolean;
  isMinimized: boolean;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export type WindowType =
  | "webview"
  | "reference-webview"
  | "markdown-editor"
  | "graph"
  | "chat"
  | "code-execution"
  | "artifact"
  | "file-explorer"
  | "terminal"
  | "image-viewer"
  | "video-player"
  | "memory"
  | "text"
  | "custom";

// Canvas system types
export interface CanvasState {
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
  dimensions: {
    width: number;
    height: number;
  };
}

// AI Tool system types
export interface AIToolRequest {
  toolName: string;
  parameters: Record<string, any>;
  windowId?: string;
}

export interface AIToolResponse {
  success: boolean;
  data: any;
  error: string | null;
  timestamp: string;
  windowId: string | null;
}

// Code execution types
export interface CodeExecutionRequest {
  language: "javascript" | "python";
  code: string;
  packages?: string[];
  timeout?: number;
  memoryLimit?: number;
}

export interface CodeExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  plots?: string[]; // Base64 encoded images
  executionTime: number;
  memoryUsed: number;
}

// Artifact system types
export interface DataTemplate {
  id: string;
  artifactId: string;
  name: string;
  description: string;
  schema: any; // JSONSchema
  defaultValue: any;
  access: 'read' | 'write' | 'readwrite';
}

export interface Artifact {
  id: string;
  title: string;
  description: string;
  html: string;
  css?: string;
  javascript?: string;
  dataTemplates?: DataTemplate[];
  dependencies?: string[];
  createdAt?: Date;
  isGlobal?: boolean;
  originalProjectId?: string;
  importedFrom?: string;
}

export interface ArtifactCreationRequest {
  title: string;
  description: string;
  html: string;
  css?: string;
  javascript?: string;
  dataTemplates?: DataTemplate[];
  dependencies?: string[];
}

export interface ArtifactConfig {
  type:
    | "react-component"
    | "data-visualization"
    | "interactive-demo"
    | "calculator";
  title: string;
  description?: string;
  dependencies: string[];
  props?: Record<string, any>;
  code: string;
}

// Project system types
export interface Project {
  id: string;
  name: string;
  description?: string;
  rootPath: string;
  createdAt: Date;
  lastAccessed: Date;
  settings: ProjectSettings;
  metadata: {
    tags: string[];
    color?: string;
    icon?: string;
  };
}

export interface ProjectSettings {
  defaultAIProvider: string;
  codeExecutionEnabled: boolean;
  memoryEnabled: boolean;
  fileWatchEnabled: boolean;
}

export interface UserSettings {
  name: string;
  interests: string[];
  aiPersonality: "efficient" | "explanatory" | "funny" | "robotic";
}

export interface FileReference {
  projectId: string;
  filePath: string;
  lineNumber?: number;
  excerpt?: string;
  lastAccessed: Date;
  accessCount: number;
}

// Memory system types
export interface MemoryEntry {
  id: string;
  projectId?: string;
  type: "conversation" | "document" | "code" | "insight" | "reference";
  content: string;
  metadata: {
    source: string;
    timestamp: Date;
    tags: string[];
    importance: number; // 1-10 scale
    context?: Record<string, any>;
  };
  embedding: number[];
}

// Inline Code Execution types
export interface InlineExecution {
  executionId: string;
  code: string;
  output?: string;
  error?: string;
  success: boolean;
  description: string;
  executionTime?: number;
  language: string;
  timestamp: string;
  fullExecution?: {
    request: CodeExecutionRequest;
    result: CodeExecutionResult;
  };
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  inlineExecution?: InlineExecution;
}

// AI Provider types
export interface AIProvider {
  name: string;
  type: "openai" | "anthropic" | "local" | "custom";
  endpoint: string;
  apiKey?: string;
  model: string;
  capabilities: string[];
}

// Application state types
export interface AppState {
  canvas: CanvasState;
  windows: BaseWindow[];
  currentProject: Project | null;
  projects: Project[];
  aiProviders: AIProvider[];
  activeAIProvider: string | null;
}

// Event types for IPC communication
export interface IPCEvents {
  // User settings
  "user:get-settings": Record<string, never>;
  "user:save-settings": UserSettings;

  // Window management
  "window:create": { type: WindowType; config: Partial<BaseWindow> };
  "window:delete": { windowId: string };
  "window:update": { windowId: string; updates: Partial<BaseWindow> };
  "window:move": { windowId: string; position: { x: number; y: number } };
  "window:resize": {
    windowId: string;
    size: { width: number; height: number };
  };
  "window:restore": { windowId: string };

  // AI tools
  "ai:execute-tool": AIToolRequest;
  "ai:tool-response": AIToolResponse;

  // Code execution
  "code:execute": CodeExecutionRequest;
  "code:result": CodeExecutionResult;

  // Project management
  "project:switch": { projectId: string };
  "project:create": Omit<Project, "id" | "createdAt" | "lastAccessed">;

  // Canvas
  "canvas:update-viewport": { viewport: CanvasState["viewport"] };

  // Additional channels
  "windows:get-all": Record<string, never>;
  "window:set-selected": { windowId: string | null };
  "window:get-selected": Record<string, never>;

  // Webview channels
  "webview:create": { windowId: string; url: string };
  "webview:get-content": { windowId: string };
  "webview:set-bounds": {
    windowId: string;
    bounds: { x: number; y: number; width: number; height: number };
  };
  "webview:go-back": { windowId: string };
  "webview:go-forward": { windowId: string };
  "webview:reload": { windowId: string };
  "webview:update-canvas-offset": { offsetX: number; offsetY: number };

  // AI Service channels
  "ai:set-api-key": { apiKey: string };
  "ai:is-configured": Record<string, never>;
  "ai:chat": { conversationId: string; message: string };
  "ai:abort": { conversationId: string };
  "ai:get-conversation": { conversationId: string };
  "ai:clear-conversation": { conversationId: string };
  "ai:new-conversation": Record<string, never>;

  // Project management channels
  "projects:list": Record<string, never>;
  "projects:recent": Record<string, never>;
  "projects:current": Record<string, never>;
  "projects:create": { name: string; description?: string; template?: string };
  "projects:open": { projectId: string };
  "projects:close": { save?: boolean };
  "projects:save": Record<string, never>;
  "projects:delete": { projectId: string };

  // Artifact management channels
  "artifact:create": ArtifactCreationRequest;
  "artifact:update": { artifactId: string; updates: Partial<Artifact> };
  "artifact:get-data": { artifactId: string; templateKey?: string };
  "artifact:set-data": { artifactId: string; templateKey: string; data: any };
  "artifact:destroy": { artifactId: string };
}

export type IPCEventName = keyof IPCEvents;
export type IPCEventData<T extends IPCEventName> = IPCEvents[T];
