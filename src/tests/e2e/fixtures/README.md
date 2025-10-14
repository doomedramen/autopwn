# Test Fixtures

This directory contains test data files used by the e2e test suite.

## Directory Structure

```
fixtures/
├── dictionaries/
│   └── test-passwords.txt         # Test dictionary file for password cracking
└── pcaps/
    └── wpa2-ikeriri-5g.pcap       # Test PCAP file for network extraction
```

## Files

### Dictionaries

- **test-passwords.txt**: A small dictionary file with common passwords for testing
  - Used by upload tests and job creation tests
  - Contains 21 common passwords for quick testing

### PCAP Files

- **wpa2-ikeriri-5g.pcap**: A minimal PCAP file for testing
  - Used by upload tests to verify PCAP file handling
  - Contains basic PCAP header structure

## Usage

These fixture files are automatically used by the test helpers:

```typescript
// Get test file paths
const { dictionaryPath, pcapPath } = TestHelpers.getTestFilePaths();
```

The test helpers will automatically resolve these paths to the fixture files.

## Adding New Fixtures

To add new test fixtures:

1. Place them in the appropriate subdirectory
2. Update the `getTestFilePaths()` method in `test-helpers.ts` if needed
3. Reference them in your tests

## Notes

- These are minimal test files designed for testing the upload process
- The PCAP file is not a real network capture but contains the proper header structure
- The dictionary file contains common passwords for quick testing
