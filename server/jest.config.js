export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/coverage/'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/src/controllers/ai.controller.js',
    '/src/ai/prompts.js',
    '/contracts.js',
    '/server.js',
    '/integrated-routes.js'
  ]
};
