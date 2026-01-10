FROM node:18-slim

WORKDIR /app

# Install required packages
RUN apt-get update && apt-get install -y \
    tmux \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY server.js .
COPY public/ ./public/

# Create data directory
RUN mkdir -p /app/data

# Environment variables
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server.js"]
