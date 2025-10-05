FROM node:24-alpine

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/web/package*.json ./packages/web/

# Install dependencies
RUN npm install

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/web ./packages/web

# Build shared package
WORKDIR /app/packages/shared
RUN npm run build

# Build web
WORKDIR /app/packages/web
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
