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

  > Where should this global account data be stored? A common location would be in the user's application support directory (e.g., `~/.bitcave` or `~/Library/Application Support/Bitcave` on macOS). Is that acceptable?
  > ANSWER: That is acceptable.

- Let's move the default Projects folder to one named Bitcave Projects.

  > To confirm, should the new default location be `~/Documents/Bitcave Projects`? Also, should existing projects in `~/Documents/Bitcave` be migrated automatically to the new location?
  > ANSWER: Yes, and no they can be ignored, they're only for testing.

- General prettification throughout the app, a focus on details and consistency.

  > This is a broad goal. Could you provide a few specific examples of areas in the app that you feel need the most "prettification"? For instance, are there specific components, windows, or color schemes you'd like to see improved first?
  > ANSWER: Ignore for now, I will come back to this one.

- Need a clean icon library to replace emojis. - DONE

  > Do you have a preferred icon library (e.g., Material Icons, Feather Icons, Font Awesome) or a particular visual style (e.g., line art, filled, two-tone) you'd like to use?
  > ANSWER: Line art, I think it's fitting with the general vibe we have here (grid-lines, blueprint like canvas, monospace fonts, etc)

- Need to allow for the user to reference files (text formats only for now) in chat

  > What should the user interface for referencing a file look like? For example, should there be an "attach file" button in the chat input, or should it work via a special syntax like typing "@" to bring up a file list?
  > ANSWER: Both. Think of something like Cursor, but we can have more simple buttons like Gemini or Claude for example as well.

- Need to be able to fullscren chat sidebar.

  > When the chat sidebar is "fullscreened," should it cover the entire application window, or should it expand to a larger, predefined width while still showing a portion of the main canvas?
  > ANSWER: It should completely fill the window like a more standard LLM client.

- Need a chat history that shows previous chats, allows continue from there (per project, and globally from the home screen)

  > How should this chat history be presented visually? Should it be a new modal window, a separate panel in the AI sidebar, or something else?
  > ANSWER: Separate panel should work.

- Need a memory system that's entirely local. Perhaps sqlite? But it needs to support embedding for RAG. Turso could work: https://turso.tech/blog/local-rag-with-ollama-and-turso-sqlite

  > This is a great direction. To start, what specific information should be stored in this memory system for RAG? Should it automatically ingest summaries of chats, user-provided documents, or something else?
  > ANSWER: Chat messages, and summaries. We should do LLM calls to generate "facts" about the user (intents, bits of their history, likes, and dislikes). We should also run searches on these facts to see if they've been input before, perhaps updating older saved facts. If the user is engaged in a conversation about their dogs for instance, we should save info in a structured format like "<NAME> has a 12 year old collie called Jim" "<NAME>'s dog Jim loves catch" These facts are incredibly powerful in a memory standpoint, we can run a searches based on the last couple of messages in a conversation (every message) to return fact information and include them in the prompt/context.

- Need a way to go back to the home screen from a project screen

  > Where should the button or link to go "back to home" be located? For example, in the main toolbar, as a menu item, or a button in the corner of the canvas?
  > ANSWER: Main toolbar. We should play with the styling a little for better consistency on that toolbar. I'll leave that to you, as long as it's clear and not too cluttered, it's good. It can be adjusted later.

- We need to be able to index files within projects and have tools to allow the LLM to automatically reference them

  > Should file indexing happen automatically when a file is added to the project, or should the user manually trigger the indexing process for specific files?
  > ANSWER: Auto-indexing as standard, but perhaps this can be a global setting.

- We should be able to start ephemeral projects (A New Blank Canvas button in the title bar and one in the home screen? Should still be saveable)

- We need a functioning artifact library. Artifact data should not be global, only within project, and code changes to a saved artifact in a project should not affect the global artifact code (but they can re-save). We should be able to access this artifact in home, and in any projects.

  > There seems to be a contradiction here. Could you clarify the desired behavior? If an artifact is created in Project A, should it be accessible in Project B? You mention it shouldn't be "global" but also that it should be accessible "in any projects." Perhaps you mean there's a global _source_ library, and projects get their own _copy_ of an artifact when it's used?
  > ANSWER: I do mean that yes. Artifacts are created inside of projects (ephemeral or otherwise) and then saved to the global artifact library if they choose. At that point, the global library artifact is a copy of the one generated in project. Any changes to the artifact code made within that project won't update the global library copy (and vice versa). Artifact data is also non-global. For example, if the artifact is a game which stores high scores, those high scores will only be saved as artifact data within the project it's being used. If I have a high score, and save the artifact to the library, then spawn the artifact in a new project, I should see no high scores.

- We need an image viewer and pdf viewer that can view local files.

- The file explorer needs to have expandable tree-like folders. All internal files should be hidden, the only thing visible should be documents added by the user to the project folder. - DONE

- Let's properly theme scroll bars (and have them auto-hide)

- Let's implement streaming AI responses (for chat only, not for background LLM calls like fact extraction)

- All conversations have id "main" instead of a unique conversation id.
