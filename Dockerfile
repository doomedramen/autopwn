# Use Node.js 20 Alpine as base image
FROM node:20-alpine AS base

# GPU OPTIMIZATION NOTE:
# This Dockerfile builds a CPU-only version of AutoPWN.
#
# Future GPU optimization variants should be created for better performance:
#
# 1. NVIDIA GPU Support (Dockerfile.nvidia):
#    - Base: nvidia/cuda:12.0-runtime-ubuntu22.04
#    - Install: NVIDIA CUDA toolkit, cuDNN
#    - Hashcat: Built with NVIDIA GPU support
#    - Performance: 10-100x faster than CPU
#
# 2. AMD GPU Support (Dockerfile.amd):
#    - Base: ubuntu:22.04
#    - Install: AMD ROCm, OpenCL drivers
#    - Hashcat: Built with AMD GPU support
#    - Performance: 5-50x faster than CPU
#
# 3. Intel GPU Support (Dockerfile.intel):
#    - Base: ubuntu:22.04
#    - Install: Intel oneAPI, OpenCL drivers
#    - Hashcat: Built with Intel GPU support
#    - Performance: 2-20x faster than CPU
#
# 4. Multi-GPU Support (Dockerfile.multigpu):
#    - Combined support for NVIDIA + AMD + Intel
#    - Automatic GPU detection and load balancing
#    - Best performance for enterprise deployments
#
# TODO: Create separate Dockerfile variants for each GPU type
# Users should select appropriate variant based on their hardware

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat curl git postgresql-client
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json pnpm-lock.yaml* ./
RUN \
  if [ -f pnpm-lock.yaml ]; then \
    corepack enable pnpm && pnpm i --frozen-lockfile; \
  elif [ -f package-lock.json ]; then \
    npm ci; \
  elif [ -f yarn.lock ]; then \
    corepack enable yarn && yarn install --frozen-lockfile; \
  else \
    echo "Lockfile not found." && exit 1; \
  fi


# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build arguments
ARG NODE_ENV=production
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG BETTER_AUTH_SECRET=github-action-build-secret-32-chars-long
ARG BETTER_AUTH_URL=http://localhost:3000
ARG DATABASE_URL=postgresql://test:test@localhost:5432/test

# Environment variables for build
ENV NODE_ENV=${NODE_ENV}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
ENV BETTER_AUTH_URL=${BETTER_AUTH_URL}
ENV DATABASE_URL=${DATABASE_URL}

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED=1

RUN \
  if [ -f pnpm-lock.yaml ]; then \
    corepack enable pnpm && pnpm run build; \
  elif [ -f package-lock.json ]; then \
    npm run build; \
  elif [ -f yarn.lock ]; then \
    corepack enable yarn && yarn build; \
  else \
    echo "Lockfile not found." && exit 1; \
  fi

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
ENV NEXT_TELEMETRY_DISABLED=1

# Install postgresql-client and su-exec for user switching
RUN apk add --no-cache postgresql-client su-exec

# Install hcxtools for PCAP analysis and hashcat for password cracking
RUN apk update \
    && apk add --no-cache --virtual .build-deps \
    make gcc git libgcc musl-dev openssl-dev linux-headers curl-dev zlib-dev \
    && cd /tmp \
    && git clone https://github.com/ZerBea/hcxtools.git \
    && cd hcxtools \
    && make \
    && make install \
    && cd / \
    && rm -rf /tmp/hcxtools \
    && apk del .build-deps

# Install hashcat for password cracking (CPU-only version)
# Using a more reliable approach with proper error handling
RUN apk update && apk add --no-cache \
    make gcc git g++ libgcc musl-dev openssl-dev linux-headers curl-dev zlib-dev \
    cblas libgomp ncurses \
    && cd /tmp \
    && git clone --depth=1 https://github.com/hashcat/hashcat.git \
    && cd hashcat \
    && make clean || true \
    && make \
    && make install \
    && mkdir -p /usr/local/share/hashcat/modules \
    && mkdir -p /usr/local/share/hashcat/OpenCL \
    && cp -r deps/* /usr/local/share/hashcat/modules/ 2>/dev/null || true \
    && cp -r OpenCL/* /usr/local/share/hashcat/OpenCL/ 2>/dev/null || true \
    && cd / \
    && rm -rf /tmp/hashcat

# Note: This installs CPU-only hashcat. For GPU support, use future GPU-optimized variants:
# - Dockerfile.nvidia (NVIDIA GPU support)
# - Dockerfile.amd (AMD GPU support)
# - Dockerfile.intel (Intel GPU support)
# - Dockerfile.multigpu (Multi-GPU support)

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy package files and pnpm
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-lock.yaml* ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /usr/local/bin/pnpm /usr/local/bin/pnpm

# Copy entrypoint script
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh

# Copy drizzle config for migrations
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# Copy drizzle migration files
COPY --from=builder /app/src/lib/db/migrations ./src/lib/db/migrations

COPY --from=builder /app/public ./public

# Create and set permissions for uploads and jobs directories
RUN mkdir -p /app/uploads/pcap /app/uploads/dictionary /app/uploads/general /app/jobs
RUN chown -R nextjs:nodejs /app/uploads /app/jobs

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Make entrypoint script executable
RUN chmod +x docker-entrypoint.sh

USER root

EXPOSE 3000

ENV PORT=3000
# set hostname to localhost
ENV HOSTNAME="0.0.0.0"

# Use the entrypoint script that runs migrations before starting the app
ENTRYPOINT ["./docker-entrypoint.sh"]

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["node", "server.js"]