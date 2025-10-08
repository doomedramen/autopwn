FROM node:24-alpine AS builder

# Install pnpm
RUN corepack enable

# Install dependencies
RUN apk add --no-cache git

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/web/package*.json ./apps/web/

# Initialize git repository for lefthook
RUN git init && git config user.email "test@example.com" && git config user.name "Test User"

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# Build shared package
WORKDIR /app/packages/shared
RUN pnpm run build

# Build web
WORKDIR /app/apps/web
RUN pnpm run build

# Production stage
FROM node:24-alpine AS runner

WORKDIR /app

# Copy standalone output and public files from builder
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./.next/static
COPY --from=builder /app/apps/web/public ./public

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "server.js"]
