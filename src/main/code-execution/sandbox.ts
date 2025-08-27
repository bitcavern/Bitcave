import * as vm from 'vm';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { CodeExecutionRequest, CodeExecutionResult } from '@/shared/types';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

export class CodeExecutionSandbox {
  private tempDir: string;
  
  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'bitcave-code-execution');
    this.ensureTempDir();
  }

  private ensureTempDir(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
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
        timeout: timeout,
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
    const sessionId = uuidv4();
    const scriptPath = path.join(this.tempDir, `script_${sessionId}.py`);
    
    try {
      // Write code to temporary file
      fs.writeFileSync(scriptPath, request.code);
      
      // Create restricted Python environment
      const timeout = request.timeout || 10000; // 10 seconds default
      const memoryLimit = request.memoryLimit || 256; // 256MB default
      
      return new Promise<CodeExecutionResult>((resolve) => {
        let output = '';
        let errorOutput = '';
        const startTime = Date.now();
        
        // Execute Python with restrictions
        const pythonProcess = spawn('python3', [
          '-u', // Unbuffered output
          '-c', `
import sys
import os
import resource
import signal

# Set memory limit (in bytes)
try:
    resource.setrlimit(resource.RLIMIT_AS, (${memoryLimit} * 1024 * 1024, ${memoryLimit} * 1024 * 1024))
except:
    pass

# Set timeout
signal.alarm(${Math.floor(timeout / 1000)})

# Restrict imports
import builtins
original_import = builtins.__import__

dangerous_modules = {
    'os', 'sys', 'subprocess', 'socket', 'urllib', 'http', 'ftplib', 
    'smtplib', 'telnetlib', 'webbrowser', 'ctypes', 'multiprocessing',
    'threading', 'asyncio', 'importlib', 'pkgutil', 'runpy', 'ast',
    'marshal', 'pickle', 'shelve', 'dbm', 'sqlite3', 'pathlib'
}

def restricted_import(name, *args, **kwargs):
    if name in dangerous_modules:
        raise ImportError(f"Import of '{name}' is restricted in sandbox")
    if name.startswith('_'):
        raise ImportError(f"Import of private modules is restricted")
    return original_import(name, *args, **kwargs)

builtins.__import__ = restricted_import

# Execute the user code
try:
    with open('${scriptPath}', 'r') as f:
        code = f.read()
    exec(code)
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
          `,
        ], {
          cwd: this.tempDir,
          env: {
            ...process.env,
            PYTHONPATH: '', // Clear Python path
            PYTHONDONTWRITEBYTECODE: '1', // Don't write .pyc files
          },
          timeout: timeout,
        });
        
        pythonProcess.stdout?.on('data', (data) => {
          output += data.toString();
        });
        
        pythonProcess.stderr?.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        pythonProcess.on('close', (code) => {
          const executionTime = Date.now() - startTime;
          
          // Clean up temporary file
          try {
            fs.unlinkSync(scriptPath);
          } catch (e) {
            console.warn('Failed to clean up temporary file:', e);
          }
          
          if (code === 0) {
            resolve({
              success: true,
              output: output.trim(),
              error: errorOutput ? errorOutput.trim() : undefined,
              executionTime,
              memoryUsed: 0, // Python memory usage is harder to track
            });
          } else {
            resolve({
              success: false,
              output: output.trim(),
              error: errorOutput.trim() || `Process exited with code ${code}`,
              executionTime,
              memoryUsed: 0,
            });
          }
        });
        
        pythonProcess.on('error', (error) => {
          resolve({
            success: false,
            output: output.trim(),
            error: `Process error: ${error.message}`,
            executionTime: Date.now() - startTime,
            memoryUsed: 0,
          });
        });
      });
    } catch (error) {
      // Clean up on error
      try {
        fs.unlinkSync(scriptPath);
      } catch (e) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  public dispose(): void {
    // Clean up temporary directory
    try {
      if (fs.existsSync(this.tempDir)) {
        const files = fs.readdirSync(this.tempDir);
        for (const file of files) {
          fs.unlinkSync(path.join(this.tempDir, file));
        }
        fs.rmdirSync(this.tempDir);
      }
    } catch (error) {
      console.warn('Failed to clean up code execution temp directory:', error);
    }
  }
}