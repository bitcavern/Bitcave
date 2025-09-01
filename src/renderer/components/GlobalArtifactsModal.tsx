import React, { useState, useEffect } from 'react';
import type { Artifact } from '@/shared/types';

interface GlobalArtifactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportArtifact: (artifactId: string) => void;
}

export const GlobalArtifactsModal: React.FC<GlobalArtifactsModalProps> = ({
  isOpen,
  onClose,
  onImportArtifact
}) => {
  const [globalArtifacts, setGlobalArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadGlobalArtifacts();
    }
  }, [isOpen]);

  const loadGlobalArtifacts = async () => {
    try {
      setLoading(true);
      const result = await (window as any).electronAPI.invoke('artifact:list-global');
      if (result.success) {
        setGlobalArtifacts(result.data);
      }
    } catch (error) {
      console.error('Failed to load global artifacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (artifactId: string) => {
    try {
      setImporting(artifactId);
      const result = await (window as any).electronAPI.invoke('artifact:import-global', {
        globalArtifactId: artifactId
      });
      if (result.success) {
        onImportArtifact(result.data.id);
        onClose();
      }
    } catch (error) {
      console.error('Failed to import artifact:', error);
    } finally {
      setImporting(null);
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
        width: '800px',
        maxHeight: '85vh',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        animation: 'modalSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        color: '#f1f5f9'
      }}
      onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
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
              Global Artifact Library
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
            Import saved artifacts from your global library
          </p>
        </div>

        {/* Content */}
        <div style={{
          maxHeight: '60vh',
          overflowY: 'auto',
          padding: '24px'
        }}>
          {loading ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px 24px',
              color: '#94a3b8'
            }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  border: '3px solid rgba(148, 163, 184, 0.3)',
                  borderTop: '3px solid #3b82f6',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginBottom: '16px'
                }}
              />
              <p style={{ margin: 0, fontSize: '16px' }}>Loading artifacts...</p>
            </div>
          ) : globalArtifacts.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '48px 24px',
              color: '#94a3b8'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📚</div>
              <h3 style={{ 
                margin: '0 0 8px 0', 
                fontSize: '18px', 
                fontWeight: '600',
                color: '#e2e8f0'
              }}>
                No Global Artifacts Yet
              </h3>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5' }}>
                Save artifacts globally from any project to build your reusable library
              </p>
            </div>
          ) : (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
              gap: '16px'
            }}>
              {globalArtifacts.map((artifact) => (
                <div
                  key={artifact.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '12px',
                    padding: '20px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.2)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '12px'
                  }}>
                    <h4 style={{
                      margin: 0,
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#f1f5f9',
                      lineHeight: '1.3'
                    }}>
                      {artifact.title}
                    </h4>
                    <span style={{
                      fontSize: '20px',
                      filter: 'grayscale(0.3)'
                    }}>
                      ✨
                    </span>
                  </div>
                  
                  <p style={{
                    margin: '0 0 16px 0',
                    fontSize: '14px',
                    color: '#94a3b8',
                    lineHeight: '1.4',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {artifact.description}
                  </p>

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px'
                  }}>
                    <div style={{
                      fontSize: '12px',
                      color: '#64748b'
                    }}>
                      {artifact.createdAt && (
                        <span>Created {formatDate(artifact.createdAt)}</span>
                      )}
                      {artifact.originalProjectId && (
                        <span style={{ display: 'block', marginTop: '2px' }}>
                          From: {artifact.originalProjectId}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleImport(artifact.id)}
                    disabled={importing === artifact.id}
                    style={{
                      width: '100%',
                      background: importing === artifact.id 
                        ? 'rgba(148, 163, 184, 0.2)'
                        : 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                      color: importing === artifact.id ? '#94a3b8' : 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 16px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: importing === artifact.id ? 'not-allowed' : 'pointer',
                      boxShadow: importing === artifact.id 
                        ? 'none' 
                        : '0 4px 12px rgba(59, 130, 246, 0.3)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (importing !== artifact.id) {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 8px 20px rgba(59, 130, 246, 0.4)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (importing !== artifact.id) {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                      }
                    }}
                  >
                    {importing === artifact.id ? '⏳ Importing...' : '📥 Import to Project'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
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
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};