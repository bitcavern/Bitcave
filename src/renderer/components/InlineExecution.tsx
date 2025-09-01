import React, { useState } from 'react';

interface InlineExecutionProps {
  executionId: string;
  code: string;
  output?: string;
  error?: string;
  success: boolean;
  description: string;
  executionTime?: number;
  isLoading?: boolean;
  onCreateCodeWindow?: (executionId: string) => void;
}

export const InlineExecution: React.FC<InlineExecutionProps> = ({
  executionId,
  code,
  output,
  error,
  success,
  description,
  executionTime,
  isLoading = false,
  onCreateCodeWindow,
}) => {
  const [showCode, setShowCode] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleCreateCodeWindow = () => {
    if (onCreateCodeWindow) {
      onCreateCodeWindow(executionId);
    }
  };

  if (isLoading) {
    return (
      <div
        style={{
          padding: '12px 16px',
          borderRadius: '12px',
          backgroundColor: '#1f2937',
          border: '1px solid #374151',
          margin: '8px 0',
          color: '#f9fafb',
          fontSize: '14px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#fbbf24',
          }}
        >
          <div
            style={{
              width: '16px',
              height: '16px',
              border: '2px solid #fbbf24',
              borderTop: '2px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <span style={{ fontWeight: '500' }}>Running Code...</span>
        </div>
        <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
          {description}
        </div>
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        margin: '8px 0',
      }}
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => setShowMenu(false)}
    >
      <div
        style={{
          padding: '12px 16px',
          borderRadius: '12px',
          backgroundColor: success ? '#064e3b' : '#7f1d1d',
          border: success ? '1px solid #065f46' : '1px solid #991b1b',
          color: '#f9fafb',
          fontSize: '14px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          transition: 'all 0.2s ease',
        }}
      >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>
            {success ? '🟢' : '🔴'}
          </span>
          <span style={{ fontWeight: '600', fontSize: '13px' }}>
            {description}
          </span>
          {executionTime && (
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>
              ({executionTime}ms)
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setShowCode(!showCode)}
            style={{
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backgroundColor: 'transparent',
              color: '#d1d5db',
              fontSize: '11px',
              cursor: 'pointer',
              fontWeight: '500',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {showCode ? 'Hide Code' : 'Show Code'}
          </button>
        </div>
      </div>

      {/* Code (collapsible) */}
      {showCode && (
        <div
          style={{
            marginBottom: '8px',
            padding: '8px 12px',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '4px' }}>
            Python Code:
          </div>
          <pre
            style={{
              margin: 0,
              fontFamily: '"JetBrains Mono", "SF Mono", Consolas, monospace',
              fontSize: '12px',
              lineHeight: '1.4',
              whiteSpace: 'pre-wrap',
              color: '#e5e7eb',
            }}
          >
            {code}
          </pre>
        </div>
      )}

      {/* Output */}
      {output && (
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: success
              ? 'rgba(16, 185, 129, 0.1)'
              : 'rgba(239, 68, 68, 0.1)',
            borderRadius: '6px',
            border: success
              ? '1px solid rgba(16, 185, 129, 0.2)'
              : '1px solid rgba(239, 68, 68, 0.2)',
          }}
        >
          <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '4px' }}>
            {success ? 'Output:' : 'Error:'}
          </div>
          <pre
            style={{
              margin: 0,
              fontFamily: '"JetBrains Mono", "SF Mono", Consolas, monospace',
              fontSize: '12px',
              lineHeight: '1.4',
              whiteSpace: 'pre-wrap',
              color: success ? '#34d399' : '#f87171',
            }}
          >
            {output}
          </pre>
        </div>
      )}

      {/* Error (separate from output for failed executions) */}
      {error && !success && (
        <div
          style={{
            marginTop: '8px',
            padding: '8px 12px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderRadius: '6px',
            border: '1px solid rgba(239, 68, 68, 0.2)',
          }}
        >
          <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '4px' }}>
            Error:
          </div>
          <pre
            style={{
              margin: 0,
              fontFamily: '"JetBrains Mono", "SF Mono", Consolas, monospace',
              fontSize: '12px',
              lineHeight: '1.4',
              whiteSpace: 'pre-wrap',
              color: '#f87171',
            }}
          >
            {error}
          </pre>
        </div>
      )}
      </div>

      {/* Hover Menu */}
      {showMenu && onCreateCodeWindow && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            right: '-8px',
            transform: 'translate(100%, -50%)',
            background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
            border: '1px solid #374151',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
            padding: '8px',
            zIndex: 9999,
            animation: 'fadeIn 0.2s ease-in-out',
            backdropFilter: 'blur(8px)',
          }}
        >
          <button
            onClick={handleCreateCodeWindow}
            style={{
              background: 'transparent',
              border: '1px solid rgba(55, 65, 81, 0.5)',
              color: '#e5e7eb',
              cursor: 'pointer',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
              fontWeight: '500',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#3b82f6';
              e.currentTarget.style.borderColor = '#3b82f6';
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = 'rgba(55, 65, 81, 0.5)';
              e.currentTarget.style.color = '#e5e7eb';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title="Open source in code editor"
          >
            <span style={{ fontSize: '14px' }}>📝</span>
            <span>Open in Editor</span>
          </button>
        </div>
      )}

      <style>
        {`
          @keyframes fadeIn {
            0% { 
              opacity: 0; 
              transform: translateY(-4px); 
            }
            100% { 
              opacity: 1; 
              transform: translateY(0); 
            }
          }
        `}
      </style>
    </div>
  );
};

export default InlineExecution;