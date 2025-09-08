from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
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
async def get_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    owner_name: Optional[str] = None,
    organization: Optional[str] = None,
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Update fields if provided
    if name is not None:
        project.name = name
    if description is not None:
        project.description = description
    if owner_name is not None:
        project.owner_name = owner_name
    if organization is not None:
        project.organization = organization
    
    try:
        db.commit()
        db.refresh(project)
        return project
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating project: {str(e)}")

@router.delete("/{project_id}")
async def delete_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    try:
        # Clean up uploaded file if it exists
        if project.input_data_file and os.path.exists(project.input_data_file):
            os.remove(project.input_data_file)
        
        db.delete(project)
        db.commit()
        return {"message": "Project deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting project: {str(e)}")

@router.post("/{project_id}/upload")
async def upload_project_data(
    project_id: str, 
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
async def preview_project_data(project_id: str, db: Session = Depends(get_db)):
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
async def list_project_datasets(project_id: str, db: Session = Depends(get_db)):
    """Get all available datasets for analysis with this project.
    
    This endpoint returns all datasets from the database that are available for analysis.
    Any dataset can be used with any project for analysis purposes.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get all available datasets from the database
    from app.models.dataset import Dataset
    
    # Query all public and enabled datasets
    datasets_query = db.query(Dataset).filter(
        Dataset.visibility == "public",
        Dataset.enabled == True
    ).order_by(Dataset.created_date.desc())
    
    datasets = []
    for dataset in datasets_query.all():
        # Check if the pickled file exists to determine status
        import os
        pickled_exists = os.path.exists(dataset.pickled_path) if dataset.pickled_path else False
        original_exists = os.path.exists(dataset.file_path) if dataset.file_path else False
        
        # Determine status based on file existence
        if pickled_exists and original_exists:
            status = "ready"
        elif original_exists:
            status = "processing"  # Original file exists but not processed yet
        else:
            status = "error"  # Files missing
        
        datasets.append({
            "id": dataset.id,
            "name": dataset.name,
            "filename": dataset.original_filename,
            "file_path": dataset.file_path,
            "size": f"{dataset.num_rows} rows, {dataset.num_columns} cols",
            "upload_date": dataset.created_date.isoformat(),
            "status": status
        })
    
    return datasets

@router.delete("/{project_id}/datasets/{dataset_id}")
async def delete_project_dataset(
    project_id: str, 
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
async def get_analysis_history(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {
        "execution_history": project.execution_history or [],
        "total_analyses": len(project.execution_history or [])
    }