import React, { useState, useEffect } from "react";

interface ProjectInfo {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date;
}

interface ProjectLauncherProps {
  onProjectOpen: (projectId: string) => void;
}

export const ProjectLauncher: React.FC<ProjectLauncherProps> = ({
  onProjectOpen,
}) => {
  const [recentProjects, setRecentProjects] = useState<ProjectInfo[]>([]);
  const [allProjects, setAllProjects] = useState<ProjectInfo[]>([]);
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    template: "",
  });

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setIsLoading(true);
      
      // Load recent projects
      const recentResult = await window.electronAPI.invoke("projects:recent");
      if (recentResult.success) {
        setRecentProjects(recentResult.data || []);
      }

      // Load all projects
      const allResult = await window.electronAPI.invoke("projects:list");
      if (allResult.success) {
        setAllProjects(allResult.data || []);
      }
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!createForm.name.trim()) return;

    try {
      const result = await window.electronAPI.invoke("projects:create", {
        name: createForm.name.trim(),
        description: createForm.description.trim() || undefined,
        template: createForm.template || undefined,
      });

      if (result.success) {
        const newProject = result.data;
        onProjectOpen(newProject.id);
      }
    } catch (error) {
      console.error("Failed to create project:", error);
    }
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatRelativeTime = (date: Date | string) => {
    const now = new Date();
    const d = new Date(date);
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return formatDate(date);
  };

  const containerStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    color: "#f1f5f9",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  };

  const contentStyle: React.CSSProperties = {
    maxWidth: "900px",
    width: "100%"
  };

  const headerStyle: React.CSSProperties = {
    textAlign: "center",
    marginBottom: "3rem"
  };

  const titleStyle: React.CSSProperties = {
    fontSize: "2.5rem",
    fontWeight: "700",
    marginBottom: "0.5rem",
    margin: 0,
    background: "linear-gradient(135deg, #60a5fa 0%, #a855f7 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent"
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: "1.1rem",
    color: "#94a3b8",
    margin: 0
  };

  const buttonContainerStyle: React.CSSProperties = {
    display: "flex",
    gap: "1rem",
    justifyContent: "center",
    marginBottom: "3rem"
  };

  const primaryButtonStyle: React.CSSProperties = {
    background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
    color: "white",
    border: "none",
    padding: "0.75rem 1.5rem",
    borderRadius: "0.5rem",
    fontSize: "1rem",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)"
  };

  const secondaryButtonStyle: React.CSSProperties = {
    background: "rgba(255, 255, 255, 0.1)",
    color: "#f1f5f9",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    padding: "0.75rem 1.5rem",
    borderRadius: "0.5rem",
    fontSize: "1rem",
    fontWeight: "500",
    cursor: "pointer"
  };

  const projectGridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "1.5rem",
    marginTop: "1.5rem"
  };

  const projectCardStyle: React.CSSProperties = {
    background: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "0.75rem",
    padding: "1.5rem",
    cursor: "pointer",
    transition: "all 0.2s"
  };

  if (isLoading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "40px",
            height: "40px",
            border: "3px solid rgba(255, 255, 255, 0.1)",
            borderTop: "3px solid #3b82f6",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "0 auto 1rem"
          }}></div>
          <p style={{ color: "#94a3b8", fontSize: "1.1rem" }}>Loading projects...</p>
        </div>
      </div>
    );
  }

  if (showCreateProject) {
    return (
      <div style={containerStyle}>
        <div style={contentStyle}>
          <div style={headerStyle}>
            <h1 style={titleStyle}>Create New Project</h1>
            <button
              style={{
                position: "absolute" as const,
                left: "0",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "#64748b",
                fontSize: "1rem",
                cursor: "pointer",
                padding: "0.5rem",
                borderRadius: "0.5rem"
              }}
              onClick={() => setShowCreateProject(false)}
            >
              ← Back
            </button>
          </div>

          <form onSubmit={handleCreateProject} style={{ maxWidth: "500px", margin: "0 auto" }}>
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: "500",
                color: "#e2e8f0"
              }}>
                Project Name
              </label>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="My Project"
                required
                autoFocus
                style={{
                  width: "100%",
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: "0.5rem",
                  padding: "0.75rem",
                  color: "#f1f5f9",
                  fontSize: "1rem",
                  boxSizing: "border-box" as const
                }}
              />
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: "500",
                color: "#e2e8f0"
              }}>
                Description (optional)
              </label>
              <textarea
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Brief description of your project..."
                rows={3}
                style={{
                  width: "100%",
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: "0.5rem",
                  padding: "0.75rem",
                  color: "#f1f5f9",
                  fontSize: "1rem",
                  resize: "vertical" as const,
                  boxSizing: "border-box" as const
                }}
              />
            </div>

            <div style={{
              display: "flex",
              gap: "1rem",
              justifyContent: "flex-end",
              marginTop: "2rem"
            }}>
              <button
                type="button"
                style={{
                  background: "none",
                  color: "#94a3b8",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  padding: "0.75rem 1.5rem",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                  cursor: "pointer"
                }}
                onClick={() => setShowCreateProject(false)}
              >
                Cancel
              </button>
              <button type="submit" style={primaryButtonStyle}>
                Create Project
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={contentStyle}>
        <div style={headerStyle}>
          <h1 style={titleStyle}>Welcome to Bitcave</h1>
          <p style={subtitleStyle}>Choose a project to continue or create a new one</p>
        </div>

        <div style={buttonContainerStyle}>
          <button
            style={primaryButtonStyle}
            onClick={() => setShowCreateProject(true)}
          >
            + New Project
          </button>
          
          {allProjects.length > 0 && (
            <button
              style={secondaryButtonStyle}
              onClick={() => setShowAllProjects(!showAllProjects)}
            >
              {showAllProjects ? "Show Recent" : "Show All Projects"}
            </button>
          )}
        </div>

        {recentProjects.length > 0 && !showAllProjects && (
          <div>
            <h2 style={{
              fontSize: "1.5rem",
              fontWeight: "600",
              marginBottom: "1.5rem",
              color: "#e2e8f0"
            }}>Recent Projects</h2>
            <div style={projectGridStyle}>
              {recentProjects.slice(0, 6).map((project) => (
                <div
                  key={project.id}
                  style={projectCardStyle}
                  onClick={() => onProjectOpen(project.id)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "0.75rem"
                  }}>
                    <h3 style={{
                      fontSize: "1.25rem",
                      fontWeight: "600",
                      margin: 0,
                      color: "#f1f5f9"
                    }}>{project.name}</h3>
                    <span style={{
                      color: "#64748b",
                      fontSize: "0.875rem",
                      whiteSpace: "nowrap" as const
                    }}>
                      {formatRelativeTime(project.lastAccessedAt)}
                    </span>
                  </div>
                  {project.description && (
                    <p style={{
                      color: "#94a3b8",
                      fontSize: "0.9rem",
                      lineHeight: "1.4",
                      marginBottom: "1rem",
                      margin: "0 0 1rem 0"
                    }}>{project.description}</p>
                  )}
                  <div style={{
                    borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                    paddingTop: "0.75rem"
                  }}>
                    <span style={{
                      color: "#64748b",
                      fontSize: "0.875rem"
                    }}>
                      Created {formatDate(project.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(showAllProjects || recentProjects.length === 0) && allProjects.length > 0 && (
          <div>
            <h2 style={{
              fontSize: "1.5rem",
              fontWeight: "600",
              marginBottom: "1.5rem",
              color: "#e2e8f0"
            }}>All Projects</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {allProjects.map((project) => (
                <div
                  key={project.id}
                  style={{
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "0.5rem",
                    padding: "1.25rem",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                  onClick={() => onProjectOpen(project.id)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                  }}
                >
                  <div>
                    <h3 style={{
                      fontSize: "1.1rem",
                      fontWeight: "600",
                      margin: "0 0 0.25rem 0",
                      color: "#f1f5f9"
                    }}>{project.name}</h3>
                    {project.description && (
                      <p style={{
                        margin: 0,
                        fontSize: "0.875rem",
                        color: "#94a3b8"
                      }}>{project.description}</p>
                    )}
                  </div>
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: "0.25rem"
                  }}>
                    <span style={{ color: "#64748b", fontSize: "0.875rem" }}>
                      Last opened: {formatRelativeTime(project.lastAccessedAt)}
                    </span>
                    <span style={{ color: "#64748b", fontSize: "0.875rem" }}>
                      Created: {formatDate(project.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {allProjects.length === 0 && (
          <div style={{ textAlign: "center", padding: "4rem 2rem" }}>
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>📁</div>
            <h2 style={{
              fontSize: "1.75rem",
              fontWeight: "600",
              marginBottom: "0.5rem",
              color: "#e2e8f0"
            }}>No projects yet</h2>
            <p style={{
              color: "#94a3b8",
              fontSize: "1.1rem",
              marginBottom: "2rem"
            }}>Create your first project to get started with Bitcave</p>
            <button
              style={primaryButtonStyle}
              onClick={() => setShowCreateProject(true)}
            >
              Create Your First Project
            </button>
          </div>
        )}
      </div>
    </div>
  );
};