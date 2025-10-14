
// Playwright Coverage Configuration
module.exports = {
  "include": [
    "src/tests/e2e/**/*.spec.ts"
  ],
  "exclude": [
    "node_modules/**",
    "dist/**",
    "**/coverage/**",
    "src/tests/e2e/fixtures/**",
    "src/tests/e2e/helpers/**",
    "src/tests/e2e/setup/**"
  ],
  "pageUrls": [
    "http://localhost:3000/",
    "http://localhost:3000/login",
    "http://localhost:3000/setup"
  ],
  "ignoreElements": [
    "[data-testid=\"skip-coverage\"]",
    ".test-only",
    "[aria-hidden=\"true\"]",
    "[role=\"presentation\"]",
    ".dev-only"
  ],
  "coverageThreshold": 0,
  "outputPath": "./coverage-report",
  "reportFormat": "all",
  "discoverElements": true,
  "staticAnalysis": true,
  "runtimeTracking": false
};
