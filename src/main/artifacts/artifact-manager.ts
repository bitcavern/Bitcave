
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { Artifact, ArtifactCreationRequest, DataTemplate } from '@/shared/types';

export class ArtifactManager {
  private artifacts: Map<string, Artifact> = new Map();
  private projectPath: string;
  private globalArtifactsPath: string;

  constructor(projectPath: string, globalBasePath?: string) {
    this.projectPath = projectPath;
    this.globalArtifactsPath = globalBasePath 
      ? path.join(globalBasePath, 'global-artifacts')
      : path.join(require('os').homedir(), '.bitcave', 'global-artifacts');
  }

  async createArtifact(request: ArtifactCreationRequest): Promise<Artifact> {
    const artifactId = uuidv4();
    const artifact: Artifact = {
      id: artifactId,
      ...request,
    };

    this.artifacts.set(artifactId, artifact);

    const artifactPath = path.join(this.projectPath, 'artifacts', artifactId);
    await fs.mkdir(artifactPath, { recursive: true });

    const sourcePath = path.join(artifactPath, 'source');
    await fs.mkdir(sourcePath, { recursive: true });

    await fs.writeFile(path.join(sourcePath, 'index.html'), request.html);
    if (request.css && request.css.trim()) {
      await fs.writeFile(path.join(sourcePath, 'styles.css'), request.css);
    }
    if (request.javascript && request.javascript.trim()) {
      await fs.writeFile(path.join(sourcePath, 'script.js'), request.javascript);
    }

    if (request.dataTemplates) {
      const dataPath = path.join(artifactPath, 'data');
      await fs.mkdir(dataPath, { recursive: true });
      await fs.writeFile(path.join(dataPath, 'templates.json'), JSON.stringify(request.dataTemplates, null, 2));
    }

    const artifactMetadataPath = path.join(artifactPath, 'artifact.json');
    await fs.writeFile(artifactMetadataPath, JSON.stringify(artifact, null, 2));

    return artifact;
  }

  async updateArtifact(artifactId: string, updates: Partial<Artifact>): Promise<Artifact> {
    const artifact = this.artifacts.get(artifactId);
    if (!artifact) {
      throw new Error(`Artifact ${artifactId} not found`);
    }

    const updatedArtifact: Artifact = { ...artifact, ...updates };
    this.artifacts.set(artifactId, updatedArtifact);

    const artifactPath = path.join(this.projectPath, 'artifacts', artifactId);
    const sourcePath = path.join(artifactPath, 'source');

    // Update source files if provided
    if (updates.html && updates.html.trim()) {
      await fs.writeFile(path.join(sourcePath, 'index.html'), updates.html);
    }
    if (updates.css && updates.css.trim()) {
      await fs.writeFile(path.join(sourcePath, 'styles.css'), updates.css);
    }
    if (updates.javascript && updates.javascript.trim()) {
      await fs.writeFile(path.join(sourcePath, 'script.js'), updates.javascript);
    }

    // Update data templates if provided
    if (updates.dataTemplates) {
      const dataPath = path.join(artifactPath, 'data');
      await fs.mkdir(dataPath, { recursive: true });
      await fs.writeFile(
        path.join(dataPath, 'templates.json'),
        JSON.stringify(updates.dataTemplates, null, 2)
      );
    }

    // Update artifact metadata
    const artifactMetadataPath = path.join(artifactPath, 'artifact.json');
    await fs.writeFile(artifactMetadataPath, JSON.stringify(updatedArtifact, null, 2));

    return updatedArtifact;
  }

  async getArtifactData(artifactId: string, templateKey?: string): Promise<any> {
    const artifactPath = path.join(this.projectPath, 'artifacts', artifactId);
    const dataPath = path.join(artifactPath, 'data');

    if (!templateKey) {
      // Return all data
      try {
        const files = await fs.readdir(dataPath);
        const dataFiles = files.filter(f => f.endsWith('.json') && f !== 'templates.json');
        const allData: Record<string, any> = {};

        for (const file of dataFiles) {
          const key = path.basename(file, '.json');
          const filePath = path.join(dataPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          allData[key] = JSON.parse(content);
        }

        return allData;
      } catch (error) {
        return {};
      }
    } else {
      // Return specific template data
      try {
        const filePath = path.join(dataPath, `${templateKey}.json`);
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content);
      } catch (error) {
        // If file doesn't exist, get default value from template
        const templatesPath = path.join(dataPath, 'templates.json');
        try {
          const templatesContent = await fs.readFile(templatesPath, 'utf-8');
          const templates: DataTemplate[] = JSON.parse(templatesContent);
          const template = templates.find(t => t.id === templateKey);
          return template ? template.defaultValue : null;
        } catch {
          return null;
        }
      }
    }
  }

  async setArtifactData(artifactId: string, templateKey: string, data: any): Promise<void> {
    const artifactPath = path.join(this.projectPath, 'artifacts', artifactId);
    const dataPath = path.join(artifactPath, 'data');

    // Ensure data directory exists
    await fs.mkdir(dataPath, { recursive: true });

    // Write data to file
    const filePath = path.join(dataPath, `${templateKey}.json`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  async destroyArtifact(artifactId: string): Promise<void> {
    this.artifacts.delete(artifactId);

    const artifactPath = path.join(this.projectPath, 'artifacts', artifactId);
    
    // Remove artifact directory and all its contents
    try {
      await fs.rm(artifactPath, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to remove artifact directory ${artifactPath}:`, error);
    }
  }

  async loadExistingArtifacts(): Promise<void> {
    const artifactsDir = path.join(this.projectPath, 'artifacts');
    
    try {
      const artifactDirs = await fs.readdir(artifactsDir);
      
      for (const dirName of artifactDirs) {
        const artifactPath = path.join(artifactsDir, dirName);
        const metadataPath = path.join(artifactPath, 'artifact.json');
        
        try {
          const content = await fs.readFile(metadataPath, 'utf-8');
          const artifact: Artifact = JSON.parse(content);
          this.artifacts.set(artifact.id, artifact);
        } catch (error) {
          console.warn(`Failed to load artifact ${dirName}:`, error);
        }
      }
    } catch (error) {
      // Artifacts directory doesn't exist yet, which is fine
    }
  }

  getArtifact(artifactId: string): Artifact | undefined {
    return this.artifacts.get(artifactId);
  }

  getAllArtifacts(): Artifact[] {
    return Array.from(this.artifacts.values());
  }

  // Global artifact methods for cross-project sharing
  async saveArtifactGlobally(artifactId: string, name?: string): Promise<void> {
    const artifact = this.artifacts.get(artifactId);
    if (!artifact) {
      throw new Error(`Artifact ${artifactId} not found`);
    }

    // Ensure global artifacts directory exists
    await fs.mkdir(this.globalArtifactsPath, { recursive: true });

    const globalArtifactId = uuidv4();
    const globalArtifact = {
      ...artifact,
      id: globalArtifactId,
      title: name || artifact.title,
      createdAt: new Date(),
      isGlobal: true,
      originalProjectId: this.getProjectIdFromPath()
    };

    const globalArtifactPath = path.join(this.globalArtifactsPath, globalArtifactId);
    await fs.mkdir(globalArtifactPath, { recursive: true });

    // Copy artifact files
    const sourcePath = path.join(globalArtifactPath, 'source');
    await fs.mkdir(sourcePath, { recursive: true });

    await fs.writeFile(path.join(sourcePath, 'index.html'), artifact.html);
    if (artifact.css && artifact.css.trim()) {
      await fs.writeFile(path.join(sourcePath, 'styles.css'), artifact.css);
    }
    if (artifact.javascript && artifact.javascript.trim()) {
      await fs.writeFile(path.join(sourcePath, 'script.js'), artifact.javascript);
    }

    if (artifact.dataTemplates) {
      const dataPath = path.join(globalArtifactPath, 'data');
      await fs.mkdir(dataPath, { recursive: true });
      await fs.writeFile(path.join(dataPath, 'templates.json'), JSON.stringify(artifact.dataTemplates, null, 2));
    }

    // Save global artifact metadata
    const globalMetadataPath = path.join(globalArtifactPath, 'artifact.json');
    await fs.writeFile(globalMetadataPath, JSON.stringify(globalArtifact, null, 2));
  }

  async loadGlobalArtifacts(): Promise<Artifact[]> {
    try {
      const globalArtifacts: Artifact[] = [];
      const artifactDirs = await fs.readdir(this.globalArtifactsPath);
      
      for (const dirName of artifactDirs) {
        const artifactMetadataPath = path.join(this.globalArtifactsPath, dirName, 'artifact.json');
        try {
          const metadataContent = await fs.readFile(artifactMetadataPath, 'utf-8');
          const artifact = JSON.parse(metadataContent) as Artifact;
          globalArtifacts.push(artifact);
        } catch (error) {
          console.warn(`Failed to load global artifact ${dirName}:`, error);
        }
      }
      
      return globalArtifacts;
    } catch (error) {
      // Global artifacts directory doesn't exist yet
      return [];
    }
  }

  async importGlobalArtifact(globalArtifactId: string): Promise<Artifact> {
    const globalArtifactPath = path.join(this.globalArtifactsPath, globalArtifactId);
    const metadataPath = path.join(globalArtifactPath, 'artifact.json');
    
    try {
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      const globalArtifact = JSON.parse(metadataContent) as Artifact;
      
      // Create new local artifact with unique ID
      const localArtifactId = uuidv4();
      const localArtifact: Artifact = {
        ...globalArtifact,
        id: localArtifactId,
        isGlobal: false,
        importedFrom: globalArtifactId
      };
      
      // Create local artifact
      return await this.createArtifact({
        title: localArtifact.title,
        description: localArtifact.description,
        html: localArtifact.html,
        css: localArtifact.css,
        javascript: localArtifact.javascript,
        dataTemplates: localArtifact.dataTemplates,
        dependencies: localArtifact.dependencies
      });
      
    } catch (error) {
      throw new Error(`Failed to import global artifact ${globalArtifactId}: ${error}`);
    }
  }

  private getProjectIdFromPath(): string {
    // Extract project ID from project path - this is a simple implementation
    return path.basename(this.projectPath);
  }
}
