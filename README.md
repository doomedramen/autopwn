# AutoPWN

Automated WPA/WPA2 handshake cracker with a web dashboard. Drop `.pcap` files, let AutoPWN handle the rest.

## Features

- **Automated Processing**: Watches input folder for `.pcap` files
- **Sequential Dictionary Attack**: Tries all dictionaries until success
- **Multi-GPU Support**: NVIDIA, AMD, Intel, and CPU modes
- **Real-time Dashboard**: Live job queue, progress, and results
- **Web Interface**: Monitor everything from your browser

## Architecture

```
AutoPWN
├── Worker Service
│   ├── File watcher (chokidar)
│   ├── PCAP to hc22000 converter (hcxpcapngtool)
│   └── Hashcat job processor
├── Web Dashboard (Next.js)
│   ├── Job queue viewer
│   ├── Live statistics
│   └── Results table
└── SQLite Database
```

## Quick Start

### 1. Clone and Setup

```bash
git clone <repo>
cd autopwn
cp .env.example .env
```

### 2. Add Dictionaries

Place your wordlists in `volumes/dictionaries/`:

```bash
cp /path/to/rockyou.txt volumes/dictionaries/
cp /path/to/Super-WPA.gz volumes/dictionaries/
```

### 3. Run with Docker Compose

**CPU Mode** (default):
```bash
docker-compose up -d
```

**NVIDIA GPU**:
```bash
docker-compose -f docker-compose.yml -f docker-compose.nvidia.yml up -d
```

**AMD GPU**:
```bash
docker-compose -f docker-compose.yml -f docker-compose.amd.yml up -d
```

### 4. Access Dashboard

Open http://localhost:3000

### 5. Add PCAP Files

Drop `.pcap` files into `volumes/input/`:

```bash
cp handshake.pcap volumes/input/
```

AutoPWN will:
1. Move file to `intermediate/`
2. Convert to `.hc22000` format
3. Run hashcat against all dictionaries
4. Move to `completed/` (if cracked) or `failed/`

## Configuration

Edit `.env` file:

```bash
# GPU Type: nvidia, amd, intel, cpu
HASHCAT_DEVICE_TYPE=cpu

# Paths (inside container)
DATABASE_PATH=/data/db/autopwn.db
DICTIONARIES_PATH=/data/dictionaries
INPUT_PATH=/data/input
```

## Directory Structure

```
autopwn/
├── volumes/
│   ├── dictionaries/    # Your wordlists
│   ├── input/           # Drop .pcap files here
│   ├── intermediate/    # Processing area
│   ├── completed/       # Successful cracks
│   ├── failed/          # Failed attempts
│   ├── hashes/          # .hc22000 files
│   └── db/              # SQLite database
├── packages/
│   ├── shared/          # Shared TypeScript types
│   ├── worker/          # File watcher + processor
│   └── web/             # Next.js dashboard
└── docker-compose.yml
```

## GPU Support

### NVIDIA

Requirements:
- NVIDIA Docker runtime (`nvidia-docker2`)
- CUDA drivers

```bash
# Install nvidia-docker
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-docker.list
sudo apt-get update && sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker
```

### AMD

Requirements:
- ROCm drivers
- Access to `/dev/kfd` and `/dev/dri`

```bash
# Add user to video group
sudo usermod -a -G video $USER
```

### Intel

Uses OpenCL. Typically works out of the box with Intel OpenCL runtime.

## Dashboard Features

- **Stats Cards**: Total jobs, processing, completed, failed, cracked
- **Job Queue**: Real-time progress, speed, ETA for each job
- **Results Table**: All cracked passwords with ESSID
- **Dictionaries List**: Available wordlists and sizes

Updates automatically every 2-3 seconds.

## Development

### Local Setup

```bash
# Install dependencies
npm install

# Run worker
npm run dev:worker

# Run web (in another terminal)
npm run dev:web
```

### Build

```bash
npm run build
```

## Troubleshooting

### No jobs appearing

- Check file watcher logs: `docker logs autopwn-worker`
- Ensure `.pcap` files are valid
- Check folder permissions

### Hashcat not finding GPU

- Verify GPU support: `docker exec autopwn-worker hashcat -I`
- Check device type in `.env`
- For NVIDIA: `nvidia-smi` should work in container
- For AMD: Check `/dev/dri` and `/dev/kfd` access

### Dashboard not updating

- Check database file exists: `ls volumes/db/`
- Verify web container can read database: `docker logs autopwn-web`

## Stack

- **Worker**: Node.js + TypeScript + chokidar + better-sqlite3
- **Web**: Next.js 14 + Tailwind CSS
- **Tools**: hashcat + hcxpcapngtool
- **Database**: SQLite3

## Security Notice

This tool is for **authorized security testing only**. Only use on networks you own or have explicit permission to test. Unauthorized access to computer networks is illegal.

## License

MIT
