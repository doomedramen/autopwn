# Test Fixtures

This directory contains test data files used by the e2e test suite.

## Directory Structure

```
fixtures/
├── dictionaries/
│   └── test-passwords.txt    # Test dictionary with common passwords
├── pcaps/
│   └── wpa2-ikeriri-5g.pcap   # Test WPA2 handshake capture
└── README.md                 # This file
```

## Test Files

### Dictionary Files

- `test-passwords.txt`: A small dictionary file containing common test passwords including "wireshark", "password", "12345678", etc. This file is used for testing dictionary attacks and should produce reliable results.

### PCAP Files

- `wpa2-ikeriri-5g.pcap`: A WPA2 handshake capture file containing WiFi network packets. This file is used for testing PCAP upload and network extraction functionality.

## Usage

These fixtures are automatically loaded by the test utilities in `../helpers/test-helpers.ts`. The `TestHelpers.getTestFilePaths()` method returns the paths to these files for use in tests.

Example usage:

```typescript
import { TestHelpers } from '../helpers/test-helpers';

const { dictionaryPath, pcapPath } = TestHelpers.getTestFilePaths();
const dictionary = await TestHelpers.uploadDictionary(
  request,
  authHeaders,
  dictionaryPath
);
const { networks } = await TestHelpers.uploadPcap(
  request,
  authHeaders,
  pcapPath
);
```

## Adding New Fixtures

When adding new test files:

1. Place them in the appropriate subdirectory (`dictionaries/` or `pcaps/`)
2. Use descriptive names
3. Keep file sizes small for fast test execution
4. Update the `TestHelpers.getTestFilePaths()` method if needed
5. Document the purpose of new files in this README

## Important Notes

- These files are for testing purposes only and should not contain sensitive or real-world data
- Files should be small enough to not significantly impact test execution time
- The dictionary file is designed to work with the WPA2 handshake in the PCAP file to ensure consistent test results
