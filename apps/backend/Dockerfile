FROM node:24-bookworm

# Install pnpm
RUN corepack enable

# Install system dependencies
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
COPY apps/backend/package*.json ./apps/backend/

# Initialize git repository for lefthook
RUN git init && git config user.email "test@example.com" && git config user.name "Test User"

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend

# Build shared package
WORKDIR /app/packages/shared
RUN pnpm run build

# Build backend
WORKDIR /app/apps/backend
RUN pnpm run build

EXPOSE 3001

CMD ["pnpm", "start"]