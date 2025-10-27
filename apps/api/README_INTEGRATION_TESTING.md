# Real Tools Integration Testing

This directory contains integration tests that use **real** hashcat and hcxpcapngtool implementations instead of mocks.

## 🎯 Test Files

- **`real-hashcat-execution.test.ts`** - Tests real hashcat command execution
- **`real-hcx-tools.test.ts`** - Tests real hcxpcapngtool functionality
- **`real-security-workflow.test.ts`** - End-to-end security workflows
- **`real-performance.test.ts`** - Performance and load testing

## 🚀 Running Tests

### Unit Tests (Mocked)
```bash
pnpm test:unit
```

### Real Tools Integration Tests
```bash
# Real tools with test containers
pnpm test:integration:real

# With real system tools (requires hashcat/hcxpcapngtool installed)
TEST_WITH_REAL_TOOLS=true HASHCAT_PATH=/usr/bin/hashcat HCX_PCAPNGTOOL_PATH=/usr/bin/hcxpcapngtool pnpm test:integration:real
```

## 🔧 Configuration

### Environment Variables
- `TEST_WITH_REAL_TOOLS=true` - Enable real tool testing
- `HASHCAT_PATH` - Path to hashcat binary
- `HCX_PCAPNGTOOL_PATH` - Path to hcxpcapngtool binary
- `NODE_ENV=test` - Test environment

### Testcontainers Setup
- **PostgreSQL**: Automatic container with test database
- **Redis**: Automatic container for queue management
- **Isolation**: Each test runs in isolated environment
- **Cleanup**: Automatic cleanup after test completion

## 📊 What's Tested

### Real Hashcat Execution
- ✅ Command building with real parameters
- ✅ Actual hashcat binary execution
- ✅ Real stdout/stderr processing
- ✅ Command timeout and error handling
- ✅ Exit code parsing

### Real HCX Tools
- ✅ Real hcxpcapngtool binary execution
- ✅ PCAP to HC22000 conversion
- ✅ PMKID extraction from beacon frames
- ✅ Format validation and error handling
- ✅ File system operations (no mocks)

### Real Security Workflows
- ✅ Complete PCAP processing → hashcat attack workflows
- ✅ Real database interactions during attacks
- ✅ Multi-network PCAP handling
- ✅ Concurrent attack management
- ✅ Error recovery and cleanup

### Performance Testing
- ✅ Large dataset processing (25MB+ PCAP files)
- ✅ Memory usage monitoring
- ✅ Concurrent attack performance
- ✅ Hash rate calculations and thresholds
- ✅ Resource cleanup verification

## 🛡️ Safety Features

### Container Isolation
- Tests run in isolated Docker containers
- No interference with development environment
- Automatic cleanup prevents resource leaks

### Error Handling
- Graceful handling of missing tools
- Timeout protection for long-running attacks
- Memory limit enforcement
- Proper error propagation and logging

## 📈 Benefits

### Confidence in Real Tools
- Tests actual tool behavior, not just mocks
- Catches integration issues before production
- Validates real command-line argument handling
- Ensures proper file permissions and paths

### Production Readiness
- Real tool testing bridges gap between development and production
- Integration tests catch environment-specific issues
- Performance testing ensures scalability under real load

---

## 🏃 Quick Start

1. Install dependencies: `pnpm install`
2. Run real tools tests: `pnpm test:integration:real`
3. Check results: `test-results/integration-real-results.json`

For development with mocked tools, use: `pnpm test:unit`