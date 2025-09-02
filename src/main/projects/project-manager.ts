import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { ProjectStorageService } from './project-storage';
import type { 
  Project, 
  ProjectInfo, 
  WorkspaceState, 
  CreateProjectRequest, 
  ProjectSettings,
  WindowState 
} from './types';
import type { WindowManager } from '../window-manager';
import type { BaseWindow } from '@/shared/types';

export class ProjectManager extends EventEmitter {
  private currentProject: Project | null = null;
  private storageService: ProjectStorageService;
  private windowManager: WindowManager | null = null;
  private autoSaveInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.storageService = new ProjectStorageService();
  }

  async initialize(): Promise<void> {
    await this.storageService.initialize();
    console.log('[ProjectManager] Initialized');
  }

  setWindowManager(windowManager: WindowManager): void {
    this.windowManager = windowManager;
  }

  async createProject(request: CreateProjectRequest): Promise<Project> {
    const project: Project = {
      id: uuidv4(),
      name: request.name,
      description: request.description || '',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastAccessedAt: new Date(),
      template: request.template,
      settings: {
        ...this.getDefaultSettings(),
        ...request.settings
      },
      metadata: {
        windowCount: 0,
        artifactCount: 0,
        conversationCount: 0,
        tags: []
      }
    };

    await this.storageService.createProject(project);
    this.emit('project-created', project);
    
    console.log(`[ProjectManager] Created project: ${project.name} (${project.id})`);
    return project;
  }

  async openProject(projectId: string): Promise<void> {
    console.log(`[ProjectManager] Opening project: ${projectId}`);
    
    // Save current project if open
    if (this.currentProject) {
      await this.closeProject(true);
    }

    // Load new project
    const project = await this.storageService.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    this.currentProject = project;

    // Load workspace state
    const workspace = await this.storageService.loadWorkspace(projectId);
    if (workspace) {
      await this.restoreWorkspace(workspace);
    }

    // Update last accessed time
    await this.storageService.updateProjectMetadata(projectId, {
      lastAccessedAt: new Date()
    });

    // Start auto-save
    this.startAutoSave();

    this.emit('project-opened', project);
    console.log(`[ProjectManager] Opened project: ${project.name}`);
  }

  async closeProject(save: boolean = true): Promise<void> {
    if (!this.currentProject) return;

    console.log(`[ProjectManager] Closing project: ${this.currentProject.name}`);

    // Stop auto-save
    this.stopAutoSave();

    if (save) {
      await this.saveWorkspace();
    }

    const closedProject = this.currentProject;
    this.currentProject = null;

    this.emit('project-closed', closedProject);
  }

  async saveWorkspace(): Promise<void> {
    if (!this.currentProject) {
      console.warn('[ProjectManager] No current project to save workspace for');
      return;
    }

    const workspace: WorkspaceState = {
      canvas: {
        viewport: { x: 0, y: 0, zoom: 1 }, // TODO: Get from canvas manager
        dimensions: { width: 2000, height: 2000 }
      },
      windows: this.windowManager ? this.serializeWindows(this.windowManager.getAllWindows()) : [],
      artifacts: [], // TODO: Get from artifact manager
      conversations: [], // TODO: Get from AI service
      version: '1.0.0',
      timestamp: new Date()
    };

    await this.storageService.saveWorkspace(this.currentProject.id, workspace);
    
    // Update project metadata
    await this.storageService.updateProjectMetadata(this.currentProject.id, {
      updatedAt: new Date(),
      metadata: {
        ...this.currentProject.metadata,
        windowCount: workspace.windows.length
      }
    });

    this.emit('workspace-saved', workspace);
    console.log(`[ProjectManager] Saved workspace for project: ${this.currentProject.name}`);
  }

  private async restoreWorkspace(workspace: WorkspaceState): Promise<void> {
    console.log(`[ProjectManager] Restoring workspace with ${workspace.windows.length} windows`);

    // Clear existing windows
    if (this.windowManager) {
      this.windowManager.clearAllWindows();

      // Restore windows
      for (const windowState of workspace.windows) {
        await this.restoreWindow(windowState);
      }
    }

    // TODO: Restore canvas state
    // TODO: Restore artifacts
    // TODO: Restore conversations

    this.emit('workspace-restored', workspace);
  }

  private async restoreWindow(windowState: WindowState): Promise<void> {
    if (!this.windowManager) return;

    try {
      // Convert WindowState back to BaseWindow format
      const windowConfig: Partial<BaseWindow> = {
        id: windowState.id,
        type: windowState.type as any, // Type assertion needed here
        title: windowState.title,
        position: windowState.position,
        size: windowState.size,
        zIndex: windowState.zIndex,
        isLocked: windowState.isLocked,
        isMinimized: windowState.isMinimized,
        metadata: {
          ...windowState.metadata,
          ...windowState.content // Merge content into metadata for restoration
        }
      };

      await this.windowManager.createWindow(windowState.type as any, windowConfig);
    } catch (error) {
      console.error(`Failed to restore window ${windowState.id}:`, error);
    }
  }

  private serializeWindows(windows: BaseWindow[]): WindowState[] {
    return windows.map(window => ({
      id: window.id,
      type: window.type,
      title: window.title,
      position: window.position,
      size: window.size,
      zIndex: window.zIndex,
      isLocked: window.isLocked,
      isMinimized: window.isMinimized,
      metadata: window.metadata,
      content: this.getWindowContent(window)
    }));
  }

  private getWindowContent(window: BaseWindow): any {
    // Extract window-specific content for serialization
    // This will be extended as more window types are added
    switch (window.type) {
      case 'text':
        return {
          text: window.metadata?.content || ''
        };
      case 'code-execution':
        return {
          code: window.metadata?.code || '',
          language: window.metadata?.language || 'python',
          history: window.metadata?.history || []
        };
      case 'webview':
        return {
          url: window.metadata?.url || 'about:blank'
        };
      default:
        return {};
    }
  }

  getCurrentProject(): Project | null {
    return this.currentProject;
  }

  async listProjects(): Promise<ProjectInfo[]> {
    return await this.storageService.listProjects();
  }

  async getRecentProjects(): Promise<ProjectInfo[]> {
    return await this.storageService.getRecentProjects();
  }

  async deleteProject(projectId: string): Promise<void> {
    // Don't delete current project
    if (this.currentProject && this.currentProject.id === projectId) {
      throw new Error('Cannot delete currently open project');
    }

    await this.storageService.deleteProject(projectId);
    this.emit('project-deleted', projectId);
    
    console.log(`[ProjectManager] Deleted project: ${projectId}`);
  }

  private getDefaultSettings(): ProjectSettings {
    return {
      canvas: {
        defaultZoom: 1.0,
        gridEnabled: true,
        snapToGrid: false,
        gridSize: 20,
        backgroundColor: '#111827',
        showMinimap: false
      },
      ai: {
        defaultModel: 'auto',
        temperature: 0.7,
        maxTokens: 1000,
        enableMemory: true,
        contextWindow: 4000
      },
      preferences: {
        theme: 'dark',
        autoSave: true,
        autoSaveInterval: 30,
        confirmDelete: true,
        showNotifications: true
      },
      features: {
        enableArtifacts: true,
        enableMemory: true,
        enableCollaboration: false,
        betaFeatures: false
      }
    };
  }

  private startAutoSave(): void {
    if (!this.currentProject) return;

    const interval = this.currentProject.settings.preferences.autoSaveInterval * 1000;
    
    this.autoSaveInterval = setInterval(async () => {
      try {
        await this.saveWorkspace();
      } catch (error) {
        console.error('[ProjectManager] Auto-save failed:', error);
      }
    }, interval);
  }

  private stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  // Utility methods
  async getProjectPath(): Promise<string | null> {
    if (!this.currentProject) return null;
    const project = await this.storageService.getProject(this.currentProject.id);
    if (!project) return null;
    return this.storageService.getProjectPath(this.currentProject.id, project.folderPath, project.name);
  }

  async getProjectRoot(): Promise<string | null> {
    if (!this.currentProject) return null;
    const project = await this.storageService.getProject(this.currentProject.id);
    if (!project) return null;
    if (project.folderPath) {
      return project.folderPath;
    }
    return this.storageService.getDefaultProjectPath(project.name);
  }

  getStorageService(): ProjectStorageService {
    return this.storageService;
  }
}