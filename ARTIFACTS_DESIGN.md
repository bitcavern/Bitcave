# Bitcave Artifacts System - Design Document

## Overview

The Bitcave Artifacts System enables AI to create interactive web applications, components, and tools based on natural language requests. Similar to Claude's artifacts but more powerful, this system allows bidirectional interaction between AI and both the source code and runtime data of created artifacts.

## Core Concept

When a user requests "Make me a midi controller that plays a single tone for each button", the AI will:

1. Generate HTML/CSS/JavaScript code for the midi controller
2. Launch it in a specialized artifact window
3. Set up data templates for any persistent data (e.g., recorded tracks)
4. Enable continued interaction through both code modification and data access

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   AI Service    │◄──►│ Artifact Manager │◄──►│ Artifact Window │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │  Data Templates  │    │   Sandboxed     │
                       │     Storage      │    │   Web Runtime   │
                       └──────────────────┘    └─────────────────┘
```

## Component Specifications

### 1. Artifact Manager

**Responsibilities:**

- Create and manage artifact instances
- Handle AI tool calls for artifact operations
- Manage data templates and persistence
- Coordinate between AI service and artifact windows

**Core Methods:**

```typescript
class ArtifactManager {
  createArtifact(request: ArtifactCreationRequest): Promise<Artifact>;
  updateArtifact(id: string, updates: ArtifactUpdates): Promise<void>;
  getArtifactData(id: string, templateKey?: string): Promise<any>;
  setArtifactData(id: string, templateKey: string, data: any): Promise<void>;
  destroyArtifact(id: string): Promise<void>;
}
```

### 2. Artifact Window

**Features:**

- Sandboxed iframe for security
- Real-time code preview and execution
- Data persistence layer
- Communication bridge with main process
- Error handling and debugging tools

**Window Structure:**

```
┌─────────────────────────────────────────┐
│ Artifact: "MIDI Controller"        [×] │
├─────────────────────────────────────────┤
│                                         │
│        Sandboxed Web Content           │
│     (HTML/CSS/JS execution)            │
│                                         │
│                                         │
├─────────────────────────────────────────┤
│ [📝 View Code] [💾 Export] [🔄 Reload] │
└─────────────────────────────────────────┘
```

### 3. Data Template System

**Purpose:**
Enable AI to define structured data schemas that artifacts can read/write to, allowing persistent interaction with application state.

**Template Definition:**

```typescript
interface DataTemplate {
  id: string;
  artifactId: string;
  name: string;
  description: string;
  schema: JSONSchema;
  defaultValue: any;
  access: "read" | "write" | "readwrite";
}
```

**Example Templates:**

```javascript
// For a MIDI controller
{
  id: "tracks",
  name: "Recorded Tracks",
  description: "Musical tracks recorded by the user",
  schema: {
    type: "array",
    items: {
      type: "object",
      properties: {
        id: { type: "string" },
        notes: { type: "array" },
        duration: { type: "number" },
        timestamp: { type: "string" }
      }
    }
  },
  defaultValue: []
}
```

### 4. AI Tools Integration

**New AI Tools:**

#### `createArtifact`

```typescript
interface CreateArtifactParams {
  title: string;
  description: string;
  html: string;
  css?: string;
  javascript?: string;
  dataTemplates?: DataTemplate[];
  dependencies?: string[]; // CDN libraries
}
```

#### `updateArtifact`

```typescript
interface UpdateArtifactParams {
  artifactId: string;
  html?: string;
  css?: string;
  javascript?: string;
  addDataTemplates?: DataTemplate[];
  removeDataTemplates?: string[];
}
```

#### `getArtifactData`

```typescript
interface GetArtifactDataParams {
  artifactId: string;
  templateKey?: string; // If omitted, returns all data
}
```

#### `setArtifactData`

```typescript
interface SetArtifactDataParams {
  artifactId: string;
  templateKey: string;
  data: any;
}
```

## Implementation Details

### 1. Artifact Creation Flow

1. **User Request**: "Make me a todo app with drag and drop"
2. **AI Analysis**: Determines need for artifact with data persistence
3. **Code Generation**: Creates HTML/CSS/JS for todo app
4. **Template Definition**: Defines data templates for todos list
5. **Artifact Launch**: Creates sandboxed artifact window
6. **Runtime Setup**: Initializes data bridge and templates

### 2. Sandboxing and Security

**Iframe Sandbox:**

```html
<iframe
  sandbox="allow-scripts allow-same-origin"
  srcdoc="<!-- Generated HTML -->"
  style="width: 100%; height: 100%; border: none;"
></iframe>
```

**Content Security Policy:**

```
default-src 'self';
script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com;
style-src 'self' 'unsafe-inline';
```

**API Bridge:**

```javascript
// Injected into artifact runtime
window.BitcaveAPI = {
  getData: (key) => window.parent.postMessage({ type: "getData", key }, "*"),
  setData: (key, data) =>
    window.parent.postMessage({ type: "setData", key, data }, "*"),
  notify: (message) =>
    window.parent.postMessage({ type: "notify", message }, "*"),
};
```

### 3. Data Persistence Architecture

**Storage Location:**

```
~/.bitcave/projects/{projectId}/artifacts/{artifactId}/
├── artifact.json           # Artifact metadata
├── source/
│   ├── index.html
│   ├── styles.css
│   └── script.js
└── data/
    ├── templates.json      # Data template definitions
    └── {templateKey}.json  # Actual data files
```

**Data Access Layer:**

```typescript
class ArtifactDataStore {
  private basePath: string;

  async getTemplate(artifactId: string, key: string): Promise<DataTemplate>;
  async setTemplate(artifactId: string, template: DataTemplate): Promise<void>;
  async getData(artifactId: string, key: string): Promise<any>;
  async setData(artifactId: string, key: string, data: any): Promise<void>;
  async listTemplates(artifactId: string): Promise<string[]>;
}
```

### 4. Runtime Communication

**Message Passing Protocol:**

```typescript
// From artifact to main process
interface ArtifactMessage {
  type: "getData" | "setData" | "notify" | "error";
  artifactId: string;
  key?: string;
  data?: any;
  message?: string;
}

// From main process to artifact
interface MainMessage {
  type: "dataResponse" | "dataUpdate" | "reload" | "error";
  key?: string;
  data?: any;
  error?: string;
}
```

## User Experience Flow

### Example: MIDI Controller Creation

**Step 1: Initial Request**

```
User: "Make me a MIDI controller that plays a single tone for each button"
```

**Step 2: AI Creates Artifact**

```javascript
await createArtifact({
  title: "MIDI Controller",
  description: "Interactive MIDI controller with tone generation",
  html: `
    <div class="midi-controller">
      <h2>MIDI Controller</h2>
      <div class="button-grid">
        ${Array.from(
          { length: 16 },
          (_, i) =>
            `<button class="midi-button" data-note="${i}">Note ${i}</button>`
        ).join("")}
      </div>
    </div>
  `,
  css: `
    .midi-controller { padding: 20px; font-family: Arial, sans-serif; }
    .button-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    .midi-button { padding: 20px; font-size: 16px; border: none; border-radius: 8px; 
                   background: #3b82f6; color: white; cursor: pointer; }
    .midi-button:active { background: #1d4ed8; transform: scale(0.95); }
  `,
  javascript: `
    const audioContext = new AudioContext();
    
    function playTone(frequency) {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.5);
    }
    
    document.addEventListener('DOMContentLoaded', () => {
      const buttons = document.querySelectorAll('.midi-button');
      buttons.forEach((button, index) => {
        const frequency = 440 * Math.pow(2, index / 12); // Chromatic scale
        button.addEventListener('click', () => playTone(frequency));
      });
    });
  `,
  dataTemplates: [],
});
```

**Step 3: User Requests Enhancement**

```
User: "Add the ability to record sequences of button presses"
```

**Step 4: AI Updates with Data Template**

```javascript
await updateArtifact({
  artifactId: "midi-controller-1",
  javascript: `
    // Enhanced with recording functionality
    let isRecording = false;
    let currentSequence = [];
    
    // ... existing tone generation code ...
    
    // Recording functionality
    function startRecording() {
      isRecording = true;
      currentSequence = [];
      BitcaveAPI.notify('Recording started');
    }
    
    function stopRecording() {
      isRecording = false;
      if (currentSequence.length > 0) {
        BitcaveAPI.setData('sequences', [...getSequences(), {
          id: Date.now().toString(),
          sequence: currentSequence,
          timestamp: new Date().toISOString()
        }]);
      }
      BitcaveAPI.notify('Recording saved');
    }
    
    async function getSequences() {
      return (await BitcaveAPI.getData('sequences')) || [];
    }
  `,
  addDataTemplates: [
    {
      id: "sequences",
      name: "Recorded Sequences",
      description: "Button press sequences recorded by the user",
      schema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            sequence: { type: "array" },
            timestamp: { type: "string" },
          },
        },
      },
      defaultValue: [],
      access: "readwrite",
    },
  ],
});
```

**Step 5: User Queries Data**

```
User: "Show me all the sequences I've recorded"
```

**Step 6: AI Retrieves and Reports**

```javascript
const sequences = await getArtifactData({
  artifactId: "midi-controller-1",
  templateKey: "sequences",
});

// AI analyzes and reports back to user
```

## Advanced Features

### 1. Hot Code Reloading

- Real-time code updates without losing runtime state
- Preserve data across code changes
- Error handling with rollback capability

### 2. External Dependencies

```javascript
{
  dependencies: [
    "https://cdn.jsdelivr.net/npm/tone@14.7.77/build/Tone.js",
    "https://unpkg.com/react@18/umd/react.development.js",
  ];
}
```

### 3. Export Functionality

- Export as standalone HTML file (can be react)
- Export as zip with all assets

### 4. Collaborative Features

- Share artifacts between projects
- Version control for artifact changes
- Import artifacts from external sources

## Future Enhancements

### 1. Visual Builder Integration

- Drag-and-drop interface for non-coders
- Component library for common elements
- Visual data binding tools

### 2. Advanced Runtime Features

- WebAssembly module support
- WebGL/3D graphics support
- File system access (with permissions)
- Network requests (with CORS handling)

### 3. AI Enhancement Tools

- Automatic code optimization suggestions
- Performance monitoring and alerts
- Accessibility compliance checking
- Cross-browser compatibility testing

## Related Feature Todos

Based on this artifacts system design, here are the key related features that need to be implemented:

### Projects System

- **Isolated Infinite Canvases**: Each project gets its own canvas workspace
- **Saveable Window States**: Complete workspace serialization and restoration
- **Reference Data Folders**: Local file storage for project assets
- **Portable Workspaces**: Export/import entire project states
- **Project Templates**: Pre-configured project setups

### Memory System (RAG-based)

- **Global User Memory**: Cross-project knowledge and preferences
- **Project-Specific Memory**: Context awareness within projects
- **Local Vector Database**: Entirely local semantic search
- **Memory Management**: Automatic cleanup and optimization
- **Context Integration**: Seamless memory injection into AI conversations

### Webview Sidebar Migration

- **Hideable Sidebar**: Move webview out of main canvas
- **Multi-tab Support**: Multiple web pages in sidebar
- **Canvas Focus**: Keep main canvas clean for work windows
- **Quick Access**: Easy toggle and navigation
- **Integration**: Maintain AI tool access to webview content

This artifacts system will be the cornerstone feature that differentiates Bitcave as a truly interactive AI workspace, enabling users to create, iterate on, and interact with AI-generated applications in real-time.
