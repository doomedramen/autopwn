# Docker Deployment Guide

AutoPWN provides optimized Docker variants for different hardware configurations.

## Quick Start

```bash
# Clone and setup
git clone <repository-url>
cd autopwn
cp .env.docker.example .env

# Edit .env with your configuration
# Required: BETTER_AUTH_SECRET (generate with: openssl rand -base64 32)
# Required: Change POSTGRES_PASSWORD from default

# Choose your variant and start:
docker-compose -f docker-compose.cpu.yml up -d      # CPU (recommended for development)
docker-compose -f docker-compose.nvidia.yml up -d  # NVIDIA GPU
docker-compose -f docker-compose.amd.yml up -d     # AMD GPU
docker-compose -f docker-compose.intel.yml up -d   # Intel GPU

# Access at http://localhost:3000
# Initial credentials:
# Email: superuser@autopwn.local
# Username: superuser
# Password: TestPassword123!
# Change these immediately after first login!
```

## Docker Variants

All variants use Debian/Ubuntu with package manager installation for **faster builds** and **smaller images** (~900MB vs 1.7GB).

| Variant    | Description               | Size   | Build Time | Hardware   |
| ---------- | ------------------------- | ------ | ---------- | ---------- |
| **CPU**    | Development & general use | ~900MB | 3-5 min    | Any        |
| **NVIDIA** | GPU acceleration          | ~1.5GB | 5-8 min    | NVIDIA GPU |
| **AMD**    | GPU acceleration          | ~1.3GB | 6-10 min   | AMD GPU    |
| **Intel**  | GPU acceleration          | ~1.2GB | 5-8 min    | Intel GPU  |

### Performance Comparison

| GPU Type   | Speed (vs CPU) | Typical Use Case              |
| ---------- | -------------- | ----------------------------- |
| **NVIDIA** | 10-100x faster | High-performance cracking     |
| **AMD**    | 5-50x faster   | Good performance cracking     |
| **Intel**  | 2-20x faster   | Moderate performance cracking |
| **CPU**    | Baseline       | Testing, development          |

## Building Variants

```bash
# CPU variant (recommended for development)
docker build -f docker/Dockerfile.cpu -t autopwn:cpu .

# NVIDIA GPU variant
docker build -f docker/Dockerfile.nvidia -t autopwn:nvidia .

# AMD GPU variant
docker build -f docker/Dockerfile.amd -t autopwn:amd .

# Intel GPU variant
docker build -f docker/Dockerfile.intel -t autopwn:intel .
```

## Management Commands

```bash
# View logs
docker-compose -f docker-compose.cpu.yml logs -f

# Stop services
docker-compose -f docker-compose.cpu.yml down

# Restart services
docker-compose -f docker-compose.cpu.yml restart

# Fresh database start
docker-compose -f docker-compose.cpu.yml down -v && docker-compose -f docker-compose.cpu.yml up -d
```

**Note**: Replace `cpu.yml` with your variant file (nvidia.yml, amd.yml, intel.yml) in the commands above.

## Production Configuration

1. **Security**: Change `BETTER_AUTH_SECRET` to secure random value
2. **Database**: Update default PostgreSQL password in docker-compose file
3. **Access**: Change default superuser credentials
4. **Environment**: Set `NODE_ENV=production` in docker-compose file
5. **HTTPS**: Configure reverse proxy for SSL

### Customizing Your Deployment

All configuration options are documented in the docker-compose files:

```yaml
environment:
  - DATABASE_URL=postgresql://autopwn:YOUR_PASSWORD@postgres:5432/autopwn
  - BETTER_AUTH_SECRET=your-super-secret-key-32-chars-long
  - NODE_ENV=production
  - LOG_LEVEL=INFO # ERROR, WARN, INFO, DEBUG, VERBOSE
  - NEXT_PUBLIC_APP_URL=http://your-domain.com
  - BETTER_AUTH_URL=http://your-domain.com
```

### Development Mode

For development, simply change the environment variables:

```yaml
environment:
  - NODE_ENV=development
  - LOG_LEVEL=DEBUG
```

## Environment Variables

| Variable              | Description                                          | Required |
| --------------------- | ---------------------------------------------------- | -------- |
| `DATABASE_URL`        | PostgreSQL connection                                | ✅       |
| `BETTER_AUTH_SECRET`  | Auth secret (32+ chars)                              | ✅       |
| `BETTER_AUTH_URL`     | Base URL for auth                                    |          |
| `NEXT_PUBLIC_APP_URL` | Public app URL                                       |          |
| `LOG_LEVEL`           | Logging verbosity: ERROR, WARN, INFO, DEBUG, VERBOSE |          |

### Logging Levels

- **ERROR**: Only errors (recommended for production troubleshooting)
- **WARN**: Errors and warnings (good for production monitoring)
- **INFO**: General information (default for production)
- **DEBUG**: Detailed debugging information (recommended for development)
- **VERBOSE**: Everything including API calls and data dumps

## Installation Requirements

### NVIDIA GPU Support

```bash
# Install NVIDIA Container Toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker
```

### AMD GPU Support

```bash
# Install ROCm drivers
sudo apt-get update
sudo apt-get install -y rocm-dkms
sudo usermod -a -G video,render $LOGNAME
sudo reboot
```

### Intel GPU Support

```bash
# Install Intel oneAPI
wget -qO - https://repositories.intel.com/gpu/intel-graphics-pub.key.asc | sudo apt-key add -
echo "deb [trusted=yes] https://repositories.intel.com/gpu/ubuntu $(lsb_release -cs) client" | sudo tee /etc/apt/sources.list.d/intel-gpu-$(lsb_release -cs).list
sudo apt-get update
sudo apt-get install -y intel-opencl-icd intel-level-zero-gpu
```

## GPU Support Details

### NVIDIA GPU Variant

- **Base**: `nvidia/cuda:12.0-runtime-ubuntu22.04`
- **Features**: hcxtools + hashcat-nvidia + CUDA
- **Requirements**: NVIDIA drivers, Docker with GPU support
- **Docker Compose Configuration**:
  ```yaml
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
  ```

### AMD GPU Variant

- **Base**: `ubuntu:22.04` + ROCm
- **Features**: hcxtools + hashcat + ROCm + OpenCL
- **Requirements**: AMD GPU, ROCm drivers
- **Docker Compose Configuration**:
  ```yaml
  devices:
    - /dev/dri:/dev/dri
  ```

### Intel GPU Variant

- **Base**: `ubuntu:22.04` + Intel oneAPI
- **Features**: hcxtools + hashcat + Intel oneAPI + OpenCL
- **Requirements**: Intel GPU, oneAPI drivers
- **Docker Compose Configuration**:
  ```yaml
  devices:
    - /dev/dri:/dev/dri
  ```

## Volumes

- `./uploads_data` - PCAP and dictionary uploads
- `./jobs_data` - Job processing files
- `postgres_data` - Database (named volume)

## Benefits of New Approach

✅ **50% Size Reduction**: 1.7GB → ~900MB (CPU)
✅ **5x Faster Builds**: 15-20 min → 3-5 min
✅ **Package Manager**: Easy updates, no compilation
✅ **GPU Variants**: Optimized for each GPU type
✅ **Production Ready**: Stable, tested packages

## Migration from Current Dockerfile

### 1. Update docker-compose.yml

```yaml
services:
  app:
    build:
      context: .
      dockerfile: docker/Dockerfile.cpu # Change this line
    # ... rest of your config
```

### 2. Test CPU variant first

```bash
docker build -f docker/Dockerfile.cpu -t autopwn:cpu .
docker run -p 3000:3000 autopwn:cpu
```

### 3. Switch to GPU variant when ready

```bash
# Example for NVIDIA
docker build -f docker/Dockerfile.nvidia -t autopwn:nvidia .
```

## Tagging Strategy

Images are tagged with variant suffixes when built via GitHub Actions:

### Variant-Specific Tags

```bash
# Development builds
yourusername/autopwn:main-cpu      # CPU variant (default)
yourusername/autopwn:main-nvidia   # NVIDIA GPU variant
yourusername/autopwn:main-amd      # AMD GPU variant
yourusername/autopwn:main-intel    # Intel GPU variant

# Release tags
yourusername/autopwn:1.2.3-cpu     # CPU variant
yourusername/autopwn:1.2.3-nvidia  # NVIDIA GPU variant
yourusername/autopwn:latest-cpu    # CPU variant (recommended)
```

### Default Tags (Backward Compatibility)

For backward compatibility, the CPU variant is also published without variant suffixes:

```bash
yourusername/autopwn:latest        # → CPU variant
yourusername/autopwn:1.2.3         # → CPU variant
```

For complete tagging strategy details, see [.github/workflows/docker-deploy.yml](../.github/workflows/docker-deploy.yml).
