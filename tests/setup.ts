// Test setup file
// Runs before all tests

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-key";
process.env.JWT_ACCESS_TOKEN_EXPIRY = "15m";
process.env.JWT_REFRESH_TOKEN_EXPIRY = "7d";

// Suppress console logs during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };

// Increase timeout for integration tests
jest.setTimeout(10000);
