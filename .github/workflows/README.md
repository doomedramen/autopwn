# GitHub Actions Workflows

This directory contains the CI/CD workflows for AutoPWN.

## Docker Deployment Workflow (`docker-deploy.yml`)

### Overview

The Docker deployment workflow builds and publishes Docker images for multiple hardware variants automatically.

### Available Variants

| Variant | Dockerfile | Description | Target Hardware | Size Estimate |
|---------|------------|-------------|-----------------|---------------|
| **CPU** | `docker/Dockerfile.cpu` | CPU-optimized (Debian Slim) | General purpose, testing | ~900MB |
| **NVIDIA** | `docker/Dockerfile.nvidia` | NVIDIA GPU support (CUDA) | NVIDIA GPUs | ~1.5GB |
| **AMD** | `docker/Dockerfile.amd` | AMD GPU support (ROCm) | AMD GPUs | ~1.3GB |
| **Intel** | `docker/Dockerfile.intel` | Intel GPU support (oneAPI) | Intel Arc GPUs | ~1.2GB |

### Build Triggers

The workflow builds images automatically when:

1. **Push to main/master branch** → Builds `main-*` and `latest-*` tags
2. **Push tags (v*.*.*)** → Builds versioned tags (`1.2.3-*`, `1.2-*`, `1-*`)
3. **Pull requests** → Builds PR tags (`pr-123-*`) for testing

### Docker Image Tagging Strategy

#### Variant-Specific Tags

All variant-specific tags include a suffix indicating the hardware type:

```bash
# Development Tags (main branch)
yourusername/autopwn:main-cpu      # CPU variant (default)
yourusername/autopwn:main-nvidia   # NVIDIA GPU variant
yourusername/autopwn:main-amd      # AMD GPU variant
yourusername/autopwn:main-intel    # Intel GPU variant

# Release Tags (versioned releases)
yourusername/autopwn:1.2.3-cpu     # CPU variant
yourusername/autopwn:1.2.3-nvidia  # NVIDIA GPU variant
yourusername/autopwn:1.2.3-amd     # AMD GPU variant
yourusername/autopwn:1.2.3-intel   # Intel GPU variant

# Major/minor versions
yourusername/autopwn:1.2-cpu       # CPU variant
yourusername/autopwn:1-cpu         # CPU variant

# Latest Tags (stable builds)
yourusername/autopwn:latest-cpu    # CPU variant (recommended)
yourusername/autopwn:latest-nvidia # NVIDIA GPU variant
yourusername/autopwn:latest-amd    # AMD GPU variant
yourusername/autopwn:latest-intel  # Intel GPU variant

# Commit-Specific Tags (for reproducibility)
yourusername/autopwn:abc1234-cpu   # CPU variant at commit abc1234
yourusername/autopwn:abc1234-nvidia# NVIDIA variant at commit abc1234
```

#### Default Tags (Backward Compatibility)

For backward compatibility, the CPU variant is also published without variant suffixes:

```bash
# Default tags point to CPU variant
yourusername/autopwn:latest        # → CPU variant
yourusername/autopwn:main          # → CPU variant
yourusername/autopwn:1.2.3         # → CPU variant
yourusername/autopwn:1.2           # → CPU variant
yourusername/autopwn:1             # → CPU variant
yourusername/autopwn:abc1234       # → CPU variant
```

### Build Matrix

All variants are built in parallel using GitHub Actions matrix strategy:

```yaml
strategy:
  matrix:
    variant:
      - name: cpu
        file: docker/Dockerfile.cpu
        platforms: linux/amd64,linux/arm64
      - name: nvidia
        file: docker/Dockerfile.nvidia
        platforms: linux/amd64
      - name: amd
        file: docker/Dockerfile.amd
        platforms: linux/amd64
      - name: intel
        file: docker/Dockerfile.intel
        platforms: linux/amd64
```

### Security & SBOM

- **SBOM Generation**: Software Bill of Materials generated for each variant
- **Security Scanning**: Trivy vulnerability scanning for all variants
- **Artifact Retention**: SBOMs stored as GitHub artifacts for 30 days

### Usage Examples

#### Development Environment
```bash
# Use CPU variant for development
docker pull yourusername/autopwn:latest-cpu
docker run -p 3000:3000 yourusername/autopwn:latest-cpu
```

#### Production with NVIDIA GPU
```bash
# NVIDIA GPU production deployment
docker pull yourusername/autopwn:latest-nvidia
docker run --gpus all -p 3000:3000 yourusername/autopwn:latest-nvidia
```

#### Versioned Deployment
```bash
# Deploy specific version
docker pull yourusername/autopwn:1.2.3-nvidia
docker run --gpus all -p 3000:3000 yourusername/autopwn:1.2.3-nvidia
```

#### Docker Compose
```yaml
services:
  autopwn:
    image: yourusername/autopwn:latest-cpu
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:5432/autopwn
```

For GPU deployments:
```yaml
services:
  autopwn:
    image: yourusername/autopwn:latest-nvidia
    ports:
      - "3000:3000"
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    environment:
      - DATABASE_URL=postgresql://postgres:5432/autopwn
```

### Migration Guide

#### From Old Single Image

If you were using the old single image setup:

1. **No changes needed** for CPU deployments - default tags maintain compatibility
2. **For GPU deployments**, switch to variant-specific tags:
   ```bash
   # Old way (no longer maintained)
   docker pull yourusername/autopwn:latest

   # New way (recommended)
   docker pull yourusername/autopwn:latest-nvidia  # For NVIDIA GPUs
   docker pull yourusername/autopwn:latest-amd     # For AMD GPUs
   docker pull yourusername/autopwn:latest-intel   # For Intel GPUs
   ```

#### Docker Compose Updates

Update your `docker-compose.yml` to use variant tags:

```yaml
# Before
services:
  app:
    image: yourusername/autopwn:latest

# After (CPU)
services:
  app:
    image: yourusername/autopwn:latest-cpu

# After (NVIDIA GPU)
services:
  app:
    image: yourusername/autopwn:latest-nvidia
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

### Build Times

| Variant | Build Time | Platforms |
|---------|------------|-----------|
| CPU | 3-5 minutes | linux/amd64,linux/arm64 |
| NVIDIA | 5-8 minutes | linux/amd64 |
| AMD | 6-10 minutes | linux/amd64 |
| Intel | 5-8 minutes | linux/amd64 |

### Benefits

✅ **Hardware Optimization**: Each variant optimized for specific GPU hardware
✅ **Smaller Images**: CPU variant ~900MB vs previous 1.7GB
✅ **Faster Builds**: 3-5 minutes vs 15-20 minutes
✅ **Multi-Architecture**: CPU variant supports both amd64 and arm64
✅ **Semantic Versioning**: Clear versioning and variant labeling
✅ **Security**: Automated vulnerability scanning for all variants
✅ **SBOM**: Complete software inventory for compliance
✅ **Backward Compatibility**: Existing deployments continue working

### Support

- **CPU Variant**: Recommended for development and general use
- **NVIDIA Variant**: Best performance for NVIDIA GPU acceleration
- **AMD Variant**: Good performance for AMD GPU acceleration
- **Intel Variant**: Moderate performance for Intel Arc GPUs

Choose the variant that matches your hardware configuration for optimal performance.