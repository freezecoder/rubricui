# Product Requirements Document: Rubrics/Rubric Runner Application

## 1. Executive Summary

**Product Name:** Rubrics/Rubric Runner  
**Version:** 1.0  
**Date:** September 5, 2025  

### 1.1 Product Overview
Rubrics/Rubric Runner is a full-stack genomics data analysis application that enables researchers to create, manage, and execute custom scoring rule sets and rubrics on large genomic datasets. The application allows users to systematically evaluate and rank genes through configurable individual rules or combinations of rules (rubrics) that produce weighted scores.

### 1.2 Key Value Propositions
- **Flexible Rule Creation**: Build custom scoring algorithms for genomic data analysis
- **Rubric Composition**: Combine multiple rules into reusable rubrics
- **Granular Execution**: Run individual rules or complete rubrics on datasets
- **Reusable Components**: Save and reuse both rules and rubrics across different projects
- **Scalable Processing**: Handle datasets with ~20,000 genes and hundreds of columns
- **Collaborative Research**: Share and organize rules and rubrics by organization and disease area

## 2. Technical Architecture

### 2.1 Technology Stack
- **Backend**: FastAPI (Python)
- **Frontend**: Next.js (React/TypeScript)
- **Database**: PostgreSQL (recommended for structured data and metadata)
- **File Processing**: Pandas, openpyxl for Excel file handling
- **Deployment**: Docker containers

### 2.2 High-Level Architecture
```
Frontend (Next.js) ↔ REST API (FastAPI) ↔ Database (PostgreSQL)
                                       ↔ File Storage (Local/S3)
```

## 3. Data Models

### 3.1 Core Entities

#### 3.1.1 Rule
```python
class Rule:
    id: UUID
    name: str
    description: str
    owner_name: str
    organization: str
    disease_area_study: str  # DAS
    tags: List[str]
    ruleset_conditions: List[str]  # e.g., ["x > 0.45 ~ 6", "x > .35 & x < 0.45 ~ 4"]
    column_mapping: Dict[str, str]  # e.g., {"x": "gene_table.aster_25gene_correlation"}
    weight: float = 1.0
    created_date: datetime
    modified_date: datetime
    is_active: bool
```

#### 3.1.2 Rubric
```python
class Rubric:
    id: UUID
    name: str
    description: str
    owner_name: str
    organization: str
    disease_area_study: str  # DAS
    tags: List[str]
    rules: List[RubricRule]  # Many-to-many relationship with weights
    created_date: datetime
    modified_date: datetime
    is_active: bool
```

#### 3.1.3 RubricRule (Association Table)
```python
class RubricRule:
    id: UUID
    rubric_id: UUID  # Foreign key to Rubric
    rule_id: UUID    # Foreign key to Rule
    weight: float = 1.0  # Weight of this rule within the rubric
    order: int       # Execution order within the rubric
    is_active: bool = True  # Can disable rules within a rubric
```

#### 3.1.4 Project
```python
class Project:
    id: UUID
    name: str
    description: str
    owner_name: str
    organization: str
    created_date: datetime
    input_data_file: str  # path to uploaded Excel file
    applied_rules: List[UUID] = []     # Individual rules applied
    applied_rubrics: List[UUID] = []   # Rubrics applied
    results: Optional[str]  # path to results file
    execution_history: List[ExecutionRecord]
```

#### 3.1.5 ExecutionRecord
```python
class ExecutionRecord:
    id: UUID
    project_id: UUID
    execution_type: str  # "rule" or "rubric"
    executed_items: List[UUID]  # IDs of rules or rubrics executed
    execution_date: datetime
    status: str  # "pending", "running", "completed", "failed"
    results_file: Optional[str]
    execution_time_seconds: Optional[float]
    error_message: Optional[str]
```

#### 3.1.6 Gene Data Structure
Input data contains three column categories:
- **Score Columns**: Contain "SCORE" in name (output of rubrics/rules)
- **Data Columns**: Numeric/categorical data (input for rules)
- **Annotation Columns**: Gene descriptions, HPA, goal, etc.

## 4. Functional Requirements

### 4.1 Rule Management (/rules)

#### 4.1.1 Core Features
- **Create Rules**: Build individual scoring rules
- **Edit Rules**: Modify existing rules
- **List Rules**: View all rules with search and filtering
- **Rule Details**: View complete rule configuration
- **Import/Export**: Save/load rules in YAML/JSON format
- **Tagging System**: Organize rules by tags, DAS, organization
- **Rule Testing**: Test individual rules on sample data

### 4.2 Rubric Management (/rubrics)

#### 4.2.1 Core Features
- **Create Rubrics**: Combine multiple rules into rubrics
- **Edit Rubrics**: Add/remove rules, adjust weights and order
- **List Rubrics**: View all rubrics with search and filtering
- **Rubric Details**: View complete rubric configuration with rule breakdown
- **Import/Export**: Save/load rubrics in YAML/JSON format
- **Rubric Testing**: Preview rubric behavior on sample data
- **Rule Weight Management**: Adjust individual rule weights within rubrics
- **Rule Ordering**: Define execution order of rules within rubrics

#### 4.2.2 Rubric Builder Interface
- **Rule Selector**: Add existing rules to rubrics
- **Weight Configuration**: Set individual rule weights
- **Order Management**: Drag-and-drop rule ordering
- **Preview Scoring**: Show combined scoring behavior
- **Validation**: Ensure all rule dependencies are met

### 4.3 Project Management (/projects)

#### 4.3.1 Core Features
- **Create Projects**: Initialize new analysis projects
- **Upload Data**: Import Excel files with genomic data
- **Data Preview**: View and validate uploaded data structure
- **Apply Rules/Rubrics**: Select individual rules or complete rubrics
- **Mixed Execution**: Combine individual rules with rubrics in single execution
- **Execute Analysis**: Run selected rules/rubrics on data to generate scores
- **View Results**: Display sorted gene rankings with score breakdowns
- **Export Results**: Download results as Excel/CSV
- **Execution History**: Track all analysis runs with timestamps

#### 4.3.2 Data Processing Workflow
1. **Data Upload**: Validate Excel file structure and column types
2. **Column Classification**: Automatically categorize columns (score/data/annotation)
3. **Analysis Selection**: Choose individual rules and/or rubrics
4. **Column Mapping Validation**: Ensure rule variables map to available columns
5. **Execution Planning**: Determine execution order and dependencies
6. **Rule Execution**: Apply individual rules row-wise across all genes
7. **Rubric Execution**: Apply rubric rules with weights and aggregation
8. **Score Aggregation**: Combine all scores (individual rules + rubrics)
9. **Ranking**: Sort genes by total score (descending)

### 4.4 Data Processing Engine

#### 4.4.1 Rule Execution Logic
```python
def execute_individual_rule(rule, data_row, column_mapping):
    """Execute a single rule on a data row"""
    # Parse conditions and apply to mapped columns
    # Return score based on first matching condition

def execute_rubric(rubric, data_row):
    """Execute a complete rubric (multiple weighted rules)"""
    total_score = 0
    for rubric_rule in rubric.rules:
        rule_score = execute_individual_rule(
            rubric_rule.rule, 
            data_row, 
            rubric_rule.rule.column_mapping
        )
        weighted_score = rule_score * rubric_rule.weight
        total_score += weighted_score
    return total_score

def execute_mixed_analysis(individual_rules, rubrics, dataset):
    """Execute combination of individual rules and rubrics"""
    # Process each gene row
    # Apply individual rules
    # Apply rubrics
    # Combine all scores
    # Return ranked results
```

#### 4.4.2 Performance Requirements
- Process 20,000+ gene rows efficiently
- Handle Excel files up to 500MB
- Complete analysis execution within 30 seconds for typical datasets
- Support concurrent project processing

## 5. User Interface Requirements

### 5.1 Navigation Structure
```
/ (Dashboard)
├── /rules
│   ├── /create
│   ├── /edit/[id]
│   └── /view/[id]
├── /rubrics
│   ├── /create
│   ├── /edit/[id]
│   └── /view/[id]
└── /projects
    ├── /create
    ├── /edit/[id]
    └── /results/[id]
```

### 5.2 Key UI Components

#### 5.2.1 Rule Builder
- **Rule Editor**: Interface for building conditional logic
- **Column Selector**: Dropdown/autocomplete for available data columns
- **Score Preview**: Real-time visualization of scoring behavior
- **Validation**: Syntax checking for rule conditions

#### 5.2.2 Rubric Builder
- **Rule Library**: Browse and select existing rules
- **Rubric Composition**: Drag-and-drop interface for adding rules
- **Weight Configuration**: Sliders/inputs for rule weights
- **Order Management**: Reorder rules within rubric
- **Combined Preview**: Visualization of rubric scoring behavior

#### 5.2.3 Project Analysis Interface
- **Analysis Type Selector**: Choose between rules, rubrics, or mixed
- **Rule/Rubric Selector**: Multi-select interface with search and filtering
- **Execution Configuration**: Set parameters for analysis run
- **Progress Tracking**: Real-time status of analysis execution
- **Results Comparison**: Compare results from different analysis runs

#### 5.2.4 Results Visualization
- **Gene Rankings**: Paginated table with score breakdowns
- **Score Attribution**: Show contribution from individual rules vs rubrics
- **Rule/Rubric Performance**: Analyze which components contributed most
- **Export Options**: Multiple format downloads with customizable columns

## 6. API Specifications

### 6.1 Rule Endpoints
```
POST   /api/rules                 # Create rule
GET    /api/rules                 # List rules (with filters)
GET    /api/rules/{id}            # Get rule details
PUT    /api/rules/{id}            # Update rule
DELETE /api/rules/{id}            # Delete rule
POST   /api/rules/import          # Import from YAML/JSON
GET    /api/rules/{id}/export     # Export to YAML/JSON
POST   /api/rules/{id}/test       # Test rule on sample data
```

### 6.2 Rubric Endpoints
```
POST   /api/rubrics               # Create rubric
GET    /api/rubrics               # List rubrics (with filters)
GET    /api/rubrics/{id}          # Get rubric details
PUT    /api/rubrics/{id}          # Update rubric
DELETE /api/rubrics/{id}          # Delete rubric
POST   /api/rubrics/import        # Import from YAML/JSON
GET    /api/rubrics/{id}/export   # Export to YAML/JSON
POST   /api/rubrics/{id}/test     # Test rubric on sample data
POST   /api/rubrics/{id}/rules    # Add rule to rubric
DELETE /api/rubrics/{id}/rules/{rule_id} # Remove rule from rubric
PUT    /api/rubrics/{id}/rules/{rule_id} # Update rule weight/order
```

### 6.3 Project Endpoints
```
POST   /api/projects              # Create project
GET    /api/projects              # List projects
GET    /api/projects/{id}         # Get project details
PUT    /api/projects/{id}         # Update project
DELETE /api/projects/{id}         # Delete project
POST   /api/projects/{id}/upload  # Upload data file
POST   /api/projects/{id}/execute # Run analysis (rules/rubrics)
GET    /api/projects/{id}/results # Get results
GET    /api/projects/{id}/history # Get execution history
```

### 6.4 Analysis Execution Endpoints
```
POST   /api/analysis/execute      # Execute mixed analysis
GET    /api/analysis/status/{job_id} # Check execution status
POST   /api/analysis/rules        # Execute individual rules only
POST   /api/analysis/rubrics      # Execute rubrics only
GET    /api/analysis/preview      # Preview analysis configuration
```

## 7. Implementation Plan

### 7.1 Phase 1: Core Backend (Weeks 1-4)
- Database schema for Rule, Rubric, RubricRule, Project models
- Basic CRUD operations for rules and rubrics
- Rule execution engine
- File upload and validation

### 7.2 Phase 2: Rubric System (Weeks 5-7)
- Rubric composition and management
- Rule-to-rubric association logic
- Mixed execution engine (rules + rubrics)
- Import/export functionality for both rules and rubrics

### 7.3 Phase 3: Frontend Foundation (Weeks 8-11)
- Next.js application structure
- Rule management interface
- Rubric builder with rule composition
- Project creation and analysis configuration

### 7.4 Phase 4: Advanced Features (Weeks 12-15)
- Visual rule and rubric builders
- Results visualization with attribution
- Execution history and comparison
- Search and filtering across rules and rubrics

### 7.5 Phase 5: Polish and Optimization (Weeks 16-18)
- Performance optimization
- Error handling and validation
- User testing and refinement
- Documentation

## 8. File Structure

### 8.1 Backend Structure
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── rule.py
│   │   ├── rubric.py
│   │   ├── rubric_rule.py
│   │   ├── project.py
│   │   └── execution_record.py
│   ├── api/
│   │   ├── __init__.py
│   │   ├── rules.py
│   │   ├── rubrics.py
│   │   ├── projects.py
│   │   └── analysis.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── rule_engine.py
│   │   ├── rubric_engine.py
│   │   ├── analysis_executor.py
│   │   ├── file_processor.py
│   │   └── import_export.py
│   └── database/
│       ├── __init__.py
│       └── connection.py
├── requirements.txt
└── Dockerfile
```

### 8.2 Frontend Structure
```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── rules/
│   │   │   ├── page.tsx
│   │   │   ├── create/
│   │   │   ├── edit/[id]/
│   │   │   └── view/[id]/
│   │   ├── rubrics/
│   │   │   ├── page.tsx
│   │   │   ├── create/
│   │   │   ├── edit/[id]/
│   │   │   └── view/[id]/
│   │   └── projects/
│   │       ├── page.tsx
│   │       ├── create/
│   │       ├── edit/[id]/
│   │       └── /results/[id]/
│   ├── components/
│   │   ├── RuleBuilder/
│   │   ├── RubricBuilder/
│   │   ├── AnalysisSelector/
│   │   ├── DataUpload/
│   │   ├── ResultsTable/
│   │   └── common/
│   ├── services/
│   │   └── api.ts
│   └── types/
│       └── index.ts
├── package.json
└── Dockerfile
```

## 9. Database Schema

### 9.1 Key Tables
```sql
-- Rules table
CREATE TABLE rules (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_name VARCHAR(255),
    organization VARCHAR(255),
    disease_area_study VARCHAR(255),
    tags TEXT[], -- PostgreSQL array
    ruleset_conditions JSONB,
    column_mapping JSONB,
    weight DECIMAL(5,3) DEFAULT 1.0,
    created_date TIMESTAMP DEFAULT NOW(),
    modified_date TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Rubrics table
CREATE TABLE rubrics (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_name VARCHAR(255),
    organization VARCHAR(255),
    disease_area_study VARCHAR(255),
    tags TEXT[],
    created_date TIMESTAMP DEFAULT NOW(),
    modified_date TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Many-to-many relationship between rubrics and rules
CREATE TABLE rubric_rules (
    id UUID PRIMARY KEY,
    rubric_id UUID REFERENCES rubrics(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES rules(id) ON DELETE CASCADE,
    weight DECIMAL(5,3) DEFAULT 1.0,
    order_index INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(rubric_id, rule_id)
);
```

## 10. Success Criteria

### 10.1 Performance Metrics
- Process 20,000 gene dataset in under 30 seconds
- Support 10 concurrent users
- 99% uptime during business hours

### 10.2 Functional Metrics
- Successfully create and execute individual rules and rubrics
- Import/export rules and rubrics without data loss
- Generate accurate gene rankings based on applied analysis
- Handle mixed execution of rules and rubrics
- Maintain rule weights and ordering within rubrics

### 10.3 User Experience Metrics
- Intuitive rule and rubric creation process
- Clear visualization of results with proper attribution
- Reliable file upload and processing feedback
- Easy transition between individual rule and rubric-based analysis

This updated PRD provides a comprehensive foundation for implementing the enhanced Rubrics/Rubric Runner application with proper separation between individual rules and composite rubrics, enabling flexible analysis workflows for genomic data.