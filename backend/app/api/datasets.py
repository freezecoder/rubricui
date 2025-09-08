from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import shutil
from pathlib import Path

from app.models.database import get_db
from app.models.dataset import Dataset, DatasetColumn, DatasetHistogram
from app.schemas.dataset import (
    DatasetCreate, DatasetResponse, DatasetSummary, DatasetStats,
    DatasetColumnResponse, DatasetAnalysisRequest, DatasetAdminUpdate,
    DatasetHistogramResponse, DatasetHistogramSummary, DatasetHistogramWithColumn,
    DatasetHistogramRequest
)
from app.services.dataset_processor import DatasetProcessor

router = APIRouter()

# Initialize dataset processor
dataset_processor = DatasetProcessor()

@router.post("/", response_model=DatasetResponse)
async def create_dataset(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    owner_name: Optional[str] = Form(None),
    organization: Optional[str] = Form(None),
    disease_area_study: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload and process a new dataset"""
    
    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in ['.xlsx', '.xls', '.csv']:
        raise HTTPException(
            status_code=400, 
            detail="Unsupported file format. Please upload Excel (.xlsx, .xls) or CSV files."
        )
    
    # Save uploaded file
    upload_dir = Path("uploads")
    upload_dir.mkdir(exist_ok=True)
    
    file_path = upload_dir / file.filename
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving file: {str(e)}")
    
    # Create dataset info
    dataset_info = DatasetCreate(
        name=name,
        description=description,
        owner_name=owner_name,
        organization=organization,
        disease_area_study=disease_area_study,
        tags=tags
    )
    
    try:
        # Process the file
        dataset, columns = dataset_processor.process_file(str(file_path), dataset_info)
        
        # Save to database
        db.add(dataset)
        for column in columns:
            db.add(column)
        db.commit()
        db.refresh(dataset)
        
        # Generate histograms for numeric columns
        try:
            histograms = dataset_processor.process_histograms_after_upload(db, dataset.id)
            if histograms:
                db.commit()
                print(f"Generated {len(histograms)} histograms for dataset {dataset.id}")
        except Exception as e:
            print(f"Warning: Failed to generate histograms for dataset {dataset.id}: {e}")
            # Don't fail the upload if histogram generation fails
        
        # Load columns for response
        db.refresh(dataset)
        return dataset
        
    except Exception as e:
        db.rollback()
        # Clean up uploaded file on error
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Error processing dataset: {str(e)}")

@router.get("/", response_model=List[DatasetSummary])
async def list_datasets(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    organization: Optional[str] = Query(None),
    owner_name: Optional[str] = Query(None),
    disease_area_study: Optional[str] = Query(None),
    tags: Optional[str] = Query(None),
    visibility: Optional[str] = Query(None, description="Filter by visibility: public, private, hidden"),
    enabled: Optional[bool] = Query(None, description="Filter by enabled status"),
    admin_view: bool = Query(False, description="Include all datasets regardless of visibility (admin only)"),
    db: Session = Depends(get_db)
):
    """List all datasets with optional filtering"""
    
    query = db.query(Dataset)
    
    # Apply visibility and enabled filters (unless admin view)
    if not admin_view:
        query = query.filter(Dataset.visibility == "public")
        query = query.filter(Dataset.enabled == True)
    else:
        # Admin view - apply filters if specified
        if visibility:
            query = query.filter(Dataset.visibility == visibility)
        if enabled is not None:
            query = query.filter(Dataset.enabled == enabled)
    
    # Apply filters
    if organization:
        query = query.filter(Dataset.organization.ilike(f"%{organization}%"))
    if owner_name:
        query = query.filter(Dataset.owner_name.ilike(f"%{owner_name}%"))
    if disease_area_study:
        query = query.filter(Dataset.disease_area_study.ilike(f"%{disease_area_study}%"))
    if tags:
        # Search for tags in comma-separated string
        query = query.filter(Dataset.tags.ilike(f"%{tags}%"))
    
    # Apply pagination and ordering
    datasets = query.order_by(Dataset.created_date.desc()).offset(skip).limit(limit).all()
    
    return datasets

@router.get("/{dataset_id}", response_model=DatasetResponse)
async def get_dataset(
    dataset_id: str, 
    admin_view: bool = Query(False, description="Include hidden datasets (admin only)"),
    db: Session = Depends(get_db)
):
    """Get a specific dataset by ID"""
    
    query = db.query(Dataset).filter(Dataset.id == dataset_id)
    
    # Apply visibility filter unless admin view
    if not admin_view:
        query = query.filter(Dataset.visibility == "public")
        query = query.filter(Dataset.enabled == True)
    
    dataset = query.first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    return dataset

@router.get("/{dataset_id}/columns", response_model=List[DatasetColumnResponse])
async def get_dataset_columns(
    dataset_id: str,
    column_type: Optional[str] = Query(None, pattern="^(numeric|string|score)$"),
    db: Session = Depends(get_db)
):
    """Get columns for a specific dataset"""
    
    # Verify dataset exists
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    query = db.query(DatasetColumn).filter(DatasetColumn.dataset_id == dataset_id)
    
    if column_type:
        query = query.filter(DatasetColumn.column_type == column_type)
    
    columns = query.order_by(DatasetColumn.column_index).all()
    return columns

@router.get("/{dataset_id}/stats", response_model=DatasetStats)
async def get_dataset_stats(dataset_id: str, db: Session = Depends(get_db)):
    """Get comprehensive statistics for a dataset"""
    
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    columns = db.query(DatasetColumn).filter(
        DatasetColumn.dataset_id == dataset_id
    ).order_by(DatasetColumn.column_index).all()
    
    return DatasetStats(
        total_rows=dataset.num_rows,
        total_columns=dataset.num_columns,
        numeric_columns=dataset.num_numeric_columns,
        string_columns=dataset.num_string_columns,
        score_columns=dataset.num_score_columns,
        column_details=columns
    )

@router.get("/{dataset_id}/column-mapping")
async def get_column_mapping(dataset_id: str, db: Session = Depends(get_db)):
    """Get mapping of sanitized column names to original column names"""
    
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    mapping = dataset_processor.get_column_mapping(db, dataset_id)
    return {
        "dataset_id": dataset_id,
        "column_mapping": mapping,
        "total_columns": len(mapping)
    }

@router.post("/{dataset_id}/validate-rubric")
async def validate_dataset_for_rubric(
    dataset_id: str,
    required_columns: List[str],
    db: Session = Depends(get_db)
):
    """Validate that a dataset has all required columns for a rubric"""
    
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    validation_result = dataset_processor.validate_dataset_for_rubric(
        db, dataset_id, required_columns
    )
    
    return {
        "dataset_id": dataset_id,
        "validation_result": validation_result
    }

@router.delete("/{dataset_id}")
async def delete_dataset(dataset_id: str, db: Session = Depends(get_db)):
    """Delete a dataset and all its associated data"""
    
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    try:
        # Delete from database (cascade will handle columns)
        db.delete(dataset)
        db.commit()
        
        # Clean up files
        dataset_processor.cleanup_dataset_files(dataset_id)
        
        # Clean up original uploaded file if it exists
        if dataset.file_path and Path(dataset.file_path).exists():
            Path(dataset.file_path).unlink()
        
        return {"message": "Dataset deleted successfully"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting dataset: {str(e)}")

@router.patch("/{dataset_id}/admin", response_model=DatasetResponse)
async def admin_update_dataset(dataset_id: str, admin_update: DatasetAdminUpdate, db: Session = Depends(get_db)):
    """Admin endpoint to update dataset visibility and enabled status"""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # Update only the fields provided in the admin update
    update_data = admin_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(dataset, key, value)
    
    try:
        db.commit()
        db.refresh(dataset)
        return dataset
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating dataset: {str(e)}")

@router.put("/{dataset_id}", response_model=DatasetResponse)
async def update_dataset(
    dataset_id: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    owner_name: Optional[str] = None,
    organization: Optional[str] = None,
    disease_area_study: Optional[str] = None,
    tags: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Update dataset metadata"""
    
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # Update fields if provided
    if name is not None:
        dataset.name = name
    if description is not None:
        dataset.description = description
    if owner_name is not None:
        dataset.owner_name = owner_name
    if organization is not None:
        dataset.organization = organization
    if disease_area_study is not None:
        dataset.disease_area_study = disease_area_study
    if tags is not None:
        dataset.tags = tags
    
    try:
        db.commit()
        db.refresh(dataset)
        return dataset
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating dataset: {str(e)}")

# Histogram endpoints

@router.get("/{dataset_id}/histograms", response_model=List[DatasetHistogramSummary])
async def get_dataset_histograms(
    dataset_id: str,
    column_id: Optional[str] = Query(None, description="Filter by specific column ID"),
    db: Session = Depends(get_db)
):
    """Get all histograms for a dataset"""
    
    # Verify dataset exists
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    query = db.query(DatasetHistogram).filter(DatasetHistogram.dataset_id == dataset_id)
    
    if column_id:
        query = query.filter(DatasetHistogram.column_id == column_id)
    
    histograms = query.order_by(DatasetHistogram.created_date.desc()).all()
    return histograms

@router.get("/{dataset_id}/histograms/{histogram_id}", response_model=DatasetHistogramWithColumn)
async def get_histogram(
    dataset_id: str,
    histogram_id: str,
    db: Session = Depends(get_db)
):
    """Get a specific histogram with column information"""
    
    # Verify dataset exists
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # Get histogram
    histogram = db.query(DatasetHistogram).filter(
        DatasetHistogram.id == histogram_id,
        DatasetHistogram.dataset_id == dataset_id
    ).first()
    
    if not histogram:
        raise HTTPException(status_code=404, detail="Histogram not found")
    
    # Get column information
    column = db.query(DatasetColumn).filter(DatasetColumn.id == histogram.column_id).first()
    if not column:
        raise HTTPException(status_code=404, detail="Column not found")
    
    return DatasetHistogramWithColumn(
        histogram=histogram,
        column=column
    )

@router.post("/{dataset_id}/histograms/generate", response_model=List[DatasetHistogramResponse])
async def generate_histograms(
    dataset_id: str,
    request: DatasetHistogramRequest,
    db: Session = Depends(get_db)
):
    """Generate histograms for numeric columns in a dataset"""
    
    # Verify dataset exists
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    try:
        # Generate histograms
        histograms = dataset_processor.generate_histograms_for_dataset(
            db, dataset_id, request.bin_count, request.column_ids
        )
        
        # Save to database
        for histogram in histograms:
            db.add(histogram)
        
        db.commit()
        
        # Refresh histograms to get IDs
        for histogram in histograms:
            db.refresh(histogram)
        
        return histograms
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error generating histograms: {str(e)}")

@router.delete("/{dataset_id}/histograms/{histogram_id}")
async def delete_histogram(
    dataset_id: str,
    histogram_id: str,
    db: Session = Depends(get_db)
):
    """Delete a specific histogram"""
    
    # Verify dataset exists
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # Get histogram
    histogram = db.query(DatasetHistogram).filter(
        DatasetHistogram.id == histogram_id,
        DatasetHistogram.dataset_id == dataset_id
    ).first()
    
    if not histogram:
        raise HTTPException(status_code=404, detail="Histogram not found")
    
    try:
        db.delete(histogram)
        db.commit()
        return {"message": "Histogram deleted successfully"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting histogram: {str(e)}")

@router.delete("/{dataset_id}/histograms")
async def delete_all_histograms(
    dataset_id: str,
    db: Session = Depends(get_db)
):
    """Delete all histograms for a dataset"""
    
    # Verify dataset exists
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    try:
        # Delete all histograms for this dataset
        db.query(DatasetHistogram).filter(DatasetHistogram.dataset_id == dataset_id).delete()
        db.commit()
        return {"message": "All histograms deleted successfully"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting histograms: {str(e)}")
