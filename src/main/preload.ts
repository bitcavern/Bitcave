import { contextBridge, ipcRenderer } from "electron";
import type { IPCEventName, IPCEventData } from "@/shared/types";

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  invoke: <T extends IPCEventName>(channel: T, data?: IPCEventData<T>) => {
    return ipcRenderer.invoke(channel, data);
  },

  // For channels that don't require data
  invokeSimple: (channel: string) => {
    return ipcRenderer.invoke(channel);
  },

  // Listen for events from main process
  on: (channel: string, callback: (event: any, ...args: any[]) => void) => {
    ipcRenderer.on(channel, callback);
  },

  // Remove event listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
});

// Define the API interface for TypeScript
declare global {
  interface Window {
    electronAPI: {
      invoke: <T extends IPCEventName>(
        channel: T,
        data?: IPCEventData<T>
      ) => Promise<any>;
      invokeSimple: (channel: string) => Promise<any>;
      on: (
        channel: string,
        callback: (event: any, ...args: any[]) => void
      ) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}
