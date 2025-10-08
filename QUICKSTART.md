# AutoPWN Quick Start Guide

Get AutoPWN up and running in 5 minutes.

## Prerequisites

- Docker and Docker Compose installed
- At least one wordlist file (e.g., rockyou.txt)
- `.pcap` files containing WPA/WPA2 handshakes

## Step 1: Clone and Setup

```bash
git clone https://github.com/DoomedRamen/autopwn.git
cd autopwn
cp .env.example .env
```

## Step 2: Add Wordlists

Place your wordlists in the dictionaries folder:

```bash
# Example with rockyou.txt
cp /path/to/rockyou.txt volumes/dictionaries/

# Or download a sample wordlist
wget https://github.com/brannondorsey/naive-hashcat/releases/download/data/rockyou.txt \
  -O volumes/dictionaries/rockyou.txt
```

## Step 3: Start AutoPWN

### CPU Mode (Default)

```bash
docker-compose up -d
```

### With NVIDIA GPU

```bash
docker-compose -f docker-compose.yml -f docker-compose.nvidia.yml up -d
```

### With AMD GPU

```bash
docker-compose -f docker-compose.yml -f docker-compose.amd.yml up -d
```

## Step 4: Access Dashboard

Open your browser to: **http://localhost:3000**

You should see:

- Statistics cards (all showing 0)
- Empty job queue
- Empty results table
- Your wordlists listed

Also check out the Analytics Dashboard at: **http://localhost:3000/analytics**

This shows charts and statistics about:

- Job creation trends
- Success rates
- Dictionary effectiveness
- Average completion times

## Step 5: Add PCAP Files and Dictionaries

### Option A: Web Upload (Recommended)

1. Click the file upload area in the dashboard
2. Upload your `.pcap` files - they'll be stored permanently
3. Upload dictionary files to use for cracking
4. Files appear in their respective management tables

### Option B: Direct File Copy

```bash
# Copy PCAP files (permanent storage)
cp your-handshake.pcap volumes/pcaps/

# Copy dictionary files
cp rockyou.txt volumes/dictionaries/
```

## Step 6: Create Jobs

1. **Select PCAP Files**: Check the box next to files you want to process
2. **Click "Process selected"**: Opens the job creation modal
3. **Choose Dictionaries**: Select which wordlists to try
4. **Click "Run"**: Creates the job and starts processing

## What Happens Next?

AutoPWN will:

1. **Extract ESSID Info**: Scan PCAPs and build network mapping (30 seconds)
2. **Create Job**: Merge selected PCAPs into single `.hc22000` file
3. **Queue**: Job appears in dashboard with "pending" status
4. **Process**: Starts cracking with selected dictionaries
5. **Monitor**: Watch real-time progress, speed, ETA
6. **Results**: Cracked passwords appear with source PCAP information

## Monitoring

### View Logs

```bash
# Backend logs (API + job processing, hashcat output)
docker logs -f autopwn-backend

# Web logs (dashboard errors)
docker logs -f autopwn-web
```

### Check Status

```bash
docker-compose ps
```

### Restart Services

```bash
docker-compose restart
```

## Common First-Time Issues

### Jobs not appearing?

- Check backend logs: `docker logs autopwn-backend`
- Ensure you clicked "Process selected" and created jobs
- Verify `.pcap` files have valid handshakes
- Check database: `docker exec autopwn-postgres psql -U autopwn -d autopwn -c "SELECT * FROM jobs;"`
- Verify `volumes/pcaps/` permissions

### Hashcat not using GPU?

```bash
# Check GPU detection
docker exec autopwn-backend hashcat -I

# For NVIDIA
docker exec autopwn-backend nvidia-smi

# Ensure you used the correct docker-compose file
```

### Dashboard not updating?

- Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
- Check database: `docker exec autopwn-postgres psql -U autopwn -d autopwn -c "\dt"`
- Verify web logs: `docker logs autopwn-web`
- Check if jobs were created: Look in Jobs table in dashboard

### No results after job completes?

- Try different dictionary (larger/more comprehensive)
- Check if PCAP contains valid handshakes
- Verify job status shows "completed" not "failed"
- Review job logs for error messages

## Next Steps

- Read the full [README.md](README.md) for advanced features
- Learn about job management (pause, resume, priority)
- Try the custom wordlist generator
- Check [USAGE.md](USAGE.md) for detailed workflows
- View the [API documentation](API.md) for automation options
- Monitor your progress on the analytics dashboard

## Stopping AutoPWN

```bash
# Stop containers
docker-compose down

# Stop and remove volumes (⚠️ deletes all data)
docker-compose down -v
```

## Get Help

- [GitHub Issues](https://github.com/DoomedRamen/autopwn/issues)
- [Contributing Guide](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)

---

**Ready to crack?** Start with a small wordlist and a known-good handshake to verify everything works!
