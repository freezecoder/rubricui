from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from app.models.database import get_db
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectResponse
from app.services.file_processor import FileProcessor
import uuid
import os

router = APIRouter()

@router.post("/", response_model=ProjectResponse)
async def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    db_project = Project(**project.dict())
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

@router.get("/", response_model=List[ProjectResponse])
async def list_projects(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    projects = db.query(Project).offset(skip).limit(limit).all()
    return projects

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: uuid.UUID, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.post("/{project_id}/upload")
async def upload_project_data(
    project_id: uuid.UUID, 
    file: UploadFile = File(...), 
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Validate file type
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files are supported")
    
    # Save file
    upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, f"{project_id}_{file.filename}")
    
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
    
    # Process file to validate structure
    file_processor = FileProcessor()
    try:
        data_info = file_processor.validate_file(file_path)
        project.input_data_file = file_path
        db.commit()
        
        return {
            "message": "File uploaded successfully",
            "file_path": file_path,
            "data_info": data_info
        }
    except Exception as e:
        # Clean up file if validation fails
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=400, detail=f"File validation failed: {str(e)}")

@router.get("/{project_id}/data-preview")
async def preview_project_data(project_id: uuid.UUID, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if not project.input_data_file:
        raise HTTPException(status_code=404, detail="No data file uploaded")
    
    file_processor = FileProcessor()
    try:
        preview = file_processor.get_file_preview(project.input_data_file)
        return preview
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")

@router.get("/{project_id}/datasets")
async def list_project_datasets(project_id: uuid.UUID, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    datasets = []
    if project.input_data_file and os.path.exists(project.input_data_file):
        file_stats = os.stat(project.input_data_file)
        file_size = file_stats.st_size
        file_size_mb = round(file_size / (1024 * 1024), 2)
        
        datasets.append({
            "id": "1",
            "name": os.path.basename(project.input_data_file).replace('.xlsx', '').replace('.xls', ''),
            "filename": os.path.basename(project.input_data_file),
            "file_path": project.input_data_file,
            "size": f"{file_size_mb} MB",
            "upload_date": project.created_date.isoformat(),
            "status": "ready"
        })
    
    return datasets

@router.delete("/{project_id}/datasets/{dataset_id}")
async def delete_project_dataset(
    project_id: uuid.UUID, 
    dataset_id: str, 
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # For now, we only support one dataset per project
    if dataset_id == "1" and project.input_data_file:
        # Remove the file
        if os.path.exists(project.input_data_file):
            os.remove(project.input_data_file)
        
        # Clear the file path from the project
        project.input_data_file = None
        db.commit()
        
        return {"message": "Dataset deleted successfully"}
    
    raise HTTPException(status_code=404, detail="Dataset not found")

@router.get("/{project_id}/analysis-history")
async def get_analysis_history(project_id: uuid.UUID, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {
        "execution_history": project.execution_history or [],
        "total_analyses": len(project.execution_history or [])
    }