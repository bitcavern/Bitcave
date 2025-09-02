import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { Project, ProjectInfo, WorkspaceState } from './types';

export class ProjectStorageService {
  private basePath: string;
  private projectsPath: string;
  private configPath: string;

  constructor() {
    this.basePath = path.join(os.homedir(), 'Documents', 'Bitcave Projects');
    this.projectsPath = this.basePath;
    this.configPath = path.join(os.homedir(), '.bitcave', 'config');
  }

  async initialize(): Promise<void> {
    await this.ensureDirectoryStructure();
  }

  private async ensureDirectoryStructure(): Promise<void> {
    const directories = [
      this.basePath,
      this.configPath,
      path.join(os.homedir(), '.bitcave', 'memory', 'global'),
      path.join(os.homedir(), '.bitcave', 'memory', 'indexes'),
      path.join(os.homedir(), '.bitcave', 'logs'),
      path.join(os.homedir(), '.bitcave', 'logs', 'ai-interactions'),
      path.join(this.basePath, 'templates')
    ];

    for (const dir of directories) {
      await fs.mkdir(dir, { recursive: true });
    }

    // Create default config files if they don't exist
    await this.createDefaultConfigFiles();
  }

  private async createDefaultConfigFiles(): Promise<void> {
    const defaultConfigs = [
      {
        path: path.join(this.configPath, 'app-settings.json'),
        content: {
          theme: 'dark',
          autoSave: true,
          recentProjectsLimit: 10,
          version: '1.0.0'
        }
      },
      {
        path: path.join(this.configPath, 'recent-projects.json'),
        content: []
      },
      {
        path: path.join(this.configPath, 'user-preferences.json'),
        content: {
          defaultCanvasZoom: 1.0,
          gridEnabled: true,
          snapToGrid: false,
          aiModel: 'auto'
        }
      }
    ];

    for (const config of defaultConfigs) {
      try {
        await fs.access(config.path);
        // File exists, skip
      } catch {
        // File doesn't exist, create it
        await fs.writeFile(config.path, JSON.stringify(config.content, null, 2));
      }
    }
  }

  async createProject(project: Project): Promise<void> {
    const projectPath = this.getProjectPath(project.id, project.folderPath, project.name);
    
    // Create project directory structure
    const directories = [
      projectPath,
      path.join(projectPath, 'memory'),
      path.join(projectPath, 'artifacts'),
      path.join(projectPath, 'assets', 'images'),
      path.join(projectPath, 'assets', 'documents'),
      path.join(projectPath, 'assets', 'data'),
      path.join(projectPath, 'assets', 'exports'),
      path.join(projectPath, 'ai-conversations')
    ];

    for (const dir of directories) {
      await fs.mkdir(dir, { recursive: true });
    }

    // Write project metadata
    await this.writeProjectFile(project.id, 'project.json', project, project.folderPath, project.name);
    
    // Create initial workspace state
    const initialWorkspace: WorkspaceState = {
      canvas: {
        viewport: { x: 0, y: 0, zoom: 1 },
        dimensions: { width: 2000, height: 2000 }
      },
      windows: [],
      artifacts: [],
      conversations: [],
      version: '1.0.0',
      timestamp: new Date()
    };
    
    await this.writeProjectFile(project.id, 'workspace.json', initialWorkspace, project.folderPath, project.name);
    
    // Update recent projects
    await this.addToRecentProjects(project);
  }

  async getProject(projectId: string): Promise<Project | null> {
    try {
      // First try to get the project's custom path from registry
      const projectRegistry = await this.getProjectRegistry();
      const projectEntry = projectRegistry.find(p => p.id === projectId);
      const customPath = projectEntry?.folderPath;
      const projectName = projectEntry?.name;
      
      return await this.readProjectFile<Project>(projectId, 'project.json', customPath, projectName);
    } catch (error) {
      console.error(`Failed to load project ${projectId}:`, error);
      return null;
    }
  }

  async listProjects(): Promise<ProjectInfo[]> {
    try {
      const projectRegistry = await this.getProjectRegistry();
      const projects: ProjectInfo[] = [];

      for (const projectEntry of projectRegistry) {
        const project = await this.getProject(projectEntry.id);
        if (project) {
          projects.push({
            id: project.id,
            name: project.name,
            description: project.description,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            lastAccessedAt: project.lastAccessedAt
          });
        }
      }

      return projects.sort((a, b) => 
        new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime()
      );
    } catch (error) {
      console.error('Failed to list projects:', error);
      return [];
    }
  }

  async getRecentProjects(): Promise<ProjectInfo[]> {
    try {
      const recentProjectIds = await this.readConfigFile<string[]>('recent-projects.json');
      const projects: ProjectInfo[] = [];

      for (const projectId of recentProjectIds || []) {
        const project = await this.getProject(projectId);
        if (project) {
          projects.push({
            id: project.id,
            name: project.name,
            description: project.description,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            lastAccessedAt: project.lastAccessedAt
          });
        }
      }

      return projects;
    } catch (error) {
      console.error('Failed to get recent projects:', error);
      return [];
    }
  }

  async saveWorkspace(projectId: string, workspace: WorkspaceState): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) return;

    await this.writeProjectFile(projectId, 'workspace.json', workspace, project.folderPath, project.name);
    await this.updateProjectMetadata(projectId, { updatedAt: new Date() });
  }

  async loadWorkspace(projectId: string): Promise<WorkspaceState | null> {
    const project = await this.getProject(projectId);
    if (!project) return null;

    return await this.readProjectFile<WorkspaceState>(projectId, 'workspace.json', project.folderPath, project.name);
  }

  async updateProjectMetadata(projectId: string, updates: Partial<Project>): Promise<void> {
    const project = await this.getProject(projectId);
    if (project) {
      const updatedProject = { ...project, ...updates };
      await this.writeProjectFile(projectId, 'project.json', updatedProject, project.folderPath, project.name);
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) return;

    const projectPath = this.getProjectPath(projectId, project.folderPath, project.name);
    await fs.rm(projectPath, { recursive: true, force: true });
    await this.removeFromRecentProjects(projectId);
    await this.removeProjectFromRegistry(projectId);
  }

  private async addToRecentProjects(project: Project): Promise<void> {
    const recentProjects = (await this.readConfigFile<string[]>('recent-projects.json')) || [];
    
    // Remove if already exists
    const filtered = recentProjects.filter(id => id !== project.id);
    
    // Add to beginning
    filtered.unshift(project.id);
    
    // Keep only last 10
    const trimmed = filtered.slice(0, 10);
    
    await this.writeConfigFile('recent-projects.json', trimmed);
    
    // Also update project registry
    await this.updateProjectRegistry(project);
  }

  private async updateProjectRegistry(project: Project): Promise<void> {
    const registry = await this.getProjectRegistry();
    const existingIndex = registry.findIndex(p => p.id === project.id);
    
    const projectEntry = {
      id: project.id,
      name: project.name,
      folderPath: project.folderPath,
      lastAccessedAt: new Date()
    };
    
    if (existingIndex >= 0) {
      registry[existingIndex] = projectEntry;
    } else {
      registry.push(projectEntry);
    }
    
    await this.writeConfigFile('project-registry.json', registry);
  }

  private async getProjectRegistry(): Promise<Array<{id: string, name: string, folderPath?: string, lastAccessedAt: Date}>> {
    return (await this.readConfigFile<Array<{id: string, name: string, folderPath?: string, lastAccessedAt: Date}>>('project-registry.json')) || [];
  }

  private async removeFromRecentProjects(projectId: string): Promise<void> {
    const recentProjects = (await this.readConfigFile<string[]>('recent-projects.json')) || [];
    const filtered = recentProjects.filter(id => id !== projectId);
    await this.writeConfigFile('recent-projects.json', filtered);
  }

  private async removeProjectFromRegistry(projectId: string): Promise<void> {
    const registry = await this.getProjectRegistry();
    const filtered = registry.filter(p => p.id !== projectId);
    await this.writeConfigFile('project-registry.json', filtered);
  }

  getDefaultProjectPath(projectName: string): string {
    return path.join(this.projectsPath, projectName);
  }

  getProjectPath(projectId: string, customPath?: string, projectName?: string): string {
    if (customPath) {
      return path.join(customPath, '.bitcave');
    }
    // Fallback for old projects
    const oldPath = path.join(this.projectsPath, projectId);
    if (require('fs').existsSync(oldPath)) {
      return oldPath;
    }

    if (!projectName) {
      // This should not happen for new projects
      console.warn('Project name not provided for new project');
      return path.join(this.projectsPath, projectId);
    }

    return this.getDefaultProjectPath(projectName);
  }

  private async writeProjectFile(projectId: string, filename: string, data: any, customPath?: string, projectName?: string): Promise<void> {
    const filePath = path.join(this.getProjectPath(projectId, customPath, projectName), filename);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  private async readProjectFile<T>(projectId: string, filename: string, customPath?: string, projectName?: string): Promise<T | null> {
    try {
      const filePath = path.join(this.getProjectPath(projectId, customPath, projectName), filename);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  private async writeConfigFile(filename: string, data: any): Promise<void> {
    const filePath = path.join(this.configPath, filename);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  private async readConfigFile<T>(filename: string): Promise<T | null> {
    try {
      const filePath = path.join(this.configPath, filename);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  // Utility methods
  getBasePath(): string {
    return this.basePath;
  }

  async getProjectAssetsPath(projectId: string): Promise<string | null> {
    const project = await this.getProject(projectId);
    if (!project) return null;
    return path.join(this.getProjectPath(projectId, project.folderPath, project.name), 'assets');
  }

  async getProjectArtifactsPath(projectId: string): Promise<string | null> {
    const project = await this.getProject(projectId);
    if (!project) return null;
    return path.join(this.getProjectPath(projectId, project.folderPath, project.name), 'artifacts');
  }
}