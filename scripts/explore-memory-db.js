#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Database path
const dbPath = path.join(os.homedir(), '.bitcave', 'memory', 'user_memory.db');

console.log('🗃️  Bitcave Memory Database Explorer');
console.log('=====================================');
console.log(`📍 Database location: ${dbPath}`);

// Check if database exists
if (!fs.existsSync(dbPath)) {
  console.log('❌ Database not found. Start Bitcave and have some conversations first!');
  process.exit(1);
}

try {
  // Open database
  const db = new Database(dbPath, { readonly: true });
  
  console.log('✅ Database connected successfully\n');

  // Show database info
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('📋 Tables in database:');
  tables.forEach(table => console.log(`   • ${table.name}`));
  console.log();

  // Show facts summary
  try {
    const factStats = db.prepare(`
      SELECT 
        COUNT(*) as total_facts,
        COUNT(DISTINCT category) as unique_categories,
        AVG(confidence) as avg_confidence,
        MAX(updated_at) as latest_update
      FROM facts
    `).get();
    
    console.log('📊 Facts Summary:');
    console.log(`   • Total facts: ${factStats.total_facts}`);
    console.log(`   • Categories: ${factStats.unique_categories}`);
    console.log(`   • Avg confidence: ${factStats.avg_confidence?.toFixed(2) || 'N/A'}`);
    console.log(`   • Latest update: ${factStats.latest_update || 'N/A'}`);
    console.log();

    // Show facts by category
    if (factStats.total_facts > 0) {
      const categoryStats = db.prepare(`
        SELECT category, COUNT(*) as count, AVG(confidence) as avg_conf
        FROM facts 
        GROUP BY category 
        ORDER BY count DESC
      `).all();
      
      console.log('📈 Facts by Category:');
      categoryStats.forEach(cat => {
        console.log(`   • ${cat.category}: ${cat.count} facts (avg confidence: ${cat.avg_conf.toFixed(2)})`);
      });
      console.log();
    }

    // Show recent facts
    if (factStats.total_facts > 0) {
      const recentFacts = db.prepare(`
        SELECT content, category, confidence, updated_at 
        FROM facts 
        ORDER BY updated_at DESC 
        LIMIT 5
      `).all();
      
      console.log('🕐 Recent Facts:');
      recentFacts.forEach((fact, i) => {
        const date = new Date(fact.updated_at).toLocaleDateString();
        console.log(`   ${i+1}. [${fact.category}] ${fact.content} (confidence: ${fact.confidence}, ${date})`);
      });
      console.log();
    }
  } catch (error) {
    console.log('⚠️  Could not read facts table:', error.message);
  }

  // Show conversations summary
  try {
    const convStats = db.prepare(`
      SELECT 
        COUNT(*) as total_conversations,
        SUM(message_count) as total_messages,
        MAX(updated_at) as latest_conversation
      FROM conversations
    `).get();
    
    console.log('💬 Conversations Summary:');
    console.log(`   • Total conversations: ${convStats.total_conversations}`);
    console.log(`   • Total messages: ${convStats.total_messages || 0}`);
    console.log(`   • Latest conversation: ${convStats.latest_conversation || 'N/A'}`);
    console.log();

    // Show recent conversations
    if (convStats.total_conversations > 0) {
      const recentConvs = db.prepare(`
        SELECT id, title, message_count, updated_at 
        FROM conversations 
        ORDER BY updated_at DESC 
        LIMIT 3
      `).all();
      
      console.log('💭 Recent Conversations:');
      recentConvs.forEach((conv, i) => {
        const date = new Date(conv.updated_at).toLocaleDateString();
        console.log(`   ${i+1}. "${conv.title || conv.id}" (${conv.message_count} messages, ${date})`);
      });
      console.log();
    }
  } catch (error) {
    console.log('⚠️  Could not read conversations table:', error.message);
  }

  // Show vector info if available
  try {
    const vectorStats = db.prepare(`
      SELECT COUNT(*) as vector_count 
      FROM vec_facts
    `).get();
    
    console.log('🧮 Vector Embeddings:');
    console.log(`   • Vector embeddings stored: ${vectorStats.vector_count}`);
  } catch (error) {
    console.log('🧮 Vector Embeddings: Not available (sqlite-vec extension not loaded)');
  }

  db.close();
  console.log('\n✅ Database exploration complete!');

} catch (error) {
  console.error('❌ Error accessing database:', error.message);
  process.exit(1);
}