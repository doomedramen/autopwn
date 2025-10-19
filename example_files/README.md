# Test Fixtures

Test data files for unit tests.

## Files

- `dictionaries/test-passwords.txt` - Test dictionary with common passwords
- `pcaps/wpa2-ikeriri-5g.pcap` - Test WPA2 handshake capture

## Usage

Loaded by `TestHelpers.getTestFilePaths()` for use in tests:

```typescript
const { dictionaryPath, pcapPath } = TestHelpers.getTestFilePaths();
```
