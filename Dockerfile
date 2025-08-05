FROM node:22.5-slim

# Install pm2 globally - DON'T REMOVE IT
RUN npm install -g pm2

# Create app directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

RUN npm i

# Install app dependencies
RUN npm ci

# Bundle app source
COPY . .

# Build the TypeScript files
RUN npm run build

# Expose port 8080
EXPOSE 8080

# Start the app
CMD npm run start
