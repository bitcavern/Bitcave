import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import type { ProjectInfo } from '@/main/projects/types';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (name: string, description?: string, folderPath?: string) => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  onSelectProject,
  onCreateProject
}) => {
  const [recentProjects, setRecentProjects] = useState<ProjectInfo[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadRecentProjects();
    }
  }, [isOpen]);

  const loadRecentProjects = async () => {
    try {
      const projects = await (window as any).electronAPI.invoke('project:list-recent');
      setRecentProjects(projects);
    } catch (error) {
      console.error('Failed to load recent projects:', error);
    }
  };

  const handleSelectFolder = async () => {
    try {
      const result = await (window as any).electronAPI.invoke('dialog:select-folder');
      if (result && !result.canceled && result.filePaths.length > 0) {
        setSelectedFolder(result.filePaths[0]);
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
    }
  };

  const handleCreateProject = async () => {
    if (!projectName.trim()) return;
    
    setLoading(true);
    try {
      await onCreateProject(projectName.trim(), projectDescription.trim() || undefined, selectedFolder || undefined);
      setProjectName('');
      setProjectDescription('');
      setSelectedFolder('');
      setShowCreateForm(false);
      onClose();
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        animation: 'modalFadeIn 0.2s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(148, 163, 184, 0.2)',
        borderRadius: '16px',
        width: '600px',
        maxHeight: '85vh',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        animation: 'modalSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        color: '#f1f5f9'
      }}
      onClick={(e) => e.stopPropagation()}
    >
        <div style={{
          padding: '24px',
          borderBottom: '1px solid rgba(148, 163, 184, 0.2)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <h2 style={{
              margin: 0,
              fontSize: '24px',
              fontWeight: '600',
              color: '#f1f5f9',
              background: 'linear-gradient(135deg, #60a5fa 0%, #a855f7 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              {showCreateForm ? 'Create New Project' : 'Select Project'}
            </h2>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(148, 163, 184, 0.1)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                fontSize: '18px',
                cursor: 'pointer',
                color: '#94a3b8',
                padding: '8px 12px',
                borderRadius: '8px',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                e.currentTarget.style.color = '#ef4444';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(148, 163, 184, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.2)';
                e.currentTarget.style.color = '#94a3b8';
              }}
            >
              ✕
            </button>
          </div>
          <p style={{
            margin: 0,
            color: '#94a3b8',
            fontSize: '14px'
          }}>
            {showCreateForm ? 'Set up a new Bitcave project' : 'Choose a project to open or create a new one'}
          </p>
        </div>

        <div style={{
          maxHeight: '60vh',
          overflowY: 'auto'
        }}>
          {!showCreateForm ? (
            <div style={{ padding: '24px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px'
              }}>
                <h3 style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: '500',
                  color: '#e2e8f0'
                }}>
                  Recent Projects
                </h3>
                <button
                  onClick={() => setShowCreateForm(true)}
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 18px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(59, 130, 246, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                  }}
                >
                  <Sparkles size={16} />
                  <span>New Project</span>
                </button>
              </div>

              {recentProjects.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '48px 24px',
                  color: '#6b7280'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
                  <p style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '500' }}>
                    No projects yet
                  </p>
                  <p style={{ margin: 0, fontSize: '14px' }}>
                    Create your first project to get started
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {recentProjects.map((project) => (
                    <div
                      key={project.id}
                      onClick={() => onSelectProject(project.id)}
                      style={{
                        padding: '16px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        marginBottom: '8px',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.borderColor = '#3b82f6';
                        (e.target as HTMLElement).style.backgroundColor = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.borderColor = '#e5e7eb';
                        (e.target as HTMLElement).style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '4px'
                      }}>
                        <h4 style={{
                          margin: 0,
                          fontSize: '16px',
                          fontWeight: '500',
                          color: '#111827'
                        }}>
                          {project.name}
                        </h4>
                        <span style={{
                          fontSize: '12px',
                          color: '#6b7280',
                          fontWeight: '400'
                        }}>
                          {formatDate(project.lastAccessedAt)}
                        </span>
                      </div>
                      {project.description && (
                        <p style={{
                          margin: 0,
                          fontSize: '14px',
                          color: '#6b7280',
                          lineHeight: '1.4'
                        }}>
                          {project.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '6px'
                }}>
                  Project Name *
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="My Amazing Project"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '6px'
                }}>
                  Description
                </label>
                <textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="What's this project about?"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '6px'
                }}>
                  Project Folder
                </label>
                <div style={{
                  display: 'flex',
                  gap: '8px'
                }}>
                  <input
                    type="text"
                    value={selectedFolder}
                    readOnly
                    placeholder="Choose a folder to store your project (optional)"
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      backgroundColor: '#f9fafb',
                      color: '#6b7280'
                    }}
                  />
                  <button
                    onClick={handleSelectFolder}
                    style={{
                      padding: '10px 16px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      backgroundColor: '#ffffff',
                      color: '#374151',
                      fontSize: '14px',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    Browse
                  </button>
                </div>
                <p style={{
                  margin: '6px 0 0 0',
                  fontSize: '12px',
                  color: '#6b7280'
                }}>
                  If not specified, project will be stored in the default Bitcave folder
                </p>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                paddingTop: '20px',
                borderTop: '1px solid #e5e7eb'
              }}>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setProjectName('');
                    setProjectDescription('');
                    setSelectedFolder('');
                  }}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    color: '#374151',
                    fontSize: '14px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={!projectName.trim() || loading}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: projectName.trim() && !loading ? '#3b82f6' : '#9ca3af',
                    color: 'white',
                    fontSize: '14px',
                    cursor: projectName.trim() && !loading ? 'pointer' : 'not-allowed',
                    fontWeight: '500'
                  }}
                >
                  {loading ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        @keyframes modalFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes modalSlideIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        
        /* Custom scrollbar for webkit browsers */
        ::-webkit-scrollbar {
          width: 6px;
        }
        
        ::-webkit-scrollbar-track {
          background: rgba(148, 163, 184, 0.1);
          border-radius: 3px;
        }
        
        ::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.3);
          border-radius: 3px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.5);
        }
      `}</style>
    </div>
  );
};