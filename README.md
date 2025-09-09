# Targetminer Rubrics

A full-stack genomics data analysis application that enables researchers to create, manage, and execute custom scoring rule sets and rubrics on large genomic datasets.

## Features

- **Flexible Rule Creation**: Build custom scoring algorithms for genomic data analysis
- **Rubric Composition**: Combine multiple rules into reusable rubrics
- **Granular Execution**: Run individual rules or complete rubrics on datasets
- **Reusable Components**: Save and reuse both rules and rubrics across different projects
- **Scalable Processing**: Handle datasets with ~20,000 genes and hundreds of columns
- **Collaborative Research**: Share and organize rules and rubrics by organization and disease area
- **Reproducible Analysis**: Export analysis configurations as YAML for reproducibility and debugging
- **Standalone Execution**: Independent analysis execution script for batch processing and testing
- **Quick Analysis**: Streamlined one-page analysis interface with on-the-fly rubric creation
- **Modal Workflows**: Create rubrics and upload datasets without leaving the analysis page

## Tech Stack

### Backend
- **FastAPI** (Python) - REST API framework
- **SQLAlchemy** - ORM for database operations
- **SQLite3** - Primary database (development), PostgreSQL compatible
- **Pandas** - Data processing and analysis
- **OpenPyXL** - Excel file handling
- **PyYAML** - YAML configuration parsing
- **Dual Database Architecture** - Separate databases for main data and analysis results

### Frontend
- **Next.js** (React/TypeScript) - Full-stack React framework
- **Tailwind CSS** - Utility-first CSS framework
- **TypeScript** - Type-safe JavaScript

### Infrastructure
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration

## Project Structure

```
targetminer-rubrics/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/            # API endpoints
│   │   ├── models/         # Database models
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── services/       # Business logic
│   │   └── main.py         # FastAPI application
│   ├── scripts/            # Utility scripts
│   │   ├── standalone_analysis_executor.py  # Standalone analysis execution
│   │   ├── test_standalone_executor.py      # Test suite for standalone executor
│   │   └── README_standalone_executor.md    # Standalone executor documentation
│   ├── requirements.txt    # Python dependencies
│   └── Dockerfile          # Backend container
├── frontend/               # Next.js frontend
│   ├── src/
│   │   ├── app/            # Next.js app directory
│   │   ├── components/     # React components
│   │   ├── lib/            # Utility libraries
│   │   │   └── yamlExport.ts  # YAML configuration export functionality
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
- SQLite3 (included with Python)
- Docker (optional)

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd targetminer-rubrics
   ```

2. **Set up the backend**
   ```bash
   cd backend
   
   # Create virtual environment
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   
   # Install dependencies
   pip install -r requirements.txt
   
   # Set up environment variables (optional for SQLite)
   cp .env.example .env
   # Edit .env with your database credentials if using PostgreSQL
   
   # Initialize database and load example data
   python scripts/init_db.py
   python scripts/load_example_data.py
   
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
   docker build -t targetminer-backend .
   docker run -p 8000:8000 targetminer-backend
   
   # Build and run frontend
   cd frontend
   docker build -t targetminer-frontend .
   docker run -p 3000:3000 targetminer-frontend
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

#### Rule Condition Syntax
The system supports R-style condition syntax with automatic conversion to Python:

**Logical Operators:**
- `&` (logical AND) - automatically converted to `and`
- `|` (logical OR) - automatically converted to `or`

**Example rule conditions:**
```
x > 0.45 ~ 6
x > 0.35 & x < 0.45 ~ 4
x > 0.25 & x < 0.35 ~ 2
x > 1 & y < 0.04 ~ 3
(x > 0.5 & x < 1) & (y > 0.05 & y < 0.1) ~ 2
TRUE ~ NA_real_
```

**Special Values:**
- `TRUE` - Always evaluates to true (catch-all condition)
- `FALSE` - Always evaluates to false
- `NA_real_` - Returns NaN (not a number) for missing/invalid scores

#### Rule Engine Logic
The rule engine processes conditions in order and returns the score for the first matching condition:
1. **Variable Mapping**: Maps rule variables (x, y, etc.) to dataset columns
2. **Condition Evaluation**: Evaluates each condition against the data row
3. **Score Assignment**: Returns the score for the first matching condition
4. **Default Handling**: Returns 0.0 if no conditions match (unless TRUE ~ NA_real_ is present)

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

### 4. Quick Analysis (New!)

For streamlined analysis without project setup, use the Quick Analysis page:

#### Quick Analysis Workflow
1. **Navigate to Quick Analysis**: Click "Start Analysis" from the main dashboard or go to `/run`
2. **Upload Dataset**: Upload your Excel file directly or select an existing dataset
3. **Create or Select Rubric**: 
   - Use the "Create New" button to create a rubric via modal
   - Upload rubric rules from TSV/CSV/Excel/JSON files
   - Or select an existing rubric from the list
4. **Validate Configuration**: System automatically validates rubric-dataset compatibility
5. **Run Analysis**: Execute analysis with immediate results display

#### Quick Analysis Features
- **No Project Setup Required**: Automatic default project creation
- **Modal Rubric Creation**: Create rubrics without leaving the analysis page
- **On-the-fly Dataset Upload**: Upload and validate datasets during analysis
- **Full Width Layout**: Optimized interface using entire screen width
- **Auto-Selection**: Newly created rubrics are automatically selected
- **Real-time Validation**: Immediate feedback on configuration compatibility

### 5. Run Analysis

Execute rules and rubrics on your data using the enhanced analysis system:

#### Rubric-Based Analysis
- **Endpoint**: `POST /api/analysis/execute-rubric`
- **Method**: Send JSON request body with `project_id`, `rubric_id`, and `dataset_id`
- **Execution**: Background task processing with real-time status updates
- **Results**: Stored in separate result database for optimal performance

#### Analysis Execution Flow
1. **Validation**: Verify project, rubric, and dataset exist and are active
2. **Execution Record**: Create tracking record with unique execution ID
3. **Background Processing**: Run analysis asynchronously with progress updates
4. **Result Storage**: Save results to dedicated result database
5. **Status Tracking**: Monitor execution status via `/api/analysis/execution/{execution_id}`

#### Result Retrieval
- **Execution Status**: `GET /api/analysis/execution/{execution_id}`
- **Analysis Results**: `GET /api/analysis/results/{execution_id}`
- **Result Database**: Separate `rubric_result.db` for scalable storage

### 6. Export and Reproduce Analysis

#### YAML Configuration Export
1. **Navigate to Analysis Page**: Go to `/projects/[id]/analysis`
2. **Configure Analysis**: Select rubric and dataset, validate configuration
3. **Export Configuration**: Click "Export Config" button to download YAML file
4. **YAML Contains**: Complete analysis configuration with all parameters

#### Standalone Analysis Execution
Execute analysis configurations independently for reproducibility and debugging:

```bash
# Basic execution
python backend/scripts/standalone_analysis_executor.py config.yaml

# With custom output directory
python backend/scripts/standalone_analysis_executor.py config.yaml --output-dir ./results

# Dry run (validation only)
python backend/scripts/standalone_analysis_executor.py config.yaml --dry-run

# Verbose logging
python backend/scripts/standalone_analysis_executor.py config.yaml --verbose

# Help and options
python backend/scripts/standalone_analysis_executor.py --help
```

#### Standalone Executor Features
- **Complete Analysis Pipeline**: Full rule execution with proper condition evaluation
- **R-Style Condition Support**: Handles R-style logical operators (`&` and `|`) correctly
- **Multiple Output Formats**: Excel results, summary reports, debug reports, and execution logs
- **Validation Mode**: Dry-run option to validate configurations without execution
- **Error Handling**: Comprehensive error reporting and debugging information
- **Flexible Output**: Custom output directories and file naming

#### Output Files Generated
- **Results Excel File**: `{project_name}_{rubric_name}_{timestamp}_results.xlsx`
  - Complete analysis results with gene scores
  - Individual rule scores and total scores
  - Sorted by total score (descending)
- **Summary Report**: `{project_name}_{rubric_name}_{timestamp}_summary.txt`
  - Analysis metadata and statistics
  - Score distribution information
  - Execution parameters
- **Debug Report**: `{project_name}_{timestamp}_debug_report.txt`
  - Detailed configuration information
  - Validation results and sample data
  - Complete rule details and column mappings
- **Execution Log**: `standalone_analysis.log`
  - Detailed execution logs
  - Error messages and debugging information
  - Performance metrics

#### Use Cases
- **Reproducibility**: Re-run analyses with identical parameters across different environments
- **Debugging**: Isolate analysis execution from web interface to troubleshoot issues
- **Batch Processing**: Process multiple configurations in sequence for large-scale analysis
- **Development**: Test new rules and rubrics independently before web deployment
- **Validation**: Verify analysis results against original pipelines
- **CI/CD Integration**: Automated testing and validation in continuous integration pipelines

## Configuration

### Environment Variables

Backend:
- `DATABASE_URL` - Database connection string (defaults to SQLite)
- `RESULT_DATABASE_URL` - Result database connection string (defaults to SQLite)
- `SECRET_KEY` - JWT secret key
- `ALGORITHM` - JWT algorithm
- `ACCESS_TOKEN_EXPIRE_MINUTES` - Token expiration time

Frontend:
- `NEXT_PUBLIC_API_URL` - Backend API URL

### Database Schema

The application uses a dual-database architecture:

**Main Database (`rubrics.db`):**
- `rules` - Individual scoring rules
- `rubrics` - Rule collections
- `rubric_rules` - Rule-rubric associations
- `projects` - Analysis projects
- `datasets` - Uploaded datasets
- `users` - User accounts and permissions
- `execution_records` - Analysis execution history

**Result Database (`rubric_result.db`):**
- `analysis_results` - Analysis metadata and tracking
- `analysis_result_tracker` - Storage location tracking
- `rubric_{rubric_id}_analysis_result` - Wide format tables for each rubric analysis

**Execution Records (`rubrics.db`):**
- `execution_records` - Analysis execution tracking and status
- Fields: `id`, `project_id`, `execution_type`, `executed_items`, `status`, `results_file`, `execution_time_seconds`, `error_message`

### Database Migration

To migrate existing analysis results to the new separate database:

```bash
cd backend
python scripts/migrate_analysis_results_to_separate_db.py
python scripts/create_result_db_indexes.py
```

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

### Standalone Executor Tests

```bash
cd backend
python scripts/test_standalone_executor.py
```

### YAML Export Testing

1. **Export Configuration**: Use the web interface to export a YAML configuration
2. **Validate Configuration**: Test the exported YAML with dry-run mode
```bash
python backend/scripts/standalone_analysis_executor.py exported_config.yaml --dry-run
```
3. **Execute Analysis**: Run the full analysis with the exported configuration
```bash
python backend/scripts/standalone_analysis_executor.py exported_config.yaml --verbose
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

## Troubleshooting

### Common Issues

#### Rule Conditions Not Evaluating Correctly
**Problem**: Rules return 0 or NaN when they should return a score
**Solution**: Check that your rule conditions use proper syntax:
- Use `&` for logical AND (automatically converted to `and`)
- Use `|` for logical OR (automatically converted to `or`)
- Ensure variable names match your column mapping

**Example Fix:**
```python
# Incorrect (will cause evaluation errors)
x > 1 && y < 0.04 ~ 3

# Correct (R-style syntax)
x > 1 & y < 0.04 ~ 3
```

#### Column Mapping Issues
**Problem**: Rule variables not finding corresponding data columns
**Solution**: Verify column mapping in rule definition:
- Check that column names match exactly (case-sensitive)
- Ensure columns exist in your dataset
- Use sanitized column names (spaces replaced with underscores)

#### Analysis Results Not Displaying
**Problem**: Analysis completes but results don't appear in frontend
**Solution**: Check the dual database architecture:
- Results are stored in separate `rubric_result.db` database
- Ensure result database API endpoints are working
- Check execution status via `/api/analysis/execution/{execution_id}`

#### Standalone Executor Issues
**Problem**: YAML configuration fails to execute
**Solution**: Use validation mode to debug:
```bash
# Validate configuration without execution
python backend/scripts/standalone_analysis_executor.py config.yaml --dry-run

# Check detailed logs
python backend/scripts/standalone_analysis_executor.py config.yaml --verbose
```

### Debugging Tips

1. **Test Individual Rules**: Use the rule testing interface to verify individual rule logic
2. **Check Data Types**: Ensure numeric columns contain numeric data, not strings
3. **Validate Conditions**: Test rule conditions with sample data before full analysis
4. **Review Logs**: Check backend logs for detailed error messages
5. **Use Dry Run**: Always validate YAML configurations before execution

## Support

For support, please open an issue in the GitHub repository or contact the development team.