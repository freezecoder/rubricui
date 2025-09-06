# Rubrics/Rubric Runner

A full-stack genomics data analysis application that enables researchers to create, manage, and execute custom scoring rule sets and rubrics on large genomic datasets.

## Features

- **Flexible Rule Creation**: Build custom scoring algorithms for genomic data analysis
- **Rubric Composition**: Combine multiple rules into reusable rubrics
- **Granular Execution**: Run individual rules or complete rubrics on datasets
- **Reusable Components**: Save and reuse both rules and rubrics across different projects
- **Scalable Processing**: Handle datasets with ~20,000 genes and hundreds of columns
- **Collaborative Research**: Share and organize rules and rubrics by organization and disease area

## Tech Stack

### Backend
- **FastAPI** (Python) - REST API framework
- **SQLAlchemy** - ORM for database operations
- **PostgreSQL** - Primary database
- **Pandas** - Data processing and analysis
- **OpenPyXL** - Excel file handling

### Frontend
- **Next.js** (React/TypeScript) - Full-stack React framework
- **Tailwind CSS** - Utility-first CSS framework
- **TypeScript** - Type-safe JavaScript

### Infrastructure
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration

## Project Structure

```
rubricrunner/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/            # API endpoints
│   │   ├── models/         # Database models
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── services/       # Business logic
│   │   └── main.py         # FastAPI application
│   ├── requirements.txt    # Python dependencies
│   └── Dockerfile          # Backend container
├── frontend/               # Next.js frontend
│   ├── src/
│   │   ├── app/            # Next.js app directory
│   │   ├── components/     # React components
│   │   ├── services/       # API service layer
│   │   └── types/          # TypeScript types
│   ├── package.json        # Node.js dependencies
│   └── Dockerfile          # Frontend container
├── docker-compose.yml      # Docker orchestration
├── launch.sh              # Full interactive launcher script
├── launch-simple.sh       # Simple Docker launcher (port 3001)
├── .env                    # Environment variables
└── README.md              # This file
```

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- Docker (optional)

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd rubricrunner
   ```

2. **Set up the backend**
   ```bash
   cd backend
   
   # Create virtual environment
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   
   # Install dependencies
   pip install -r requirements.txt
   
   # Set up environment variables
   cp .env.example .env
   # Edit .env with your database credentials
   
   # Run database migrations
   alembic upgrade head
   
   # Start the backend server
   uvicorn app.main:app --reload
   ```

3. **Set up the frontend**
   ```bash
   cd frontend
   
   # Install dependencies
   npm install
   
   # Start the development server
   npm run dev
   ```

### Quick Launch (Recommended)

Use the provided launch scripts for easy setup:

1. **Simple Docker Launch (Frontend on port 3001)**
   ```bash
   ./launch-simple.sh
   ```

2. **Full Launch Script (Interactive)**
   ```bash
   ./launch.sh
   ```
   This script provides options for both Docker and local development modes.

### Docker Setup

1. **Using Docker Compose**
   ```bash
   # Start all services
   docker-compose up -d
   
   # Stop all services
   docker-compose down
   
   # View logs
   docker-compose logs -f
   ```

2. **Individual containers**
   ```bash
   # Build and run backend
   cd backend
   docker build -t rubrics-backend .
   docker run -p 8000:8000 rubrics-backend
   
   # Build and run frontend
   cd frontend
   docker build -t rubrics-frontend .
   docker run -p 3000:3000 rubrics-frontend
   ```

## API Documentation

Once the backend is running, you can access:
- API documentation: http://localhost:8000/docs
- Alternative API docs: http://localhost:8000/redoc

## Usage

### 1. Create Rules

Rules define scoring logic for genomic data:
- Set conditions based on column values
- Assign scores when conditions are met
- Map variables to data columns

Example rule conditions:
```
x > 0.45 ~ 6
x > 0.35 & x < 0.45 ~ 4
x > 0.25 & x < 0.35 ~ 2
TRUE ~ NA_real_
```

### 2. Create Rubrics

Rubrics combine multiple rules:
- Add existing rules to rubrics
- Set weights for each rule
- Define execution order

### 3. Upload Data

Upload Excel files with genomic data:
- Score columns (contain "SCORE" in name)
- Data columns (numeric/categorical)
- Annotation columns (gene descriptions, etc.)

### 4. Run Analysis

Execute rules and rubrics on your data:
- Select individual rules or complete rubrics
- Mixed execution supported
- Results ranked by total score

## Configuration

### Environment Variables

Backend:
- `DATABASE_URL` - PostgreSQL connection string
- `SECRET_KEY` - JWT secret key
- `ALGORITHM` - JWT algorithm
- `ACCESS_TOKEN_EXPIRE_MINUTES` - Token expiration time

Frontend:
- `NEXT_PUBLIC_API_URL` - Backend API URL

### Database Schema

The application uses the following main tables:
- `rules` - Individual scoring rules
- `rubrics` - Rule collections
- `rubric_rules` - Rule-rubric associations
- `projects` - Analysis projects
- `execution_records` - Analysis execution history

## Development

### Backend Development

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

### Frontend Development

```bash
cd frontend
npm run dev
```

### Database Migrations

```bash
cd backend
alembic revision --autogenerate -m "Description of changes"
alembic upgrade head
```

## Testing

### Backend Tests

```bash
cd backend
pytest
```

### Frontend Tests

```bash
cd frontend
npm test
```

## Deployment

### Production Setup

1. **Environment Configuration**
   - Set production environment variables
   - Configure SSL certificates
   - Set up reverse proxy (nginx)

2. **Database Setup**
   - Use managed PostgreSQL service
   - Configure backups
   - Set up monitoring

3. **Application Deployment**
   - Build optimized containers
   - Set up CI/CD pipeline
   - Configure health checks

### Docker Production

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please open an issue in the GitHub repository or contact the development team.