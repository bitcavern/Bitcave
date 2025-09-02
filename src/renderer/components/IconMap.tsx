import React from 'react';
import {
  Globe,
  BookText,
  FileText,
  AreaChart,
  MessageSquare,
  TerminalSquare,
  Package,
  Folder,
  Terminal,
  Image,
  Video,
  BrainCircuit,
  File,
  Wrench,
} from 'lucide-react';
import type { WindowType } from '@/shared/types';

const iconMap: Record<WindowType, React.ReactNode> = {
  webview: <Globe />,
  "reference-webview": <BookText />,
  "markdown-editor": <FileText />,
  graph: <AreaChart />,
  chat: <MessageSquare />,
  "code-execution": <TerminalSquare />,
  artifact: <Package />,
  "file-explorer": <Folder />,
  terminal: <Terminal />,
  "image-viewer": <Image />,
  "video-player": <Video />,
  memory: <BrainCircuit />,
  text: <File />,
  custom: <Wrench />,
};

export const getIconForWindowType = (type: WindowType): React.ReactNode => {
  return iconMap[type] || <Wrench />;
};
