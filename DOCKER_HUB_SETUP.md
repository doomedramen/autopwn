# Docker Hub CI/CD Setup

Automated Docker image builds and publishing via GitHub Actions.

## Quick Setup

### 1. Create Docker Hub Repositories

Create two repositories:
- `autopwn-worker` - "AutoPWN Worker - WPA/WPA2 handshake cracker"
- `autopwn-web` - "AutoPWN Web Dashboard - Next.js interface"

Images will be available at:
- `docker.io/doomedramen/autopwn-worker`
- `docker.io/doomedramen/autopwn-web`

### 2. Create Access Token

1. Go to https://hub.docker.com/settings/security
2. Click "New Access Token"
3. Description: `GitHub Actions - AutoPWN`
4. Permissions: **Read, Write, Delete**
5. Copy the token (can't be shown again)

### 3. Add GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions:

- `DOCKER_USERNAME`: `doomedramen`
- `DOCKER_PASSWORD`: `<your Docker Hub access token>`

### 4. Test Workflow

```bash
# Push to main (builds and pushes)
git push origin main

# Or create release (multi-arch + version tags)
git tag v1.0.0
git push origin v1.0.0
```

Monitor at: https://github.com/DoomedRamen/autopwn/actions

## Workflow Behavior

| Event | Action | Tags Created |
|-------|--------|--------------|
| Push to main | Build & Push | `latest`, `main`, `main-<sha>` |
| Pull Request | Build only (test) | None |
| Tag `v1.2.3` | Build & Push | `latest`, `1.2.3`, `1.2`, `1`, `v1.2.3` |
| Release | Build & Push + Artifacts | Same as tag + docker-compose |

## Multi-Architecture Support

- `linux/amd64` (Intel/AMD)
- `linux/arm64` (Apple Silicon, Raspberry Pi 4+)

Docker automatically pulls the correct architecture.

## Using Published Images

```bash
# Pull images
docker pull doomedramen/autopwn-worker:latest
docker pull doomedramen/autopwn-web:latest

# Or update docker-compose.yml to use images:
services:
  worker:
    image: doomedramen/autopwn-worker:latest
  web:
    image: doomedramen/autopwn-web:latest
```

## Troubleshooting

- **"authentication required"**: Check Docker Hub secrets and permissions
- **"repository does not exist"**: Create repositories first
- **Builds not pushing**: Verify it's not a PR (PRs don't push)
- **Slow builds**: Expected for multi-arch (~2x time), subsequent builds faster with caching

## Maintenance

- **Update descriptions**: Can be done manually on Docker Hub or automatically via releases
- **Revoke token**: Delete and recreate if compromised, update GitHub secret

---

**You're set!** Every push and release automatically builds and publishes to Docker Hub. 🚀
