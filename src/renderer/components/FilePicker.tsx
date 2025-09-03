import React, { useState, useEffect } from 'react';
import { File, Folder, X } from 'lucide-react';
import type { FileReference } from '@/shared/types';

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileEntry[];
}

interface FilePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFiles: (files: FileReference[]) => void;
  multiSelect?: boolean;
  position?: { x: number; y: number };
}

export const FilePicker: React.FC<FilePickerProps> = ({
  isOpen,
  onClose,
  onSelectFiles,
  multiSelect = false,
  position,
}) => {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      loadFiles();
    }
  }, [isOpen]);

  const loadFiles = async () => {
    try {
      setIsLoading(true);
      const result = await (window as any).electronAPI.invoke('files:list');
      if (result.success) {
        setFiles(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (filePath: string) => {
    try {
      // Read the file content
      const result = await (window as any).electronAPI.invoke('files:read', filePath);
      if (result.success) {
        const fileRef: FileReference = result.data;
        
        if (multiSelect) {
          const newSelected = new Set(selectedFiles);
          if (newSelected.has(filePath)) {
            newSelected.delete(filePath);
          } else {
            newSelected.add(filePath);
          }
          setSelectedFiles(newSelected);
        } else {
          // Single select - immediately return the file
          onSelectFiles([fileRef]);
          onClose();
        }
      } else {
        console.error('Failed to read file:', result.error);
        // TODO: Show error toast/notification
      }
    } catch (error) {
      console.error('Error reading file:', error);
    }
  };

  const handleConfirmSelection = async () => {
    if (selectedFiles.size === 0) return;
    
    try {
      const fileRefs: FileReference[] = [];
      
      for (const filePath of selectedFiles) {
        const result = await (window as any).electronAPI.invoke('files:read', filePath);
        if (result.success) {
          fileRefs.push(result.data);
        }
      }
      
      onSelectFiles(fileRefs);
      setSelectedFiles(new Set());
      onClose();
    } catch (error) {
      console.error('Error reading selected files:', error);
    }
  };

  const toggleFolder = (folderPath: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  const renderFileTree = (nodes: FileEntry[], depth = 0) => {
    return nodes.map((node) => (
      <div key={node.path} style={{ marginLeft: `${depth * 20}px` }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 8px',
            borderRadius: '4px',
            cursor: 'pointer',
            backgroundColor: selectedFiles.has(node.path) ? '#3b82f6' : 'transparent',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!selectedFiles.has(node.path)) {
              e.currentTarget.style.backgroundColor = '#374151';
            }
          }}
          onMouseLeave={(e) => {
            if (!selectedFiles.has(node.path)) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
          onClick={() => {
            if (node.isDirectory) {
              toggleFolder(node.path);
            } else {
              handleFileSelect(node.path);
            }
          }}
        >
          {node.isDirectory ? (
            <>
              <Folder size={16} color="#9ca3af" />
              <span style={{ fontSize: '14px', flex: 1 }}>{node.name}</span>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                {expandedFolders.has(node.path) ? '−' : '+'}
              </span>
            </>
          ) : (
            <>
              <File size={16} color="#9ca3af" />
              <span style={{ fontSize: '14px' }}>{node.name}</span>
            </>
          )}
        </div>
        {node.isDirectory && node.children && expandedFolders.has(node.path) && (
          renderFileTree(node.children, depth + 1)
        )}
      </div>
    ));
  };

  if (!isOpen) return null;

  const modalStyle = position
    ? {
        position: 'absolute' as const,
        left: position.x,
        top: position.y,
        zIndex: 1001,
      }
    : {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1001,
      };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: position ? 'transparent' : 'rgba(0, 0, 0, 0.7)',
        zIndex: 1000,
      }}
      onClick={position ? undefined : onClose}
    >
      <div
        style={{
          ...modalStyle,
          backgroundColor: '#1f2937',
          border: '1px solid #374151',
          borderRadius: '8px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          width: '400px',
          maxHeight: '500px',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px',
            borderBottom: '1px solid #374151',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3 style={{ margin: 0, color: '#f9fafb', fontSize: '16px', fontWeight: '600' }}>
            {multiSelect ? 'Select Files' : 'Select File'}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#9ca3af',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#374151';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* File List */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '8px',
            color: '#f1f5f9',
          }}
        >
          {isLoading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
                color: '#9ca3af',
                fontSize: '14px',
              }}
            >
              Loading files...
            </div>
          ) : files.length > 0 ? (
            renderFileTree(files)
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
                color: '#9ca3af',
                fontSize: '14px',
                textAlign: 'center',
              }}
            >
              <Folder size={32} color="#4b5563" style={{ marginBottom: '8px' }} />
              <div>No files found</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                Add files to your project folder to see them here
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {multiSelect && selectedFiles.size > 0 && (
          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid #374151',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ color: '#9ca3af', fontSize: '14px' }}>
              {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''} selected
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={onClose}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: '1px solid #374151',
                  backgroundColor: 'transparent',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSelection}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Select
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};