import Database from 'better-sqlite3';

// Simple test to verify basic memory operations work
describe('Basic Memory System Test', () => {
  let db: Database.Database;

  beforeAll(() => {
    db = new Database(':memory:');
    
    // Create simple tables without vector functions
    db.exec(`
      CREATE TABLE facts (
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

    db.exec(`
      CREATE TABLE conversations (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        title TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        message_count INTEGER DEFAULT 0
      );
    `);
  });

  afterAll(() => {
    db.close();
  });

  test('should store and retrieve facts', () => {
    // Insert a fact
    const insertStmt = db.prepare(`
      INSERT INTO facts (content, category, confidence, source_conversation_id)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = insertStmt.run(
      'User prefers TypeScript over JavaScript',
      'preferences',
      1.0,
      'test-conversation'
    );

    expect(result.lastInsertRowid).toBeDefined();

    // Retrieve the fact
    const selectStmt = db.prepare('SELECT * FROM facts WHERE id = ?');
    const fact = selectStmt.get(result.lastInsertRowid);

    expect(fact).toBeDefined();
    expect(fact.content).toBe('User prefers TypeScript over JavaScript');
    expect(fact.category).toBe('preferences');
    expect(fact.confidence).toBe(1.0);
  });

  test('should store and retrieve conversations', () => {
    // Insert a conversation
    const insertStmt = db.prepare(`
      INSERT INTO conversations (id, title, message_count)
      VALUES (?, ?, ?)
    `);
    
    insertStmt.run('test-conv-1', 'Test Conversation', 3);

    // Retrieve the conversation
    const selectStmt = db.prepare('SELECT * FROM conversations WHERE id = ?');
    const conversation = selectStmt.get('test-conv-1');

    expect(conversation).toBeDefined();
    expect(conversation.id).toBe('test-conv-1');
    expect(conversation.title).toBe('Test Conversation');
    expect(conversation.message_count).toBe(3);
  });

  test('should search facts by content', () => {
    // Insert multiple facts
    const insertStmt = db.prepare(`
      INSERT INTO facts (content, category, confidence, source_conversation_id)
      VALUES (?, ?, ?, ?)
    `);
    
    insertStmt.run('User loves React development', 'preferences', 0.9, 'conv-1');
    insertStmt.run('User has 5 years of React experience', 'professional', 1.0, 'conv-1');
    insertStmt.run('User enjoys hiking on weekends', 'personal', 0.8, 'conv-2');

    // Search for React-related facts
    const searchStmt = db.prepare("SELECT * FROM facts WHERE content LIKE '%React%'");
    const reactFacts = searchStmt.all();

    expect(reactFacts).toHaveLength(2);
    expect(reactFacts[0].content).toContain('React');
    expect(reactFacts[1].content).toContain('React');
  });

  test('should update fact confidence', () => {
    // Insert a fact
    const insertStmt = db.prepare(`
      INSERT INTO facts (content, category, confidence, source_conversation_id)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = insertStmt.run('User likes Vue.js', 'preferences', 0.7, 'conv-1');
    const factId = result.lastInsertRowid;

    // Update confidence
    const updateStmt = db.prepare('UPDATE facts SET confidence = ? WHERE id = ?');
    updateStmt.run(0.9, factId);

    // Verify update
    const selectStmt = db.prepare('SELECT * FROM facts WHERE id = ?');
    const updatedFact = selectStmt.get(factId);

    expect(updatedFact.confidence).toBe(0.9);
  });

  test('should delete facts', () => {
    // Insert a fact
    const insertStmt = db.prepare(`
      INSERT INTO facts (content, category, confidence, source_conversation_id)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = insertStmt.run('Temporary fact', 'test', 1.0, 'conv-1');
    const factId = result.lastInsertRowid;

    // Verify fact exists
    let selectStmt = db.prepare('SELECT * FROM facts WHERE id = ?');
    let fact = selectStmt.get(factId);
    expect(fact).toBeDefined();

    // Delete the fact
    const deleteStmt = db.prepare('DELETE FROM facts WHERE id = ?');
    deleteStmt.run(factId);

    // Verify fact is deleted
    selectStmt = db.prepare('SELECT * FROM facts WHERE id = ?');
    fact = selectStmt.get(factId);
    expect(fact).toBeUndefined();
  });

  test('should count facts by category', () => {
    // Clear existing data
    db.exec('DELETE FROM facts');

    // Insert facts with different categories
    const insertStmt = db.prepare(`
      INSERT INTO facts (content, category, confidence, source_conversation_id)
      VALUES (?, ?, ?, ?)
    `);
    
    insertStmt.run('Fact 1', 'personal', 1.0, 'conv-1');
    insertStmt.run('Fact 2', 'personal', 1.0, 'conv-1');
    insertStmt.run('Fact 3', 'professional', 1.0, 'conv-1');
    insertStmt.run('Fact 4', 'preferences', 1.0, 'conv-1');
    insertStmt.run('Fact 5', 'preferences', 1.0, 'conv-1');
    insertStmt.run('Fact 6', 'preferences', 1.0, 'conv-1');

    // Count facts by category
    const countStmt = db.prepare('SELECT category, COUNT(*) as count FROM facts GROUP BY category');
    const counts = countStmt.all();

    const countMap = Object.fromEntries(counts.map((row: any) => [row.category, row.count]));
    
    expect(countMap.personal).toBe(2);
    expect(countMap.professional).toBe(1);
    expect(countMap.preferences).toBe(3);
  });
});