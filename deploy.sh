#!/bin/bash

# Pull the latest changes from the 'release' branch
echo "Pulling latest changes from 'release' branch..."
git pull origin release

# Stop the Docker container
echo "Stopping Docker container 'send-later-whatsapp'..."
sudo docker stop send-later-whatsapp

# Remove the Docker container
echo "Removing Docker container 'send-later-whatsapp'..."
sudo docker rm send-later-whatsapp

# Remove the Docker image
echo "Removing Docker image 'wa-send-later-be-api'..."
sudo docker rmi wa-send-later-be-api

# Bring up the Docker Compose services in detached mode
echo "Starting Docker Compose services..."
sudo docker compose up -d

echo "Script execution completed."
