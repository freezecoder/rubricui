from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from app.models.database import get_db
from app.models.analysis_result import AnalysisResult, AnalysisResultDetail
from app.schemas.analysis_result import (
    AnalysisResultResponse,
    AnalysisResultWithDetails,
    AnalysisResultsResponse,
    AnalysisSummaryResponse,
    AnalysisExecutionRequest,
    AnalysisExecutionResponse
)
from app.services.analysis_result_service import AnalysisResultService
import uuid

router = APIRouter()


@router.post("/execute", response_model=AnalysisExecutionResponse)
async def execute_analysis(
    request: AnalysisExecutionRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Execute a rubric analysis and save results to database"""
    
    service = AnalysisResultService()
    
    try:
        # Execute analysis in background
        analysis_result = service.execute_rubric_analysis(
            db=db,
            project_id=request.project_id,
            rubric_id=request.rubric_id,
            dataset_id=request.dataset_id,
            key_column=request.key_column
        )
        
        return AnalysisExecutionResponse(
            id=analysis_result.id,
            project_id=analysis_result.project_id,
            rubric_id=analysis_result.rubric_id,
            dataset_id=analysis_result.dataset_id,
            status=analysis_result.status,
            total_genes_processed=analysis_result.total_genes_processed,
            total_rules_executed=analysis_result.total_rules_executed,
            execution_time_seconds=analysis_result.execution_time_seconds,
            created_date=analysis_result.created_date,
            error_message=analysis_result.error_message
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis execution failed: {str(e)}")


@router.get("/", response_model=List[AnalysisResultResponse])
async def list_analysis_results(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    rubric_id: Optional[str] = Query(None, description="Filter by rubric ID"),
    dataset_id: Optional[str] = Query(None, description="Filter by dataset ID"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    db: Session = Depends(get_db)
):
    """List analysis results with optional filtering"""
    
    query = db.query(AnalysisResult)
    
    # Apply filters
    if project_id:
        query = query.filter(AnalysisResult.project_id == project_id)
    if rubric_id:
        query = query.filter(AnalysisResult.rubric_id == rubric_id)
    if dataset_id:
        query = query.filter(AnalysisResult.dataset_id == dataset_id)
    if status:
        query = query.filter(AnalysisResult.status == status)
    
    # Apply pagination and ordering
    results = query.order_by(AnalysisResult.created_date.desc()).offset(offset).limit(limit).all()
    
    return results


@router.get("/{analysis_result_id}", response_model=AnalysisResultWithDetails)
async def get_analysis_result(
    analysis_result_id: str,
    db: Session = Depends(get_db)
):
    """Get a specific analysis result with all details"""
    
    analysis_result = db.query(AnalysisResult).filter(
        AnalysisResult.id == analysis_result_id
    ).first()
    
    if not analysis_result:
        raise HTTPException(status_code=404, detail="Analysis result not found")
    
    # Get all detail records
    details = db.query(AnalysisResultDetail).filter(
        AnalysisResultDetail.analysis_result_id == analysis_result_id
    ).order_by(
        AnalysisResultDetail.key_column_value,
        AnalysisResultDetail.execution_order
    ).all()
    
    return AnalysisResultWithDetails(
        **analysis_result.__dict__,
        details=details
    )


@router.get("/{analysis_result_id}/results", response_model=AnalysisResultsResponse)
async def get_analysis_results(
    analysis_result_id: str,
    limit: int = Query(1000, ge=1, le=10000, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    db: Session = Depends(get_db)
):
    """Get analysis results with pagination"""
    
    service = AnalysisResultService()
    
    try:
        results = service.get_analysis_results(
            db=db,
            analysis_result_id=analysis_result_id,
            limit=limit,
            offset=offset
        )
        return results
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving results: {str(e)}")


@router.get("/{analysis_result_id}/summary", response_model=AnalysisSummaryResponse)
async def get_analysis_summary(
    analysis_result_id: str,
    db: Session = Depends(get_db)
):
    """Get summary statistics for an analysis result"""
    
    service = AnalysisResultService()
    
    try:
        summary = service.get_analysis_summary(
            db=db,
            analysis_result_id=analysis_result_id
        )
        return summary
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving summary: {str(e)}")


@router.delete("/{analysis_result_id}")
async def delete_analysis_result(
    analysis_result_id: str,
    db: Session = Depends(get_db)
):
    """Delete an analysis result and all its details"""
    
    service = AnalysisResultService()
    
    try:
        success = service.delete_analysis_result(
            db=db,
            analysis_result_id=analysis_result_id
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="Analysis result not found")
        
        return {"message": "Analysis result deleted successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting analysis result: {str(e)}")


@router.get("/project/{project_id}/latest", response_model=Optional[AnalysisResultResponse])
async def get_latest_analysis_result(
    project_id: str,
    db: Session = Depends(get_db)
):
    """Get the latest analysis result for a project"""
    
    analysis_result = db.query(AnalysisResult).filter(
        AnalysisResult.project_id == project_id
    ).order_by(AnalysisResult.created_date.desc()).first()
    
    if not analysis_result:
        return None
    
    return analysis_result


@router.get("/project/{project_id}/history", response_model=List[AnalysisResultResponse])
async def get_project_analysis_history(
    project_id: str,
    limit: int = Query(50, ge=1, le=500, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    db: Session = Depends(get_db)
):
    """Get analysis history for a project"""
    
    results = db.query(AnalysisResult).filter(
        AnalysisResult.project_id == project_id
    ).order_by(AnalysisResult.created_date.desc()).offset(offset).limit(limit).all()
    
    return results
