"""
API endpoints for Omics View - Gene-centric heatmap visualization
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import pandas as pd
import numpy as np
from datetime import datetime

from app.models.result_database import get_result_db
from app.models.result_analysis_result import AnalysisResult, AnalysisResultTracker
from app.services.omics_utils import OmicsDataService
from app.schemas.omics_view import (
    OmicsViewData,
    GeneFilterRequest,
    GeneSortRequest,
    HeatmapData,
    ColorSchemeRequest,
    GeneListUploadRequest
)

router = APIRouter(prefix="/api/omics-view", tags=["omics-view"])


@router.get("/analysis/{analysis_id}/data/", response_model=OmicsViewData)
async def get_omics_view_data(
    analysis_id: str,
    limit: int = Query(50, ge=1, le=1000, description="Maximum number of genes to display"),
    sort_by: str = Query("total_score", description="Sort by: total_score, gene_symbol, or rule name"),
    sort_order: str = Query("desc", description="Sort order: asc or desc"),
    filter_genes: Optional[str] = Query(None, description="Comma-separated list of gene symbols to filter"),
    annotation_filter: Optional[str] = Query(None, description="Filter by annotation criteria"),
    rubric_scaling: str = Query("none", description="Scaling for rubric scores: none, minmax, standard"),
    numeric_scaling: str = Query("standard", description="Scaling for numeric columns: none, minmax, standard"),
    annotation_scaling: str = Query("standard", description="Scaling for annotations: none, minmax, standard"),
    result_db: Session = Depends(get_result_db)
):
    """
    Get omics view data for a specific analysis result.
    Returns gene-centric data for heatmap visualization.
    """
    
    try:
        service = OmicsDataService(result_db)
        
        # Get analysis result
        analysis_result = result_db.query(AnalysisResult).filter(
            AnalysisResult.id == analysis_id
        ).first()
        
        if not analysis_result:
            raise HTTPException(status_code=404, detail="Analysis result not found")
        
        # Get tracker to find storage location
        tracker = result_db.query(AnalysisResultTracker).filter(
            AnalysisResultTracker.analysis_result_id == analysis_id
        ).first()
        
        # Determine data source
        table_name = None
        if tracker and tracker.storage_type == "wide_table":
            table_name = tracker.storage_location
        
        # Get omics view data
        scaling_methods = {
            'rubric_scores': rubric_scaling,
            'numeric_columns': numeric_scaling,
            'annotations': annotation_scaling
        }
        
        omics_data = await service.get_omics_view_data(
            analysis_id=analysis_id,
            table_name=table_name,
            limit=limit,
            sort_by=sort_by,
            sort_order=sort_order,
            filter_genes=filter_genes.split(',') if filter_genes else None,
            annotation_filter=annotation_filter,
            scaling_methods=scaling_methods
        )
        
        return omics_data
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Omics view error: {str(e)}")
        print(f"Traceback: {error_details}")
        raise HTTPException(status_code=500, detail=f"Error retrieving omics view data: {str(e)}")


@router.post("/analysis/{analysis_id}/filter-genes")
async def filter_genes(
    analysis_id: str,
    filter_request: GeneFilterRequest,
    result_db: Session = Depends(get_result_db)
):
    """
    Filter genes based on criteria and return filtered gene list.
    """
    
    try:
        service = OmicsDataService(result_db)
        
        # Get analysis result
        analysis_result = result_db.query(AnalysisResult).filter(
            AnalysisResult.id == analysis_id
        ).first()
        
        if not analysis_result:
            raise HTTPException(status_code=404, detail="Analysis result not found")
        
        # Get tracker
        tracker = result_db.query(AnalysisResultTracker).filter(
            AnalysisResultTracker.analysis_result_id == analysis_id
        ).first()
        
        if not tracker:
            raise HTTPException(status_code=404, detail="No data found for this analysis")
        
        # Apply filters
        filtered_genes = await service.filter_genes(
            analysis_id=analysis_id,
            table_name=tracker.storage_location,
            filter_request=filter_request
        )
        
        return {
            "filtered_genes": filtered_genes,
            "total_count": len(filtered_genes),
            "filter_criteria": filter_request.dict()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error filtering genes: {str(e)}")


@router.post("/analysis/{analysis_id}/sort-genes")
async def sort_genes(
    analysis_id: str,
    sort_request: GeneSortRequest,
    result_db: Session = Depends(get_result_db)
):
    """
    Sort genes based on criteria and return sorted gene list.
    """
    
    try:
        service = OmicsDataService(result_db)
        
        # Get analysis result
        analysis_result = result_db.query(AnalysisResult).filter(
            AnalysisResult.id == analysis_id
        ).first()
        
        if not analysis_result:
            raise HTTPException(status_code=404, detail="Analysis result not found")
        
        # Get tracker
        tracker = result_db.query(AnalysisResultTracker).filter(
            AnalysisResultTracker.analysis_result_id == analysis_id
        ).first()
        
        if not tracker:
            raise HTTPException(status_code=404, detail="No data found for this analysis")
        
        # Apply sorting
        sorted_genes = await service.sort_genes(
            analysis_id=analysis_id,
            table_name=tracker.storage_location,
            sort_request=sort_request
        )
        
        return {
            "sorted_genes": sorted_genes,
            "total_count": len(sorted_genes),
            "sort_criteria": sort_request.dict()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error sorting genes: {str(e)}")


@router.post("/analysis/{analysis_id}/upload-gene-list")
async def upload_gene_list(
    analysis_id: str,
    gene_list_request: GeneListUploadRequest,
    result_db: Session = Depends(get_result_db)
):
    """
    Upload a gene list and return matching genes from the analysis.
    """
    
    try:
        service = OmicsDataService(result_db)
        
        # Get analysis result
        analysis_result = result_db.query(AnalysisResult).filter(
            AnalysisResult.id == analysis_id
        ).first()
        
        if not analysis_result:
            raise HTTPException(status_code=404, detail="Analysis result not found")
        
        # Get tracker
        tracker = result_db.query(AnalysisResultTracker).filter(
            AnalysisResultTracker.analysis_result_id == analysis_id
        ).first()
        
        if not tracker:
            raise HTTPException(status_code=404, detail="No data found for this analysis")
        
        # Process gene list
        matching_genes = await service.process_gene_list(
            analysis_id=analysis_id,
            table_name=tracker.storage_location,
            gene_list_request=gene_list_request
        )
        
        return {
            "matching_genes": matching_genes,
            "total_uploaded": len(gene_list_request.gene_symbols),
            "total_matched": len(matching_genes),
            "match_rate": len(matching_genes) / len(gene_list_request.gene_symbols) if gene_list_request.gene_symbols else 0
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing gene list: {str(e)}")


@router.get("/analysis/{analysis_id}/heatmap-data/{heatmap_type}")
async def get_heatmap_data(
    analysis_id: str,
    heatmap_type: str,
    gene_symbols: Optional[str] = Query(None, description="Comma-separated list of gene symbols"),
    result_db: Session = Depends(get_result_db)
):
    """
    Get specific heatmap data for visualization.
    heatmap_type: 'rubric_scores', 'numeric_columns', 'annotations'
    """
    
    try:
        service = OmicsDataService(result_db)
        
        # Get analysis result
        analysis_result = result_db.query(AnalysisResult).filter(
            AnalysisResult.id == analysis_id
        ).first()
        
        if not analysis_result:
            raise HTTPException(status_code=404, detail="Analysis result not found")
        
        # Get tracker
        tracker = result_db.query(AnalysisResultTracker).filter(
            AnalysisResultTracker.analysis_result_id == analysis_id
        ).first()
        
        if not tracker:
            raise HTTPException(status_code=404, detail="No data found for this analysis")
        
        # Get heatmap data
        heatmap_data = await service.get_heatmap_data(
            analysis_id=analysis_id,
            table_name=tracker.storage_location,
            heatmap_type=heatmap_type,
            gene_symbols=gene_symbols.split(',') if gene_symbols else None
        )
        
        return heatmap_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving heatmap data: {str(e)}")


@router.get("/analysis/{analysis_id}/available-columns")
async def get_available_columns(
    analysis_id: str,
    result_db: Session = Depends(get_result_db)
):
    """
    Get available columns for heatmap visualization.
    """
    
    try:
        service = OmicsDataService(result_db)
        
        # Get analysis result
        analysis_result = result_db.query(AnalysisResult).filter(
            AnalysisResult.id == analysis_id
        ).first()
        
        if not analysis_result:
            raise HTTPException(status_code=404, detail="Analysis result not found")
        
        # Get tracker
        tracker = result_db.query(AnalysisResultTracker).filter(
            AnalysisResultTracker.analysis_result_id == analysis_id
        ).first()
        
        if not tracker:
            raise HTTPException(status_code=404, detail="No data found for this analysis")
        
        # Get available columns
        columns = await service.get_available_columns(
            analysis_id=analysis_id,
            table_name=tracker.storage_location
        )
        
        return columns
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving available columns: {str(e)}")


@router.post("/analysis/{analysis_id}/color-scheme")
async def update_color_scheme(
    analysis_id: str,
    color_scheme_request: ColorSchemeRequest,
    result_db: Session = Depends(get_result_db)
):
    """
    Update color scheme for heatmap visualization.
    """
    
    try:
        service = OmicsDataService(result_db)
        
        # Store color scheme preferences (could be stored in database or cache)
        color_scheme = await service.update_color_scheme(
            analysis_id=analysis_id,
            color_scheme_request=color_scheme_request
        )
        
        return {
            "color_scheme": color_scheme,
            "updated_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating color scheme: {str(e)}")


@router.get("/analysis/{analysis_id}/gene-annotations")
async def get_gene_annotations(
    analysis_id: str,
    gene_symbols: Optional[str] = Query(None, description="Comma-separated list of gene symbols"),
    result_db: Session = Depends(get_result_db)
):
    """
    Get gene annotations for the specified genes.
    This endpoint will be enhanced when annotation data is available.
    """
    
    try:
        service = OmicsDataService(result_db)
        
        # Get gene annotations (placeholder for future implementation)
        annotations = await service.get_gene_annotations(
            analysis_id=analysis_id,
            gene_symbols=gene_symbols.split(',') if gene_symbols else None
        )
        
        return {
            "annotations": annotations,
            "total_genes": len(annotations),
            "note": "Annotation data not yet available - using placeholder data"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving gene annotations: {str(e)}")
