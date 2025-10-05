# Test Fixtures

This directory contains test files for end-to-end testing.

## PCAP Files

### WPA2 Link Up Test File
- **File**: `wpa2linkuppassphraseiswireshark.pcap`
- **SSID**: `ikeriri-5g`
- **Password**: `wireshark`
- **Description**: Typical WPA2 PSK linked up process
- **Usage**: Perfect for testing cracking workflow with known credentials

## Usage

Test files are managed by the `TestUtils` class which automatically copies local pcap files from this directory to the test environment.

The `getLocalPcapFiles()` method in `test-utils.ts` handles:
1. Copying files from fixtures/pcaps/ to test input directories
2. Providing metadata about each test file (filename, password, essid, description)
3. Setting up test environment with realistic data

To add new test files:
1. Place pcap files in the `pcaps/` subdirectory
2. Update the `getLocalPcapFiles()` method in `tests/helpers/test-utils.ts`
3. Add test cases that reference the new files

## Known Test Credentials

| File | SSID | Password | Source |
|------|------|----------|--------|
| wpa2linkuppassphraseiswireshark.pcap | ikeriri-5g | wireshark | Manual |

## Local Files Only

This testing framework uses only local pcap files stored in the repository. No external downloads are performed during test execution, ensuring:
- Consistent test results across environments
- Offline testing capability
- Faster test execution
- No external dependencies