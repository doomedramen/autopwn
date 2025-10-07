# Usage Guide

## Getting Started

### 1. Capture WPA Handshakes

Use tools like `airodump-ng` to capture handshakes:

```bash
# Monitor mode
sudo airmon-ng start wlan0

# Capture handshakes
sudo airodump-ng -c 6 --bssid AA:BB:CC:DD:EE:FF -w capture wlan0mon

# Wait for handshake, then stop
sudo airmon-ng stop wlan0mon
```

You'll get files like `capture-01.cap` or `capture-01.pcap`.

### 2. Add to AutoPWN

**Via Web Interface** (Recommended):
1. Open http://localhost:3000
2. Upload `.pcap` files using the file upload interface
3. Upload dictionary files using the dictionary upload interface

**Via File Copy**:
```bash
# Copy PCAP files
cp capture-01.cap /path/to/autopwn/volumes/pcaps/

# Copy dictionary files
cp rockyou.txt /path/to/autopwn/volumes/dictionaries/
```

### 3. Create Jobs

1. In the dashboard, select one or more PCAP files
2. Click "Process selected"
3. Select which dictionaries you want to use
4. Click "Run" to create the job

### 4. Monitor Progress

Watch as AutoPWN:
- Extracts ESSID information and builds mapping database
- Merges selected PCAPs into single `.hc22000` file
- Runs hashcat against selected dictionaries
- Shows real-time progress, speed, and ETA
- Tracks which PCAP file each cracked password came from

### 5. Retrieve Results

**Via Dashboard**: Check "Cracked Passwords" table - shows ESSID, password, and source PCAP file

**Via Database**:
```bash
sqlite3 volumes/db/autopwn.db "SELECT essid, password, pcap_filename FROM results;"
```

**Via Files**: Job files are stored in `volumes/jobs/`

## Dictionary Management

### Adding Dictionaries

**Via Web Interface** (Recommended):
1. Open http://localhost:3000
2. Click on dictionary upload area
3. Select or drag-and-drop dictionary files
4. Files are automatically scanned and added to database

**Via File Copy**:
```bash
# Single file
cp wordlist.txt volumes/dictionaries/

# Compressed (hashcat handles .gz automatically)
cp rockyou.txt.gz volumes/dictionaries/

# Multiple files
cp *.txt volumes/dictionaries/
```

### Dictionary Selection

When creating jobs, you can:
- Select specific dictionaries for each job
- Choose multiple dictionaries to try in sequence
- View dictionary sizes and names in the selection interface

### Dictionary Order

Within a job, dictionaries are tried in the order you select them in the interface. If you prefer alphabetical ordering:

```bash
# Rename with prefixes
mv common.txt volumes/dictionaries/01-common.txt
mv rockyou.txt volumes/dictionaries/02-rockyou.txt
mv huge.txt volumes/dictionaries/99-huge.txt
```

### Recommended Dictionaries

- **rockyou.txt** - Common passwords
- **Super-WPA** - WiFi-specific wordlist
- **john.txt** - John the Ripper wordlist
- **Custom** - Generated with tools like `crunch` or `hashcat-utils`

## Advanced Usage

### Multiple PCAP Files

**Upload Multiple Files**:
1. Select multiple `.pcap` files in the upload interface
2. Or copy multiple files: `cp *.pcap volumes/pcaps/`

**Create Batch Jobs**:
1. Select multiple PCAP files in the dashboard
2. Click "Process selected"
3. Choose your dictionaries
4. Click "Run" to create a single efficient job

### Job Management

**Job Priority**:
- Select jobs in the dashboard
- Set priority: Low, Normal, High, or Urgent
- Higher priority jobs are processed first

**Pause/Resume**:
- Pause running jobs to free up resources
- Resume paused jobs from where they left off

**Retry Failed Jobs**:
- Select failed jobs and click retry
- Jobs are re-queued with same dictionaries and settings

### ESSID Tracking

AutoPWN automatically tracks which PCAP file each cracked password came from:

1. **During Upload**: ESSID information is extracted from each PCAP
2. **Database Mapping**: ESSID → PCAP filename mapping is stored
3. **Result Processing**: Cracked passwords are linked back to source PCAPs
4. **Display**: Results show ESSID, password, and source PCAP file

This allows you to:
- Know exactly which capture file contained each network
- Organize results by source PCAP
- Maintain forensic chain of custody

### Monitoring Jobs

```bash
# Worker logs
docker logs -f autopwn-worker

# Check hashcat directly
docker exec -it autopwn-worker hashcat -I  # List devices
```

### GPU Selection

Force specific GPU:

```bash
# In .env
HASHCAT_DEVICE_TYPE=nvidia

# Or override in docker-compose
docker-compose up -d --build
```

### Stopping Jobs

```bash
# Stop all services
docker-compose down

# Worker will gracefully stop current hashcat process
```

### Database Queries

```bash
# Enter database
docker exec -it autopwn-web sqlite3 /data/db/autopwn.db

# Useful queries
SELECT * FROM jobs WHERE status = 'processing';
SELECT COUNT(*) FROM results;
SELECT essid, password, pcap_filename FROM results;
SELECT name, size FROM dictionaries ORDER BY name;

-- ESSID to PCAP mapping
SELECT essid, pcap_filename FROM pcap_essid_mapping;

-- Analytics queries
SELECT
  DATE(created_at) as date,
  COUNT(*) as jobs_count
FROM jobs
WHERE created_at >= date('now', '-30 days')
GROUP BY DATE(created_at)
ORDER BY date;

-- Dictionary effectiveness
SELECT
  d.name,
  COUNT(r.id) as cracks_count
FROM dictionaries d
LEFT JOIN job_dictionaries jd ON d.id = jd.dictionary_id
LEFT JOIN results r ON jd.job_id = r.job_id
GROUP BY d.id, d.name
ORDER BY cracks_count DESC;

-- Most successful PCAP files
SELECT
  pcap_filename,
  COUNT(*) as cracks_count
FROM results
GROUP BY pcap_filename
ORDER BY cracks_count DESC;
```

## Performance Tips

### GPU Optimization

**NVIDIA**:
- Use latest drivers
- Set `CUDA_VISIBLE_DEVICES` if multiple GPUs
- Monitor with `nvidia-smi`

**AMD**:
- Install latest ROCm
- Check compatibility: https://github.com/RadeonOpenCompute/ROCm
- Set `HSA_OVERRIDE_GFX_VERSION` if needed

**CPU**:
- Not recommended for large dictionaries
- Use for testing only

### Dictionary Strategy

1. **Small, targeted lists first** (1-10MB) - fastest results
2. **Common passwords** (rockyou.txt) - high hit rate
3. **WiFi-specific** (Super-WPA) - formatted for WiFi
4. **Large generic** (as last resort) - comprehensive but slow

### Job Strategy

For many PCAP files:
- **Group similar networks**: PCAPs from same location/organization
- **Logical batch sizes**: 10-50 PCAPs per job for optimal performance
- **Dictionary selection**: Choose targeted dictionaries for your environment

**Example Workflow**:
```bash
# Copy all PCAPs from a pentest session
cp /pentest/session/*.pcap volumes/pcaps/

# In the web interface:
# 1. Select all PCAPs from target location
# 2. Choose relevant dictionaries (company names, common passwords)
# 3. Create single batch job
# 4. Monitor progress and results
```

## Troubleshooting

### "No hashes found"

- PCAP file doesn't contain valid handshake
- Try with `hcxpcapngtool` manually:
  ```bash
  hcxpcapngtool -o test.hc22000 capture.pcap
  ```

### "Hashcat exhausted"

All dictionaries tried, no match. Add more wordlists or generate custom ones.

### Slow Performance

- Check GPU is actually being used: `hashcat -I`
- Verify device type in `.env`
- Monitor GPU utilization
- Consider larger/faster dictionaries

### Jobs Not Processing

```bash
# Check worker
docker logs autopwn-worker

# Verify permissions
ls -la volumes/pcaps/

# Check database
docker exec -it autopwn-web sqlite3 /data/db/autopwn.db "SELECT * FROM jobs WHERE status = 'pending';"

# Check if files were uploaded correctly
ls -la volumes/pcaps/
ls -la volumes/dictionaries/
```

## Best Practices

1. **Test first**: Run with small dictionary to verify setup
2. **Organize dictionaries**: Use meaningful names and descriptions
3. **Job grouping**: Group related PCAPs into logical batches
4. **Monitor resources**: Check CPU/GPU usage, adjust if needed
5. **Backup results**: Export cracked passwords with source PCAP info
6. **File management**: Keep original PCAPs organized by project/location

## Example Workflow

```bash
# 1. Setup
cd autopwn
docker-compose -f docker-compose.yml -f docker-compose.nvidia.yml up -d

# 2. Add dictionaries via web interface or copy
cp ~/wordlists/rockyou.txt volumes/dictionaries/
cp ~/wordlists/company-targets.txt volumes/dictionaries/

# 3. Upload PCAPs
cp ~/pentest/client-site/*.pcap volumes/pcaps/

# 4. Create jobs via web interface
# - Select PCAPs from client-site
# - Choose relevant dictionaries
# - Click "Run" to create batch job

# 5. Monitor progress
open http://localhost:3000

# 6. Export results with source tracking
sqlite3 volumes/db/autopwn.db "SELECT essid, password, pcap_filename FROM results;" > client-site-cracks.txt

# 7. Archive by project
mkdir -p ~/archives/client-site/
mv volumes/jobs/client-site-* ~/archives/client-site/
```

## Analytics Dashboard

Access the analytics dashboard at http://localhost:3000/analytics to view:

- **Job Trends**: Line chart showing jobs created over time
- **Success Rate**: Percentage of successful cracks
- **Completion Times**: Average time to complete jobs
- **Dictionary Performance**: Which dictionaries are most effective
- **Status Distribution**: Pie chart of job statuses

The dashboard automatically refreshes every 30 seconds with new data.

## Integration Ideas

- **Cron job**: Auto-copy new captures
- **Notification**: Alert on successful crack (webhook, email)
- **API**: Build on top of Next.js API routes (see API.md)
- **Custom dictionaries**: Generate based on target (location, names, dates)
- **Analytics**: Export data for external reporting
- **Automation**: Use the REST API to integrate with other tools
