# Rubrics/Rubric Runner

## Overview

A full-stack genomics data analysis application that enables researchers to create, manage, and execute custom scoring rule sets and rubrics on large genomic datasets. The application features a beautiful, modern UI with advanced interactive components, supporting flexible rule creation, rubric composition, and scalable processing of datasets with ~20,000 genes and hundreds of columns.

**Key Capabilities:**
- **Flexible Rule Creation**: Build custom scoring algorithms for genomic data analysis
- **Rubric Composition**: Combine multiple rules into reusable rubrics  
- **Granular Execution**: Run individual rules or complete rubrics on datasets
- **Reusable Components**: Save and reuse both rules and rubrics across different projects
- **Scalable Processing**: Handle large genomic datasets efficiently
- **Collaborative Research**: Share and organize rules and rubrics by organization and disease area
- **Beautiful Modern UI**: Enhanced user interface with gradient backgrounds, interactive components, and responsive design

## Architecture

### Backend Architecture
- **FastAPI** (Python) - Modern, fast REST API framework with automatic API documentation
- **SQLAlchemy** - ORM for database operations with SQLite3 for development
- **Pandas** - Data processing and analysis for genomic datasets
- **OpenPyXL** - Excel file handling for data uploads
- **Rule Engine** - Custom scoring logic execution with condition parsing
- **File Processor** - Handles Excel uploads and data validation

### Frontend Architecture  
- **Next.js 15** (React/TypeScript) - Full-stack React framework with App Router
- **Tailwind CSS** - Enhanced design system with custom color palette and animations
- **TypeScript** - Type-safe JavaScript for better development experience
- **Lucide React** - Beautiful icon library for consistent UI elements
- **Enhanced UI Components** - Custom card, button, and layout components
- **Advanced Interactions** - Hover effects, transitions, and responsive animations

### Enhanced Design System
- **Gradient Backgrounds**: Beautiful blue-to-indigo gradients throughout the application
- **Genomics Color Palette**: Custom colors optimized for scientific applications
- **Interactive Components**: Cards with hover effects, smooth transitions, and loading states
- **Responsive Design**: Mobile-first approach with proper breakpoints and touch-friendly elements
- **Professional Typography**: Clean, modern fonts with proper hierarchy and spacing

### Infrastructure
- **Docker** - Containerization for consistent deployment
- **Docker Compose** - Multi-container orchestration
- **SQLite3** - Development database (PostgreSQL compatible for production)
- **UUID String Storage** - Custom UUID handling for database compatibility
- **Enhanced Build System** - Tailwind CSS with custom plugins and animations

## Setup & Installation

### Prerequisites
- Python 3.9+
- Node.js 18+
- npm 8+

### Quick Start (Recommended)
Use the provided launch scripts for easy setup:

```bash
# Simple unified launcher (automatically sets up everything)
./launch-stack.sh

# Or use the interactive launcher with Docker/local options
./launch.sh

# Or use the simple Docker launcher
./launch-simple.sh
```

### Manual Setup

1. **Backend Setup**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

2. **Frontend Setup**
```bash
cd frontend
npm install
npm run dev
```

### Environment Configuration
- Backend runs on port 8000 by default
- Frontend runs on port 3001 (configured to avoid conflicts)
- API URL: `http://localhost:8000/api`
- Frontend URL: `http://localhost:3001`

## Development Workflow

### Launch Scripts
- **`launch-stack.sh`** - Unified script that automatically:
  - Checks and frees ports 8000 and 3001
  - Sets up Python virtual environment
  - Installs backend dependencies
  - Starts FastAPI backend
  - Installs frontend dependencies  
  - Starts Next.js frontend
  - Provides graceful shutdown handling

- **`launch.sh`** - Interactive launcher with Docker and local development options
- **`launch-simple.sh`** - Simple Docker-based launcher

### Database Management
- SQLite3 database automatically created (`rubrics.db`)
- Example data loaded with 60+ genomic analysis rules
- Database schema includes: Rules, Rubrics, Projects, Execution Records

### API Development
- Auto-generated API documentation at `http://localhost:8000/docs`
- FastAPI automatic validation and serialization
- CORS configured for frontend communication

### UI Development
- **Enhanced Components**: Custom card, button, and layout components
- **Icon Library**: Lucide React for consistent, beautiful icons
- **Animation System**: Smooth transitions, hover effects, and loading states
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Design Tokens**: Custom color palette and spacing system

## API Documentation

### Core Endpoints
- **Rules**: `/api/rules` - CRUD operations for scoring rules
- **Rubrics**: `/api/rubrics` - Rubric management and rule associations  
- **Projects**: `/api/projects` - Project management and data handling
- **Analysis**: `/api/analysis` - Rule execution and analysis workflows

### Key Features
- Rule testing with sample data
- Excel file upload and validation
- Background analysis execution
- Real-time analysis status tracking
- Data preview functionality

## UI Components & Features

### Enhanced UI Components
- **Card System**: Multiple variants (elevated, outlined, ghost, premium) with hover effects
- **Button System**: Gradient buttons, loading states, multiple variants (default, destructive, outline, secondary, ghost, link, success, warning, premium)
- **Navigation**: Sticky header with glass morphism effect and DNA-themed branding
- **Interactive Elements**: Hover effects, smooth transitions, and loading animations

### Key UI Features
- **Dual View Modes**: Cards and List views with toggle functionality
- **Advanced Search**: Real-time filtering with Lucide icons
- **Status Indicators**: Color-coded badges for different states
- **Loading States**: Animated spinners and skeleton screens
- **Empty States**: Beautiful placeholder designs with clear CTAs

### Responsive Design
- **Mobile-First**: Optimized for mobile devices with touch-friendly elements
- **Breakpoint System**: Proper responsive behavior across all screen sizes
- **Touch Interactions**: Large tap targets and gesture support
- **Accessibility**: Focus rings, keyboard navigation, and screen reader support

## File Structure

```
rubricrunner/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── api/               # API routers (rules, rubrics, projects, analysis)
│   │   ├── models/            # SQLAlchemy models (updated UUID handling)
│   │   ├── schemas/           # Pydantic validation schemas
│   │   ├── services/          # Business logic (rule engine, file processor)
│   │   └── main.py            # FastAPI application entry point
│   ├── scripts/               # Database utilities and data loading
│   ├── uploads/               # Uploaded Excel files storage
│   ├── requirements.txt       # Python dependencies
│   └── rubrics.db            # SQLite database (development)
├── frontend/                   # Next.js frontend with enhanced UI
│   ├── src/
│   │   ├── app/               # Next.js App Router pages
│   │   │   ├── layout.tsx     # Enhanced layout with navigation
│   │   │   ├── globals.css    # Enhanced CSS with design system
│   │   │   ├── rubrics/       # Enhanced rubrics page
│   │   │   ├── rules/         # Rules management pages
│   │   │   ├── projects/      # Project management pages
│   │   │   └── analysis/      # Analysis workflow pages
│   │   ├── components/        # Reusable UI components
│   │   │   ├── ui/            # Enhanced UI components
│   │   │   │   ├── card-enhanced.tsx
│   │   │   │   ├── button-enhanced.tsx
│   │   │   │   └── layout/    # Layout components
│   │   │   └── layout/        # App layout with navigation
│   │   ├── services/          # API service layer
│   │   ├── lib/               # Utility functions
│   │   └── types/             # TypeScript type definitions
│   ├── tailwind.config.ts     # Enhanced Tailwind configuration
│   ├── package.json           # Node.js dependencies with UI libraries
│   └── next.config.ts         # Next.js configuration
├── launch-stack.sh           # Unified launcher script (NEW)
├── launch.sh                 # Interactive launcher
├── launch-simple.sh          # Simple Docker launcher
├── docker-compose.yml        # Docker orchestration
└── README.md                 # Project documentation
```

## Recent Updates (Updated: 2025-09-06)

### Major UI/UX Enhancement (NEW)
- **Complete Design System Overhaul**: Transformed basic UI into beautiful, modern interface
- **Enhanced Components**: Created sophisticated card, button, and layout components
- **Gradient Backgrounds**: Beautiful blue-to-indigo gradients throughout the application
- **Lucide Icon Integration**: Professional icon library for consistent visual elements
- **Interactive Elements**: Hover effects, smooth transitions, and loading animations
- **Responsive Design**: Mobile-first approach with proper breakpoints and touch-friendly elements

### Enhanced Frontend Architecture
- **Tailwind CSS Enhancement**: Custom color palette, animations, and design tokens
- **Component Library**: Reusable UI components with multiple variants and states
- **Navigation System**: Sticky header with glass morphism effect and DNA-themed branding
- **Search & Filtering**: Real-time search with beautiful icon integration
- **View Mode Toggle**: Cards and List views with smooth transitions

### Backend Infrastructure Improvements
- **UUID Handling**: Fixed critical database compatibility issue by converting from UUIDType to String(32) across all models
- **API Route Configuration**: Updated routes to work without trailing slashes to prevent frontend fetch errors
- **Data Serialization**: Resolved ResponseValidationError by ensuring proper string serialization
- **CORS Configuration**: Enhanced for better frontend-backend communication

### New Infrastructure Components
- **Unified Launch Script**: Created `launch-stack.sh` for one-command full-stack deployment
- **Port Management**: Automatic port conflict resolution and graceful service shutdown
- **Dependency Management**: Automatic installation of missing Python and Node.js dependencies
- **Enhanced Build System**: Integrated Tailwind CSS plugins for advanced styling

### Enhanced User Experience
- **Loading States**: Beautiful animated spinners and skeleton screens
- **Empty States**: Professional placeholder designs with clear call-to-actions
- **Error Handling**: Enhanced error messages with visual feedback
- **Accessibility**: Focus rings, keyboard navigation, and screen reader support
- **Performance**: Optimized animations and transitions for smooth user experience

## Important Notes

### Database Changes
The project has been migrated from PostgreSQL to SQLite3 for development simplicity. The UUID handling has been updated to use String(32) fields instead of custom UUIDType to resolve serialization issues.

### Port Configuration
- Backend API: Port 8000
- Frontend: Port 3001 (changed from 3000 to avoid conflicts)
- API Documentation: Available at `http://localhost:8000/docs`

### UI Framework Dependencies
New dependencies added for enhanced UI:
- **Lucide React**: Beautiful icon library
- **Class Variance Authority**: Component variant management
- **Tailwind CSS Plugins**: Enhanced animations, forms, and typography
- **Custom Design System**: Genomics-themed color palette and components

### Launch Script Features
The new `launch-stack.sh` script provides:
- Automatic port conflict resolution
- Virtual environment setup
- Dependency installation
- Background service management
- Graceful shutdown handling
- Real-time service status feedback

### Example Data
The application comes pre-loaded with 60+ genomic analysis rules covering:
- Gene coexpression analysis
- TCGA and GTEx correlation studies
- CPTAC protein and RNA data analysis
- Single-cell RNA sequencing analysis
- HPA (Human Protein Atlas) integration

This provides immediate functionality for testing and development without manual data setup.

### UI/UX Transformation
The UI has been completely transformed from basic to beautiful with:
- **Professional Design System**: Consistent colors, spacing, and typography
- **Interactive Components**: Cards with hover effects, smooth transitions
- **Modern Layout**: Gradient backgrounds, glass morphism effects
- **Enhanced Navigation**: Sticky header with DNA-themed branding
- **Responsive Design**: Mobile-first approach with touch-friendly elements
- **Loading Experiences**: Animated spinners, skeleton screens, and progress indicators

The application now provides a premium user experience suitable for professional genomics research workflows.