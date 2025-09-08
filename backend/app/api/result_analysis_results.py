from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import os
from app.models.database import get_db
from app.models.result_database import get_result_db
from app.models.result_analysis_result import AnalysisResult, AnalysisResultTracker
from app.schemas.result_analysis_result import (
    ResultAnalysisResultResponse,
    AnalysisResultsResponse,
    AnalysisSummaryResponse,
    AnalysisExecutionRequest,
    AnalysisExecutionResponse,
    AnalysisResultWithWideTable
)
from app.services.result_analysis_service import ResultAnalysisService
import uuid

router = APIRouter()


@router.post("/execute", response_model=AnalysisExecutionResponse)
async def execute_analysis(
    request: AnalysisExecutionRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    result_db: Session = Depends(get_result_db)
):
    """Execute a rubric analysis and save results to result database"""
    
    service = ResultAnalysisService()
    
    try:
        # Create analysis result record
        analysis_result = service.create_analysis_result(
            project_id=request.project_id,
            rubric_id=request.rubric_id,
            dataset_id=request.dataset_id,
            key_column=request.key_column
        )
        
        # Start background analysis (this would integrate with existing analysis executor)
        # For now, return the created analysis result
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
            error_message=analysis_result.error_message,
            results_table_name=analysis_result.results_table_name
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis execution failed: {str(e)}")


@router.get("/")
async def list_analysis_results(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    rubric_id: Optional[str] = Query(None, description="Filter by rubric ID"),
    dataset_id: Optional[str] = Query(None, description="Filter by dataset ID"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    result_db: Session = Depends(get_result_db)
):
    """List analysis results with optional filtering"""
    
    try:
        query = result_db.query(AnalysisResult)
        
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
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving analysis results: {str(e)}")


@router.get("/{analysis_result_id}", response_model=AnalysisResultWithWideTable)
async def get_analysis_result(
    analysis_result_id: str,
    result_db: Session = Depends(get_result_db)
):
    """Get a specific analysis result with wide table information"""
    
    service = ResultAnalysisService()
    
    try:
        # Get analysis result
        analysis_result = result_db.query(AnalysisResult).filter(
            AnalysisResult.id == analysis_result_id
        ).first()
        
        if not analysis_result:
            raise HTTPException(status_code=404, detail="Analysis result not found")
        
        # Get tracker information
        tracker = result_db.query(AnalysisResultTracker).filter(
            AnalysisResultTracker.analysis_result_id == analysis_result_id
        ).first()
        
        # Get wide table info if available
        wide_table_info = None
        if tracker and tracker.storage_type == "wide_table":
            # Get table statistics
            from sqlalchemy import text, inspect
            
            inspector = inspect(result_db.bind)
            if inspector.has_table(tracker.storage_location):
                columns = inspector.get_columns(tracker.storage_location)
                rule_columns = [col['name'] for col in columns if col['name'].endswith('_score') and not col['name'].startswith('total_')]
                
                # Get row count
                count_query = text(f"SELECT COUNT(*) FROM {tracker.storage_location}")
                total_genes = result_db.execute(count_query).scalar()
                
                wide_table_info = {
                    "table_name": tracker.storage_location,
                    "analysis_result_id": analysis_result_id,
                    "total_genes": total_genes,
                    "total_rules": len(rule_columns),
                    "rule_columns": rule_columns,
                    "created_date": analysis_result.created_date
                }
        
        return AnalysisResultWithWideTable(
            **analysis_result.__dict__,
            wide_table_info=wide_table_info,
            tracker=tracker
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving analysis result: {str(e)}")


@router.get("/{analysis_result_id}/results", response_model=AnalysisResultsResponse)
async def get_analysis_results(
    analysis_result_id: str,
    limit: int = Query(1000, ge=1, le=10000, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    result_db: Session = Depends(get_result_db)
):
    """Get analysis results with pagination from wide format table"""
    
    service = ResultAnalysisService()
    
    try:
        results = service.get_analysis_results(
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
    result_db: Session = Depends(get_result_db)
):
    """Get summary statistics for an analysis result"""
    
    service = ResultAnalysisService()
    
    try:
        summary = service.get_analysis_summary(
            analysis_result_id=analysis_result_id
        )
        return summary
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving summary: {str(e)}")


@router.get("/{analysis_result_id}/genes", response_model=List[dict])
async def get_gene_scores(
    analysis_result_id: str,
    gene_symbols: str = Query(..., description="Comma-separated list of gene symbols"),
    result_db: Session = Depends(get_result_db)
):
    """Get scores for specific genes"""
    
    service = ResultAnalysisService()
    
    try:
        gene_list = [gene.strip() for gene in gene_symbols.split(',')]
        results = service.get_gene_scores(
            analysis_result_id=analysis_result_id,
            gene_symbols=gene_list
        )
        
        # Convert to dict format for response
        return [result.dict() for result in results]
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving gene scores: {str(e)}")


@router.delete("/{analysis_result_id}")
async def delete_analysis_result(
    analysis_result_id: str,
    result_db: Session = Depends(get_result_db)
):
    """Delete an analysis result and all its associated data"""
    
    service = ResultAnalysisService()
    
    try:
        success = service.delete_analysis_result(
            analysis_result_id=analysis_result_id
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="Analysis result not found")
        
        return {"message": "Analysis result deleted successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting analysis result: {str(e)}")


@router.get("/project/{project_id}/latest", response_model=Optional[ResultAnalysisResultResponse])
async def get_latest_analysis_result(
    project_id: str,
    result_db: Session = Depends(get_result_db)
):
    """Get the latest analysis result for a project"""
    
    try:
        analysis_result = result_db.query(AnalysisResult).filter(
            AnalysisResult.project_id == project_id
        ).order_by(AnalysisResult.created_date.desc()).first()
        
        if not analysis_result:
            return None
        
        return analysis_result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving latest analysis result: {str(e)}")


@router.get("/project/{project_id}/history", response_model=List[ResultAnalysisResultResponse])
async def get_project_analysis_history(
    project_id: str,
    limit: int = Query(50, ge=1, le=500, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    result_db: Session = Depends(get_result_db)
):
    """Get analysis history for a project"""
    
    try:
        results = result_db.query(AnalysisResult).filter(
            AnalysisResult.project_id == project_id
        ).order_by(AnalysisResult.created_date.desc()).offset(offset).limit(limit).all()
        
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving analysis history: {str(e)}")


@router.get("/rubric/{rubric_id}/analyses", response_model=List[ResultAnalysisResultResponse])
async def get_rubric_analyses(
    rubric_id: str,
    limit: int = Query(50, ge=1, le=500, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    result_db: Session = Depends(get_result_db)
):
    """Get all analyses for a specific rubric"""
    
    try:
        results = result_db.query(AnalysisResult).filter(
            AnalysisResult.rubric_id == rubric_id
        ).order_by(AnalysisResult.created_date.desc()).offset(offset).limit(limit).all()
        
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving rubric analyses: {str(e)}")


@router.get("/dataset/{dataset_id}/analyses", response_model=List[ResultAnalysisResultResponse])
async def get_dataset_analyses(
    dataset_id: str,
    limit: int = Query(50, ge=1, le=500, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    result_db: Session = Depends(get_result_db)
):
    """Get all analyses for a specific dataset"""
    
    try:
        results = result_db.query(AnalysisResult).filter(
            AnalysisResult.dataset_id == dataset_id
        ).order_by(AnalysisResult.created_date.desc()).offset(offset).limit(limit).all()
        
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving dataset analyses: {str(e)}")


@router.get("/{analysis_result_id}/download")
async def download_analysis_results(
    analysis_result_id: str,
    result_db: Session = Depends(get_result_db)
):
    """Download the Excel results file for an analysis"""
    
    try:
        # Get analysis result
        analysis_result = result_db.query(AnalysisResult).filter(
            AnalysisResult.id == analysis_result_id
        ).first()
        
        if not analysis_result:
            raise HTTPException(status_code=404, detail="Analysis result not found")
        
        if not analysis_result.results_file:
            raise HTTPException(status_code=404, detail="No results file available for this analysis")
        
        # Check if file exists
        if not os.path.exists(analysis_result.results_file):
            raise HTTPException(status_code=404, detail="Results file not found on server")
        
        # Generate filename for download
        filename = f"analysis_results_{analysis_result_id}.xlsx"
        
        return FileResponse(
            path=analysis_result.results_file,
            filename=filename,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error downloading results file: {str(e)}")
