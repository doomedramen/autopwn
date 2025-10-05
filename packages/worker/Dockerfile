FROM node:24-bookworm

# Install hashcat and hcxtools
RUN apt-get update && apt-get install -y \
    hashcat \
    hcxtools \
    ocl-icd-opencl-dev \
    pocl-opencl-icd \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/worker/package*.json ./packages/worker/

# Install dependencies
RUN npm install

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/worker ./packages/worker

# Build shared package
WORKDIR /app/packages/shared
RUN npm run build

# Build worker
WORKDIR /app/packages/worker
RUN npm run build

CMD ["npm", "start"]
