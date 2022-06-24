/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ["<rootDir>/tests", "<rootDir>/src"],
  collectCoverage: true,
  collectCoverageFrom: [
    "**/*.ts",
    "!**/node_modules/**",
  ],
  coverageDirectory: 'coverage_dir',
  coverageReporters: ["html"],
  moduleFileExtensions: [
    "ts",
    "js"
  ],
  transform: {
    "^.+\\.ts$": "ts-jest"
  },
  globals: {
    "ts-jest": {
      "tsConfig": "tsconfig.json"
    }
  },
  testMatch: [
    "**/tests/**/*.test.ts"
  ]
};