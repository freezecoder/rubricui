#!/bin/bash

# Simple Full-Stack Launcher for RubricRunner
# Launches both backend (Python/FastAPI) and frontend (Next.js) services

set -e

echo "🚀 Starting RubricRunner Full Stack Application..."

# Function to check if port is in use
port_in_use() {
    lsof -i :$1 >/dev/null 2>&1
}

# Function to kill process on port
kill_port() {
    local port=$1
    local pid=$(lsof -ti :$port 2>/dev/null)
    if [ ! -z "$pid" ]; then
        echo "🛑 Killing process on port $port (PID: $pid)"
        kill $pid 2>/dev/null || true
        sleep 2
    fi
}

# Default ports
BACKEND_PORT=8000
FRONTEND_PORT=3001

# Check if ports are available
if port_in_use $BACKEND_PORT; then
    echo "⚠️  Port $BACKEND_PORT is in use. Killing existing process..."
    kill_port $BACKEND_PORT
fi

if port_in_use $FRONTEND_PORT; then
    echo "⚠️  Port $FRONTEND_PORT is in use. Killing existing process..."
    kill_port $FRONTEND_PORT
fi

# Start Backend
echo "📦 Starting Backend (Python/FastAPI) on port $BACKEND_PORT..."
cd backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📋 Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies if requirements.txt exists
if [ -f "requirements.txt" ]; then
    echo "📋 Installing Python dependencies..."
    pip install -r requirements.txt
fi

# Start backend in background
echo "🌐 Starting FastAPI server..."
uvicorn app.main:app --host 0.0.0.0 --port $BACKEND_PORT --reload &> backend.log &
BACKEND_PID=$!
cd ..

# Wait for backend to start
echo "⏳ Waiting for backend to be ready..."
sleep 5

# Start Frontend
echo "📦 Starting Frontend (Next.js) on port $FRONTEND_PORT..."
cd frontend

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📋 Installing Node.js dependencies..."
    npm install
fi

# Set environment variables
export PORT=$FRONTEND_PORT
export NEXT_PUBLIC_API_URL=http://localhost:$BACKEND_PORT/api

# Start frontend in background
echo "🌐 Starting Next.js development server..."
npm run dev &> frontend.log &
FRONTEND_PID=$!
cd ..

# Wait for frontend to start
echo "⏳ Waiting for frontend to be ready..."
sleep 5

# Display status
echo ""
echo "✅ RubricRunner Full Stack Application is running!"
echo "🌐 Frontend: http://localhost:$FRONTEND_PORT"
echo "🔧 Backend API: http://localhost:$BACKEND_PORT"
echo "📚 API Docs: http://localhost:$BACKEND_PORT/docs"
echo ""
echo "Press Ctrl+C to stop all services"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    echo "✅ Services stopped."
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Wait for user to stop
wait
