# AutoPWN (⌐■_■)

Modern WPA/WPA2 handshake cracker with a web dashboard. Upload `.pcap` files, select dictionaries, and run automated password cracking jobs.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-24.x-green.svg)
![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)
[![Docker Worker](https://img.shields.io/docker/v/doomedramen/autopwn-worker?label=worker)](https://hub.docker.com/r/doomedramen/autopwn-worker)
[![Docker Web](https://img.shields.io/docker/v/doomedramen/autopwn-web?label=web)](https://hub.docker.com/r/doomedramen/autopwn-web)

![AutoPWN Dashboard](screenshot.png)

## ⚠️ Legal Disclaimer

**For authorized security testing and educational purposes only.**
- Only use on networks you own or have explicit written permission to test
- Unauthorized access to computer networks is illegal and punishable by law
- Developers assume no liability for misuse of this software

## Quick Start

### Docker Compose (Recommended)

```bash
# Clone and setup
git clone <repo>
cd autopwn
cp .env.example .env

# Add dictionaries
cp /path/to/rockyou.txt volumes/dictionaries/

# Run (CPU mode)
docker-compose up -d

# Access dashboard
open http://localhost:3000
```

### GPU Support

```bash
# NVIDIA GPU
docker-compose -f docker-compose.yml -f docker-compose.nvidia.yml up -d

# AMD GPU
docker-compose -f docker-compose.yml -f docker-compose.amd.yml up -d
```

### Local Development

```bash
# Install dependencies
pnpm install

# Run worker (terminal 1)
pnpm run dev:worker

# Run web dashboard (terminal 2)
pnpm run dev:web

# Access at http://localhost:3000
```

## How It Works

1. **Upload PCAP files** via web interface or copy to `volumes/pcaps/`
2. **Add dictionaries** via web interface or copy to `volumes/dictionaries/`
3. **Create jobs** by selecting PCAP files and dictionaries
4. **Monitor progress** in real-time with speed, ETA, and live logs
5. **View results** with ESSID tracking back to source PCAP files

## Key Features

- **Modern Dashboard** - Real-time job monitoring with progress tracking
- **Batch Processing** - Merge multiple PCAPs into efficient jobs
- **Multi-GPU Support** - NVIDIA, AMD, Intel, and CPU modes
- **ESSID Tracking** - Trace cracked passwords back to source PCAP files
- **Analytics** - Job statistics, success rates, and dictionary performance
- **REST API** - Full automation and integration support

## Configuration

Edit `.env` file:

```bash
# GPU Type: nvidia, amd, intel, cpu
HASHCAT_DEVICE_TYPE=cpu

# Paths (auto-configured for local development)
DATABASE_PATH=/Users/martin/Developer/autopwn/volumes/db/autopwn.db
PCAPS_PATH=/Users/martin/Developer/autopwn/volumes/pcaps
DICTIONARIES_PATH=/Users/martin/Developer/autopwn/volumes/dictionaries
JOBS_PATH=/Users/martin/Developer/autopwn/volumes/jobs
```

## Documentation

- **[API Documentation](API.md)** - REST API endpoints and integration examples
- **[Usage Guide](USAGE.md)** - Detailed usage instructions and best practices
- **[Docker Hub Setup](DOCKER_HUB_SETUP.md)** - CI/CD and automated builds

## Architecture

```
AutoPWN
├── Web Dashboard (Next.js)    # File upload, job creation, monitoring
├── Worker Service             # Job processing, hashcat execution
└── SQLite Database            # Job management, ESSID tracking
```

## Tech Stack

- **Worker**: Node.js 24 + TypeScript + better-sqlite3
- **Web**: Next.js 15 + React 19 + Tailwind CSS
- **Tools**: hashcat + hcxpcapngtool
- **Database**: SQLite3 (WAL mode)

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

