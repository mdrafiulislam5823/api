# Use Node.js 18 Alpine as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies required for yt-dlp
RUN apk update && apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    curl \
    && rm -rf /var/cache/apk/*

# Install yt-dlp with --break-system-packages to avoid virtual environment issues
RUN pip3 install --no-cache-dir --break-system-packages yt-dlp

# Create logs directory
RUN mkdir -p logs

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application source code
COPY src/ ./src/

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of app directory to nodejs user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "src/server.js"]