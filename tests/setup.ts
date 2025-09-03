import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Set up test database path in a temporary directory
const testDbDir = path.join(os.tmpdir(), 'bitcave-tests', `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);

beforeAll(() => {
  // Create test directory
  if (!fs.existsSync(testDbDir)) {
    fs.mkdirSync(testDbDir, { recursive: true });
  }
  
  // Set environment variables for testing
  process.env.NODE_ENV = 'test';
  process.env.TEST_DB_DIR = testDbDir;
});

afterAll(() => {
  // Clean up test database
  if (fs.existsSync(testDbDir)) {
    fs.rmSync(testDbDir, { recursive: true, force: true });
  }
});

// Mock console.log for cleaner test output
const originalConsoleLog = console.log;
console.log = (...args: any[]) => {
  // Only log if not in test mode or if explicitly enabled
  if (process.env.ENABLE_TEST_LOGS === 'true') {
    originalConsoleLog(...args);
  }
};

// Mock console.warn and console.error similarly
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

console.warn = (...args: any[]) => {
  if (process.env.ENABLE_TEST_LOGS === 'true') {
    originalConsoleWarn(...args);
  }
};

console.error = (...args: any[]) => {
  if (process.env.ENABLE_TEST_LOGS === 'true') {
    originalConsoleError(...args);
  }
};