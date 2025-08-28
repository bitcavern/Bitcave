import React, { useRef, useEffect, useState } from 'react';
import type { Artifact } from '@/shared/types';

interface ArtifactWindowProps {
  artifact: Artifact;
  onDataChange?: (templateKey: string, data: any) => void;
  onNotify?: (message: string) => void;
}

export const ArtifactWindow: React.FC<ArtifactWindowProps> = ({
  artifact,
  onDataChange,
  onNotify
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!iframeRef.current) return;

    // Build the complete HTML document for the artifact
    const dependencies = artifact.dependencies?.map(dep => 
      `<script src="${dep}"></script>`
    ).join('\n') || '';

    const artifactHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${artifact.title}</title>
    <style>
        body {
            margin: 0;
            padding: 16px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #ffffff;
            color: #1f2937;
        }
        * {
            box-sizing: border-box;
        }
        ${artifact.css || ''}
    </style>
</head>
<body>
    ${artifact.html}
    
    <script>
        // BitcaveAPI for artifact interaction
        window.BitcaveAPI = {
            getData: async (key) => {
                return new Promise((resolve) => {
                    const messageId = Date.now().toString();
                    window.addEventListener('message', function handler(event) {
                        if (event.data.type === 'dataResponse' && event.data.messageId === messageId) {
                            window.removeEventListener('message', handler);
                            resolve(event.data.data);
                        }
                    });
                    parent.postMessage({
                        type: 'getData',
                        messageId: messageId,
                        artifactId: '${artifact.id}',
                        key: key
                    }, '*');
                });
            },
            
            setData: (key, data) => {
                parent.postMessage({
                    type: 'setData',
                    artifactId: '${artifact.id}',
                    key: key,
                    data: data
                }, '*');
            },
            
            notify: (message) => {
                parent.postMessage({
                    type: 'notify',
                    artifactId: '${artifact.id}',
                    message: message
                }, '*');
            }
        };
        
        // Initialize artifact
        ${artifact.javascript || ''}
        
        // Signal that the artifact is ready
        parent.postMessage({ type: 'ready', artifactId: '${artifact.id}' }, '*');
    </script>
    
    ${dependencies}
</body>
</html>`;

    // Set the iframe content
    const iframe = iframeRef.current;
    iframe.srcdoc = artifactHTML;

    const handleLoad = () => {
      setIsLoading(false);
    };

    iframe.addEventListener('load', handleLoad);

    return () => {
      iframe.removeEventListener('load', handleLoad);
    };
  }, [artifact]);

  // Handle messages from the artifact iframe
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;

      const { type, artifactId, key, data, message, messageId } = event.data;

      if (artifactId !== artifact.id) return;

      switch (type) {
        case 'getData':
          try {
            const result = await (window as any).electronAPI.invoke('artifact:get-data', {
              artifactId,
              templateKey: key
            });
            if (result.success && iframeRef.current?.contentWindow) {
              iframeRef.current.contentWindow.postMessage({
                type: 'dataResponse',
                messageId,
                data: result.data
              }, '*');
            }
          } catch (error) {
            console.error('Failed to get artifact data:', error);
          }
          break;

        case 'setData':
          try {
            await (window as any).electronAPI.invoke('artifact:set-data', {
              artifactId,
              templateKey: key,
              data
            });
            onDataChange?.(key, data);
          } catch (error) {
            console.error('Failed to set artifact data:', error);
          }
          break;

        case 'notify':
          onNotify?.(message);
          break;

        case 'ready':
          console.log(`Artifact ${artifactId} is ready`);
          break;

        default:
          console.warn('Unknown artifact message type:', type);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [artifact.id, onDataChange, onNotify]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f9fafb',
            color: '#6b7280',
            fontSize: '14px',
            zIndex: 1
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: '24px',
                height: '24px',
                border: '2px solid #e5e7eb',
                borderTop: '2px solid #3b82f6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 8px'
              }}
            />
            Loading {artifact.title}...
          </div>
        </div>
      )}
      
      <iframe
        ref={iframeRef}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: '8px',
          display: isLoading ? 'none' : 'block'
        }}
        sandbox="allow-scripts allow-same-origin"
        title={artifact.title}
      />
      
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};