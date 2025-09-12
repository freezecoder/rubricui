# Domino ODSL Installation Guide for Targetminer Rubrics

This guide provides step-by-step instructions for deploying the Targetminer Rubrics fullstack application on Domino ODSL without Docker, using nginx as a reverse proxy to serve both frontend and backend on a single machine.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Dockerfile Instructions for Domino Environment](#dockerfile-instructions-for-domino-environment)
3. [System Requirements](#system-requirements)
4. [Installation Overview](#installation-overview)
5. [Step 1: Environment Setup](#step-1-environment-setup)
6. [Step 2: Backend Installation](#step-2-backend-installation)
7. [Step 3: Frontend Installation](#step-3-frontend-installation)
8. [Step 4: Nginx Configuration](#step-4-nginx-configuration)
9. [Step 5: Application Startup Script](#step-5-application-startup-script)
10. [Step 6: Service Management](#step-6-service-management)
11. [Step 7: Verification and Testing](#step-7-verification-and-testing)
12. [Troubleshooting](#troubleshooting)
13. [Maintenance and Updates](#maintenance-and-updates)

## Prerequisites

- Domino ODSL environment with sudo access
- Python 3.11+ installed
- **Node.js 18+ and npm installed** (Next.js 15.5.2 requires Node.js 18+)
- nginx installed and configured
- Basic knowledge of Linux system administration

### Node.js Version Check and Upgrade

Before proceeding, verify your Node.js version:
```bash
node --version
```

If you have Node.js version 12 or older, you must upgrade to Node.js 18+:

```bash
# Install NVM (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# Install and use Node.js 18 LTS (required for Next.js 15.5.2)
nvm install 18.20.4
nvm use 18.20.4
nvm alias default 18.20.4

# Verify installation
node --version  # Should show v18.20.4 or higher
npm --version   # Should show 10.x.x or higher
```

## Dockerfile Instructions for Domino Environment

If you are extending the `quay.io/domino/domino-standard-environment:ubuntu22-py3.10-r4.4-domino5.11-standard` base image, add the following instructions to your Dockerfile to install the required dependencies:

```dockerfile
# Extend the Domino standard environment
FROM quay.io/domino/domino-standard-environment:ubuntu22-py3.10-r4.4-domino5.11-standard

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install NVM (Node Version Manager)
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Set up NVM environment
ENV NVM_DIR="/root/.nvm"
ENV PATH="$NVM_DIR/versions/node/v18.20.4/bin:$PATH"

# Install Node.js 18.20.4 LTS and npm (required for Next.js 15.5.2)
RUN . "$NVM_DIR/nvm.sh" && \
    nvm install 18.20.4 && \
    nvm use 18.20.4 && \
    nvm alias default 18.20.4 && \
    npm install -g npm@latest

# Verify installations
RUN node --version && npm --version && echo "Node.js and npm versions verified" && \
    echo "Expected: Node.js v18.20.4, npm 10.x.x"

# Set working directory
WORKDIR /mnt/apps/targetminer-rubrics

# Copy application files
COPY . .

# Install Python dependencies
RUN pip install --upgrade pip && \
    pip install -r backend/requirements.txt && \
    pip install gunicorn

# Install Node.js dependencies and build frontend (Next.js 15.5.2)
RUN cd frontend && \
    npm install && \
    npx next --version && \
    npm run build && \
    echo "Frontend build completed successfully with Next.js 15.5.2"

# Create necessary directories
RUN mkdir -p logs scripts nginx-configs

# Set permissions
RUN chmod +x scripts/*.sh

# Expose ports
EXPOSE 80 8000 3001

# Default command
CMD ["/mnt/apps/targetminer-rubrics/scripts/start_app.sh"]
```

### Alternative Dockerfile with Multi-stage Build

For a more optimized production build, you can use a multi-stage approach:

```dockerfile
# Build stage
FROM quay.io/domino/domino-standard-environment:ubuntu22-py3.10-r4.4-domino5.11-standard as builder

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install NVM and Node.js 18.20.4 (required for Next.js 15.5.2)
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
ENV NVM_DIR="/root/.nvm"
ENV PATH="$NVM_DIR/versions/node/v18.20.4/bin:$PATH"

RUN . "$NVM_DIR/nvm.sh" && \
    nvm install 18.20.4 && \
    nvm use 18.20.4 && \
    nvm alias default 18.20.4 && \
    npm install -g npm@latest && \
    echo "Node.js 18.20.4 and npm installed for build stage"

# Build frontend (Next.js 15.5.2)
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --only=production
COPY frontend/ ./
RUN npm run build && echo "Frontend build completed in build stage"

# Production stage
FROM quay.io/domino/domino-standard-environment:ubuntu22-py3.10-r4.4-domino5.11-standard

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    nginx \
    && rm -rf /var/lib/apt/lists/*

# Install NVM and Node.js 18.20.4 for runtime (required for Next.js 15.5.2)
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
ENV NVM_DIR="/root/.nvm"
ENV PATH="$NVM_DIR/versions/node/v18.20.4/bin:$PATH"

RUN . "$NVM_DIR/nvm.sh" && \
    nvm install 18.20.4 && \
    nvm use 18.20.4 && \
    nvm alias default 18.20.4 && \
    echo "Node.js 18.20.4 installed for runtime stage"

# Copy built frontend from builder stage
COPY --from=builder /app/frontend/.next /mnt/apps/targetminer-rubrics/frontend/.next
COPY --from=builder /app/frontend/public /mnt/apps/targetminer-rubrics/frontend/public
COPY --from=builder /app/frontend/package*.json /mnt/apps/targetminer-rubrics/frontend/

# Copy backend and other files
COPY backend/ /mnt/apps/targetminer-rubrics/backend/
COPY scripts/ /mnt/apps/targetminer-rubrics/scripts/
COPY nginx-configs/ /mnt/apps/targetminer-rubrics/nginx-configs/

# Install Python dependencies
RUN pip install --upgrade pip && \
    pip install -r /mnt/apps/targetminer-rubrics/backend/requirements.txt && \
    pip install gunicorn

# Install frontend runtime dependencies
RUN cd /mnt/apps/targetminer-rubrics/frontend && npm ci --only=production

# Create necessary directories
RUN mkdir -p /mnt/apps/targetminer-rubrics/logs

# Set permissions
RUN chmod +x /mnt/apps/targetminer-rubrics/scripts/*.sh

# Expose ports
EXPOSE 80 8000 3001

# Set working directory
WORKDIR /mnt/apps/targetminer-rubrics

# Default command
CMD ["/mnt/apps/targetminer-rubrics/scripts/start_app.sh"]
```

## System Requirements

### Minimum Requirements
- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 10GB free space
- **Network**: Ports 80, 443, 8000, 3001 available

### Recommended Requirements
- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Storage**: 20GB+ free space
- **Network**: SSL certificate for HTTPS

## Installation Overview

The installation process involves:
1. Setting up the application environment
2. Installing and configuring the Python backend (FastAPI)
3. Installing and configuring the Next.js frontend
4. Configuring nginx as a reverse proxy
5. Creating startup scripts for service management
6. Setting up systemd services for automatic startup

## Step 1: Environment Setup

### 1.1 Create Application Directory

```bash
# Create main application directory
sudo mkdir -p /mnt/apps/targetminer-rubrics
sudo chown $USER:$USER /mnt/apps/targetminer-rubrics
cd /mnt/apps/targetminer-rubrics

# Create subdirectories
mkdir -p {backend,frontend,logs,scripts,nginx-configs}
```

### 1.2 Clone Repository

```bash
# Clone the repository (replace with your actual repository URL)
git clone <your-repository-url> .

# Or if you have the code locally, copy it
# cp -r /path/to/your/targetminer-rubrics/* /mnt/apps/targetminer-rubrics/
```

### 1.3 Set Up Environment Variables

```bash
# Create environment file for backend
cat > backend/.env << EOF
# Database Configuration
DATABASE_URL=sqlite:///./rubrics.db
RESULT_DATABASE_URL=sqlite:///./rubric_result.db

# Security
SECRET_KEY=your-secret-key-here-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Application Settings
DEBUG=False
LOG_LEVEL=INFO
EOF

# Create environment file for frontend
cat > frontend/.env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost/api
NODE_ENV=production
EOF
```

## Step 2: Backend Installation

### 2.1 Install Python Dependencies

```bash
cd /mnt/apps/targetminer-rubrics/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt

# Install additional production dependencies
pip install gunicorn
```

### 2.2 Initialize Database

```bash
# Activate virtual environment
source venv/bin/activate

# Initialize database
python scripts/init_db.py

# Load example data
python scripts/load_example_data.py

# Create admin user (optional)
python scripts/create_admin_user.py
```

### 2.3 Create Backend Startup Script

```bash
cat > /mnt/apps/targetminer-rubrics/scripts/start_backend.sh << 'EOF'
#!/bin/bash

# Backend startup script for Targetminer Rubrics
set -e

APP_DIR="/mnt/apps/targetminer-rubrics"
BACKEND_DIR="$APP_DIR/backend"
LOG_DIR="$APP_DIR/logs"
PID_FILE="$LOG_DIR/backend.pid"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Change to backend directory
cd "$BACKEND_DIR"

# Activate virtual environment
source venv/bin/activate

# Set environment variables
export PYTHONPATH="$BACKEND_DIR"
export DATABASE_URL="sqlite:///./rubrics.db"
export RESULT_DATABASE_URL="sqlite:///./rubric_result.db"

# Start the application with gunicorn
echo "Starting Targetminer Rubrics Backend..."
gunicorn app.main:app \
    --bind 127.0.0.1:8000 \
    --workers 4 \
    --worker-class uvicorn.workers.UvicornWorker \
    --access-logfile "$LOG_DIR/backend_access.log" \
    --error-logfile "$LOG_DIR/backend_error.log" \
    --log-level info \
    --pid "$PID_FILE" \
    --daemon

echo "Backend started successfully. PID: $(cat $PID_FILE)"
EOF

chmod +x /mnt/apps/targetminer-rubrics/scripts/start_backend.sh
```

### 2.4 Create Backend Stop Script

```bash
cat > /mnt/apps/targetminer-rubrics/scripts/stop_backend.sh << 'EOF'
#!/bin/bash

# Backend stop script for Targetminer Rubrics
set -e

LOG_DIR="/mnt/apps/targetminer-rubrics/logs"
PID_FILE="$LOG_DIR/backend.pid"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    echo "Stopping backend (PID: $PID)..."
    
    if kill -0 "$PID" 2>/dev/null; then
        kill "$PID"
        sleep 2
        
        # Force kill if still running
        if kill -0 "$PID" 2>/dev/null; then
            echo "Force killing backend..."
            kill -9 "$PID"
        fi
        
        echo "Backend stopped successfully."
    else
        echo "Backend process not found."
    fi
    
    rm -f "$PID_FILE"
else
    echo "Backend PID file not found. Backend may not be running."
fi
EOF

chmod +x /mnt/apps/targetminer-rubrics/scripts/stop_backend.sh
```

## Step 3: Frontend Installation

### 3.1 Install Node.js Dependencies

```bash
cd /mnt/apps/targetminer-rubrics/frontend

# Check Node.js and npm versions
node --version
npm --version

# Clean install dependencies
rm -rf node_modules package-lock.json
npm cache clean --force
npm install

# Verify Next.js is installed and check version
ls -la node_modules/.bin/next
npx next --version  # Should show 15.5.2

# Build the application for production
npm run build
```

#### Troubleshooting Frontend Build Issues

If you encounter "next: not found" errors:

```bash
# Option 1: Use npx to run next
npx next build --turbopack

# Option 2: Install Next.js globally
npm install -g next@15.5.2
npm run build

# Option 3: Use yarn instead of npm
npm install -g yarn
yarn install
yarn build

# Option 4: Check Node.js version (requires Node.js 18+ for Next.js 15.5.2)
node --version
# If version is too old, install nvm and use Node.js 18.20.4
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18.20.4
nvm use 18.20.4
```

### 3.2 Create Frontend Startup Script

```bash
cat > /mnt/apps/targetminer-rubrics/scripts/start_frontend.sh << 'EOF'
#!/bin/bash

# Frontend startup script for Targetminer Rubrics
set -e

APP_DIR="/mnt/apps/targetminer-rubrics"
FRONTEND_DIR="$APP_DIR/frontend"
LOG_DIR="$APP_DIR/logs"
PID_FILE="$LOG_DIR/frontend.pid"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Change to frontend directory
cd "$FRONTEND_DIR"

# Set environment variables
export PORT=3001
export NODE_ENV=production
export NEXT_PUBLIC_API_URL=http://localhost/api

# Start the application
echo "Starting Targetminer Rubrics Frontend..."
nohup npm start > "$LOG_DIR/frontend.log" 2>&1 &
echo $! > "$PID_FILE"

echo "Frontend started successfully. PID: $(cat $PID_FILE)"
EOF

chmod +x /mnt/apps/targetminer-rubrics/scripts/start_frontend.sh
```

### 3.3 Create Frontend Stop Script

```bash
cat > /mnt/apps/targetminer-rubrics/scripts/stop_frontend.sh << 'EOF'
#!/bin/bash

# Frontend stop script for Targetminer Rubrics
set -e

LOG_DIR="/mnt/apps/targetminer-rubrics/logs"
PID_FILE="$LOG_DIR/frontend.pid"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    echo "Stopping frontend (PID: $PID)..."
    
    if kill -0 "$PID" 2>/dev/null; then
        kill "$PID"
        sleep 2
        
        # Force kill if still running
        if kill -0 "$PID" 2>/dev/null; then
            echo "Force killing frontend..."
            kill -9 "$PID"
        fi
        
        echo "Frontend stopped successfully."
    else
        echo "Frontend process not found."
    fi
    
    rm -f "$PID_FILE"
else
    echo "Frontend PID file not found. Frontend may not be running."
fi
EOF

chmod +x /mnt/apps/targetminer-rubrics/scripts/stop_frontend.sh
```

## Step 4: Nginx Configuration

### 4.1 Install Nginx (if not already installed)

```bash
# On Ubuntu/Debian
sudo apt update
sudo apt install nginx

# On CentOS/RHEL
sudo yum install nginx
# or
sudo dnf install nginx
```

### 4.2 Create Nginx Configuration

```bash
cat > /mnt/apps/targetminer-rubrics/nginx-configs/targetminer-rubrics.conf << 'EOF'
# Targetminer Rubrics Nginx Configuration
server {
    listen 80;
    server_name localhost;  # Replace with your domain name
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # Client max body size for file uploads
    client_max_body_size 100M;
    
    # API routes - proxy to backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://127.0.0.1:8000/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Frontend static files and Next.js routes
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Error pages
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}

# Optional: HTTPS configuration (uncomment and configure if you have SSL certificates)
# server {
#     listen 443 ssl http2;
#     server_name your-domain.com;
#     
#     ssl_certificate /path/to/your/certificate.crt;
#     ssl_certificate_key /path/to/your/private.key;
#     
#     # SSL configuration
#     ssl_protocols TLSv1.2 TLSv1.3;
#     ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
#     ssl_prefer_server_ciphers off;
#     ssl_session_cache shared:SSL:10m;
#     ssl_session_timeout 10m;
#     
#     # Include the same location blocks as above
#     include /mnt/apps/targetminer-rubrics/nginx-configs/targetminer-rubrics-locations.conf;
# }
EOF
```

### 4.3 Create Location Configuration (for HTTPS)

```bash
cat > /mnt/apps/targetminer-rubrics/nginx-configs/targetminer-rubrics-locations.conf << 'EOF'
# Location blocks for HTTPS configuration
# Include this file in your HTTPS server block

# Security headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

# Gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_proxied expired no-cache no-store private must-revalidate auth;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

# Client max body size for file uploads
client_max_body_size 100M;

# API routes - proxy to backend
location /api/ {
    proxy_pass http://127.0.0.1:8000/api/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    proxy_read_timeout 300s;
    proxy_connect_timeout 75s;
}

# Health check endpoint
location /health {
    proxy_pass http://127.0.0.1:8000/health;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Frontend static files and Next.js routes
location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    proxy_read_timeout 300s;
    proxy_connect_timeout 75s;
}

# Static files caching
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    expires 1y;
    add_header Cache-Control "public, immutable";
}
EOF
```

### 4.4 Install Nginx Configuration

```bash
# Copy configuration to nginx sites-available
sudo cp /mnt/apps/targetminer-rubrics/nginx-configs/targetminer-rubrics.conf /etc/nginx/sites-available/

# Create symbolic link to sites-enabled
sudo ln -sf /etc/nginx/sites-available/targetminer-rubrics.conf /etc/nginx/sites-enabled/

# Remove default nginx site (optional)
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t

# If test passes, reload nginx
sudo systemctl reload nginx
```

## Step 5: Application Startup Script

### 5.1 Create Master Startup Script

```bash
cat > /mnt/apps/targetminer-rubrics/scripts/start_app.sh << 'EOF'
#!/bin/bash

# Master startup script for Targetminer Rubrics
set -e

APP_DIR="/mnt/apps/targetminer-rubrics"
SCRIPTS_DIR="$APP_DIR/scripts"
LOG_DIR="$APP_DIR/logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Create log directory
mkdir -p "$LOG_DIR"

print_status "Starting Targetminer Rubrics Application..."

# Check if services are already running
if port_in_use 8000; then
    print_warning "Backend port 8000 is already in use. Stopping existing service..."
    "$SCRIPTS_DIR/stop_backend.sh"
fi

if port_in_use 3001; then
    print_warning "Frontend port 3001 is already in use. Stopping existing service..."
    "$SCRIPTS_DIR/stop_frontend.sh"
fi

# Start backend
print_status "Starting backend service..."
"$SCRIPTS_DIR/start_backend.sh"

# Wait for backend to be ready
wait_for_service "http://127.0.0.1:8000/health" "Backend API"

# Start frontend
print_status "Starting frontend service..."
"$SCRIPTS_DIR/start_frontend.sh"

# Wait for frontend to be ready
wait_for_service "http://127.0.0.1:3001" "Frontend"

print_success "Targetminer Rubrics Application started successfully!"
echo ""
echo "🌐 Application URL: http://localhost"
echo "🔧 Backend API: http://localhost/api"
echo "📚 API Documentation: http://localhost/api/docs"
echo "💊 Health Check: http://localhost/health"
echo ""
echo "Logs are available in: $LOG_DIR"
echo "Backend logs: $LOG_DIR/backend_*.log"
echo "Frontend logs: $LOG_DIR/frontend.log"
echo ""
echo "To stop the application, run: $SCRIPTS_DIR/stop_app.sh"
EOF

chmod +x /mnt/apps/targetminer-rubrics/scripts/start_app.sh
```

### 5.2 Create Master Stop Script

```bash
cat > /mnt/apps/targetminer-rubrics/scripts/stop_app.sh << 'EOF'
#!/bin/bash

# Master stop script for Targetminer Rubrics
set -e

APP_DIR="/mnt/apps/targetminer-rubrics"
SCRIPTS_DIR="$APP_DIR/scripts"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_status "Stopping Targetminer Rubrics Application..."

# Stop frontend
print_status "Stopping frontend service..."
"$SCRIPTS_DIR/stop_frontend.sh"

# Stop backend
print_status "Stopping backend service..."
"$SCRIPTS_DIR/stop_backend.sh"

print_success "Targetminer Rubrics Application stopped successfully!"
EOF

chmod +x /mnt/apps/targetminer-rubrics/scripts/stop_app.sh
```

### 5.3 Create Status Check Script

```bash
cat > /mnt/apps/targetminer-rubrics/scripts/status_app.sh << 'EOF'
#!/bin/bash

# Status check script for Targetminer Rubrics
set -e

APP_DIR="/mnt/apps/targetminer-rubrics"
LOG_DIR="$APP_DIR/logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to check if a port is in use
port_in_use() {
    lsof -i :$1 >/dev/null 2>&1
}

# Function to check service health
check_service_health() {
    local url=$1
    local service_name=$2
    
    if curl -s "$url" >/dev/null 2>&1; then
        print_success "$service_name is healthy"
        return 0
    else
        print_error "$service_name is not responding"
        return 1
    fi
}

echo "🔍 Targetminer Rubrics Application Status"
echo "=========================================="
echo ""

# Check backend
if port_in_use 8000; then
    print_success "Backend is running on port 8000"
    check_service_health "http://127.0.0.1:8000/health" "Backend API"
else
    print_error "Backend is not running on port 8000"
fi

echo ""

# Check frontend
if port_in_use 3001; then
    print_success "Frontend is running on port 3001"
    check_service_health "http://127.0.0.1:3001" "Frontend"
else
    print_error "Frontend is not running on port 3001"
fi

echo ""

# Check nginx
if systemctl is-active --quiet nginx; then
    print_success "Nginx is running"
else
    print_error "Nginx is not running"
fi

echo ""

# Check PID files
if [ -f "$LOG_DIR/backend.pid" ]; then
    BACKEND_PID=$(cat "$LOG_DIR/backend.pid")
    if kill -0 "$BACKEND_PID" 2>/dev/null; then
        print_success "Backend PID file exists and process is running (PID: $BACKEND_PID)"
    else
        print_warning "Backend PID file exists but process is not running (PID: $BACKEND_PID)"
    fi
else
    print_warning "Backend PID file not found"
fi

if [ -f "$LOG_DIR/frontend.pid" ]; then
    FRONTEND_PID=$(cat "$LOG_DIR/frontend.pid")
    if kill -0 "$FRONTEND_PID" 2>/dev/null; then
        print_success "Frontend PID file exists and process is running (PID: $FRONTEND_PID)"
    else
        print_warning "Frontend PID file exists but process is not running (PID: $FRONTEND_PID)"
    fi
else
    print_warning "Frontend PID file not found"
fi

echo ""
echo "📊 Application URLs:"
echo "  🌐 Main Application: http://localhost"
echo "  🔧 Backend API: http://localhost/api"
echo "  📚 API Documentation: http://localhost/api/docs"
echo "  💊 Health Check: http://localhost/health"
echo ""
echo "📁 Log Files:"
echo "  Backend: $LOG_DIR/backend_*.log"
echo "  Frontend: $LOG_DIR/frontend.log"
echo "  Nginx: /var/log/nginx/access.log, /var/log/nginx/error.log"
EOF

chmod +x /mnt/apps/targetminer-rubrics/scripts/status_app.sh
```

## Step 6: Service Management

### 6.1 Create Systemd Service Files

```bash
# Create systemd service for the application
sudo tee /etc/systemd/system/targetminer-rubrics.service > /dev/null << 'EOF'
[Unit]
Description=Targetminer Rubrics Fullstack Application
After=network.target nginx.service
Wants=nginx.service

[Service]
Type=forking
User=root
Group=root
WorkingDirectory=/mnt/apps/targetminer-rubrics
ExecStart=/mnt/apps/targetminer-rubrics/scripts/start_app.sh
ExecStop=/mnt/apps/targetminer-rubrics/scripts/stop_app.sh
ExecReload=/mnt/apps/targetminer-rubrics/scripts/stop_app.sh && /mnt/apps/targetminer-rubrics/scripts/start_app.sh
PIDFile=/mnt/apps/targetminer-rubrics/logs/backend.pid
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable the service
sudo systemctl daemon-reload
sudo systemctl enable targetminer-rubrics.service
```

### 6.2 Create Service Management Scripts

```bash
# Create service management script
cat > /mnt/apps/targetminer-rubrics/scripts/manage_service.sh << 'EOF'
#!/bin/bash

# Service management script for Targetminer Rubrics
set -e

SERVICE_NAME="targetminer-rubrics"

case "$1" in
    start)
        echo "Starting $SERVICE_NAME service..."
        sudo systemctl start $SERVICE_NAME
        ;;
    stop)
        echo "Stopping $SERVICE_NAME service..."
        sudo systemctl stop $SERVICE_NAME
        ;;
    restart)
        echo "Restarting $SERVICE_NAME service..."
        sudo systemctl restart $SERVICE_NAME
        ;;
    status)
        echo "Checking $SERVICE_NAME service status..."
        sudo systemctl status $SERVICE_NAME
        ;;
    enable)
        echo "Enabling $SERVICE_NAME service..."
        sudo systemctl enable $SERVICE_NAME
        ;;
    disable)
        echo "Disabling $SERVICE_NAME service..."
        sudo systemctl disable $SERVICE_NAME
        ;;
    logs)
        echo "Showing $SERVICE_NAME service logs..."
        sudo journalctl -u $SERVICE_NAME -f
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|enable|disable|logs}"
        echo ""
        echo "Commands:"
        echo "  start   - Start the service"
        echo "  stop    - Stop the service"
        echo "  restart - Restart the service"
        echo "  status  - Show service status"
        echo "  enable  - Enable service to start on boot"
        echo "  disable - Disable service from starting on boot"
        echo "  logs    - Show service logs (follow mode)"
        exit 1
        ;;
esac
EOF

chmod +x /mnt/apps/targetminer-rubrics/scripts/manage_service.sh
```

## Step 7: Verification and Testing

### 7.1 Test the Installation

```bash
# Start the application
/mnt/apps/targetminer-rubrics/scripts/start_app.sh

# Check status
/mnt/apps/targetminer-rubrics/scripts/status_app.sh

# Test endpoints
curl -s http://localhost/health | jq .
curl -s http://localhost/api/health | jq .
```

### 7.2 Verify All Components

```bash
# Check if all services are running
systemctl status nginx
systemctl status targetminer-rubrics

# Check ports
netstat -tlnp | grep -E ':(80|8000|3001)'

# Check logs
tail -f /mnt/apps/targetminer-rubrics/logs/backend_error.log
tail -f /mnt/apps/targetminer-rubrics/logs/frontend.log
tail -f /var/log/nginx/error.log
```

### 7.3 Test Application Functionality

1. **Open the application**: Navigate to `http://localhost` in your browser
2. **Test API endpoints**: Visit `http://localhost/api/docs` for API documentation
3. **Test file uploads**: Try uploading a dataset through the web interface
4. **Test analysis**: Create a rule, rubric, and run an analysis
5. **Check database**: Verify data is being stored correctly

## Troubleshooting

### Common Issues and Solutions

#### 1. Port Already in Use

```bash
# Check what's using the port
sudo lsof -i :8000
sudo lsof -i :3001

# Kill the process
sudo kill -9 <PID>

# Or use the kill_port script
/mnt/apps/targetminer-rubrics/scripts/kill_port.sh 8000
```

#### 2. Permission Issues

```bash
# Fix ownership
sudo chown -R $USER:$USER /mnt/apps/targetminer-rubrics

# Fix permissions
chmod +x /mnt/apps/targetminer-rubrics/scripts/*.sh
```

#### 3. Database Issues

```bash
# Reinitialize database
cd /mnt/apps/targetminer-rubrics/backend
source venv/bin/activate
python scripts/init_db.py
python scripts/load_example_data.py
```

#### 4. Nginx Configuration Issues

```bash
# Test nginx configuration
sudo nginx -t

# Check nginx error logs
sudo tail -f /var/log/nginx/error.log

# Reload nginx
sudo systemctl reload nginx
```

#### 5. Frontend Build Issues

```bash
# Rebuild frontend
cd /mnt/apps/targetminer-rubrics/frontend
rm -rf .next
npm run build
```

#### 6. Backend Dependencies Issues

```bash
# Reinstall backend dependencies
cd /mnt/apps/targetminer-rubrics/backend
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Log Analysis

```bash
# Backend logs
tail -f /mnt/apps/targetminer-rubrics/logs/backend_error.log
tail -f /mnt/apps/targetminer-rubrics/logs/backend_access.log

# Frontend logs
tail -f /mnt/apps/targetminer-rubrics/logs/frontend.log

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# System logs
sudo journalctl -u targetminer-rubrics -f
```

## Maintenance and Updates

### 1. Application Updates

```bash
# Stop the application
/mnt/apps/targetminer-rubrics/scripts/stop_app.sh

# Backup current installation
sudo cp -r /mnt/apps/targetminer-rubrics /mnt/apps/targetminer-rubrics.backup.$(date +%Y%m%d)

# Update code
cd /mnt/apps/targetminer-rubrics
git pull origin main

# Update backend dependencies
cd backend
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Update frontend dependencies and rebuild
cd ../frontend
npm install
npm run build

# Start the application
/mnt/apps/targetminer-rubrics/scripts/start_app.sh
```

### 2. Database Backups

```bash
# Create backup script
cat > /mnt/apps/targetminer-rubrics/scripts/backup_db.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/mnt/apps/targetminer-rubrics/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Backup main database
cp /mnt/apps/targetminer-rubrics/backend/rubrics.db "$BACKUP_DIR/rubrics_$DATE.db"

# Backup result database
cp /mnt/apps/targetminer-rubrics/backend/rubric_result.db "$BACKUP_DIR/rubric_result_$DATE.db"

echo "Database backup completed: $BACKUP_DIR/*_$DATE.db"
EOF

chmod +x /mnt/apps/targetminer-rubrics/scripts/backup_db.sh
```

### 3. Log Rotation

```bash
# Create logrotate configuration
sudo tee /etc/logrotate.d/targetminer-rubrics > /dev/null << 'EOF'
/mnt/apps/targetminer-rubrics/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
    postrotate
        /mnt/apps/targetminer-rubrics/scripts/stop_app.sh
        /mnt/apps/targetminer-rubrics/scripts/start_app.sh
    endscript
}
EOF
```

### 4. Monitoring Script

```bash
# Create monitoring script
cat > /mnt/apps/targetminer-rubrics/scripts/monitor.sh << 'EOF'
#!/bin/bash

# Simple monitoring script for Targetminer Rubrics
LOG_FILE="/mnt/apps/targetminer-rubrics/logs/monitor.log"

check_service() {
    local service_name=$1
    local port=$2
    local url=$3
    
    if ! lsof -i :$port >/dev/null 2>&1; then
        echo "$(date): $service_name is down on port $port" >> "$LOG_FILE"
        return 1
    fi
    
    if ! curl -s "$url" >/dev/null 2>&1; then
        echo "$(date): $service_name is not responding at $url" >> "$LOG_FILE"
        return 1
    fi
    
    return 0
}

# Check services
check_service "Backend" 8000 "http://127.0.0.1:8000/health"
check_service "Frontend" 3001 "http://127.0.0.1:3001"

# Check nginx
if ! systemctl is-active --quiet nginx; then
    echo "$(date): Nginx is down" >> "$LOG_FILE"
fi
EOF

chmod +x /mnt/apps/targetminer-rubrics/scripts/monitor.sh

# Add to crontab for regular monitoring
(crontab -l 2>/dev/null; echo "*/5 * * * * /mnt/apps/targetminer-rubrics/scripts/monitor.sh") | crontab -
```

## Security Considerations

### 1. Firewall Configuration

```bash
# Configure UFW firewall
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### 2. SSL/TLS Configuration

For production deployments, configure SSL certificates:

```bash
# Install certbot for Let's Encrypt
sudo apt install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 3. Application Security

- Change default secret keys in environment files
- Use strong passwords for admin users
- Regularly update dependencies
- Monitor logs for suspicious activity
- Implement rate limiting in nginx if needed

## Conclusion

This installation guide provides a complete setup for deploying Targetminer Rubrics on Domino ODSL without Docker. The application will be accessible through nginx on port 80, with the backend API on port 8000 and frontend on port 3001 running behind the reverse proxy.

Key features of this setup:
- **Single machine deployment** with nginx reverse proxy
- **Systemd service management** for automatic startup
- **Comprehensive logging** and monitoring
- **Easy maintenance** and update procedures
- **Production-ready configuration** with security considerations

For support or issues, refer to the troubleshooting section or check the application logs in `/mnt/apps/targetminer-rubrics/logs/`.
