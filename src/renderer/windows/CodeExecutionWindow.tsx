import React, { useState, useEffect } from 'react';
import { BaseWindow, CodeExecutionRequest, CodeExecutionResult } from '@/shared/types';

interface CodeExecutionWindowProps {
  window: BaseWindow;
  onUpdateWindow: (windowId: string, updates: Partial<BaseWindow>) => void;
  onExecuteCode?: (request: CodeExecutionRequest) => Promise<CodeExecutionResult>;
}

interface ExecutionHistory {
  id: string;
  request: CodeExecutionRequest;
  result: CodeExecutionResult;
  timestamp: Date;
}

export const CodeExecutionWindow: React.FC<CodeExecutionWindowProps> = ({
  window,
  onUpdateWindow,
  onExecuteCode,
}) => {
  const [code, setCode] = useState(window.metadata?.code || '');
  const [language, setLanguage] = useState<'python' | 'javascript'>(
    window.metadata?.language || 'python'
  );
  const [isExecuting, setIsExecuting] = useState(false);
  const [history, setHistory] = useState<ExecutionHistory[]>(
    window.metadata?.history || []
  );
  const [currentResult, setCurrentResult] = useState<CodeExecutionResult | null>(
    window.metadata?.lastExecution?.result || null
  );
  
  // Sync state when window metadata changes (e.g., from AI tool execution)
  useEffect(() => {
    if (window.metadata?.lastExecution?.result && !isExecuting) {
      setCurrentResult(window.metadata.lastExecution.result);
      setCode(window.metadata.code || code);
      setLanguage(window.metadata.language || language);
      setHistory(window.metadata.history || []);
    }
  }, [window.metadata?.lastExecution, window.metadata?.code, window.metadata?.language, window.metadata?.history, isExecuting]);
  
  // Update window metadata when state changes
  useEffect(() => {
    onUpdateWindow(window.id, {
      metadata: {
        ...window.metadata,
        code,
        language,
        history,
      },
    });
  }, [code, language, history, window.id, window.metadata, onUpdateWindow]);

  const handleExecuteCode = async () => {
    if (!code.trim() || isExecuting) return;
    
    setIsExecuting(true);
    setCurrentResult(null);
    
    try {
      const request: CodeExecutionRequest = {
        language,
        code: code.trim(),
        timeout: 10000, // 10 seconds
        memoryLimit: language === 'python' ? 256 : 128, // MB
      };
      
      // Execute code using provided function or fall back to direct IPC
      let result: CodeExecutionResult;
      
      if (onExecuteCode) {
        result = await onExecuteCode(request);
      } else {
        // Fallback to direct IPC call
        try {
          const electronAPI = (window as any).electronAPI;
          if (!electronAPI || !electronAPI.invoke) {
            throw new Error('electronAPI not available and no executeCode function provided');
          }
          const response = await electronAPI.invoke('code:execute', request);
          
          if (!response.success) {
            throw new Error(response.error);
          }
          
          result = response.data;
        } catch (ipcError) {
          throw new Error(`IPC call failed: ${(ipcError as Error).message}`);
        }
      }
      
      setCurrentResult(result);
      
      // Add to history
      const historyEntry: ExecutionHistory = {
        id: Date.now().toString(),
        request,
        result,
        timestamp: new Date(),
      };
      
      setHistory(prev => [historyEntry, ...prev.slice(0, 9)]); // Keep last 10 executions
      
    } catch (error) {
      setCurrentResult({
        success: false,
        output: '',
        error: `Execution failed: ${(error as Error).message}`,
        executionTime: 0,
        memoryUsed: 0,
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    setCurrentResult(null);
  };

  const loadFromHistory = (entry: ExecutionHistory) => {
    setCode(entry.request.code);
    setLanguage(entry.request.language);
    setCurrentResult(entry.result);
  };

  return (
    <div 
      style={{
        margin: '-16px',
        height: 'calc(100% + 32px)',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
        color: 'white',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px',
        borderBottom: '1px solid #374151',
        background: 'rgba(55, 65, 81, 0.3)',
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'python' | 'javascript')}
            disabled={isExecuting}
            style={{
              background: '#374151',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #4b5563',
              fontSize: '14px',
              fontWeight: '500',
              cursor: isExecuting ? 'not-allowed' : 'pointer',
            }}
          >
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
          </select>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleExecuteCode}
            disabled={!code.trim() || isExecuting}
            style={{
              padding: '10px 16px',
              background: (!code.trim() || isExecuting) ? '#4b5563' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: (!code.trim() || isExecuting) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: (!code.trim() || isExecuting) ? 'none' : '0 2px 8px rgba(16, 185, 129, 0.3)',
            }}
          >
            {isExecuting ? 'Running...' : 'Execute'}
          </button>
          <button
            onClick={clearHistory}
            style={{
              padding: '10px 16px',
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background 0.2s ease',
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#9ca3af'}
            onMouseOut={(e) => e.currentTarget.style.background = '#6b7280'}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
        
        {/* Input Card */}
        <div style={{
          background: 'rgba(31, 41, 55, 0.8)',
          borderRadius: '12px',
          border: '1px solid #374151',
          overflow: 'hidden',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
        }}>
          <div style={{
            padding: '12px 16px',
            background: 'rgba(55, 65, 81, 0.5)',
            borderBottom: '1px solid #374151',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#e5e7eb' }}>
              Code Editor
            </span>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>
              Ctrl+Enter to execute
            </span>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={
              language === 'python'
                ? 'print("Hello from Python!")\n\n# Try some math:\nimport math\nprint(f"π = {math.pi:.4f}")\n\n# Data analysis:\nimport numpy as np\ndata = np.array([1, 2, 3, 4, 5])\nprint(f"Mean: {np.mean(data)}")'
                : 'console.log("Hello from JavaScript!");\n\n// Try some math:\nconst result = Math.PI * 2;\nconsole.log(`2π = ${result.toFixed(4)}`);\n\n// Array operations:\nconst data = [1, 2, 3, 4, 5];\nconst sum = data.reduce((a, b) => a + b, 0);\nconsole.log(`Sum: ${sum}`);'
            }
            disabled={isExecuting}
            onKeyDown={(e) => {
              if (e.ctrlKey && e.key === 'Enter') {
                handleExecuteCode();
              }
            }}
            style={{
              width: '100%',
              minHeight: '200px',
              maxHeight: '400px',
              padding: '16px',
              background: 'transparent',
              color: '#f9fafb',
              fontFamily: '"JetBrains Mono", "SF Mono", Consolas, monospace',
              fontSize: '14px',
              lineHeight: '1.5',
              border: 'none',
              outline: 'none',
              resize: 'vertical',
              opacity: isExecuting ? 0.6 : 1,
            }}
          />
        </div>

        {/* Output Card */}
        <div style={{
          background: 'rgba(31, 41, 55, 0.8)',
          borderRadius: '12px',
          border: '1px solid #374151',
          overflow: 'hidden',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
          flex: 1,
          minHeight: '200px',
        }}>
          <div style={{
            padding: '12px 16px',
            background: 'rgba(55, 65, 81, 0.5)',
            borderBottom: '1px solid #374151',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#e5e7eb' }}>
              Output
            </span>
            {currentResult && (
              <span style={{
                fontSize: '12px',
                padding: '4px 8px',
                borderRadius: '6px',
                background: currentResult.success ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: currentResult.success ? '#34d399' : '#f87171',
                border: `1px solid ${currentResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                fontWeight: '500',
              }}>
                {currentResult.success ? '✅ Success' : '❌ Error'} 
                {currentResult.executionTime > 0 && ` (${currentResult.executionTime}ms)`}
              </span>
            )}
          </div>
          
          <div style={{ padding: '16px', height: 'calc(100% - 57px)', overflowY: 'auto' }}>
            {isExecuting && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                color: '#fbbf24',
                padding: '20px',
                justifyContent: 'center',
              }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid #fbbf24',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }} />
                <span style={{ fontSize: '16px', fontWeight: '500' }}>
                  Executing your {language} code...
                </span>
              </div>
            )}
            
            {currentResult && !isExecuting && (
              <div>
                {currentResult.output && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px', fontWeight: '600' }}>
                      Output:
                    </div>
                    <pre style={{
                      fontSize: '13px',
                      color: '#34d399',
                      whiteSpace: 'pre-wrap',
                      background: 'rgba(6, 78, 59, 0.3)',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      margin: 0,
                      fontFamily: '"JetBrains Mono", "SF Mono", Consolas, monospace',
                      lineHeight: '1.4',
                    }}>
                      {currentResult.output}
                    </pre>
                  </div>
                )}
                
                {currentResult.error && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px', fontWeight: '600' }}>
                      Error:
                    </div>
                    <pre style={{
                      fontSize: '13px',
                      color: '#f87171',
                      whiteSpace: 'pre-wrap',
                      background: 'rgba(127, 29, 29, 0.3)',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      margin: 0,
                      fontFamily: '"JetBrains Mono", "SF Mono", Consolas, monospace',
                      lineHeight: '1.4',
                    }}>
                      {currentResult.error}
                    </pre>
                  </div>
                )}
                
                {currentResult.plots && currentResult.plots.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px', fontWeight: '600' }}>
                      Plots:
                    </div>
                    {currentResult.plots.map((plot, index) => (
                      <img
                        key={index}
                        src={`data:image/png;base64,${plot}`}
                        alt={`Plot ${index + 1}`}
                        style={{
                          maxWidth: '100%',
                          height: 'auto',
                          borderRadius: '8px',
                          border: '1px solid #4b5563',
                          marginBottom: '8px',
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {!currentResult && !isExecuting && (
              <div style={{
                textAlign: 'center',
                color: '#9ca3af',
                padding: '40px 20px',
                fontSize: '15px',
              }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚡</div>
                <div style={{ fontWeight: '500', marginBottom: '4px' }}>Ready to execute</div>
                <div style={{ fontSize: '13px', opacity: 0.7 }}>
                  Write your {language} code above and click Execute
                </div>
              </div>
            )}
          </div>
        </div>

        {/* History Panel */}
        {history.length > 0 && (
          <div style={{
            background: 'rgba(31, 41, 55, 0.6)',
            borderRadius: '12px',
            border: '1px solid #374151',
            maxHeight: '160px',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{
              padding: '12px 16px',
              background: 'rgba(55, 65, 81, 0.3)',
              borderBottom: '1px solid #374151',
              fontSize: '14px',
              fontWeight: '600',
              color: '#e5e7eb',
            }}>
              Recent Executions ({history.length})
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              {history.map((entry) => (
                <div
                  key={entry.id}
                  onClick={() => loadFromHistory(entry)}
                  style={{
                    margin: '4px 0',
                    padding: '8px 12px',
                    background: 'rgba(55, 65, 81, 0.4)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    transition: 'background 0.2s ease',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(55, 65, 81, 0.6)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'rgba(55, 65, 81, 0.4)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{
                      fontWeight: '500',
                      color: entry.result.success ? '#34d399' : '#f87171'
                    }}>
                      {entry.request.language} • {entry.result.success ? 'Success' : 'Error'}
                    </span>
                    <span style={{ color: '#9ca3af', fontSize: '11px' }}>
                      {entry.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <div style={{ color: '#d1d5db', fontSize: '11px', fontFamily: 'monospace' }}>
                    {entry.request.code.split('\n')[0]}
                    {entry.request.code.split('\n').length > 1 && '...'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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
};

export default CodeExecutionWindow;