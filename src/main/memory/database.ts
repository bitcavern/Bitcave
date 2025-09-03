import Database from "better-sqlite3";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

const DB_PATH = path.join(os.homedir(), ".bitcave", "memory", "user_memory.db");

// Log the database path for debugging
console.log("[MemoryDB] Database path:", DB_PATH);
console.log("[MemoryDB] Current working directory:", process.cwd());
console.log("[MemoryDB] Executable path:", process.execPath);
console.log("[MemoryDB] Platform:", os.platform());
console.log("[MemoryDB] Architecture:", os.arch());
console.log("[MemoryDB] Node version:", process.version);
console.log("[MemoryDB] Electron version:", process.versions.electron);

let db: Database.Database;

export function getDb() {
  if (!db) {
    try {
      // Ensure directory exists
      const dbDir = path.dirname(DB_PATH);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      console.log("[MemoryDB] Initializing database at:", DB_PATH);
      console.log("[MemoryDB] Checking if better-sqlite3 is available...");

      // Check if better-sqlite3 is properly loaded
      if (typeof Database !== "function") {
        throw new Error("better-sqlite3 module not properly loaded");
      }

      // Add a small delay to ensure the app is fully ready
      console.log("[MemoryDB] Waiting for app to be ready...");

      // Check if existing database has old foreign key constraint
      if (fs.existsSync(DB_PATH)) {
        try {
          const tempDb = new Database(DB_PATH, { readonly: true });
          const tableInfo = tempDb.pragma("table_info(facts)") as any[];
          const hasOldConstraint = tableInfo.some(
            (col: any) =>
              col.name === "vec_id" && col.pk === 0 && col.notnull === 0
          );
          tempDb.close();

          if (hasOldConstraint) {
            console.log(
              "[MemoryDB] Detected old database schema with foreign key constraints, will recreate"
            );
            // Remove old database file
            fs.unlinkSync(DB_PATH);
          }
        } catch (error) {
          console.warn(
            "[MemoryDB] Could not check existing database schema:",
            error
          );
          if (fs.existsSync(DB_PATH)) {
            fs.unlinkSync(DB_PATH);
          }
        }
      }

      // Try to create the database with error handling
      try {
        console.log("[MemoryDB] Attempting to create database at:", DB_PATH);
        db = new Database(DB_PATH, { verbose: console.log });
        console.log("[MemoryDB] Database created successfully at:", DB_PATH);
      } catch (dbError) {
        console.error(
          "[MemoryDB] Failed to create database instance at primary path:",
          dbError
        );
        // Try with a different path as fallback
        const fallbackPath = path.join(process.cwd(), "user_memory.db");
        console.log("[MemoryDB] Trying fallback path:", fallbackPath);
        try {
          db = new Database(fallbackPath, { verbose: console.log });
          console.log(
            "[MemoryDB] Database created successfully at fallback path:",
            fallbackPath
          );
        } catch (fallbackError) {
          console.error(
            "[MemoryDB] Failed to create database at fallback path:",
            fallbackError
          );
          throw new Error(
            `Failed to create database at both primary (${DB_PATH}) and fallback (${fallbackPath}) paths`
          );
        }
      }

      setupDatabase();
      console.log("[MemoryDB] Database initialized successfully");
    } catch (error) {
      console.error("[MemoryDB] Failed to initialize database:", error);
      throw error;
    }
  }

  // Ensure database is properly initialized
  if (!db || !db.open) {
    throw new Error("Database is not properly initialized");
  }

  return db;
}

function setupDatabase() {
  try {
    // Enable WAL mode for better performance
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    db.pragma("temp_store = MEMORY");
    console.log("[MemoryDB] Database pragmas set successfully");
  } catch (error) {
    console.warn("[MemoryDB] Could not set database pragmas:", error);
  }

  try {
    // Load sqlite-vec extension
    // Try different possible paths for the extension based on architecture
    const arch = os.arch();
    const platform = os.platform();
    const extensionName = "vec0.dylib";
    const platformPackage = `sqlite-vec-${platform}-${arch}`;

    const possiblePaths = [
      path.join(process.cwd(), "node_modules", platformPackage, extensionName),
      path.join(
        process.cwd(),
        "node_modules/sqlite-vec-darwin-arm64",
        extensionName
      ),
      path.join(
        path.dirname(process.execPath),
        "node_modules",
        platformPackage,
        extensionName
      ),
      path.join(
        path.dirname(process.execPath),
        "node_modules/sqlite-vec-darwin-arm64",
        extensionName
      ),
    ];

    console.log(
      "[MemoryDB] Looking for sqlite-vec extension in paths:",
      possiblePaths
    );

    let extensionLoaded = false;
    for (const extensionPath of possiblePaths) {
      try {
        if (fs.existsSync(extensionPath)) {
          console.log(
            "[MemoryDB] Attempting to load extension from:",
            extensionPath
          );
          db.loadExtension(extensionPath);
          extensionLoaded = true;
          console.log(
            "[MemoryDB] Successfully loaded sqlite-vec extension from:",
            extensionPath
          );
          break;
        } else {
          console.log("[MemoryDB] Extension not found at:", extensionPath);
        }
      } catch (error) {
        console.warn(
          "[MemoryDB] Failed to load extension from:",
          extensionPath,
          error
        );
      }
    }

    if (!extensionLoaded) {
      console.warn(
        "[MemoryDB] sqlite-vec extension not found. Memory system may not work properly."
      );
      console.log("[MemoryDB] Available files in node_modules:");
      try {
        const nodeModulesPath = path.join(process.cwd(), "node_modules");
        if (fs.existsSync(nodeModulesPath)) {
          const dirs = fs.readdirSync(nodeModulesPath);
          dirs.forEach((dir) => {
            if (dir.includes("sqlite-vec")) {
              console.log(
                "[MemoryDB] Found sqlite-vec related directory:",
                dir
              );
            }
          });
        }
      } catch (error) {
        console.warn("[MemoryDB] Could not list node_modules:", error);
      }
    }
  } catch (error) {
    console.error("[MemoryDB] Failed to load sqlite-vec extension:", error);
  }

  // Create tables if they don't exist
  const createTables = db.transaction(() => {
    // Try to create the vec_facts table, but handle gracefully if vec0 extension is not available
    try {
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS vec_facts USING vec0(
          fact_embedding FLOAT[384]
        );
      `);
      console.log("[MemoryDB] Created vec_facts table successfully");
    } catch (error) {
      console.warn(
        "[MemoryDB] Could not create vec_facts table (vec0 extension may not be available):",
        error
      );
      // Create a fallback table structure if vec0 is not available
      try {
        db.exec(`
          CREATE TABLE IF NOT EXISTS vec_facts_fallback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fact_embedding TEXT
          );
        `);
        console.log("[MemoryDB] Created fallback vec_facts_fallback table");

        // Also create a regular facts table that doesn't depend on vec0
        db.exec(`
          CREATE TABLE IF NOT EXISTS facts_simple (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            category TEXT,
            confidence REAL DEFAULT 1.0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            source_conversation_id TEXT,
            project_id TEXT
          );
        `);
        console.log("[MemoryDB] Created simple facts table as fallback");
      } catch (fallbackError) {
        console.error(
          "[MemoryDB] Failed to create fallback tables:",
          fallbackError
        );
      }
    }

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
        vec_id INTEGER
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

  try {
    createTables();
    console.log("[MemoryDB] Database tables created successfully");
  } catch (error) {
    console.error("[MemoryDB] Failed to create database tables:", error);
    throw error;
  }
}
