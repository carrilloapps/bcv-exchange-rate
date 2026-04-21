module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['index.ts'],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 100,
      lines: 100,
      statements: 98
    }
  }
};
