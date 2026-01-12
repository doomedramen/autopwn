# Multi-stage Dockerfile for Hono API with tsx
# Stage 1: Dependencies
FROM node:25-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace root files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy all package.json files for workspace dependencies
COPY apps/api/package.json ./apps/api/
COPY packages/ui/package.json ./packages/ui/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json ./packages/eslint-config/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --filter=@crackhouse/api... --prod

# Stage 2: Runner
FROM node:25-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 hono

# Install hashcat (required for password cracking functionality)
RUN apk add --no-cache hashcat

# Install pnpm (needed for tsx at runtime)
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

# Copy source code (we use tsx at runtime, no build needed)
COPY apps/api/src ./apps/api/src
COPY apps/api/package.json ./apps/api/
COPY apps/api/tsconfig.json ./apps/api/
COPY package.json pnpm-lock.yaml ./

# Create temp directories for file uploads and processing
RUN mkdir -p /app/temp/uploads /app/temp/dictionaries /app/temp/captures /app/temp/hashcat && \
    chown -R hono:nodejs /app/temp

# Set correct permissions
RUN chown -R hono:nodejs /app

# Switch to non-root user
USER hono

# Expose port
EXPOSE 3001

ENV PORT=3001
ENV HOST="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Start the application using tsx
WORKDIR /app/apps/api
CMD ["pnpm", "start"]
