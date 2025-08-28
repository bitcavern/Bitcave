import type { IPCEventName, IPCEventData } from "@/shared/types";

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

// Add webview element support
declare namespace JSX {
  interface IntrinsicElements {
    webview: any;
  }
}
