# Frontend Dockerfile
FROM node:20-alpine AS build

# Set working directory
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Build the Vite app
COPY . .
RUN npm run build

# Serve the app with a lightweight server
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
