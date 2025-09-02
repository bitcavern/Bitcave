- We need to be able to delete projects - DONE

- The default location for new folders should be Documents/Bitcave/<PROJECT_NAME> - DONE

- We need a tree like file explorer that shows the project folder (with internal files hidden, like artifacts and metadata and such. We can use .folder .filenames to hide these, I think.) - DONE

- Artifact data should be stored as files in the project folder so it can be recalled across sessions. Will likely need to update the javascript bitcave api methods to account for this. - DONE (already implemented)

- When creating a project there is no way to make a new folder, it prompts you to select an existing one. - DONE

- There is too much extra padding at the bottom of message boxes in the AI sidebar - DONE

- Code execution windows start too small, they should be tall enough to fit the standard sizes of the components (no vertical scroll on start) - DONE

- We shouldn't allow windows to go over each other. When a window is dragged above another window, it should temporarily drop opacity (ensure its z-index is maxed out as we have some issues of windows going under other windows when dragged), and if released over another window it should snap to the nearest empty space. - DONE

- You should be able to right-click drag a window from any spot within it. - DONE

- You should only see the "dragging" cursor when the cursor is directly over empty canvas space. It is currently appearing over windows too (but it doesn't drag the canvas, luckily.) - DONE

- We need a global account. (no email and password, just locally stored personal information/settings.) The data we should collect is name, which we will provide as info in the system rompt, and use as a greeting in the app too. We can also collect interests, what style of personality they want with the AI (e.g, efficient and robotic, explanatory, funny, etc.) which can all inform the prompt. We should store this in some hidden folder somewhere.

- Let's move the default Projects folder to one named Bitcave Projects.

- General prettification throughout the app, a focus on details and consistency.

- Need a clean icon library to replace emojis.

- Need to allow for the user to reference files (text formats only for now) in chat

- Need to be able to fullscren chat sidebar.

- Need a chat history that shows previous chats, allows continue from there (per project, and globally from the home screen)

- Need a memory system that's entirely local. Perhaps sqlite? But it needs to support embedding for RAG. Turso could work: https://turso.tech/blog/local-rag-with-ollama-and-turso-sqlite

- Need a way to go back to the home screen from a project screen

- We need to be able to index files within projects and have tools to allow the LLM to automatically reference them

- We should be able to start ephemeral projects (A New Blank Canvas button in the title bar and one in the home screen? Should still be saveable)

- We need a functioning artifact library. Artifact data should not be global, only within project, and code changes to a saved artifact in a project should not affect the global artifact code (but they can re-save). We should be able to access this artifact in home, and in any projects.

- We need an image viewer and pdf viewer that can view local files.

- The file explorer needs to have expandable tree-like folders. All internal files should be hidden, the only thing visible should be documents added by the user to the project folder.
