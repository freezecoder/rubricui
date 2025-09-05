from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.models.database import get_db
from app.models.project import Project
from app.models.rule import Rule
from app.models.rubric import Rubric
from app.models.rubric_rule import RubricRule
from app.services.analysis_executor import AnalysisExecutor
from app.services.file_processor import FileProcessor
import uuid
import os

router = APIRouter()

# Store for background job status
job_status = {}

@router.post("/execute")
async def execute_analysis(
    background_tasks: BackgroundTasks,
    project_id: uuid.UUID,
    rule_ids: List[uuid.UUID] = [],
    rubric_ids: List[uuid.UUID] = [],
    db: Session = Depends(get_db)
):
    """Execute analysis with selected rules and rubrics"""
    
    # Validate project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Validate input data file exists
    if not project.input_data_file or not os.path.exists(project.input_data_file):
        raise HTTPException(status_code=404, detail="Project data file not found")
    
    # Validate rules exist and are active
    valid_rules = []
    if rule_ids:
        valid_rules = db.query(Rule).filter(
            Rule.id.in_(rule_ids),
            Rule.is_active == True
        ).all()
        
        if len(valid_rules) != len(rule_ids):
            raise HTTPException(status_code=400, detail="Some rules not found or inactive")
    
    # Validate rubrics exist and are active
    valid_rubrics = []
    if rubric_ids:
        valid_rubrics = db.query(Rubric).filter(
            Rubric.id.in_(rubric_ids),
            Rubric.is_active == True
        ).all()
        
        if len(valid_rubrics) != len(rubric_ids):
            raise HTTPException(status_code=400, detail="Some rubrics not found or inactive")
    
    # Create job ID
    job_id = str(uuid.uuid4())
    
    # Start background task
    background_tasks.add_task(
        run_analysis,
        job_id,
        project_id,
        [rule.id for rule in valid_rules],
        [rubric.id for rubric in valid_rubrics],
        db
    )
    
    return {"job_id": job_id, "status": "started"}

@router.get("/status/{job_id}")
async def get_analysis_status(job_id: str):
    """Get status of analysis job"""
    if job_id not in job_status:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return job_status[job_id]

@router.get("/preview")
async def preview_analysis(
    project_id: uuid.UUID,
    rule_ids: List[uuid.UUID] = [],
    rubric_ids: List[uuid.UUID] = [],
    db: Session = Depends(get_db)
):
    """Preview analysis configuration without executing"""
    
    # Validate project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get rules and rubrics
    rules = []
    rubrics = []
    
    if rule_ids:
        rules = db.query(Rule).filter(
            Rule.id.in_(rule_ids),
            Rule.is_active == True
        ).all()
    
    if rubric_ids:
        rubrics = db.query(Rubric).filter(
            Rubric.id.in_(rubric_ids),
            Rubric.is_active == True
        ).all()
    
    # Get data preview
    file_processor = FileProcessor()
    try:
        data_preview = file_processor.get_file_preview(project.input_data_file, max_rows=5)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading data file: {str(e)}")
    
    return {
        "project_name": project.name,
        "rules": [{"id": str(rule.id), "name": rule.name} for rule in rules],
        "rubrics": [{"id": str(rubric.id), "name": rubric.name} for rubric in rubrics],
        "data_preview": data_preview,
        "estimated_computation": len(data_preview["data"]) * (len(rules) + len(rubrics))
    }

async def run_analysis(
    job_id: str,
    project_id: uuid.UUID,
    rule_ids: List[uuid.UUID],
    rubric_ids: List[uuid.UUID],
    db: Session
):
    """Background task to run analysis"""
    
    try:
        job_status[job_id] = {"status": "running", "progress": 0, "message": "Starting analysis"}
        
        # Get project and data
        project = db.query(Project).filter(Project.id == project_id).first()
        
        job_status[job_id] = {"status": "running", "progress": 10, "message": "Loading data"}
        
        # Load data
        file_processor = FileProcessor()
        df = file_processor.process_file_for_analysis(project.input_data_file)
        
        job_status[job_id] = {"status": "running", "progress": 20, "message": "Loading rules and rubrics"}
        
        # Get rules and rubrics
        rules = db.query(Rule).filter(Rule.id.in_(rule_ids), Rule.is_active == True).all()
        rubrics = db.query(Rubric).filter(Rubric.id.in_(rubric_ids), Rubric.is_active == True).all()
        
        job_status[job_id] = {"status": "running", "progress": 30, "message": "Executing analysis"}
        
        # Execute analysis
        executor = AnalysisExecutor()
        results = executor.execute_mixed_analysis(rules, rubrics, df)
        
        job_status[job_id] = {"status": "running", "progress": 80, "message": "Saving results"}
        
        # Save results
        results_file = f"results/{project_id}_results.xlsx"
        os.makedirs("results", exist_ok=True)
        results.to_excel(results_file, index=False)
        
        # Update project
        project.results = results_file
        project.applied_rules = [str(rule.id) for rule in rules]
        project.applied_rubrics = [str(rubric.id) for rubric in rubrics]
        
        db.commit()
        
        job_status[job_id] = {
            "status": "completed", 
            "progress": 100, 
            "message": "Analysis completed successfully",
            "results_file": results_file,
            "total_genes": len(results)
        }
        
    except Exception as e:
        job_status[job_id] = {
            "status": "failed", 
            "progress": 0, 
            "message": f"Analysis failed: {str(e)}"
        }