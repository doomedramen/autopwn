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

```bash
cp capture-01.cap /path/to/autopwn/volumes/input/
```

### 3. Monitor Dashboard

Open http://localhost:3000

Watch as AutoPWN:
- Converts PCAP → hc22000
- Tries each dictionary sequentially
- Shows real-time progress

### 4. Retrieve Results

**Via Dashboard**: Check "Cracked Passwords" table

**Via Database**:
```bash
sqlite3 volumes/db/autopwn.db "SELECT * FROM results;"
```

**Via Files**: Cracked files are in `volumes/completed/`

## Dictionary Management

### Adding Dictionaries

```bash
# Single file
cp wordlist.txt volumes/dictionaries/

# Compressed (hashcat handles .gz automatically)
cp rockyou.txt.gz volumes/dictionaries/

# Multiple files
cp *.txt volumes/dictionaries/
```

Worker scans dictionaries folder on startup and rescans periodically.

### Dictionary Order

Dictionaries are tried in alphabetical order by filename. To prioritize:

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

Drop multiple files at once:

```bash
cp *.pcap volumes/input/
```

Jobs are processed sequentially.

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
SELECT essid, password FROM results;
SELECT name, size FROM dictionaries ORDER BY name;
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

1. **Small, targeted lists first** (1-10MB)
2. **Common passwords** (rockyou.txt)
3. **WiFi-specific** (Super-WPA)
4. **Large generic** (as last resort)

### Batch Processing

For many PCAP files:

```bash
# Copy all at once
cp /capture/session/*.pcap volumes/input/

# Or use watch script
watch -n 60 'cp /new/captures/*.pcap volumes/input/ 2>/dev/null'
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

### Files Not Processing

```bash
# Check watcher
docker logs autopwn-worker | grep "detected"

# Verify permissions
ls -la volumes/input/

# Manually trigger
touch volumes/input/test.pcap  # Then check logs
```

## Best Practices

1. **Test first**: Run with small dictionary to verify setup
2. **Organize dictionaries**: Use numbered prefixes for order
3. **Monitor resources**: Check CPU/GPU usage, adjust if needed
4. **Clean up**: Archive completed files periodically
5. **Backup results**: Export cracked passwords regularly

## Example Workflow

```bash
# 1. Setup
cd autopwn
docker-compose -f docker-compose.yml -f docker-compose.nvidia.yml up -d

# 2. Add dictionaries
cp ~/wordlists/rockyou.txt volumes/dictionaries/01-rockyou.txt
cp ~/wordlists/wpa.txt volumes/dictionaries/02-wpa.txt

# 3. Add captures
cp ~/captures/office-wifi.pcap volumes/input/

# 4. Monitor
open http://localhost:3000

# 5. Wait for results...

# 6. Export results
sqlite3 volumes/db/autopwn.db "SELECT essid, password FROM results;" > cracked.txt

# 7. Archive
mv volumes/completed/* ~/archives/
```

## Integration Ideas

- **Cron job**: Auto-copy new captures
- **Notification**: Alert on successful crack (webhook, email)
- **API**: Build on top of Next.js API routes
- **Custom dictionaries**: Generate based on target (location, names, dates)
