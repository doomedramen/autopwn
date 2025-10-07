# AutoPWN API Documentation

This document describes the REST API endpoints provided by the AutoPWN web dashboard.

## Base URL

```
http://localhost:3000/api
```

## Authentication

Currently, the API does not require authentication. This may change in future versions.

## Response Format

All responses are in JSON format.

Success responses:
```json
{
  "data": { ... }
}
```

Error responses:
```json
{
  "error": "Error message",
  "details": "Additional error details"
}
```

## Endpoints

### Jobs

#### Get All Jobs
```http
GET /api/jobs
```

Returns a list of all jobs with their current status.

**Response:**
```json
[
  {
    "id": 1,
    "job_id": "job-1234567890",
    "status": "processing",
    "priority": 0,
    "paused": 0,
    "batch_mode": 1,
    "items_total": 3,
    "items_cracked": 1,
    "created_at": "2025-01-05T12:00:00.000Z",
    "started_at": "2025-01-05T12:01:00.000Z",
    "completed_at": null,
    "current_dictionary": "Super-WPA.gz",
    "progress": 45.5,
    "hash_count": 5,
    "speed": "1234 H/s",
    "eta": "2h 30m",
    "error": null,
    "logs": null,
    "captures": ["handshake1.pcap", "handshake2.pcap", "handshake3.pcap"],
    "total_hashes": 5
  }
]
```

#### Create Job
```http
POST /api/jobs/create
```

Creates a new job by merging selected PCAP files into a single hash file.

**Request Body:**
```json
{
  "captures": ["handshake1.pcap", "handshake2.pcap", "handshake3.pcap"],
  "dictionaryIds": [1, 2],
  "name": "Office WiFi Audit"
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "job-1234567890",
  "jobName": "Office WiFi Audit",
  "captures": ["handshake1.pcap", "handshake2.pcap", "handshake3.pcap"],
  "dictionaries": [1, 2],
  "totalCreated": 1,
  "totalFiles": 3,
  "totalHashes": 5,
  "message": "Successfully created job 'Office WiFi Audit' merging 3 capture files with 5 total hashes."
}
```

#### Get Job by ID
```http
GET /api/jobs/{id}
```

Returns details for a specific job.

#### Pause/Resume Job
```http
POST /api/jobs/{id}/pause
```

Toggles the pause state of a job.

**Response:**
```json
{
  "paused": 1
}
```

#### Set Job Priority
```http
POST /api/jobs/{id}/priority
```

Sets the priority of a job.

**Request Body:**
```json
{
  "priority": 1
}
```

Priority levels:
- `0`: Low
- `1`: Normal
- `2`: High
- `3`: Urgent

**Response:**
```json
{
  "priority": 1
}
```

#### Retry Failed Job
```http
POST /api/jobs/{id}/retry
```

Retries a failed job by resetting its status to pending so it can be processed again.

**Response:**
```json
{
  "success": true
}
```

#### Retry Multiple Jobs
```http
POST /api/jobs/retry-batch
```

Retries multiple failed jobs.

**Request Body:**
```json
{
  "jobIds": [1, 2, 3]
}
```

#### Get Job Items
```http
GET /api/jobs/{id}/items
```

Returns all items (handshakes) within a job with source PCAP tracking.

**Response:**
```json
[
  {
    "id": 1,
    "job_id": 1,
    "filename": "handshake.pcap",
    "essid": "MyNetwork",
    "bssid": "AA:BB:CC:DD:EE:FF",
    "status": "completed",
    "password": "password123",
    "cracked_at": "2025-01-05T12:30:00.000Z",
    "pcap_filename": "office-capture.pcap"
  }
]
```

### Dictionaries

#### Get All Dictionaries
```http
GET /api/dictionaries
```

Returns a list of all available dictionaries.

**Response:**
```json
[
  {
    "id": 1,
    "name": "rockyou.txt",
    "path": "/data/dictionaries/rockyou.txt",
    "size": 14344392
  }
]
```

#### Upload Dictionary
```http
POST /api/dictionaries/upload
```

Uploads a new dictionary file.

**Request:** multipart/form-data with a file field named "file"

**Response:**
```json
{
  "success": true,
  "filename": "custom-dict.txt"
}
```

### Wordlist Generation

#### Generate Custom Wordlist
```http
POST /api/wordlist/generate
```

Generates a custom wordlist based on provided parameters.

**Request Body:**
```json
{
  "baseWords": ["password", "admin", "wifi"],
  "includeNumbers": true,
  "includeSpecialChars": true,
  "includeCaps": true,
  "includeLeet": true,
  "minLength": 8,
  "maxLength": 63,
  "customPattern": "{word}{number}"
}
```

**Response:**
```json
{
  "filename": "custom-2025-01-05-1234.txt",
  "count": 1500
}
```

### Results

#### Get All Results
```http
GET /api/results
```

Returns all successfully cracked passwords with source PCAP tracking.

**Response:**
```json
[
  {
    "id": 1,
    "job_id": 1,
    "essid": "MyNetwork",
    "password": "password123",
    "cracked_at": "2025-01-05T12:30:00.000Z",
    "pcap_filename": "office-capture.pcap"
  }
]
```

### Stats

#### Get Statistics
```http
GET /api/stats
```

Returns current statistics about jobs and results.

**Response:**
```json
{
  "totalJobs": 10,
  "pendingJobs": 2,
  "processingJobs": 1,
  "completedJobs": 5,
  "failedJobs": 2,
  "totalResults": 5
}
```

### Analytics

#### Get Analytics Data
```http
GET /api/analytics
```

Returns analytics data for charts and statistics.

**Response:**
```json
{
  "jobsOverTime": [
    { "date": "2025-01-01", "count": 5 },
    { "date": "2025-01-02", "count": 3 }
  ],
  "cracksOverTime": [
    { "date": "2025-01-01", "count": 2 },
    { "date": "2025-01-02", "count": 1 }
  ],
  "statusDistribution": [
    { "status": "completed", "count": 5 },
    { "status": "failed", "count": 2 },
    { "status": "pending", "count": 2 },
    { "status": "processing", "count": 1 }
  ],
  "dictionaryEffectiveness": [
    { "name": "rockyou.txt", "cracks": 3 },
    { "name": "custom-2025-01-05.txt", "cracks": 2 }
  ],
  "avgCompletionTime": 1800,
  "successRate": 50.0
}
```

### File Upload

#### Upload PCAP Files
```http
POST /api/upload
```

Uploads PCAP files for storage. Files are permanently stored and ESSID information is extracted for tracking.

**Request:** multipart/form-data with files field named "files"

**Response:**
```json
{
  "success": true,
  "uploaded": ["handshake.pcap"],
  "essids_extracted": ["MyNetwork", "OfficeWiFi"],
  "errors": []
}
```

#### Get PCAP Files
```http
GET /api/captures
```

Returns list of uploaded PCAP files with ESSID information.

**Response:**
```json
[
  {
    "filename": "office-capture.pcap",
    "size": 1048576,
    "uploaded_at": "2025-01-05T12:00:00.000Z",
    "essids": ["MyNetwork", "OfficeWiFi"],
    "hash_count": 2
  }
]
```

## Error Codes

- `400`: Bad Request - Invalid parameters or missing data
- `404`: Not Found - Resource doesn't exist
- `500`: Internal Server Error - Server-side error

## Rate Limiting

Currently, there are no rate limits on API endpoints.

## WebSocket

The dashboard uses server-sent events (SSE) for real-time updates, not WebSockets. The frontend polls the API every 2-3 seconds for updates.

## Integration Examples

### JavaScript/Node.js

```javascript
// Get all jobs
const response = await fetch('http://localhost:3000/api/jobs');
const jobs = await response.json();

// Upload a file
const formData = new FormData();
formData.append('files', fileInput.files[0]);

const uploadResponse = await fetch('http://localhost:3000/api/upload', {
  method: 'POST',
  body: formData
});

const uploadResult = await uploadResponse.json();

// Create a job
const jobResponse = await fetch('http://localhost:3000/api/jobs/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    captures: ['handshake1.pcap', 'handshake2.pcap'],
    dictionaryIds: [1, 2],
    name: 'Security Audit'
  })
});

const jobResult = await jobResponse.json();
```

### Python

```python
import requests

# Get all jobs
response = requests.get('http://localhost:3000/api/jobs')
jobs = response.json()

# Upload a file
files = {'files': open('handshake.pcap', 'rb')}
response = requests.post('http://localhost:3000/api/upload', files=files)
upload_result = response.json()

# Create a job
job_data = {
    'captures': ['handshake1.pcap', 'handshake2.pcap'],
    'dictionaryIds': [1, 2],
    'name': 'Security Audit'
}
response = requests.post('http://localhost:3000/api/jobs/create', json=job_data)
job_result = response.json()
```

### curl

```bash
# Get all jobs
curl http://localhost:3000/api/jobs

# Upload a file
curl -X POST -F "files=@handshake.pcap" http://localhost:3000/api/upload

# Create a job
curl -X POST -H "Content-Type: application/json" \
  -d '{"captures":["handshake1.pcap","handshake2.pcap"],"dictionaryIds":[1,2],"name":"Security Audit"}' \
  http://localhost:3000/api/jobs/create

# Set job priority
curl -X POST -H "Content-Type: application/json" \
  -d '{"priority":2}' \
  http://localhost:3000/api/jobs/1/priority

# Get results with source PCAP info
curl http://localhost:3000/api/results