import * as vm from 'vm';
import { CodeExecutionRequest, CodeExecutionResult } from '@/shared/types';
import { BrowserWindow } from 'electron';

export class CodeExecutionSandbox {
  private mainWindow: BrowserWindow | null = null;
  
  constructor(mainWindow?: BrowserWindow) {
    this.mainWindow = mainWindow || null;
  }

  public setMainWindow(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;
  }

  public async executeCode(request: CodeExecutionRequest): Promise<CodeExecutionResult> {
    const startTime = Date.now();
    
    try {
      let result: CodeExecutionResult;
      
      if (request.language === 'javascript') {
        result = await this.executeJavaScript(request);
      } else if (request.language === 'python') {
        result = await this.executePython(request);
      } else {
        throw new Error(`Unsupported language: ${request.language}`);
      }
      
      result.executionTime = Date.now() - startTime;
      return result;
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `Execution failed: ${(error as Error).message}`,
        executionTime: Date.now() - startTime,
        memoryUsed: 0,
      };
    }
  }

  private async executeJavaScript(request: CodeExecutionRequest): Promise<CodeExecutionResult> {
    const timeout = request.timeout || 5000; // 5 seconds default
    const logs: string[] = [];
    
    try {
      // Create a new context with restricted globals
      const sandbox = {
        console: {
          log: (...args: any[]) => {
            logs.push(args.map(String).join(' '));
          },
        },
        Math,
        Date,
        JSON,
        String,
        Number,
        Array,
        Object,
        Boolean,
        RegExp,
        // Explicitly block dangerous globals
        require: undefined,
        process: undefined,
        global: undefined,
        Buffer: undefined,
        setTimeout: () => {
          throw new Error('setTimeout is not available in sandbox');
        },
        setInterval: () => {
          throw new Error('setInterval is not available in sandbox');
        },
      };
      
      const context = vm.createContext(sandbox);
      
      // Execute the code with timeout
      const script = new vm.Script(`
        (function() {
          ${request.code}
        })()
      `);
      
      const result = script.runInContext(context, {
        timeout: request.timeout || 5000,
        displayErrors: true,
      });
      
      return {
        success: true,
        output: logs.join('\n') + (result !== undefined ? `\n${String(result)}` : ''),
        error: undefined,
        executionTime: 0,
        memoryUsed: 0, // Node's vm module doesn't provide memory usage
      };
      
    } catch (error) {
      return {
        success: false,
        output: logs.join('\n'),
        error: `Runtime error: ${(error as Error).message}`,
        executionTime: 0,
        memoryUsed: 0,
      };
    }
  }

  private async executePython(request: CodeExecutionRequest): Promise<CodeExecutionResult> {
    if (!this.mainWindow) {
      return {
        success: false,
        output: '',
        error: 'No main window available for Python execution',
        executionTime: 0,
        memoryUsed: 0,
      };
    }

    const timeout = request.timeout || 10000;
    
    try {
      // Execute Python in renderer process via IPC
      const result = await this.mainWindow.webContents.executeJavaScript(`
        (async () => {
          try {
            // Initialize Pyodide if not already loaded
            if (!window.pyodide) {
              // Load Pyodide via script tag method
              if (!window.loadPyodide) {
                await new Promise((resolve, reject) => {
                  const script = document.createElement('script');
                  script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
                  script.onload = resolve;
                  script.onerror = reject;
                  document.head.appendChild(script);
                });
              }
              
              window.pyodide = await window.loadPyodide({
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/"
              });
              
              // Load common scientific packages
              await window.pyodide.loadPackage(["numpy", "pandas", "matplotlib"]);
              
              // Set up output capture
              window.pyodide.runPython(\`
import sys
from io import StringIO

_stdout_capture = StringIO()
_original_stdout = sys.stdout

class OutputCapture:
    def write(self, text):
        _stdout_capture.write(text)
        _original_stdout.write(text)
    def flush(self):
        _stdout_capture.flush()
        _original_stdout.flush()

sys.stdout = OutputCapture()
              \`);
            }
            
            // Clear previous output
            window.pyodide.runPython(\`
_stdout_capture.seek(0)
_stdout_capture.truncate(0)
            \`);
            
            // Execute user code
            const result = window.pyodide.runPython(\`${request.code.replace(/`/g, '\\\\`')}\`);
            const output = window.pyodide.runPython('_stdout_capture.getvalue()');
            
            // Format final output
            let finalOutput = output || '';
            if (result !== undefined && result !== null && String(result) !== '') {
              finalOutput += (finalOutput ? '\\\\n' : '') + String(result);
            }
            
            return {
              success: true,
              output: finalOutput,
              error: undefined
            };
            
          } catch (error) {
            // Try to get any captured output even on error
            let output = '';
            try {
              if (window.pyodide) {
                output = window.pyodide.runPython('_stdout_capture.getvalue()') || '';
              }
            } catch (e) {
              // Ignore capture errors
            }
            
            return {
              success: false,
              output: output,
              error: error.message
            };
          }
        })()
      `);
      
      return {
        success: result.success,
        output: result.output || '',
        error: result.error,
        executionTime: 0, // We'll calculate this on the main process side
        memoryUsed: 0,
      };
      
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `Python execution failed: ${(error as Error).message}`,
        executionTime: 0,
        memoryUsed: 0,
      };
    }
  }

  public dispose(): void {
    // Clean up references
    this.mainWindow = null;
  }
}