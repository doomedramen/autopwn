FROM node:24-alpine

# Install pnpm
RUN corepack enable

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++ git

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

EXPOSE 3000

CMD ["pnpm", "start"]
