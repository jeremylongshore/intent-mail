# Multi-stage build for IntentMail MCP Server
FROM node:20-alpine AS builder

# Install build dependencies for native modules (better-sqlite3, keytar)
RUN apk add --no-cache python3 make g++ libsecret-dev

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --ignore-scripts=false

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Production image
FROM node:20-alpine

# Install runtime dependencies for native modules
RUN apk add --no-cache libsecret

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install build deps, production dependencies, then remove build deps
RUN apk add --no-cache --virtual .build-deps python3 make g++ libsecret-dev && \
    npm ci --omit=dev && \
    apk del .build-deps

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Switch to non-root user
USER nodejs

# Expose port for Cloud Run
ENV PORT=8080
EXPOSE 8080

# Health check - verifies the built application exists
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD test -f dist/index.js || exit 1

# Start server
CMD ["node", "dist/index.js"]
