import React, { useState, useEffect } from 'react';

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
          <li key={node.path}>
            <span>{node.isDirectory ? '📁' : '📄'} {node.name}</span>
            {node.children && renderTree(node.children)}
          </li>
        ))}
      </ul>
    );
  };

  if (isLoading) {
    return <div>Loading files...</div>;
  }

  return (
    <div style={{ color: '#f1f5f9', padding: '1rem' }}>
      {renderTree(files)}
    </div>
  );
};
