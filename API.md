# AutoPWN API Documentation

REST API for AutoPWN automation and integration.

**Base URL:** `http://localhost:3000/api`

## Authentication

Currently no authentication required (may change in future versions).

## Response Format

All responses are JSON format.

- **Success:** `{"data": {...}}` or direct data
- **Error:** `{"error": "Error message", "details": "Additional details"}`

## Core Endpoints

### Jobs
- `GET /api/jobs` - List all jobs with status and progress
- `POST /api/jobs/create` - Create new job from selected PCAPs and dictionaries
- `GET /api/jobs/{id}` - Get specific job details
- `POST /api/jobs/{id}/pause` - Pause/resume job
- `POST /api/jobs/{id}/priority` - Set job priority (0=Low, 1=Normal, 2=High, 3=Urgent)
- `POST /api/jobs/{id}/retry` - Retry failed job
- `POST /api/jobs/retry-batch` - Retry multiple failed jobs
- `GET /api/jobs/{id}/items` - Get job items with source PCAP tracking

### Files
- `POST /api/upload` - Upload PCAP files (multipart/form-data)
- `GET /api/captures` - List uploaded PCAP files with ESSID info
- `GET /api/dictionaries` - List available dictionaries
- `POST /api/dictionaries/upload` - Upload dictionary file

### Results & Analytics
- `GET /api/results` - Get all cracked passwords with source PCAP tracking
- `GET /api/stats` - Current job and result statistics
- `GET /api/analytics` - Analytics data for charts (jobs over time, success rates, etc.)

### Wordlist Generation
- `POST /api/wordlist/generate` - Generate custom wordlist with transformations

## Quick Examples

### Create Job
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"captures":["test.pcap"],"dictionaryIds":[1],"name":"Test Job"}' \
  http://localhost:3000/api/jobs/create
```

### Upload Files
```bash
curl -X POST -F "files=@handshake.pcap" http://localhost:3000/api/upload
```

### Get Results
```bash
curl http://localhost:3000/api/results
```

### Python Integration
```python
import requests

# Upload and create job
files = {'files': open('handshake.pcap', 'rb')}
requests.post('http://localhost:3000/api/upload', files=files)

job_data = {
    'captures': ['handshake.pcap'],
    'dictionaryIds': [1, 2],
    'name': 'Security Audit'
}
response = requests.post('http://localhost:3000/api/jobs/create', json=job_data)
print(response.json())
```

### JavaScript Integration
```javascript
// Upload file
const formData = new FormData();
formData.append('files', fileInput.files[0]);
await fetch('http://localhost:3000/api/upload', {
  method: 'POST',
  body: formData
});

// Create job
await fetch('http://localhost:3000/api/jobs/create', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    captures: ['handshake.pcap'],
    dictionaryIds: [1],
    name: 'Test Job'
  })
});
```

## Error Codes

- `400` - Bad Request (invalid parameters)
- `404` - Not Found
- `500` - Internal Server Error

## Real-time Updates

The dashboard uses polling (2-3 second intervals) rather than WebSockets for real-time updates.