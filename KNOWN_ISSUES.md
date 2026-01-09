# Known Issues

## Test Failures

### Dictionary Route Tests (13 failures)
**Status**: Under investigation
**Impact**: Medium - Tests failing but functionality appears to work in development
**Tests Affected**:
- `GET /api/dictionaries` - returning 500 instead of 200
- `GET /api/dictionaries/:id` - returning 500 instead of 200/404/403
- `POST /api/dictionaries/:id/validate` - returning 500 instead of 404/403
- `DELETE /api/dictionaries/:id` - returning 500 instead of 200/404/403

**Context**:
- These tests started failing after schema migration 0006 (add progressMetadata)
- Test database has been updated with the migration
- Routes load successfully and appear to work in development
- 237 out of 252 tests (94%) are passing

**Next Steps**:
1. Add comprehensive error logging to dictionary routes
2. Run tests with verbose error output to capture actual error messages
3. Consider refactoring test setup to better isolate issues

### Test Results Summary
- **Total Tests**: 252
- **Passing**: 237 (94%)
- **Failing**: 15 (6%)
  - Health tests: 0 (fixed in latest commit)
  - Dictionary tests: 13
  - Other: 2

## Migration Notes

### Test Database Migration
The test database (`autopwn_test`) needs manual migration application currently. Migration 0006 was applied manually via:
```bash
docker exec -i crackhouse-db-development psql -U postgres -d autopwn_test < apps/api/src/db/migrations/0006_add_progress_metadata.sql
```

**TODO**: Ensure test setup automatically applies all migrations without manual intervention.

---

*Last Updated*: 2026-01-09
*Version*: pre-1.0
