# Bitcave AI Dashboard - Claude Code Configuration

## Project Overview

Bitcave is an AI-focused dashboard client with an infinite canvas interface where multiple windows can be tiled, resized, and manipulated. The system is designed to be fully interactive with AI through tool-use, allowing AI agents to create, modify, and interact with various window types.

## Technology Stack

- **Framework**: Electron + React + TypeScript
- **Canvas**: Custom infinite canvas implementation
- **State Management**: React Context/State
- **Build System**: Webpack with hot reloading
- **AI Integration**: OpenRouter API client with tool registry

## Project Structure

```
Bitcave/
├── DESIGN_DOCUMENT.md          # Comprehensive design specification
├── DEVELOPMENT.md              # Development log and status
├── CLAUDE.md                   # This file - Claude Code configuration
├── package.json                # Dependencies and scripts
├── src/
│   ├── main/                   # Electron main process
│   │   ├── main.ts             # Main entry point
│   │   ├── window-manager.ts   # Window lifecycle management
│   │   ├── ai-tools/
│   │   │   └── registry.ts     # AI tool implementations (15+ tools)
│   │   └── ai/
│   │       ├── ai-service.ts   # AI service orchestration
│   │       └── openrouter-client.ts # OpenRouter API client
│   ├── renderer/               # React renderer process
│   │   ├── index.tsx           # React entry point
│   │   ├── App.tsx             # Main app component
│   │   ├── canvas/
│   │   │   └── Canvas.tsx      # Infinite canvas component
│   │   ├── components/
│   │   │   ├── Toolbar.tsx     # Floating toolbar
│   │   │   ├── WindowRenderer.tsx # Window rendering system
│   │   │   └── AISidebar.tsx   # AI interaction sidebar
│   │   └── windows/            # Window type implementations
│   ├── shared/                 # Shared utilities and types
│   │   ├── types.ts            # Core TypeScript interfaces
│   │   └── constants.ts        # App configuration constants
│   └── assets/                 # Static assets
└── dist/                       # Build output
```

## Development Commands

### Setup and Development
```bash
# Install dependencies
npm install

# Start development with hot reloading
npm run dev

# Start only main process development
npm run dev:main

# Start only renderer development  
npm run dev:renderer

# Build for production
npm run build

# Start built application
npm start
```

### Code Quality
```bash
# Run TypeScript type checking
npm run type-check

# Run ESLint
npm run lint

# Fix ESLint issues automatically
npm run lint:fix
```

### Packaging
```bash
# Package for all platforms
npm run package

# Package for macOS specifically
npm run package:mac
```

## Key Features Implemented

### Core Systems
- ✅ Infinite canvas with pan/zoom controls
- ✅ Window management system (create, move, resize, delete)
- ✅ AI tool registry with 15+ implemented tools
- ✅ IPC communication between main and renderer processes
- ✅ Hot reloading for both main and renderer processes

### Window Types Available
- Webview windows for web content
- Markdown editor windows 
- Graph visualization windows
- Chat windows
- Basic window scaffolding for extensibility

### AI Tools Available
- Window creation, deletion, positioning, resizing
- Content manipulation for different window types
- State querying and canvas management
- System metrics and window search capabilities

## Current Development Phase

**Phase 1 - Core Infrastructure**: 90% Complete

**Next Priority Features**:
1. **Code Execution System** - Sandboxed Python/TypeScript execution
2. **Artifact System** - React component rendering like Claude Artifacts  
3. **Project System** - Multi-project file management
4. **Memory/RAG System** - Vector database integration for context

## Architecture Notes

### AI Tool System
- Tools are registered in `src/main/ai-tools/registry.ts`
- Each tool follows a standard interface with parameters and response structure
- Tools communicate via Electron IPC between main and renderer processes
- All window operations are available to AI through structured tool calls

### Window System
- Base window interface defined in `src/shared/types.ts`
- Each window type inherits from BaseWindow interface
- Windows are managed by the main process and rendered in the canvas
- Full window lifecycle (create, update, destroy) is tracked

### Canvas Implementation
- Custom infinite canvas built with React and HTML5 Canvas
- Supports smooth pan/zoom with mouse/trackpad
- Grid background that scales with zoom level
- Viewport-based rendering for performance optimization

## Development Notes

### Hot Reloading
- Full hot reloading setup for rapid development
- Renderer process updates instantly (React components)
- Main process automatically restarts on changes
- DevTools automatically opened in development mode

### TypeScript Configuration
- Separate tsconfig files for main and renderer processes
- Strict type checking enabled
- Path aliases configured for cleaner imports

### Build System
- Webpack configured for both main and renderer processes
- Development and production configurations
- Automatic bundling and optimization
- Electron Builder for packaging

## Known Issues & Technical Debt

1. **Performance**: Large numbers of windows may impact performance (needs virtualization)
2. **Persistence**: No state persistence between app restarts yet
3. **Window Content**: Most window types show placeholder content
4. **Error Handling**: Limited error boundaries and user feedback

## Security Considerations

- Secure IPC communication via preload script
- Content Security Policy for webviews
- Sandboxed execution environments for code (planned)
- Local-first architecture with optional cloud sync

## Testing & Quality Assurance

- TypeScript strict mode enabled for compile-time safety
- ESLint configuration for code quality
- Hot reloading for rapid iteration
- Electron DevTools integration for debugging

---

*Last Updated: December 2024*
*Current Status: Implementing code execution system*