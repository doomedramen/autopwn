# Test Fixtures

Test data files for e2e tests.

## Files

- `dictionaries/test-passwords.txt` - Test dictionary with common passwords
- `pcaps/wpa2-ikeriri-5g.pcap` - Test PCAP file for network upload testing

## Usage

Fixtures are automatically used by test helpers:

```typescript
const { dictionaryPath, pcapPath } = TestHelpers.getTestFilePaths();
```
