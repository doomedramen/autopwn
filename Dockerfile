# AutoPWN Multi-service Dockerfile
# Supports development, test, and production builds

# Build stage with dependencies and caching
FROM node:20-alpine AS base
RUN apk add --no-cache \
    curl \
    dumb-init \
    postgresql-client \
    redis \
    pnpm

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
COPY apps/api/tsconfig.json ./apps/api/
COPY turbo.json ./

# Install all dependencies
RUN pnpm install --frozen-lockfile --prefer-frozen-lockfile

# Development target
FROM base AS development
ENV NODE_ENV=development

# Copy API source code and pre-built dist
COPY apps/api ./apps/api
COPY packages ./packages

# Install API dependencies
RUN cd apps/api && pnpm install

# Install tsx for TypeScript execution
RUN npm install -g tsx

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S apiuser -u 1001

# Create upload directory and set permissions
RUN mkdir -p /app/uploads /app/.turbo/cache && chown -R apiuser:nodejs /app

# Switch to non-root user
USER apiuser

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Start development server with tsx (no compilation needed)
CMD ["tsx", "watch", "apps/api/src/index.ts"]

# Production build target - use the development target as base
FROM development AS production
ENV NODE_ENV=production

# The user and directories are already created in the development stage
# Just switch to the non-root user
USER apiuser

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Start production server with tsx (same as development but different env)
CMD ["tsx", "apps/api/src/index.ts"]