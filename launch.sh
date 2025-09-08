#!/bin/bash

# RubricRunner Fullstack Application Launcher
# This script launches the fullstack application with frontend on port 3001

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a port is in use
port_in_use() {
    lsof -i :$1 >/dev/null 2>&1
}

# Function to wait for a service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1
    
    print_status "Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" >/dev/null 2>&1; then
            print_success "$service_name is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "$service_name failed to start within expected time"
    return 1
}

# Function to launch with Docker
launch_docker() {
    print_status "Launching application with Docker..."
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    
    # Create a custom docker-compose override for port 3001
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
    print_status "Starting PostgreSQL database..."
    docker-compose up -d postgres
    
    print_status "Starting backend API..."
    docker-compose up -d backend
    
    print_status "Starting frontend on port 3001..."
    docker-compose up -d frontend
    
    # Wait for services
    wait_for_service "http://localhost:8000/health" "Backend API"
    wait_for_service "http://localhost:3001" "Frontend"
    
    print_success "Application launched successfully!"
    echo ""
    echo "🌐 Frontend: http://localhost:3001"
    echo "🔧 Backend API: http://localhost:8000"
    echo "📚 API Docs: http://localhost:8000/docs"
    echo ""
    echo "To stop the application, run: docker-compose down"
}

# Function to launch locally
launch_local() {
    print_status "Launching application locally..."
    
    # Check prerequisites
    if ! command_exists python3; then
        print_error "Python 3 is required but not installed."
        exit 1
    fi
    
    if ! command_exists node; then
        print_error "Node.js is required but not installed."
        exit 1
    fi
    
    if ! command_exists npm; then
        print_error "npm is required but not installed."
        exit 1
    fi
    
    # Check if ports are available
    if port_in_use 8000; then
        print_warning "Port 8000 is already in use. Backend may already be running."
    fi
    
    if port_in_use 3001; then
        print_error "Port 3001 is already in use. Please free the port and try again."
        exit 1
    fi
    
    # Start backend
    print_status "Starting backend API..."
    cd backend
    
    # Check if virtual environment exists
    if [ ! -d "venv" ]; then
        print_status "Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Install dependencies if requirements.txt exists
    if [ -f "requirements.txt" ]; then
        print_status "Installing Python dependencies..."
        pip install -r requirements.txt
    fi
    
    # Start backend in background
    print_status "Starting backend server on port 8000..."
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
    BACKEND_PID=$!
    cd ..
    
    # Wait for backend to be ready
    wait_for_service "http://localhost:8000/health" "Backend API"
    
    # Start frontend
    print_status "Starting frontend on port 3001..."
    cd frontend
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        print_status "Installing Node.js dependencies..."
        npm install
    fi
    
    # Set environment variable for port 3001
    export PORT=3001
    export NEXT_PUBLIC_API_URL=http://localhost:8000/api
    
    # Start frontend
    npm run dev &
    FRONTEND_PID=$!
    cd ..
    
    # Wait for frontend to be ready
    wait_for_service "http://localhost:3001" "Frontend"
    
    print_success "Application launched successfully!"
    echo ""
    echo "🌐 Frontend: http://localhost:3001"
    echo "🔧 Backend API: http://localhost:8000"
    echo "📚 API Docs: http://localhost:8000/docs"
    echo ""
    echo "Press Ctrl+C to stop all services"
    
    # Function to cleanup on exit
    cleanup() {
        print_status "Stopping services..."
        kill $BACKEND_PID 2>/dev/null || true
        kill $FRONTEND_PID 2>/dev/null || true
        print_success "Services stopped."
        exit 0
    }
    
    # Set trap to cleanup on script exit
    trap cleanup SIGINT SIGTERM
    
    # Wait for user to stop
    wait
}

# Main script logic
main() {
    echo "🚀 RubricRunner Fullstack Application Launcher"
    echo "=============================================="
    echo ""
    
    # Check if Docker is available and user wants to use it
    if command_exists docker && command_exists docker-compose; then
        echo "Choose launch method:"
        echo "1) Docker (recommended)"
        echo "2) Local development"
        echo ""
        read -p "Enter your choice (1 or 2): " choice
        
        case $choice in
            1)
                launch_docker
                ;;
            2)
                launch_local
                ;;
            *)
                print_error "Invalid choice. Please run the script again and choose 1 or 2."
                exit 1
                ;;
        esac
    else
        print_warning "Docker not found. Launching in local development mode..."
        launch_local
    fi
}

# Run main function
main "$@"
