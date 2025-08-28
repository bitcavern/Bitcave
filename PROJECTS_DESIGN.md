# Bitcave Projects System - Design Document

## Overview

The Projects system provides workspace management similar to Obsidian vaults, where each project is an isolated environment with its own canvas, windows, settings, and data. The system manages the complete state of workspaces and enables seamless switching between different projects.

## Folder Structure

### Main Bitcave Directory
```
~/.bitcave/
├── config/
│   ├── app-settings.json          # Global app preferences
│   ├── recent-projects.json       # Recently accessed projects
│   └── user-preferences.json      # User-specific settings
├── memory/
│   ├── global/                    # Cross-project memory
│   │   ├── embeddings.db          # Vector database for global context
│   │   └── knowledge-base.json    # Structured knowledge
│   └── indexes/                   # Search indexes
├── projects/
│   ├── {project-id}/              # Individual project folders
│   │   ├── project.json           # Project metadata
│   │   ├── workspace.json         # Window positions and states
│   │   ├── canvas.json            # Canvas viewport and settings
│   │   ├── memory/                # Project-specific memory
│   │   ├── artifacts/             # Generated artifacts
│   │   ├── assets/                # Project files and resources
│   │   └── ai-conversations/      # Conversation history
│   └── templates/                 # Project templates
└── logs/
    ├── app.log                    # Application logs
    └── ai-interactions/           # AI interaction logs
```

## Implementation Plan

1. **Create Project Storage Service** - File system operations and directory management
2. **Implement Project Manager** - Core project lifecycle and workspace management
3. **Build Project Launcher UI** - Welcome screen and project selection
4. **Integrate with existing systems** - Window manager, canvas, AI service

This Projects system will provide the foundational structure needed for the Artifacts system.