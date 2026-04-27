# Build Stage
FROM node:20-alpine as build

# Set the working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --force

# Copy the rest of the frontend code
COPY . .

# Build the React app using Vite
RUN npm run build

# Production Stage (Serve with a lightweight HTTP server)
FROM node:20-alpine

WORKDIR /app

# Install a simple static file server
RUN npm install -g serve

# Copy the built assets from the build stage
COPY --from=build /app/dist /app/dist

# Expose the port
EXPOSE 5173

# Start the server
CMD ["serve", "-s", "dist", "-l", "5173"]