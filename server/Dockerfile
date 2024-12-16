# Backend Dockerfile
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy the backend code
COPY . .

# Expose port 3000
EXPOSE 3000

CMD ["node", "server.js"]
