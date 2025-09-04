import React, { useState, useEffect } from 'react';
import { ProjectModal } from './ProjectModal';
import type { ProjectInfo, Project } from '@/main/projects/types';

interface ProjectIndicatorProps {
  leftSidebarVisible?: boolean;
  leftSidebarWidth?: number;
  onProjectChange?: (projectId: string | null) => void;
}

export const ProjectIndicator: React.FC<ProjectIndicatorProps> = ({
  leftSidebarVisible = false,
  leftSidebarWidth = 400,
  onProjectChange
}) => {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCurrentProject();
  }, []);

  const loadCurrentProject = async () => {
    try {
      const result = await (window as any).electronAPI.invoke('projects:current');
      if (result.success && result.data) {
        setCurrentProject(result.data);
      } else {
        setCurrentProject(null);
      }
    } catch (error) {
      console.error('Failed to load current project:', error);
      setCurrentProject(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectProject = async (projectId: string) => {
    try {
      const result = await (window as any).electronAPI.invoke('projects:open', { projectId });
      if (result.success) {
        await loadCurrentProject();
        onProjectChange?.(projectId);
      }
    } catch (error) {
      console.error('Failed to open project:', error);
    }
  };

  const handleCreateProject = async (name: string, description?: string, folderPath?: string) => {
    try {
      const result = await (window as any).electronAPI.invoke('projects:create', {
        name,
        description,
        folderPath
      });
      if (result.success) {
        await loadCurrentProject();
        onProjectChange?.(result.data.id);
      }
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  if (isLoading) {
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: leftSidebarVisible ? `${leftSidebarWidth}px` : "0",
          right: 0,
          height: "40px",
          backgroundColor: "#1f2937",
          zIndex: 10000,
          // @ts-ignore - webkit-app-region is a valid CSS property for Electron
          WebkitAppRegion: "drag" as any,
          borderBottom: "1px solid rgba(75, 85, 99, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#9ca3af",
          fontSize: "14px",
          fontWeight: "500",
          transition: "left 0.3s ease",
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          position: "fixed",
          top: 0,
          left: leftSidebarVisible ? `${leftSidebarWidth}px` : "0",
          right: 0,
          height: "40px",
          backgroundColor: "#1f2937",
          zIndex: 10000,
          // @ts-ignore - webkit-app-region is a valid CSS property for Electron
          WebkitAppRegion: "drag" as any,
          borderBottom: "1px solid rgba(75, 85, 99, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#9ca3af",
          fontSize: "14px",
          fontWeight: "500",
          transition: "left 0.3s ease",
        }}
      >
        <button
          onClick={() => setShowProjectModal(true)}
          style={{
            // @ts-ignore - WebkitAppRegion is a valid CSS property for Electron  
            WebkitAppRegion: "no-drag" as any,
            background: "none",
            border: "none",
            color: "inherit",
            fontSize: "inherit",
            fontWeight: "inherit",
            fontFamily: "inherit",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 12px",
            borderRadius: "6px",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(59, 130, 246, 0.1)";
            e.currentTarget.style.color = "#3b82f6";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "#9ca3af";
          }}
        >
          {currentProject ? (
            <>
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: currentProject.metadata?.color || "#10b981",
                  flexShrink: 0
                }}
              />
              <span style={{ fontWeight: "600" }}>
                {currentProject.name}
              </span>
              <span style={{ opacity: 0.7 }}>▼</span>
            </>
          ) : (
            <>
              <span>📁</span>
              <span>No Project - Click to Select</span>
              <span style={{ opacity: 0.7 }}>▼</span>
            </>
          )}
        </button>
      </div>

      {showProjectModal && (
        <ProjectModal
          isOpen={showProjectModal}
          onClose={() => setShowProjectModal(false)}
          onSelectProject={handleSelectProject}
          onCreateProject={handleCreateProject}
        />
      )}
    </>
  );
};