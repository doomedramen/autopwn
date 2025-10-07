# Docker Hub Automated Builds Setup

This guide will help you set up automated Docker image builds and publishing to Docker Hub via GitHub Actions.

## Prerequisites

- GitHub account with your repository
- Docker Hub account
- Repository already pushed to GitHub

## Step 1: Create Docker Hub Account (if needed)

1. Go to https://hub.docker.com/
2. Sign up or log in
3. Note your Docker Hub username (should match `doomedramen`)

## Step 2: Create Docker Hub Repositories

Create two repositories on Docker Hub:

### Repository 1: autopwn-worker
1. Go to https://hub.docker.com/repository/create
2. Name: `autopwn-worker`
3. Visibility: Public (recommended) or Private
4. Description: "AutoPWN Worker - Automated WPA/WPA2 handshake cracker with hashcat"
5. Click "Create"

### Repository 2: autopwn-web
1. Go to https://hub.docker.com/repository/create
2. Name: `autopwn-web`
3. Visibility: Public (recommended) or Private
4. Description: "AutoPWN Web Dashboard - Modern Next.js interface for AutoPWN"
5. Click "Create"

Your images will be available at:
- `docker.io/doomedramen/autopwn-worker`
- `docker.io/doomedramen/autopwn-web`

## Step 3: Create Docker Hub Access Token

1. Go to https://hub.docker.com/settings/security
2. Click "New Access Token"
3. Description: `GitHub Actions - AutoPWN`
4. Access permissions: **Read, Write, Delete**
5. Click "Generate"
6. **⚠️ IMPORTANT**: Copy the token immediately (you can't see it again)

## Step 4: Add Secrets to GitHub Repository

1. Go to your GitHub repository: https://github.com/DoomedRamen/autopwn
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click "New repository secret"

### Add DOCKER_USERNAME
- Name: `DOCKER_USERNAME`
- Value: `doomedramen` (your Docker Hub username)
- Click "Add secret"

### Add DOCKER_PASSWORD
- Name: `DOCKER_PASSWORD`
- Value: `<paste your Docker Hub access token>`
- Click "Add secret"

## Step 5: Verify GitHub Actions Workflow

The workflow file is already created at `.github/workflows/docker-publish.yml`. It will:

### On Push to Main Branch:
- Build both worker and web images
- Tag with `latest` and branch name
- Push to Docker Hub

### On Pull Request:
- Build images (test only, doesn't push)
- Verify everything compiles

### On Release/Tag (v*):
- Build multi-architecture images (amd64, arm64)
- Tag with version numbers (e.g., `v1.0.0`, `1.0`, `1`)
- Tag with `latest`
- Push to Docker Hub
- Update Docker Hub README
- Create release artifact with docker-compose files

## Step 6: Test the Workflow

### Option A: Push to Main
```bash
git add .
git commit -m "Add Docker Hub CI/CD"
git push origin main
```

### Option B: Create a Release
```bash
# Create and push a tag
git tag v1.0.0
git push origin v1.0.0

# Or create a release via GitHub UI
# Go to Releases → Draft new release → Create tag: v1.0.0
```

## Step 7: Monitor the Build

1. Go to https://github.com/DoomedRamen/autopwn/actions
2. Click on the running workflow
3. Watch the build progress
4. Verify both worker and web images build successfully

## Step 8: Verify on Docker Hub

After the workflow completes:

1. Check worker image: https://hub.docker.com/r/doomedramen/autopwn-worker
2. Check web image: https://hub.docker.com/r/doomedramen/autopwn-web
3. Verify tags are present (`latest`, version numbers)

## Using the Published Images

### Pull and run from Docker Hub:

```bash
# Pull images
docker pull doomedramen/autopwn-worker:latest
docker pull doomedramen/autopwn-web:latest

# Or use docker-compose with published images
```

### Update docker-compose.yml (optional):

For production deployments, you can use published images instead of building locally:

```yaml
services:
  worker:
    image: doomedramen/autopwn-worker:latest  # Instead of build: ./apps/worker
    # ... rest of config

  web:
    image: doomedramen/autopwn-web:latest  # Instead of build: ./apps/web
    # ... rest of config
```

## Image Tags Explained

- `latest` - Always points to the most recent main branch build
- `main` - Latest commit on main branch
- `v1.0.0` - Specific release version
- `1.0` - Major.minor version (updates with patches)
- `1` - Major version (updates with minor/patches)
- `main-sha256abc` - Specific commit SHA

## Workflow Triggers

| Event | Action | Tags Created |
|-------|--------|--------------|
| Push to main | Build & Push | `latest`, `main`, `main-<sha>` |
| Pull Request | Build only (test) | None (not pushed) |
| Create tag `v1.2.3` | Build & Push | `latest`, `1.2.3`, `1.2`, `1`, `v1.2.3` |
| Create Release | Build & Push + Artifacts | Same as tag + docker-compose tarball |

## Multi-Architecture Support

Images are built for:
- `linux/amd64` (x86_64 - Intel/AMD CPUs)
- `linux/arm64` (ARM64 - Apple Silicon, Raspberry Pi 4+)

Docker will automatically pull the correct architecture for your system.

## Troubleshooting

### Build fails with "authentication required"
- Verify `DOCKER_USERNAME` and `DOCKER_PASSWORD` secrets are set correctly
- Check that the access token has Read, Write, Delete permissions
- Ensure Docker Hub repositories exist

### Build succeeds but images not on Docker Hub
- Check if it's a PR (PRs don't push)
- Verify the workflow shows "push: true" in the build step
- Check Docker Hub access token hasn't expired

### "repository does not exist" error
- Create the repositories on Docker Hub first (autopwn-worker, autopwn-web)
- Ensure repository names match the workflow file

### Slow builds
- GitHub Actions caches are enabled (`cache-from: type=gha`)
- Subsequent builds will be faster
- Multi-arch builds take longer (~2x time)

## Cost Considerations

### Docker Hub Free Tier:
- Unlimited public repositories ✅
- 200 container pulls per 6 hours (for anonymous users)
- Unlimited pulls for authenticated users
- 1 concurrent build (might need to wait)

### GitHub Actions Free Tier:
- 2,000 minutes/month for private repos
- Unlimited for public repos ✅
- Your builds should take ~10-15 minutes each

## Maintenance

### Update Docker Hub descriptions:
The workflow automatically updates README on releases, but you can also do it manually:

1. Go to Docker Hub repository
2. Click "Edit"
3. Update description/README
4. Save

### Revoke access token:
If compromised, immediately:
1. Go to https://hub.docker.com/settings/security
2. Delete the token
3. Create a new one
4. Update GitHub secret `DOCKER_PASSWORD`

## Next Steps

Once set up:
- Users can pull your images with `docker pull doomedramen/autopwn-worker`
- Include Docker Hub links in your README
- Badge your README with Docker Hub stats

---

**You're all set!** Every push and release will now automatically build and publish to Docker Hub. 🚀
