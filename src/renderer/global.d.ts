// Global type declarations for renderer process

declare global {
  interface Window {
    pyodide?: any;
    loadPyodide?: (config: any) => Promise<any>;
    electronAPI: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      on: (channel: string, callback: (...args: any[]) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}

export {};
