import React, { useState, useEffect } from 'react';
import { Folder, File } from 'lucide-react';

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileEntry[];
}

export const FileExplorer: React.FC = () => {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadFiles();
  }, []);

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

  const renderTree = (nodes: FileEntry[]) => {
    return (
      <ul style={{ paddingLeft: '1rem', listStyleType: 'none' }}>
        {nodes.map((node) => (
          <li key={node.path} style={{ marginBottom: '4px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              padding: '2px 4px',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#374151';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            >
              {node.isDirectory ? (
                <Folder size={16} color="#9ca3af" />
              ) : (
                <File size={16} color="#9ca3af" />
              )}
              <span style={{ fontSize: '14px' }}>{node.name}</span>
            </div>
            {node.children && renderTree(node.children)}
          </li>
        ))}
      </ul>
    );
  };

  if (isLoading) {
    return (
      <div style={{ 
        color: '#9ca3af', 
        padding: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px'
      }}>
        Loading files...
      </div>
    );
  }

  return (
    <div style={{ 
      color: '#f1f5f9', 
      padding: '1rem',
      borderRight: '1px solid #374151',
      height: '100%',
      overflow: 'auto'
    }}>
      {files.length > 0 ? (
        renderTree(files)
      ) : (
        <div style={{
          color: '#9ca3af',
          fontSize: '14px',
          textAlign: 'center',
          marginTop: '2rem'
        }}>
          <div style={{ marginBottom: '8px' }}>
            <Folder size={32} color="#4b5563" style={{ margin: '0 auto' }} />
          </div>
          <div>No files found</div>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>
            Add files to your project folder to see them here
          </div>
        </div>
      )}
    </div>
  );
};
