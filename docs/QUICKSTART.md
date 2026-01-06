# Quick Start Guide

Get AutoPWN running in 5 minutes.

## What is AutoPWN?

AutoPWN is a WiFi security testing platform that automates the process of:
- Uploading PCAP files containing WiFi handshakes
- Extracting networks and authentication data
- Running password cracking jobs (hashcat)
- Managing wordlists and generated dictionaries

## Prerequisites

- Docker 24.0+
- Docker Compose 2.0+
- 2 CPU cores minimum, 4GB RAM minimum

## Installation

### 1. Clone and Configure

```bash
git clone https://github.com/yourusername/autopwn.git
cd autopwn
cp .env.example .env
```

### 2. Generate Secrets

```bash
# Generate secrets
SESSION_SECRET=$(openssl rand -base64 32)
DB_PASSWORD=$(openssl rand -base64 24)

# Update .env
sed -i.bak "s/SESSION_SECRET=.*/SESSION_SECRET=$SESSION_SECRET/" .env
sed -i.bak "s/DATABASE_PASSWORD=.*/DATABASE_PASSWORD=$DB_PASSWORD/" .env
sed -i.bak "s|postgresql://autopwn:.*@db:5432/autopwn|postgresql://autopwn:$DB_PASSWORD@db:5432/autopwn|" .env
rm .env.bak
```

### 3. Start Services

```bash
docker compose up -d
```

Wait 30-60 seconds for all services to start.

### 4. Get Initial Credentials

```bash
docker compose logs backend | grep -A 2 "Initial Superuser"
```

You'll see:
```
Email: admin@crackhouse.local
Password: <random-password>
```

### 5. Access the Application

Open http://localhost:3000 in your browser.

Log in with the credentials from step 4 and change your password immediately.

## Your First Workflow

### Upload a PCAP File

1. Navigate to **Captures** in the sidebar
2. Click **Upload PCAP**
3. Select your WiFi capture file (.pcap, .pcapng)
4. Wait for processing - networks will be automatically extracted

### View Extracted Networks

1. Go to **Networks**
2. You'll see detected WiFi networks with:
   - SSID (network name)
   - BSSID (AP MAC address)
   - Encryption type
   - Handshake/PMKID status

### Create a Cracking Job

1. Select a network from **Networks**
2. Click **Create Job**
3. Choose job type:
   - **Wordlist**: Use an existing dictionary
   - **Rule-based**: Apply transformation rules
   - **Mask attack**: Targeted pattern-based cracking
4. Select or upload a wordlist
5. Click **Start Job**

### Monitor Progress

1. Go to **Jobs** to see all running jobs
2. Click a job to view details
3. Real-time progress updates via WebSocket

## Common Commands

```bash
# View logs
docker compose logs -f backend

# Restart services
docker compose restart

# Stop everything
docker compose down

# Check status
docker compose ps
```

## Troubleshooting

**Can't access the UI?**
- Check all services are running: `docker compose ps`
- All should show "healthy" status

**Forgot admin password?**
```bash
docker compose exec backend npm run reset-superuser
```

**Jobs not processing?**
- Check worker logs: `docker compose logs -f worker`
- Visit /admin/queues (superuser only) to view queue status

**File upload fails?**
- Check file size limit (default 500MB)
- Check disk space: `docker compose exec backend df -h /data`

## Next Steps

- [Full Setup Guide](./SETUP.md) - Advanced configuration
- [API Documentation](./API.md) - REST API reference
- [Deployment Guide](./DEPLOYMENT.md) - Production deployment
- [Architecture](./ARCHITECTURE.md) - System design overview

---

**Last Updated:** 2026-01-03
