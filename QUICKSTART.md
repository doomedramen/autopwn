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

## Step 5: Add PCAP Files

### Option A: File Upload (Recommended)
1. Click the file upload area in the dashboard
2. Drag and drop your `.pcap` files
3. Watch them appear in the job queue

### Option B: Direct File Drop
```bash
cp your-handshake.pcap volumes/input/
```

## What Happens Next?

AutoPWN will automatically:

1. **Convert**: PCAP → `.hc22000` format (30 seconds)
2. **Queue**: Job appears in dashboard with "pending" status
3. **Process**: Starts cracking with first dictionary
4. **Monitor**: Watch real-time progress, speed, ETA
5. **Results**: Cracked passwords appear in results table

## Monitoring

### View Logs
```bash
# Worker logs (file processing, hashcat output)
docker logs -f autopwn-worker

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
- Check file watcher: `docker logs autopwn-worker`
- Ensure `.pcap` files have valid handshakes
- Verify `volumes/input/` permissions

### Hashcat not using GPU?
```bash
# Check GPU detection
docker exec autopwn-worker hashcat -I

# For NVIDIA
docker exec autopwn-worker nvidia-smi

# Ensure you used the correct docker-compose file
```

### Dashboard not updating?
- Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
- Check database: `ls -lh volumes/db/autopwn.db`
- Verify web logs: `docker logs autopwn-web`

## Next Steps

- Read the full [README.md](README.md) for advanced features
- Learn about job management (pause, resume, priority)
- Try the custom wordlist generator
- Check [USAGE.md](USAGE.md) for detailed workflows

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
