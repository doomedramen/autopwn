# Docker Setup Guide

## Development Setup

For local development:
```bash
docker-compose up -d
```

## Production Setup

For production deployment:
```bash
# Use production configuration
docker-compose -f docker-compose.prod.yml up -d
```

## Configuration Notes

### Environment Variables
- `PUID=1000` - User ID for file permissions
- `PGID=1000` - Group ID for file permissions
- `TZ=Etc/UTC` - Timezone setting

### Volume Structure
- `./uploads_data` - PCAP and dictionary uploads
- `./jobs_data` - Job processing files
- `postgres_data` - PostgreSQL database data (named volume)

### Production Customization
Update the following in `docker-compose.prod.yml`:
- `BETTER_AUTH_SECRET` - Change to a secure secret
- `NODE_ENV` - Set to 'production' (already configured)

Note: URL configuration is now automatic - no need to set NEXT_PUBLIC_APP_URL or BETTER_AUTH_URL

### Fresh Database Start
To start with a fresh database:
```bash
docker-compose down -v
docker-compose up -d
```

### Container Management
- Containers will automatically restart on failure (`restart: unless-stopped`)
- Container names: `autopwn-app`, `autopwn-postgres`
- Default port: 3000

## GPU Optimization Variants

**Current Implementation**: CPU-only hashcat installation

**Future GPU Support Required**:
For optimal performance, separate Dockerfile variants should be created:

### 🚀 Performance Comparison
**Note**: Actual performance varies significantly based on:
- Hash type (WPA/WPA2 vs other formats)
- GPU model and architecture
- Dictionary size and optimization
- System configuration

**General Performance Tiers** (for WPA/WPA2 cracking):
- **CPU-only**: Baseline performance (varies by CPU)
- **Intel GPU**: Moderate improvement over CPU
- **AMD GPU**: Significant improvement over CPU
- **NVIDIA GPU**: Typically highest performance for GPU cracking

**Real-world testing required** for accurate benchmarks on specific hardware.

### 📋 Future Dockerfile Variants
```bash
# CPU-only (current)
docker build -t doomedramen/autopwn:latest .

# NVIDIA GPU (future)
docker build -f Dockerfile.nvidia -t doomedramen/autopwn:nvidia .

# AMD GPU (future)
docker build -f Dockerfile.amd -t doomedramen/autopwn:amd .

# Intel GPU (future)
docker build -f Dockerfile.intel -t doomedramen/autopwn:intel .

# Multi-GPU (future)
docker build -f Dockerfile.multigpu -t doomedramen/autopwn:multigpu .
```

### 🔧 Requirements for GPU Variants
- **NVIDIA**: NVIDIA drivers, CUDA toolkit, Docker nvidia-runtime
- **AMD**: AMD drivers, ROCm, OpenCL support
- **Intel**: Intel drivers, oneAPI, OpenCL support
- **Multi-GPU**: All drivers + automatic GPU detection

**TODO**: Create GPU-optimized Dockerfile variants for enterprise deployments