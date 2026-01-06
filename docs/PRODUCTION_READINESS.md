# Production Readiness Plan

## Current State Assessment

### ✅ Working Backend (~80% Complete)
- Authentication system (Better Auth)
- PCAP upload and network extraction
- Dictionary management (upload, merge, validate)
- HashCat integration with job queues
- WebSocket real-time updates
- Email notifications (partially broken)
- User management
- Results storage

### ❌ Critical Issues Blocking Production

#### 1. API Startup Errors (Must Fix)
- `emailService is not defined` in `apps/api/src/index.ts:151`
- `get_jobs_error` with `Error: undefined` in `apps/api/src/routes/jobs.ts:76`
- `Ioredis` import error in `apps/api/src/lib/email-queue.ts:2`

#### 2. Job Creation UI is Mock (Critical Blocker)
- `apps/web/components/create-job-modal.tsx` line 113: `// Simulate API call` - setTimeout only
- No actual job creation through the UI
- Users cannot create cracking jobs without API calls

#### 3. Upload Flow Has Auth Issues
- `apps/web/lib/api.ts` line 20-22: Empty return in auth interceptor
- `apps/web/components/upload-modal.tsx` line 58: Auth headers not added to uploads

#### 4. Missing/Failing E2E Tests
- Some tests still failing (dashboard tabs, job monitoring)

## Implementation Plan

### Phase 1: Fix Critical API Errors (1-2 hours)

**File: `apps/api/src/index.ts`**
```typescript
// Add at top with other imports:
import { emailService } from "@/services/email.service";
```

**File: `apps/api/src/routes/jobs.ts`**
```typescript
// Line ~76: Add null check
error: error?.message || "Unknown error",
```

**File: `apps/api/src/lib/email-queue.ts`**
```typescript
// Line 2: Fix import
import { Redis } from "ioredis";
// Update usage accordingly
```

### Phase 2: Implement Real Job Creation UI (2-3 hours)

**File: `apps/web/components/create-job-modal.tsx`**

Replace the mock `handleSubmit` with actual API call:
```typescript
const { mutate: createJob } = useCreateJob();

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!isValid) return;

  setIsCreating(true);

  try {
    await createJob({
      name,
      selectedNetworks,
      selectedDictionaries,
      attackMode,
      hashType,
      workloadProfile,
      runtimeLimit,
      optimizedKernels,
    });
    setOpen(false);
  } catch (error) {
    // Handle error
  } finally {
    setIsCreating(false);
  }
};
```

### Phase 3: Fix Upload Auth (1 hour)

**File: `apps/web/lib/api.ts`**

Fix the auth interceptor to actually add tokens:
```typescript
request.use(async (config) => {
  const session = await authClient.getSession();
  if (session?.user) {
    config.headers.Authorization = `Bearer ${session.token}`;
  }
  return config;
});
```

**File: `apps/web/components/upload-modal.tsx`**

Add auth headers to Uppy XHRUpload configuration.

### Phase 4: Verify & Test (1-2 hours)

1. Run full E2E test suite
2. Manual testing:
   - Upload PCAP file → extract networks
   - Upload dictionary file
   - Create cracking job
   - Monitor job progress
   - View results

### Phase 5: Production Hardening (optional but recommended)

1. Enable rate limiting
2. Add CORS for production domain
3. Set up proper logging
4. Add monitoring/alerting
5. Create production deployment guide

## Estimated Timeline

| Phase | Time | Priority |
|-------|------|----------|
| Fix API errors | 1-2 hrs | CRITICAL |
| Implement job creation UI | 2-3 hrs | CRITICAL |
| Fix upload auth | 1 hr | HIGH |
| Testing & verification | 1-2 hrs | HIGH |
| Production hardening | TBD | MEDIUM |

## Next Steps

Would you like me to start with:
1. **Phase 1** - Fix the API startup errors immediately
2. **Phase 2** - Implement real job creation (the critical missing feature)
3. **All phases** - Full implementation

Let me know which approach you'd prefer!
