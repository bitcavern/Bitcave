import Database from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const DB_PATH = path.join(os.homedir(), '.bitcave', 'memory', 'user_memory.db');

let db: Database.Database;

export function getDb() {
  if (!db) {
    // Ensure directory exists
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    db = new Database(DB_PATH, { verbose: console.log });
    setupDatabase();
  }
  return db;
}

function setupDatabase() {
  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('temp_store = MEMORY');

  try {
    // Load sqlite-vec extension
    // Try different possible paths for the extension
    const possiblePaths = [
      './node_modules/sqlite-vec/vec.dylib',
      path.join(__dirname, '../../node_modules/sqlite-vec/vec.dylib'),
      path.join(process.cwd(), 'node_modules/sqlite-vec/vec.dylib')
    ];
    
    let extensionLoaded = false;
    for (const extensionPath of possiblePaths) {
      try {
        if (fs.existsSync(extensionPath)) {
          db.loadExtension(extensionPath);
          extensionLoaded = true;
          console.log('[MemoryDB] Loaded sqlite-vec extension from:', extensionPath);
          break;
        }
      } catch (error) {
        console.warn('[MemoryDB] Failed to load extension from:', extensionPath, error);
      }
    }
    
    if (!extensionLoaded) {
      console.warn('[MemoryDB] sqlite-vec extension not found. Memory system may not work properly.');
    }
  } catch (error) {
    console.error('[MemoryDB] Failed to load sqlite-vec extension:', error);
  }

  // Create tables if they don't exist
  const createTables = db.transaction(() => {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_facts USING vec0(
        fact_embedding FLOAT[384]
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS facts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        category TEXT,
        confidence REAL DEFAULT 1.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        source_conversation_id TEXT,
        project_id TEXT,
        vec_id INTEGER REFERENCES vec_facts(rowid)
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        title TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        message_count INTEGER DEFAULT 0
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS conversation_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT REFERENCES conversations(id),
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_for_facts BOOLEAN DEFAULT FALSE
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS user_profile (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  });

  createTables();
}
