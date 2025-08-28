import type { CanvasState } from '@/shared/types';

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date;
  template?: string;
  settings: ProjectSettings;
  metadata: ProjectMetadata;
}

export interface ProjectInfo {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date;
}

export interface ProjectSettings {
  canvas: CanvasSettings;
  ai: AISettings;
  preferences: UserPreferences;
  features: FeatureFlags;
}

export interface CanvasSettings {
  defaultZoom: number;
  gridEnabled: boolean;
  snapToGrid: boolean;
  gridSize: number;
  backgroundColor: string;
  showMinimap: boolean;
}

export interface AISettings {
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  enableMemory: boolean;
  contextWindow: number;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  autoSave: boolean;
  autoSaveInterval: number; // seconds
  confirmDelete: boolean;
  showNotifications: boolean;
}

export interface FeatureFlags {
  enableArtifacts: boolean;
  enableMemory: boolean;
  enableCollaboration: boolean;
  betaFeatures: boolean;
}

export interface ProjectMetadata {
  windowCount?: number;
  artifactCount?: number;
  conversationCount?: number;
  lastBackup?: Date;
  tags?: string[];
  color?: string;
  icon?: string;
}

export interface WorkspaceState {
  canvas: CanvasState;
  windows: WindowState[];
  artifacts: ArtifactReference[];
  conversations: ConversationReference[];
  version: string;
  timestamp: Date;
}

export interface WindowState {
  id: string;
  type: string;
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  isLocked: boolean;
  isMinimized: boolean;
  metadata: Record<string, any>;
  content?: any; // Type-specific content
}

export interface ArtifactReference {
  id: string;
  name: string;
  type: string;
  path: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationReference {
  id: string;
  title: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  settings: Partial<ProjectSettings>;
  initialWindows?: Partial<WindowState>[];
  initialContent?: {
    type: string;
    content: any;
  }[];
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  template?: string;
  settings?: Partial<ProjectSettings>;
}

export interface ExportOptions {
  includeAssets: boolean;
  includeMemory: boolean;
  includeConversations: boolean;
  format: 'zip' | 'folder';
  destination: string;
}