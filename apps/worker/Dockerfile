FROM node:24-bookworm

# Install pnpm
RUN corepack enable

# Install hashcat and hcxtools
RUN apt-get update && apt-get install -y \
    hashcat \
    hcxtools \
    ocl-icd-opencl-dev \
    pocl-opencl-icd \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/worker/package*.json ./packages/worker/

# Initialize git repository for lefthook
RUN git init && git config user.email "test@example.com" && git config user.name "Test User"

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/worker ./packages/worker

# Build shared package
WORKDIR /app/packages/shared
RUN pnpm run build

# Build worker
WORKDIR /app/packages/worker
RUN pnpm run build

CMD ["pnpm", "start"]
