# AI Dashboard Client - Design Document

## Project Overview

An AI-focused dashboard client for macOS that provides an infinite canvas interface where multiple windows can be tiled, resized, and manipulated. The system is designed to be fully interactive with AI through tool-use, allowing AI agents to create, modify, and interact with various window types while maintaining full context awareness.

## Core Objectives

1. **AI-First Design**: Every component must be accessible and manipulable by AI through well-defined tools
2. **Infinite Canvas**: Seamless, infinite workspace for organizing windows
3. **Extensible Architecture**: Easy addition of new window types and AI tools
4. **Context Awareness**: Complete system state available to AI in structured format
5. **Multi-Modal Interaction**: Support for various content types (web, markdown, graphs, chat, etc.)
6. **Local & Remote AI**: Support for both cloud APIs and local AI servers

## Technology Stack Recommendation

### Primary Framework: Electron + React + TypeScript

**Rationale**:

- **Cross-platform potential**: Easy porting to Windows/Linux later
- **Web technologies**: Leverage existing web ecosystem for webviews, markdown editors, graphing libraries
- **AI Integration**: Excellent for building tool APIs and handling JSON/structured data
- **Rapid Development**: Rich ecosystem and familiar technologies
- **Native Integration**: Good macOS integration while maintaining flexibility

### Alternative Consideration: Tauri + React + TypeScript

**Benefits**: Smaller bundle size, better performance, Rust backend
**Trade-offs**: Less mature ecosystem, more complex setup

### Core Libraries

- **UI Framework**: React with TypeScript
- **Canvas Management**: React-based infinite canvas (custom or libraries like `react-flow` as base)
- **Window Management**: Custom window system with drag/resize/tile capabilities
- **Webview**: Electron's webview or iframe-based solutions
- **Markdown Editor**: Monaco Editor or CodeMirror 6
- **Graphing**: D3.js, Chart.js, or Plotly.js
- **State Management**: Zustand or Redux Toolkit
- **AI Integration**: Custom API layer supporting multiple providers

## System Architecture

### 1. Core Application Layer

```
┌─────────────────────────────────────┐
│           Main Process              │
│  ┌─────────────────────────────────┐│
│  │        AI Tool Registry         ││
│  │     - Window Management         ││
│  │     - Content Manipulation      ││
│  │     - State Queries            ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │      Window Manager             ││
│  │     - Window Lifecycle          ││
│  │     - Layout Engine             ││
│  │     - Event Coordination        ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│         Renderer Process            │
│  ┌─────────────────────────────────┐│
│  │       Canvas Controller         ││
│  │     - Infinite Canvas           ││
│  │     - Viewport Management       ││
│  │     - Pan/Zoom Controls         ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │      Window Components          ││
│  │     - Webview Windows           ││
│  │     - Markdown Editor           ││
│  │     - Graph Windows             ││
│  │     - Chat Windows              ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

### 2. Window System Architecture

#### Window Base Class

```typescript
interface BaseWindow {
  id: string;
  type: WindowType;
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  isLocked: boolean;
  isMinimized: boolean;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Window Types

1. **WebviewWindow**: Interactive web content, AI-generated demos
2. **ReferenceWebviewWindow**: Research sources, documentation
3. **MarkdownEditorWindow**: Rich text editing with live preview
4. **GraphWindow**: Data visualization and interactive charts
5. **ChatWindow**: Secondary AI conversations
6. **CodeExecutionWindow**: Sandboxed JavaScript/Python execution environment
7. **ArtifactWindow**: React-based mini-applications (like Claude Artifacts)
8. **FileExplorerWindow**: Project file system browser with references
9. **TerminalWindow**: Command line interface
10. **ImageViewerWindow**: Image display and annotation
11. **VideoPlayerWindow**: Media playback
12. **MemoryWindow**: RAG-based knowledge retrieval and management
13. **CustomWindow**: Extensible base for future types

### 3. AI Tool System

#### Tool Categories

##### Window Management Tools

- `createWindow(type, config)`: Create new window instances
- `deleteWindow(windowId)`: Remove windows
- `moveWindow(windowId, position)`: Reposition windows
- `resizeWindow(windowId, dimensions)`: Resize windows
- `setWindowTitle(windowId, title)`: Update window titles
- `lockWindow(windowId)`: Prevent user modifications
- `unlockWindow(windowId)`: Allow user modifications
- `minimizeWindow(windowId)`: Minimize windows
- `restoreWindow(windowId)`: Restore minimized windows
- `bringToFront(windowId)`: Adjust z-index
- `tileWindows(windowIds, layout)`: Arrange multiple windows

##### Content Manipulation Tools

- `setWebviewUrl(windowId, url)`: Navigate webviews
- `executeWebviewScript(windowId, script)`: Run JavaScript in webviews
- `updateMarkdownContent(windowId, content)`: Edit markdown
- `createGraph(windowId, data, config)`: Generate visualizations
- `updateGraphData(windowId, data)`: Modify existing graphs
- `sendChatMessage(windowId, message)`: Interact with chat windows
- `uploadFile(windowId, filePath)`: Handle file operations
- `executeCode(windowId, code, language)`: Run sandboxed Python/JavaScript code
- `createArtifact(config)`: Generate React-based mini-applications
- `updateArtifact(windowId, componentCode)`: Modify artifact components
- `installPackage(windowId, packageName)`: Install npm/pip packages in sandbox

##### State Query Tools

- `getWindowList()`: Retrieve all windows and their states
- `getWindowContent(windowId)`: Extract window-specific content
- `getCanvasState()`: Get current viewport and layout
- `searchWindows(query)`: Find windows by content or metadata
- `exportWindowState(windowId)`: Serialize window data
- `getSystemMetrics()`: Performance and usage statistics
- `getProjectFiles(projectId)`: List all files in a project
- `readProjectFile(projectId, filePath)`: Read project file contents
- `searchMemory(query)`: Query RAG-based memory system
- `getMemoryContext(windowId)`: Get relevant memory for current context

#### Tool Response Format

```json
{
  "success": boolean,
  "data": any,
  "error": string | null,
  "timestamp": string,
  "windowId": string | null
}
```

### 4. Context System

#### State Serialization

The system maintains a complete, AI-readable state representation:

```json
{
  "canvas": {
    "viewport": {
      "x": 0,
      "y": 0,
      "zoom": 1.0
    },
    "dimensions": {
      "width": 1920,
      "height": 1080
    }
  },
  "windows": [
    {
      "id": "win_001",
      "type": "webview",
      "title": "AI Generated Chart",
      "position": { "x": 100, "y": 100 },
      "size": { "width": 800, "height": 600 },
      "zIndex": 1,
      "isLocked": false,
      "isMinimized": false,
      "content": {
        "url": "data:text/html,<html>...</html>",
        "lastLoaded": "2024-01-01T12:00:00Z"
      },
      "metadata": {
        "aiGenerated": true,
        "sourcePrompt": "Create a sales dashboard",
        "tags": ["dashboard", "sales", "chart"]
      }
    }
  ],
  "layout": {
    "activeLayout": "freeform",
    "savedLayouts": []
  },
  "aiContext": {
    "lastInteraction": "2024-01-01T12:00:00Z",
    "activeTools": ["createWindow", "updateGraph"],
    "conversationHistory": []
  }
}
```

### 5. Canvas System

#### Infinite Canvas Implementation

- **Virtual Rendering**: Only render visible windows for performance
- **Smooth Pan/Zoom**: Hardware-accelerated transformations
- **Grid System**: Optional snap-to-grid for alignment
- **Minimap**: Overview of all windows and current viewport
- **Bookmarks**: Save and restore specific canvas locations

#### Layout Modes

1. **Freeform**: Complete freedom of positioning
2. **Grid**: Snap-to-grid alignment
3. **Tiled**: Automatic tiling algorithms
4. **Stacked**: Layered window management
5. **Timeline**: Chronological arrangement

### 6. AI Integration Architecture

#### Multi-Provider Support

```typescript
interface AIProvider {
  name: string;
  type: "openai" | "anthropic" | "local" | "custom";
  endpoint: string;
  apiKey?: string;
  model: string;
  capabilities: string[];
}
```

#### Local AI Server Integration

- **LM Studio**: HTTP API integration
- **Ollama**: REST API support
- **LocalAI**: OpenAI-compatible interface
- **Custom Servers**: Configurable endpoints

#### Tool Execution Pipeline

1. **Tool Request**: AI sends structured tool call
2. **Validation**: Verify tool exists and parameters are valid
3. **Authorization**: Check if operation is allowed
4. **Execution**: Perform the requested operation
5. **Response**: Return structured result to AI
6. **State Update**: Update global state and notify observers

### 7. Security & Permissions

#### Window Security Levels

- **Public**: Fully accessible to AI
- **Protected**: Read-only for AI
- **Private**: Hidden from AI context
- **Locked**: No modifications allowed

#### Content Security Policy

- Sandboxed webviews with restricted permissions
- Whitelist for external resource loading
- Script execution controls for AI-generated content

#### Data Privacy

- Local storage of sensitive information
- Encrypted configuration files
- Optional cloud sync with encryption

## User Interface Design

### 1. Main Application Window

- **Full-screen canvas**: Infinite scrollable workspace
- **Floating toolbar**: Quick access to common tools
- **Context menu**: Right-click operations
- **Status bar**: System information and AI status

### 2. Window Chrome

- **Title bar**: Draggable with window controls
- **Resize handles**: Corner and edge resizing
- **Context menu**: Window-specific operations
- **Lock indicator**: Visual indication of locked state

### 3. AI Integration UI

- **AI Status Indicator**: Connection status and activity
- **Tool Execution Log**: History of AI operations
- **Permission Prompts**: User approval for sensitive operations
- **Context Viewer**: Current state visible to AI

### 4. Settings & Configuration

- **AI Provider Setup**: Configure multiple AI services
- **Window Type Management**: Enable/disable window types
- **Tool Permissions**: Granular control over AI capabilities
- **Canvas Preferences**: Grid, snap, zoom settings

## Data Management

### 1. Persistence Strategy

- **SQLite Database**: Window metadata and configurations
- **File System**: Content storage for large assets
- **JSON Exports**: Portable workspace snapshots
- **Auto-save**: Continuous state preservation

### 2. Data Schema

```sql
-- Windows table
CREATE TABLE windows (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  position_x REAL NOT NULL,
  position_y REAL NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL,
  z_index INTEGER NOT NULL,
  is_locked BOOLEAN DEFAULT FALSE,
  is_minimized BOOLEAN DEFAULT FALSE,
  metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Content table for large content
CREATE TABLE window_content (
  window_id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  content BLOB,
  content_hash TEXT,
  FOREIGN KEY (window_id) REFERENCES windows (id)
);

-- AI interactions log
CREATE TABLE ai_interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_name TEXT NOT NULL,
  parameters JSON,
  result JSON,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  success BOOLEAN NOT NULL
);
```

### 3. Import/Export System

- **Workspace Export**: Complete state serialization
- **Selective Export**: Individual window or window group export
- **Template System**: Reusable workspace configurations
- **Migration Tools**: Version compatibility handling

## Performance Considerations

### 1. Rendering Optimization

- **Virtual Scrolling**: Only render visible windows
- **Canvas Culling**: Skip off-screen rendering
- **Lazy Loading**: Defer content loading until needed
- **Memory Management**: Cleanup unused resources

### 2. AI Tool Performance

- **Async Operations**: Non-blocking tool execution
- **Batch Operations**: Group related operations
- **Caching**: Cache frequently accessed data
- **Rate Limiting**: Prevent excessive API calls

### 3. Scalability

- **Window Limits**: Configurable maximum windows
- **Content Size Limits**: Prevent memory exhaustion
- **Background Processing**: Handle large operations asynchronously
- **Progressive Loading**: Stream large content

## Development Phases

### Phase 1: Core Infrastructure (Weeks 1-3)

- [ ] Set up Electron + React + TypeScript project
- [ ] Implement basic infinite canvas
- [ ] Create base window system
- [ ] Design AI tool architecture
- [ ] Implement basic webview windows

### Phase 2: Window Types & Tools (Weeks 4-6)

- [ ] Markdown editor window
- [ ] Graph window with basic charting
- [ ] Chat window implementation
- [ ] Complete AI tool set for window management
- [ ] Content manipulation tools

### Phase 3: AI Integration (Weeks 7-8)

- [ ] Multi-provider AI support
- [ ] Local AI server integration
- [ ] Tool execution pipeline
- [ ] Context serialization system

### Phase 4: Polish & Features (Weeks 9-10)

- [ ] UI/UX improvements
- [ ] Performance optimizations
- [ ] Security implementation
- [ ] Documentation and testing

### Phase 5: Extension & Deployment (Weeks 11-12)

- [ ] Plugin system for custom windows
- [ ] Advanced layout features
- [ ] Export/import functionality
- [ ] macOS app packaging and distribution

## Risk Assessment & Mitigation

### Technical Risks

1. **Performance**: Large number of windows may impact performance
   - _Mitigation_: Virtual rendering and resource management
2. **Security**: AI-generated content execution risks
   - _Mitigation_: Sandboxing and permission system
3. **Complexity**: Feature creep and architecture complexity
   - _Mitigation_: Phased development and clear interfaces

### User Experience Risks

1. **Learning Curve**: Complex interface may be overwhelming
   - _Mitigation_: Progressive disclosure and good defaults
2. **AI Reliability**: Inconsistent AI tool usage
   - _Mitigation_: Robust error handling and fallbacks

## Success Metrics

### Technical Metrics

- Window creation/manipulation latency < 100ms
- Support for 100+ concurrent windows
- Memory usage < 1GB for typical workloads
- 99.9% AI tool execution success rate

### User Experience Metrics

- Time to create first window < 30 seconds
- AI task completion rate > 90%
- User retention after first week > 70%
- Average session duration > 30 minutes

## Future Extensibility

### Plugin System

- **Window Plugins**: Custom window types
- **Tool Plugins**: Additional AI tools
- **Integration Plugins**: External service connections
- **Theme Plugins**: Custom UI themes

### API Extensions

- **REST API**: External tool integration
- **WebSocket API**: Real-time updates
- **CLI Tools**: Command-line workspace management
- **SDK**: Third-party development kit

## Code Execution System

### 1. Sandboxed Execution Environment

#### JavaScript Execution

- **Runtime**: Isolated V8 contexts with restricted global objects
- **Security**: No file system access, network restrictions, memory limits
- **Package Management**: Sandboxed npm package installation
- **Libraries**: Pre-installed common libraries (lodash, d3, etc.)
- **Output Capture**: Console logs, return values, and error handling

#### Python Execution

- **Runtime**: Isolated Python subprocess with restricted imports
- **Security**: Chroot jail, no system calls, memory/CPU limits
- **Package Management**: Sandboxed pip installation in virtual environment
- **Libraries**: Pre-installed scientific stack (numpy, pandas, matplotlib)
- **Output Capture**: stdout/stderr capture, plot generation, error handling

#### Execution Architecture

```typescript
interface CodeExecutionRequest {
  language: "javascript" | "python";
  code: string;
  packages?: string[];
  timeout?: number;
  memoryLimit?: number;
}

interface CodeExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  plots?: string[]; // Base64 encoded images
  executionTime: number;
  memoryUsed: number;
}
```

### 2. Security & Isolation

#### Sandbox Implementation

- **Container-based**: Docker containers for Python execution
- **Process Isolation**: Separate processes with restricted permissions
- **Resource Limits**: CPU time, memory usage, disk space quotas
- **Network Restrictions**: No external network access by default
- **File System**: Temporary directories, automatic cleanup

#### Permission System

- **Code Review**: Optional human approval for sensitive operations
- **Whitelist**: Approved packages and imports
- **Execution Limits**: Daily execution quotas per user
- **Monitoring**: Real-time resource usage tracking

## Artifact System (React Mini-Applications)

### 1. Artifact Architecture

#### Component Generation

- **Template System**: Pre-built React component templates
- **Hot Reloading**: Real-time component updates
- **Dependency Management**: Automatic import resolution
- **Styling**: Tailwind CSS integration for rapid styling

#### Artifact Types

```typescript
interface ArtifactConfig {
  type:
    | "react-component"
    | "data-visualization"
    | "interactive-demo"
    | "calculator";
  title: string;
  description?: string;
  dependencies: string[];
  props?: Record<string, any>;
  code: string;
}
```

### 2. Artifact Window Implementation

#### Runtime Environment

- **React Sandbox**: Isolated React rendering context
- **Error Boundaries**: Graceful error handling and recovery
- **State Management**: Local component state with persistence
- **Event Handling**: Safe event binding and cleanup

#### Pre-built Templates

- **Data Visualizations**: Charts, graphs, interactive plots
- **Calculators**: Mathematical tools, converters
- **Demos**: Interactive examples and prototypes
- **Forms**: Data collection and validation components

## Multi-Project System

### 1. Project Architecture

#### Project Structure

```typescript
interface Project {
  id: string;
  name: string;
  description?: string;
  rootPath: string;
  createdAt: Date;
  lastAccessed: Date;
  settings: ProjectSettings;
  metadata: {
    tags: string[];
    color?: string;
    icon?: string;
  };
}

interface ProjectSettings {
  defaultAIProvider: string;
  codeExecutionEnabled: boolean;
  memoryEnabled: boolean;
  fileWatchEnabled: boolean;
}
```

### 2. File Reference System

#### File Management

- **Project Browser**: Hierarchical file tree navigation
- **File Indexing**: Real-time file content indexing for search
- **Reference Tracking**: Track file usage across windows
- **Version Control**: Git integration for file history

#### File Types Support

- **Code Files**: Syntax highlighting, intelligent parsing
- **Documents**: PDF, Word, text file preview
- **Data Files**: CSV, JSON, XML structured data preview
- **Media Files**: Image, video, audio file handling
- **Archives**: ZIP, tar file exploration

#### Reference System

```typescript
interface FileReference {
  projectId: string;
  filePath: string;
  lineNumber?: number;
  excerpt?: string;
  lastAccessed: Date;
  accessCount: number;
}
```

### 3. Project Switching & Context

#### Context Preservation

- **Window Association**: Windows belong to specific projects
- **State Isolation**: Separate AI context per project
- **Memory Isolation**: Project-specific RAG memory
- **Quick Switching**: Instant project context switching

## RAG-Based Memory System

### 1. Memory Architecture

#### Vector Database Integration

- **Options**: ChromaDB, Pinecone, or Weaviate integration
- **Embeddings**: OpenAI embeddings or local sentence transformers
- **Indexing**: Automatic content indexing and chunking
- **Similarity Search**: Semantic search across stored memories

#### Memory Types

```typescript
interface MemoryEntry {
  id: string;
  projectId?: string;
  type: "conversation" | "document" | "code" | "insight" | "reference";
  content: string;
  metadata: {
    source: string;
    timestamp: Date;
    tags: string[];
    importance: number; // 1-10 scale
    context?: Record<string, any>;
  };
  embedding: number[];
}
```

### 2. Memory Collection & Storage

#### Automatic Collection

- **Conversation History**: AI interactions and context
- **Code Execution Results**: Successful code snippets and outputs
- **Document Processing**: Extracted insights from project files
- **User Actions**: Important user decisions and preferences
- **Window Content**: Snapshots of important window states

#### Manual Memory Management

- **Save to Memory**: User-initiated memory storage
- **Memory Tagging**: Organize memories with tags
- **Memory Editing**: Update and refine stored memories
- **Memory Deletion**: Remove outdated or incorrect memories

### 3. Context Retrieval

#### Smart Context Assembly

- **Relevance Scoring**: Rank memories by relevance to current task
- **Context Window Management**: Fit most relevant memories in AI context
- **Temporal Weighting**: Recent memories weighted higher
- **Project Filtering**: Filter memories by current project context

#### Memory Window Features

- **Search Interface**: Full-text and semantic search
- **Memory Browser**: Visual exploration of stored memories
- **Memory Clusters**: Group related memories together
- **Memory Analytics**: Usage patterns and memory effectiveness

## Enhanced Core Libraries

### Additional Dependencies

- **Code Execution**:
  - Docker SDK for Python sandboxing
  - VM2 for JavaScript sandboxing
  - Pyodide for in-browser Python execution (alternative)
- **Artifact System**:
  - React Hot Loader for component updates
  - Babel for JSX transformation
  - Tailwind CSS for styling
- **File Management**:
  - Chokidar for file watching
  - Simple-git for version control
  - File-type detection libraries
- **Memory System**:
  - ChromaDB client or vector database SDK
  - Sentence transformers for embeddings
  - Text chunking and processing utilities

## Updated Development Phases

### Phase 1: Core Infrastructure (Weeks 1-4)

- [ ] Set up Electron + React + TypeScript project
- [ ] Implement basic infinite canvas
- [ ] Create base window system
- [ ] Design AI tool architecture
- [ ] Implement basic webview windows
- [ ] **NEW**: Set up code execution sandbox (JavaScript)
- [ ] **NEW**: Implement basic artifact system

### Phase 2: Advanced Features (Weeks 5-8)

- [ ] Markdown editor window
- [ ] Graph window with basic charting
- [ ] Chat window implementation
- [ ] Complete AI tool set for window management
- [ ] Content manipulation tools
- [ ] **NEW**: Python code execution sandbox
- [ ] **NEW**: Multi-project system with file browser
- [ ] **NEW**: Basic RAG memory system

### Phase 3: AI Integration & Polish (Weeks 9-12)

- [ ] Multi-provider AI support
- [ ] Local AI server integration
- [ ] Tool execution pipeline
- [ ] Context serialization system
- [ ] **NEW**: Advanced memory features and analytics
- [ ] **NEW**: Artifact templates and hot reloading
- [ ] **NEW**: Project context switching

This enhanced design document now includes all the critical features you mentioned. The code execution system provides secure sandboxing for both JavaScript and Python, the artifact system enables Claude Artifacts-style React components, the multi-project system organizes work with file references, and the RAG-based memory system provides intelligent context retrieval.
