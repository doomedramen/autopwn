# AutoPWN Multi-stage Dockerfile for API and Worker Services
# Supports development, test, and production builds

# Build base image with all dependencies
FROM node:20-alpine AS base
RUN apk add --no-cache \
    curl \
    dumb-init \
    postgresql-client \
    redis

# Install pnpm globally
RUN npm install -g pnpm@10.4.1

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json pnpm-lock.yaml* ./
COPY packages/ui/package*.json ./packages/ui/
COPY packages/eslint-config/package*.json ./packages/eslint-config/
COPY packages/typescript-config/package*.json ./packages/typescript-config/
COPY apps/web/package*.json ./apps/web/
COPY apps/api/package*.json ./apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile --prefer-frozen-lockfile

# Development target
FROM base AS development
ENV NODE_ENV=development

# Copy source code for hot-reloading
COPY . .

# Build workspace packages
RUN pnpm build

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S apiuser -u 1001

# Create upload directory
RUN mkdir -p /app/uploads && chown -R apiuser:nodejs /app/uploads

# Switch to non-root user
USER apiuser

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Start development server with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["pnpm", "dev"]

# Test target
FROM development AS test
ENV NODE_ENV=test

# Install test-specific dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    # Tools for PCAP processing
    tcpdump \
    wireshark-cli

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy test configuration
COPY docker-compose.test.yml ./docker-compose.test.yml

# Build for production testing
RUN pnpm build

# Switch to root for test setup
USER root

# Ensure proper permissions for test files
RUN mkdir -p /app/uploads /app/test-results && \
    chown -R apiuser:nodejs /app

USER apiuser

# Default test command (can be overridden)
CMD ["tail", "-f", "/dev/null"]

# CI target for continuous integration
FROM test AS ci
ENV NODE_ENV=ci

# Additional CI-specific setup
RUN pnpm run build

# Production build target
FROM node:20-alpine AS production
ENV NODE_ENV=production

# Install production dependencies
RUN apk add --no-cache \
    curl \
    dumb-init \
    postgresql-client \
    redis \
    # PCAP processing tools
    tcpdump \
    wireshark-cli

# Install pnpm globally
RUN npm install -g pnpm@10.4.1

WORKDIR /app

# Copy package files
COPY package*.json pnpm-lock.yaml* ./
COPY packages/ui/package*.json ./packages/ui/
COPY packages/eslint-config/package*.json ./packages/eslint-config/
COPY packages/typescript-config/package*.json ./packages/typescript-config/
COPY apps/web/package*.json ./apps/web/
COPY apps/api/package*.json ./apps/api/

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy built application from development stage
COPY --from=development /app/dist ./dist
COPY --from=development /app/packages ./packages

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S apiuser -u 1001

# Create upload directory
RUN mkdir -p /app/uploads && chown -R apiuser:nodejs /app/uploads

# Copy non-changing files first for better Docker layer caching
COPY --chown=apiuser:nodejs apps/api/src ./apps/api/src

# Switch to non-root user
USER apiuser

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Start application with dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]