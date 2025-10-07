# AutoPWN Usage Guide

## Quick Start

1. **Capture handshakes** with `airodump-ng` or similar tools
2. **Upload files** to AutoPWN dashboard (http://localhost:3000)
3. **Create jobs** by selecting PCAP files and dictionaries
4. **Monitor progress** in real-time
5. **Export results** with source PCAP tracking

## File Management

### Upload Files

**Web Interface** (Recommended):
- Upload PCAP files via drag-and-drop
- Upload dictionaries through dictionary manager
- Files are automatically scanned and indexed

**File Copy**:
```bash
# PCAP files
cp *.pcap volumes/pcaps/

# Dictionaries
cp rockyou.txt volumes/dictionaries/
cp wordlist.gz volumes/dictionaries/  # Compressed supported
```

### Dictionary Strategy

1. **Small targeted lists** (1-10MB) - Fast results
2. **Common passwords** (rockyou.txt) - High hit rate
3. **WiFi-specific** (Super-WPA) - Optimized for WiFi
4. **Large generic** - Comprehensive but slow

## Job Management

### Create Jobs

1. Select one or more PCAP files in dashboard
2. Click "Process selected"
3. Choose dictionaries (multiple supported)
4. Set job name and click "Run"

### Job Control

- **Priority**: Low, Normal, High, Urgent
- **Pause/Resume**: Free up resources temporarily
- **Retry**: Re-queue failed jobs with same settings
- **Batch**: Multiple PCAPs → Single efficient job

### ESSID Tracking

AutoPWN automatically tracks which PCAP file each password came from:
1. Extract ESSID during upload
2. Store ESSID → PCAP mapping in database
3. Link cracked passwords back to source files
4. Display results with forensic chain of custody

## Performance

### GPU Setup

```bash
# NVIDIA
docker-compose -f docker-compose.yml -f docker-compose.nvidia.yml up -d

# AMD
docker-compose -f docker-compose.yml -f docker-compose.amd.yml up -d

# CPU (testing only)
docker-compose up -d
```

### Optimization

- **NVIDIA**: Latest drivers, monitor with `nvidia-smi`
- **AMD**: Latest ROCm, check `/dev/dri` access
- **Batch size**: 10-50 PCAPs per job optimal
- **Dictionary order**: Try fast lists first

## Monitoring

### Check Progress

```bash
# Worker logs
docker logs -f autopwn-worker

# GPU status
docker exec -it autopwn-worker hashcat -I

# Database queries
docker exec -it autopwn-web sqlite3 /data/db/autopwn.db \
  "SELECT essid, password, pcap_filename FROM results;"
```

### Common Issues

- **"No hashes found"**: PCAP lacks valid handshake
- **"Hashcat exhausted"**: Try more dictionaries
- **Slow performance**: Verify GPU usage with `hashcat -I`
- **Jobs not processing**: Check `docker logs autopwn-worker`

## Analytics

Access analytics dashboard at http://localhost:3000/analytics:
- Job trends and success rates
- Dictionary effectiveness comparison
- Completion time statistics
- Status distribution charts

## Database Queries

```sql
-- Recent results
SELECT essid, password, pcap_filename, cracked_at
FROM results
ORDER BY cracked_at DESC;

-- Dictionary performance
SELECT d.name, COUNT(r.id) as cracks
FROM dictionaries d
LEFT JOIN job_dictionaries jd ON d.id = jd.dictionary_id
LEFT JOIN results r ON jd.job_id = r.job_id
GROUP BY d.id, d.name
ORDER BY cracks DESC;

-- Job status
SELECT status, COUNT(*) as count
FROM jobs
GROUP BY status;
```

## Best Practices

1. **Test first** with small dictionaries
2. **Group related PCAPs** into logical batches
3. **Monitor GPU usage** during processing
4. **Backup results** with source PCAP mapping
5. **Organize files** by project/location
6. **Use targeted dictionaries** for environment

## Integration

- **REST API**: Full automation support (see API.md)
- **Custom scripts**: Auto-copy new captures
- **Notifications**: Webhook/email alerts on success
- **Analytics export**: External reporting and metrics
