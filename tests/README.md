# Memory System Test Suite

This directory contains comprehensive tests for the Local RAG Memory System implemented in Bitcave.

## Test Structure

```
tests/
├── setup.ts                           # Jest test setup and configuration
├── utils/
│   └── test-helpers.ts                 # Test utilities, mock data, and helper functions
└── memory/
    ├── memory-service.test.ts          # Unit tests for MemoryService
    ├── embedding-service.test.ts       # Unit tests for EmbeddingService  
    ├── fact-extractor.test.ts          # Unit tests for FactExtractor
    ├── ai-integration.test.ts          # Integration tests for AI service memory integration
    └── memory-system.integration.test.ts  # End-to-end integration tests
```

## Running Tests

### Install Dependencies
First, install the testing dependencies:
```bash
npm install
```

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Only Memory System Tests
```bash
npm run test:memory
```

### Run Specific Test File
```bash
npx jest memory-service.test.ts
```

### Run Tests with Coverage
```bash
npx jest --coverage
```

## Test Categories

### Unit Tests

**MemoryService Tests** (`memory-service.test.ts`)
- Conversation management (create, read, update, delete)
- Message handling and storage
- Fact management operations
- Search functionality with vector similarity
- Error handling and edge cases

**EmbeddingService Tests** (`embedding-service.test.ts`)
- Service initialization
- Embedding generation for text
- Batch embedding operations
- Error handling and edge cases
- Mock service validation for testing

**FactExtractor Tests** (`fact-extractor.test.ts`)
- Fact extraction from conversation messages
- Deduplication logic
- Message processing and marking
- Category assignment
- Error handling for AI service failures

### Integration Tests

**AI Integration Tests** (`ai-integration.test.ts`)
- Memory context injection into conversations
- Automatic fact extraction during chat
- Relevance ranking and recency weighting
- Context building and formatting
- Error handling in integrated environment

**End-to-End Tests** (`memory-system.integration.test.ts`)
- Complete memory system workflow
- Multi-conversation memory persistence
- Search capabilities across different categories
- Performance and scalability testing
- Real-world usage scenarios

## Test Features

### Mock Services
- **MockEmbeddingService**: Provides deterministic embeddings for testing
- **MockAIService**: Simulates AI responses for fact extraction
- **In-memory databases**: Fast, isolated test databases

### Test Data
- Pre-defined fact samples across all categories
- Mock conversation data
- Helper functions for generating test data

### Assertions
Tests verify:
- ✅ Facts are extracted and stored correctly
- ✅ Vector embeddings are generated and stored
- ✅ Search results are ranked by relevance and recency
- ✅ Memory context is injected into AI conversations
- ✅ Deduplication prevents duplicate facts
- ✅ Error conditions are handled gracefully
- ✅ Performance meets acceptable thresholds

## Test Scenarios

### Memory Building
1. User has conversation about their preferences
2. Facts are automatically extracted every 3 messages
3. Facts are stored with appropriate categories and confidence scores
4. Similar facts are deduplicated

### Memory Usage
1. User starts new conversation
2. Relevant facts are retrieved based on conversation context
3. Facts are ranked by relevance and recency
4. Context is injected into AI system message
5. AI provides personalized response

### Memory Management
1. Facts can be viewed, edited, and deleted
2. Fact updates regenerate embeddings
3. Statistics are calculated correctly
4. Search works across all stored facts

## Environment Variables

Set these for enhanced test output:
```bash
export ENABLE_TEST_LOGS=true  # Show console logs during tests
```

## Performance Expectations

Tests verify these performance characteristics:
- Adding 50 messages: < 5 seconds
- Retrieving 50 messages: < 1 second  
- Adding 100 facts: < 10 seconds
- Searching facts: < 2 seconds

## Troubleshooting

### SQLite-vec Extension
If vector operations fail in tests, the system gracefully falls back to mock implementations. Real vector operations require the sqlite-vec extension.

### Memory Leaks
Tests use in-memory databases and clean up after each test to prevent memory leaks.

### Async Operations  
Tests use appropriate delays for async fact extraction operations to complete.

## Contributing

When adding new memory system features:
1. Add corresponding unit tests
2. Update integration tests if needed
3. Ensure all tests pass before submitting
4. Add performance tests for new operations
5. Update mock services if new interfaces are added

## Test Coverage Goals

- **Unit Tests**: > 90% code coverage
- **Integration Tests**: Cover all major user workflows  
- **Error Scenarios**: Test all error conditions
- **Performance Tests**: Verify scalability characteristics