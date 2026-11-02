export default {
  testEnvironment: 'node',
  transform: {},
  setupFiles: ['./tests/setup-env.js'],
  testMatch: ['**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/coverage/'],
  coveragePathIgnorePatterns: ['/node_modules/', '/tests/'],
  coverageThreshold: { global: { lines: 70 } },
};
