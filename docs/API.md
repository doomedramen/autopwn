# API Documentation

REST API reference for autopwn v1.

## Base URL

```
http://localhost:4000/api/v1
```

## Authentication

All API endpoints (except `/auth/login`) require authentication via session cookie or Bearer token.

### Session Cookie (Recommended for Web)

After logging in, a session cookie is automatically set. The frontend will send this cookie with each request.

### Bearer Token (For CLI/Scripts)

Include the session token in the Authorization header:

```
Authorization: Bearer <session-token>
```

## Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {} // Optional additional details
  }
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not logged in)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `422` - Unprocessable Entity (invalid data)
- `500` - Internal Server Error

## Endpoints

### Authentication

#### POST /auth/login

Authenticate user and create session.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "user",
      "createdAt": "2025-01-19T12:00:00Z"
    },
    "token": "session-token-here"
  }
}
```

#### POST /auth/logout

End current session.

**Request:** Empty body

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

#### GET /auth/session

Get current session information.

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "user"
    },
    "expiresAt": "2025-01-26T12:00:00Z"
  }
}
```

#### POST /auth/change-password

Change current user's password.

**Request:**

```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Password changed successfully"
  }
}
```

---

### Users

**Permissions:**

- GET /users - Admin, Superuser
- POST /users - Admin (can create User only), Superuser (can create any role)
- PATCH /users/:id - Admin (User only), Superuser (any)
- DELETE /users/:id - Admin (User only), Superuser (any except other Superusers)

#### GET /users

List all users (with pagination).

**Query Parameters:**

- `page` (default: 1)
- `limit` (default: 20, max: 100)
- `role` (filter by role: user, admin, superuser)
- `search` (search email)

**Response:**

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "email": "user@example.com",
        "role": "user",
        "createdAt": "2025-01-19T12:00:00Z",
        "lastLoginAt": "2025-01-19T12:00:00Z"
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    }
  }
}
```

#### POST /users

Create a new user.

**Request:**

```json
{
  "email": "newuser@example.com",
  "password": "securepassword123",
  "role": "user"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "newuser@example.com",
    "role": "user",
    "createdAt": "2025-01-19T12:00:00Z"
  }
}
```

#### PATCH /users/:id

Update user information.

**Request:**

```json
{
  "email": "updated@example.com",
  "role": "admin",
  "password": "newpassword" // Optional
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "updated@example.com",
    "role": "admin",
    "updatedAt": "2025-01-19T12:00:00Z"
  }
}
```

#### DELETE /users/:id

Delete a user (soft delete).

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "User deleted successfully"
  }
}
```

---

### Captures

**Permissions:** Users can only access their own captures. Admins/Superusers can access all.

#### GET /captures

List user's PCAP captures.

**Query Parameters:**

- `page` (default: 1)
- `limit` (default: 20)
- `status` (filter: pending, processing, completed, failed)
- `sort` (uploadedAt, filename)
- `order` (asc, desc)

**Response:**

```json
{
  "success": true,
  "data": {
    "captures": [
      {
        "id": "uuid",
        "filename": "handshakes_2025-01-19.pcap",
        "fileSize": 1048576,
        "status": "completed",
        "uploadedAt": "2025-01-19T12:00:00Z",
        "processedAt": "2025-01-19T12:05:00Z",
        "networkCount": 5,
        "userId": "uuid"
      }
    ],
    "pagination": {
      "total": 10,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

#### POST /captures/upload

Upload a PCAP file.

**Request:** multipart/form-data

```
file: <binary PCAP file>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "filename": "handshakes.pcap",
    "fileSize": 1048576,
    "status": "processing",
    "uploadedAt": "2025-01-19T12:00:00Z"
  }
}
```

**Notes:**

- Maximum file size defined by `MAX_PCAP_SIZE` environment variable
- File is queued for conversion to hc22000 format
- Poll GET /captures/:id for status updates

#### GET /captures/:id

Get capture details including extracted networks.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "filename": "handshakes.pcap",
    "fileSize": 1048576,
    "status": "completed",
    "uploadedAt": "2025-01-19T12:00:00Z",
    "processedAt": "2025-01-19T12:05:00Z",
    "networks": [
      {
        "id": "uuid",
        "ssid": "HomeWiFi",
        "bssid": "AA:BB:CC:DD:EE:FF",
        "handshakeType": "EAPOL",
        "extractedAt": "2025-01-19T12:05:00Z"
      }
    ],
    "userId": "uuid"
  }
}
```

#### DELETE /captures/:id

Delete a capture and all associated networks.

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Capture deleted successfully"
  }
}
```

---

### Networks

**Permissions:** Users can only access networks from their own captures.

#### GET /networks

List all networks extracted from user's captures.

**Query Parameters:**

- `page` (default: 1)
- `limit` (default: 20)
- `ssid` (filter by SSID)
- `captureId` (filter by capture)
- `cracked` (filter: true, false)

**Response:**

```json
{
  "success": true,
  "data": {
    "networks": [
      {
        "id": "uuid",
        "ssid": "HomeWiFi",
        "bssid": "AA:BB:CC:DD:EE:FF",
        "handshakeType": "EAPOL",
        "extractedAt": "2025-01-19T12:05:00Z",
        "captureId": "uuid",
        "isCracked": false
      }
    ],
    "pagination": {
      "total": 25,
      "page": 1,
      "limit": 20,
      "totalPages": 2
    }
  }
}
```

#### GET /networks/:id

Get network details including cracking attempts.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "ssid": "HomeWiFi",
    "bssid": "AA:BB:CC:DD:EE:FF",
    "handshakeType": "EAPOL",
    "extractedAt": "2025-01-19T12:05:00Z",
    "captureId": "uuid",
    "isCracked": true,
    "crackedPassword": "password123",
    "crackedAt": "2025-01-19T14:30:00Z",
    "jobs": [
      {
        "id": "uuid",
        "status": "completed",
        "createdAt": "2025-01-19T13:00:00Z"
      }
    ]
  }
}
```

#### GET /networks/by-capture/:captureId

Get all networks from a specific capture.

**Response:** Same as GET /networks

---

### Dictionaries

**Permissions:** Users can only access their own dictionaries.

#### GET /dictionaries

List user's dictionaries.

**Query Parameters:**

- `page` (default: 1)
- `limit` (default: 20)
- `type` (filter: uploaded, generated)
- `status` (filter: ready, generating, failed)

**Response:**

```json
{
  "success": true,
  "data": {
    "dictionaries": [
      {
        "id": "uuid",
        "name": "rockyou.txt",
        "type": "uploaded",
        "status": "ready",
        "fileSize": 139921507,
        "lineCount": 14344392,
        "createdAt": "2025-01-19T12:00:00Z",
        "userId": "uuid"
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

#### POST /dictionaries/upload

Upload a dictionary file.

**Request:** multipart/form-data

```
file: <text file>
name: "My Custom Wordlist" (optional)
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "custom.txt",
    "type": "uploaded",
    "status": "ready",
    "fileSize": 1048576,
    "lineCount": 10000,
    "createdAt": "2025-01-19T12:00:00Z"
  }
}
```

#### POST /dictionaries/generate

Generate a dictionary from keywords.

**Request:**

```json
{
  "name": "Generated Wordlist",
  "keywords": ["password", "wifi", "home"],
  "options": {
    "includeUppercase": true,
    "includeLowercase": true,
    "includeMixedCase": true,
    "leetSpeak": true,
    "specialCharPadding": true,
    "specialChars": ["!", "@", "#", "$"],
    "numberPadding": true,
    "numberRange": [0, 999],
    "minLength": 8,
    "maxLength": 20
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Generated Wordlist",
    "type": "generated",
    "status": "generating",
    "createdAt": "2025-01-19T12:00:00Z",
    "estimatedCompletion": "2025-01-19T12:10:00Z"
  }
}
```

**Notes:**

- Generation happens in background queue
- Poll GET /dictionaries/:id for status
- Status will change to "ready" when complete

#### GET /dictionaries/:id

Get dictionary details.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "rockyou.txt",
    "type": "uploaded",
    "status": "ready",
    "fileSize": 139921507,
    "lineCount": 14344392,
    "createdAt": "2025-01-19T12:00:00Z",
    "userId": "uuid",
    "generationOptions": null // Only for generated dictionaries
  }
}
```

#### DELETE /dictionaries/:id

Delete a dictionary.

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Dictionary deleted successfully"
  }
}
```

---

### Jobs

**Permissions:** Users can only access their own jobs.

#### GET /jobs

List user's hashcat jobs.

**Query Parameters:**

- `page` (default: 1)
- `limit` (default: 20)
- `status` (filter: waiting, active, completed, failed, cancelled)
- `sort` (createdAt, startedAt, completedAt)
- `order` (asc, desc)

**Response:**

```json
{
  "success": true,
  "data": {
    "jobs": [
      {
        "id": "uuid",
        "name": "HomeWiFi Crack Attempt",
        "status": "active",
        "progress": 45.5,
        "createdAt": "2025-01-19T13:00:00Z",
        "startedAt": "2025-01-19T13:00:30Z",
        "estimatedCompletion": "2025-01-19T15:00:00Z",
        "networkCount": 2,
        "dictionaryCount": 1,
        "crackedCount": 0,
        "userId": "uuid"
      }
    ],
    "pagination": {
      "total": 10,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

#### POST /jobs/create

Create a new hashcat job.

**Request:**

```json
{
  "name": "Crack HomeWiFi",
  "networkIds": ["uuid1", "uuid2"],
  "dictionaryIds": ["uuid1", "uuid2"],
  "attackMode": "straight", // straight, combinator, mask
  "hashcatOptions": {
    "workloadProfile": 3,
    "optimized": true,
    "rules": [] // Optional hashcat rules
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Crack HomeWiFi",
    "status": "waiting",
    "createdAt": "2025-01-19T13:00:00Z",
    "queuePosition": 2
  }
}
```

#### GET /jobs/:id

Get job details and results.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Crack HomeWiFi",
    "status": "completed",
    "progress": 100,
    "createdAt": "2025-01-19T13:00:00Z",
    "startedAt": "2025-01-19T13:00:30Z",
    "completedAt": "2025-01-19T15:30:00Z",
    "duration": 8970, // seconds
    "networks": [
      {
        "id": "uuid",
        "ssid": "HomeWiFi",
        "bssid": "AA:BB:CC:DD:EE:FF",
        "cracked": true,
        "password": "password123"
      }
    ],
    "dictionaries": [
      {
        "id": "uuid",
        "name": "rockyou.txt"
      }
    ],
    "stats": {
      "totalPasswords": 14344392,
      "testedPasswords": 14344392,
      "speed": "150.5 kH/s",
      "crackedCount": 1
    },
    "userId": "uuid"
  }
}
```

#### POST /dictionaries/merge

Merge multiple dictionaries into one.

**Request:** application/json

```json
{
  "name": "Merged Dictionary",
  "dictionaryIds": ["uuid1", "uuid2", ...],
  "removeDuplicates": true,  // default: true
  "validationRules": {
    "minLength": 8,
    "maxLength": 64,
    "excludePatterns": ["^admin", "^test"]
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Merged Dictionary",
    "type": "generated",
    "status": "ready",
    "wordCount": 15,
    "fileSize": 2048,
    "checksum": "sha256hash",
    "processingConfig": {
      "merge": {
        "sourceDictionaries": ["uuid1", "uuid2", ...],
        "originalWordCount": 20,
        "finalWordCount": 15,
        "removedDuplicates": 5,
        "validationRules": {
          "minLength": 8,
          "maxLength": 64
        },
        "mergedAt": "2025-01-19T12:00:00Z"
      }
    }
  }
}
```

**Validation Rules:**

- `dictionaryIds`: Must be array of 2-10 dictionary IDs
- `removeDuplicates`: Optional (boolean), default true
- `validationRules`: Optional object with:
  - `minLength`: Minimum word length (integer >= 1)
  - `maxLength`: Maximum word length (integer >= 1)
  - `excludePatterns`: Array of regex patterns to exclude

**Notes:**

- Only user's own dictionaries can be merged
- All dictionaries must have status "ready"
- Deduplication is case-insensitive
- Validation rules are applied before deduplication

#### POST /dictionaries/:id/validate

Validate and clean a dictionary.

**Request:** No body required

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "rockyou.txt (validated)",
    "type": "generated",
    "status": "ready",
    "wordCount": 8,
    "processingConfig": {
      "validation": {
        "sourceDictionaryId": "original-uuid",
        "originalWordCount": 10,
        "validWordCount": 8,
        "invalidWordCount": 2,
        "duplicateWordCount": 2,
        "validatedAt": "2025-01-19T12:00:00Z",
        "invalidWords": ["word1$", "word@#$"],
        "duplicateWords": ["password", "test123"]
      }
    }
  },
  "stats": {
    "originalWords": 10,
    "validWords": 8,
    "invalidWords": 2,
    "duplicateWords": 2,
    "removedWords": 4
  }
}
```

**Validation Criteria:**

- Valid words: Only alphanumeric characters and standard symbols (!@#$%^&\*()-\_=+[])
- Invalid words: Contains spaces, tabs, or unsupported special characters
- Duplicates: Case-insensitive duplicate detection

**Notes:**

- Creates a new dictionary with validated words
- Original dictionary is not modified
- Invalid and duplicate samples (up to 100 each) included in response

#### GET /dictionaries/:id/statistics

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "rockyou.txt (validated)",
    "type": "generated",
    "status": "ready",
    "wordCount": 8,
    "processingConfig": {
      "validation": {
        "sourceDictionaryId": "original-uuid",
        "originalWordCount": 10,
        "validWordCount": 8,
        "invalidWordCount": 2,
        "duplicateWordCount": 2,
        "validatedAt": "2025-01-19T12:00:00Z",
        "invalidWords": ["word1$", "word@#$"],
        "duplicateWords": ["password", "test123"]
      }
    }
  },
  "stats": {
    "originalWords": 10,
    "validWords": 8,
    "invalidWords": 2,
    "duplicateWords": 2,
    "removedWords": 4
  }
}
```

**Validation Criteria:**

- Valid words: Only alphanumeric characters and standard symbols (!@#$%^&\*()-\_=+[])
- Invalid words: Contains spaces, tabs, or unsupported special characters
- Duplicates: Case-insensitive duplicate detection

**Notes:**

- Creates a new dictionary with validated words
- Original dictionary is not modified
- Invalid and duplicate samples (up to 100 each) included in response

#### GET /dictionaries/:id/statistics

Get real-time job progress (lightweight endpoint for polling).

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "active",
    "progress": 67.3,
    "currentSpeed": "155.2 kH/s",
    "timeRemaining": 3600, // seconds
    "crackedCount": 1
  }
}
```

#### POST /jobs/:id/cancel

Cancel a running or queued job.

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Job cancelled successfully",
    "id": "uuid",
    "status": "cancelled"
  }
}
```

#### DELETE /jobs/:id

Delete a job (only if completed, failed, or cancelled).

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Job deleted successfully"
  }
}
```

---

### Results

**Permissions:** Users can only access results from their own jobs.

#### GET /results

List all cracked passwords.

**Query Parameters:**

- `page` (default: 1)
- `limit` (default: 20)
- `networkId` (filter by network)
- `jobId` (filter by job)
- `sort` (crackedAt, ssid)
- `order` (asc, desc)

**Response:**

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "uuid",
        "networkId": "uuid",
        "ssid": "HomeWiFi",
        "bssid": "AA:BB:CC:DD:EE:FF",
        "password": "password123",
        "crackedAt": "2025-01-19T15:30:00Z",
        "jobId": "uuid",
        "dictionaryId": "uuid"
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

#### GET /results/by-network/:networkId

Get all cracking attempts for a specific network.

**Response:** Same format as GET /results

#### GET /results/by-job/:jobId

Get all results from a specific job.

**Response:** Same format as GET /results

---

### Config

**Permissions:** Superuser only

#### GET /config

Get system configuration.

**Response:**

```json
{
  "success": true,
  "data": {
    "maxConcurrentJobs": 2,
    "maxPcapSize": 524288000,
    "maxDictionarySize": 10737418240,
    "maxGeneratedDictSize": 21474836480,
    "maxGenerationKeywords": 50,
    "hashcatDefaultWorkload": 3,
    "hashcatJobTimeout": 86400,
    "allowUserRegistration": false
  }
}
```

#### PATCH /config

Update system configuration.

**Request:**

```json
{
  "maxConcurrentJobs": 3,
  "hashcatDefaultWorkload": 4
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "maxConcurrentJobs": 3,
    "hashcatDefaultWorkload": 4,
    "updatedAt": "2025-01-19T12:00:00Z"
  }
}
```

---

## Pagination

All list endpoints support pagination:

**Query Parameters:**

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Response includes:**

```json
{
  "pagination": {
    "total": 100,
    "page": 2,
    "limit": 20,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": true
  }
}
```

## Error Codes

| Code                       | Description                     |
| -------------------------- | ------------------------------- |
| `AUTH_REQUIRED`            | Authentication required         |
| `INVALID_CREDENTIALS`      | Invalid email or password       |
| `INSUFFICIENT_PERMISSIONS` | User lacks required permissions |
| `NOT_FOUND`                | Resource not found              |
| `VALIDATION_ERROR`         | Request validation failed       |
| `DUPLICATE_RESOURCE`       | Resource already exists         |
| `FILE_TOO_LARGE`           | Uploaded file exceeds limit     |
| `INVALID_FILE_TYPE`        | File type not allowed           |
| `QUOTA_EXCEEDED`           | User quota exceeded             |
| `JOB_RUNNING`              | Cannot delete running job       |
| `INTERNAL_ERROR`           | Server error                    |

## Examples

### Complete Workflow Example (cURL)

```bash
# 1. Login
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' \
  -c cookies.txt

# 2. Upload PCAP
curl -X POST http://localhost:4000/api/v1/captures/upload \
  -b cookies.txt \
  -F "file=@handshakes.pcap"

# 3. Get capture status (repeat until status = completed)
curl http://localhost:4000/api/v1/captures/{captureId} \
  -b cookies.txt

# 4. Upload dictionary
curl -X POST http://localhost:4000/api/v1/dictionaries/upload \
  -b cookies.txt \
  -F "file=@rockyou.txt"

# 5. Create hashcat job
curl -X POST http://localhost:4000/api/v1/jobs/create \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Crack Job",
    "networkIds":["network-uuid"],
    "dictionaryIds":["dict-uuid"],
    "attackMode":"straight"
  }'

# 6. Monitor job progress
curl http://localhost:4000/api/v1/jobs/{jobId}/progress \
  -b cookies.txt

# 7. Get results
curl http://localhost:4000/api/v1/results/by-job/{jobId} \
  -b cookies.txt
```

### JavaScript/TypeScript Example

```typescript
// Using fetch API
const API_BASE = "http://localhost:4000/api/v1";

// Login
const loginResponse = await fetch(`${API_BASE}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({
    email: "user@example.com",
    password: "password",
  }),
});

const { data } = await loginResponse.json();
console.log("Logged in as:", data.user.email);

// Upload PCAP
const formData = new FormData();
formData.append("file", fileInput.files[0]);

const uploadResponse = await fetch(`${API_BASE}/captures/upload`, {
  method: "POST",
  credentials: "include",
  body: formData,
});

const capture = await uploadResponse.json();
console.log("Capture ID:", capture.data.id);

// Poll for completion
const pollCapture = async (id: string) => {
  while (true) {
    const response = await fetch(`${API_BASE}/captures/${id}`, {
      credentials: "include",
    });
    const { data } = await response.json();

    if (data.status === "completed") {
      console.log("Networks found:", data.networks.length);
      return data;
    }

    await new Promise((r) => setTimeout(r, 2000)); // Wait 2s
  }
};

await pollCapture(capture.data.id);
```

## Webhooks (Future)

Coming soon: Webhook notifications for job completion, failures, and other events.
