#!/bin/bash

# Simple RubricRunner Launcher - Frontend on Port 3001
# This script provides a quick way to launch the application

set -e

echo "🚀 Launching RubricRunner on port 3001..."

# Check if Docker is available
if command -v docker >/dev/null 2>&1 && command -v docker-compose >/dev/null 2>&1; then
    echo "Using Docker..."
    
    # Create override for port 3001
    cat > docker-compose.override.yml << EOF
version: '3.8'

services:
  frontend:
    ports:
      - "3001:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000/api
EOF
    
    # Start services
    docker-compose up -d
    
    echo "✅ Application started!"
    echo "🌐 Frontend: http://localhost:3001"
    echo "🔧 Backend: http://localhost:8000"
    echo "📚 API Docs: http://localhost:8000/docs"
    echo ""
    echo "To stop: docker-compose down"
    
else
    echo "Docker not found. Please install Docker or use the full launch.sh script for local development."
    exit 1
fi
