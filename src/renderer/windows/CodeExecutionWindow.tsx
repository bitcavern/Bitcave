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
    null
  );
  
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
    <div className="flex flex-col h-full text-white" style={{ margin: '-16px', height: 'calc(100% + 32px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'python' | 'javascript')}
            className="bg-gray-800 text-white px-2 py-1 rounded text-sm border border-gray-600"
            disabled={isExecuting}
          >
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
          </select>
          <span className="text-xs text-gray-400">
            {language === 'python' ? '🐍' : '🟡'} {language.charAt(0).toUpperCase() + language.slice(1)}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleExecuteCode}
            disabled={!code.trim() || isExecuting}
            className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-sm font-medium transition-colors"
          >
            {isExecuting ? '▶️ Running...' : '▶️ Execute'}
          </button>
          <button
            onClick={clearHistory}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm transition-colors"
          >
            🗑️ Clear
          </button>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Code Editor */}
        <div className="flex-1 flex flex-col">
          <div className="p-2 bg-gray-800 border-b border-gray-700">
            <span className="text-xs text-gray-400">Code</span>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={
              language === 'python'
                ? 'print("Hello from Python!")\n\n# Try some math:\nimport math\nprint(f"π = {math.pi:.4f}")'
                : 'console.log("Hello from JavaScript!");\n\n// Try some math:\nconst result = Math.PI * 2;\nconsole.log(`2π = ${result.toFixed(4)}`);'
            }
            className="flex-1 p-3 bg-gray-900 text-white font-mono text-sm resize-none outline-none"
            disabled={isExecuting}
            onKeyDown={(e) => {
              if (e.ctrlKey && e.key === 'Enter') {
                handleExecuteCode();
              }
            }}
          />
        </div>

        {/* Output Panel */}
        <div className="w-1/2 flex flex-col border-l border-gray-700">
          <div className="p-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
            <span className="text-xs text-gray-400">Output</span>
            {currentResult && (
              <span className={`text-xs px-2 py-1 rounded ${
                currentResult.success ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
              }`}>
                {currentResult.success ? '✅ Success' : '❌ Error'} 
                {currentResult.executionTime > 0 && ` (${currentResult.executionTime}ms)`}
              </span>
            )}
          </div>
          
          {/* Current Result */}
          <div className="flex-1 overflow-auto">
            {isExecuting && (
              <div className="p-3 text-yellow-400">
                <div className="flex items-center gap-2">
                  <div className="animate-spin w-3 h-3 border border-yellow-400 border-t-transparent rounded-full"></div>
                  Executing code...
                </div>
              </div>
            )}
            
            {currentResult && !isExecuting && (
              <div className="p-3">
                {currentResult.output && (
                  <div className="mb-3">
                    <div className="text-xs text-gray-400 mb-1">Output:</div>
                    <pre className="text-sm text-green-300 whitespace-pre-wrap bg-gray-800 p-2 rounded">
                      {currentResult.output}
                    </pre>
                  </div>
                )}
                
                {currentResult.error && (
                  <div className="mb-3">
                    <div className="text-xs text-gray-400 mb-1">Error:</div>
                    <pre className="text-sm text-red-300 whitespace-pre-wrap bg-red-950 p-2 rounded border border-red-800">
                      {currentResult.error}
                    </pre>
                  </div>
                )}
                
                {currentResult.plots && currentResult.plots.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs text-gray-400 mb-1">Plots:</div>
                    {currentResult.plots.map((plot, index) => (
                      <img
                        key={index}
                        src={`data:image/png;base64,${plot}`}
                        alt={`Plot ${index + 1}`}
                        className="max-w-full h-auto rounded border border-gray-600"
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {!currentResult && !isExecuting && (
              <div className="p-3 text-gray-500 text-center">
                Click "Execute" to run your code
                <br />
                <span className="text-xs">Ctrl+Enter for quick execution</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* History Panel */}
      {history.length > 0 && (
        <div className="h-32 border-t border-gray-700 flex flex-col">
          <div className="p-2 bg-gray-800 border-b border-gray-700">
            <span className="text-xs text-gray-400">Execution History ({history.length})</span>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {history.map((entry) => (
              <div
                key={entry.id}
                onClick={() => loadFromHistory(entry)}
                className="mb-2 p-2 bg-gray-800 hover:bg-gray-700 cursor-pointer rounded text-xs transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-medium ${entry.result.success ? 'text-green-400' : 'text-red-400'}`}>
                    {entry.request.language} • {entry.result.success ? 'Success' : 'Error'}
                  </span>
                  <span className="text-gray-500">
                    {entry.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-gray-300 truncate">
                  {entry.request.code.split('\n')[0]}
                  {entry.request.code.split('\n').length > 1 && '...'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CodeExecutionWindow;