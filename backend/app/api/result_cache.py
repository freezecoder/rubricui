from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from app.models.database import get_db
from app.models.result_database import get_result_db
from app.services.result_cache_service import ResultCacheService
from app.services.analysis_result_service import AnalysisResultService
import pandas as pd
import numpy as np

router = APIRouter()

@router.get("/{analysis_id}/cached-results")
async def get_cached_analysis_results(
    analysis_id: str,
    limit: int = Query(1000, ge=1, le=10000, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    cache_service: ResultCacheService = Depends(lambda: ResultCacheService())
):
    """Get analysis results from optimized cache with pagination"""
    
    try:
        # Load cached results
        results_df = cache_service.load_result_cache(analysis_id)
        
        if results_df is None:
            raise HTTPException(status_code=404, detail="Cached results not found")
        
        print(f"Loaded cached results: {len(results_df)} rows, columns: {list(results_df.columns)}")
        
        # Apply pagination
        total_count = len(results_df)
        paginated_df = results_df.iloc[offset:offset + limit]
        
        # Clean the DataFrame to handle NaN and infinite values before JSON serialization
        cleaned_df = paginated_df.copy()
        
        # Replace NaN and infinite values with None for JSON compatibility
        for col in cleaned_df.columns:
            if cleaned_df[col].dtype in ['float64', 'float32']:
                # Replace NaN and infinite values with None
                cleaned_df[col] = cleaned_df[col].replace([np.inf, -np.inf], None)
                cleaned_df[col] = cleaned_df[col].where(pd.notna(cleaned_df[col]), None)
        
        # Convert to list of dictionaries
        results = cleaned_df.to_dict('records')
        
        print(f"Returning {len(results)} results for analysis {analysis_id}")
        
        return {
            "analysis_id": analysis_id,
            "results": results,
            "pagination": {
                "limit": limit,
                "offset": offset,
                "total_count": total_count,
                "has_more": offset + limit < total_count
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error loading cached results for {analysis_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error loading cached results: {str(e)}")

@router.get("/{analysis_id}/score-statistics")
async def get_cached_score_statistics(
    analysis_id: str,
    cache_service: ResultCacheService = Depends(lambda: ResultCacheService())
):
    """Get cached score statistics for fast access"""
    
    try:
        stats = cache_service.load_score_statistics(analysis_id)
        
        if stats is None:
            raise HTTPException(status_code=404, detail="Score statistics not found")
        
        return {
            "analysis_id": analysis_id,
            "score_statistics": stats
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading score statistics: {str(e)}")

@router.get("/{analysis_id}/histograms")
async def get_cached_histograms(
    analysis_id: str,
    cache_service: ResultCacheService = Depends(lambda: ResultCacheService())
):
    """Get cached histograms for score columns"""
    
    try:
        histograms = cache_service.load_score_histograms(analysis_id)
        
        if histograms is None:
            raise HTTPException(status_code=404, detail="Histograms not found")
        
        return {
            "analysis_id": analysis_id,
            "histograms": histograms
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading histograms: {str(e)}")

@router.get("/{analysis_id}/cache-metadata")
async def get_cache_metadata(
    analysis_id: str,
    cache_service: ResultCacheService = Depends(lambda: ResultCacheService())
):
    """Get cache metadata for an analysis"""
    
    try:
        metadata = cache_service.load_cache_metadata(analysis_id)
        
        if metadata is None:
            raise HTTPException(status_code=404, detail="Cache metadata not found")
        
        return metadata
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading cache metadata: {str(e)}")

@router.get("/list")
async def list_cached_analyses(
    cache_service: ResultCacheService = Depends(lambda: ResultCacheService())
):
    """List all cached analyses"""
    
    try:
        cached_analyses = cache_service.list_cached_analyses()
        cache_info = cache_service.get_cache_size()
        
        return {
            "cached_analyses": cached_analyses,
            "cache_info": cache_info
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing cached analyses: {str(e)}")

@router.post("/{analysis_id}/recalculate-statistics")
async def recalculate_statistics_with_original_data(
    analysis_id: str,
    cache_service: ResultCacheService = Depends(lambda: ResultCacheService())
):
    """Recalculate score statistics using original dataset for accurate valid percentages"""
    try:
        # Load the cached results
        cached_df = cache_service.load_result_cache(analysis_id)
        if cached_df is None:
            raise HTTPException(status_code=404, detail="Cached analysis not found")
        
        # Load the original dataset
        from app.services.dataset_processor import DatasetProcessor
        from app.models.result_analysis_result import AnalysisResult
        from app.models.result_database import get_result_db
        
        # Get analysis result to find dataset
        result_db = next(get_result_db())
        analysis_result = result_db.query(AnalysisResult).filter(
            AnalysisResult.id == analysis_id
        ).first()
        
        if not analysis_result:
            raise HTTPException(status_code=404, detail="Analysis result not found")
        
        # Load original dataset
        dataset_processor = DatasetProcessor()
        original_df = dataset_processor.load_dataset(analysis_result.dataset_id)
        
        # Get score columns from cached data
        score_columns = [col for col in cached_df.columns if col.endswith('_SCORE')]
        
        # Recalculate statistics using original data
        corrected_stats = cache_service._calculate_score_statistics_with_original_data(
            cached_df, score_columns, original_df
        )
        
        # Save corrected statistics
        stats_filename = f"stats_{analysis_id}.json"
        stats_path = cache_service.cache_dir / stats_filename
        
        import json
        with open(stats_path, 'w') as f:
            json.dump(corrected_stats, f, indent=2)
        
        return {
            "success": True,
            "analysis_id": analysis_id,
            "corrected_statistics": corrected_stats,
            "message": "Statistics recalculated using original dataset"
        }
        
    except Exception as e:
        print(f"Error recalculating statistics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error recalculating statistics: {str(e)}")

@router.delete("/{analysis_id}")
async def delete_cached_analysis(
    analysis_id: str,
    cache_service: ResultCacheService = Depends(lambda: ResultCacheService())
):
    """Delete cached analysis data"""
    
    try:
        success = cache_service.delete_result_cache(analysis_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Cached analysis not found")
        
        return {"message": "Cached analysis deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting cached analysis: {str(e)}")

@router.get("/{analysis_id}/summary")
async def get_cached_analysis_summary(
    analysis_id: str,
    cache_service: ResultCacheService = Depends(lambda: ResultCacheService())
):
    """Get a summary of cached analysis results"""
    
    try:
        # Load metadata and statistics
        metadata = cache_service.load_cache_metadata(analysis_id)
        stats = cache_service.load_score_statistics(analysis_id)
        
        if metadata is None:
            raise HTTPException(status_code=404, detail="Cached analysis not found")
        
        # Calculate summary statistics
        summary = {
            "analysis_result_id": analysis_id,
            "total_genes": metadata.get("total_rows", 0),
            "total_rules": 0,  # Will be calculated from rule_statistics
            "created_at": metadata.get("created_at"),
            "file_size_mb": metadata.get("file_size_mb", 0),
            "score_distribution": {},
            "rule_statistics": [],
            "top_genes": [],
            "score_statistics": {}
        }
        
        if stats:
            # Convert score statistics to the format expected by frontend
            for score_name, score_stats in stats.items():
                # Clean statistics to handle NaN and infinite values
                def clean_stat_value(value):
                    if value is None or (isinstance(value, float) and (np.isnan(value) or np.isinf(value))):
                        return None
                    return value
                
                summary["score_distribution"][score_name] = {
                    "count": score_stats.get("count", 0),
                    "valid_percentage": clean_stat_value(score_stats.get("valid_percentage")),
                    "min": clean_stat_value(score_stats.get("min")),
                    "max": clean_stat_value(score_stats.get("max")),
                    "mean": clean_stat_value(score_stats.get("mean")),
                    "median": clean_stat_value(score_stats.get("median")),
                    "std": clean_stat_value(score_stats.get("std"))
                }
                
                # Create rule statistics entry (exclude rubric scores)
                if not score_name.endswith("_RUBRIC_SCORE"):
                    # Convert _SCORE to rule name
                    rule_name = score_name.replace("_SCORE", "")
                    summary["rule_statistics"].append({
                        "rule_name": rule_name,
                        "weight": 1.0,  # Default weight, could be stored in metadata
                        "score_stats": {
                            "min": clean_stat_value(score_stats.get("min")),
                            "max": clean_stat_value(score_stats.get("max")),
                            "mean": clean_stat_value(score_stats.get("mean")),
                            "median": clean_stat_value(score_stats.get("median")),
                            "std": clean_stat_value(score_stats.get("std"))
                        }
                    })
            
            # Set total_rules count
            summary["total_rules"] = len(summary["rule_statistics"])
            
            # Get total_score statistics for score_statistics field
            # Look for rubric score column (ends with _RUBRIC_SCORE)
            rubric_score_key = None
            for key in stats.keys():
                if key.endswith("_RUBRIC_SCORE"):
                    rubric_score_key = key
                    break
            
            if rubric_score_key:
                total_score_stats = stats[rubric_score_key]
                summary["score_statistics"] = {
                    "min": clean_stat_value(total_score_stats.get("min")),
                    "max": clean_stat_value(total_score_stats.get("max")),
                    "mean": clean_stat_value(total_score_stats.get("mean")),
                    "median": clean_stat_value(total_score_stats.get("median")),
                    "std": clean_stat_value(total_score_stats.get("std")),
                    "count": total_score_stats.get("count")
                }
            elif "total_score" in stats:
                # Fallback to total_score if it exists
                total_score_stats = stats["total_score"]
                summary["score_statistics"] = {
                    "min": clean_stat_value(total_score_stats.get("min")),
                    "max": clean_stat_value(total_score_stats.get("max")),
                    "mean": clean_stat_value(total_score_stats.get("mean")),
                    "median": clean_stat_value(total_score_stats.get("median")),
                    "std": clean_stat_value(total_score_stats.get("std")),
                    "count": total_score_stats.get("count")
                }
        
        # Generate top_genes from cached results
        try:
            results_df = cache_service.load_result_cache(analysis_id)
            if results_df is not None:
                # Find the rubric score column (ends with _RUBRIC_SCORE)
                rubric_score_col = None
                for col in results_df.columns:
                    if col.endswith("_RUBRIC_SCORE"):
                        rubric_score_col = col
                        break
                
                # Find gene identifier column
                gene_col = None
                if 'gene_symbol' in results_df.columns:
                    gene_col = 'gene_symbol'
                elif 'ensg_id' in results_df.columns:
                    gene_col = 'ensg_id'
                
                if rubric_score_col and gene_col:
                    # Get top 10 genes by rubric score
                    top_genes_df = results_df.nlargest(10, rubric_score_col)[[gene_col, rubric_score_col]]
                    summary["top_genes"] = [
                        {
                            "gene_symbol": str(row[gene_col]),
                            "total_score": float(row[rubric_score_col]) if pd.notna(row[rubric_score_col]) and not np.isinf(row[rubric_score_col]) else None
                        }
                        for _, row in top_genes_df.iterrows()
                    ]
                else:
                    print(f"Missing required columns for top_genes: rubric_score_col={rubric_score_col}, gene_col={gene_col}")
                    summary["top_genes"] = []
        except Exception as e:
            print(f"Failed to generate top_genes: {str(e)}")
            summary["top_genes"] = []
        
        return summary
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading analysis summary: {str(e)}")

@router.get("/{analysis_id}/exists")
async def check_cache_exists(
    analysis_id: str,
    cache_service: ResultCacheService = Depends(lambda: ResultCacheService())
):
    """Check if cache exists for an analysis"""
    
    try:
        metadata = cache_service.load_cache_metadata(analysis_id)
        pickle_exists = cache_service.load_result_cache(analysis_id) is not None
        stats_exists = cache_service.load_score_statistics(analysis_id) is not None
        histograms_exists = cache_service.load_score_histograms(analysis_id) is not None
        
        return {
            "analysis_id": analysis_id,
            "cache_exists": metadata is not None,
            "pickle_exists": pickle_exists,
            "stats_exists": stats_exists,
            "histograms_exists": histograms_exists,
            "metadata": metadata
        }
        
    except Exception as e:
        return {
            "analysis_id": analysis_id,
            "cache_exists": False,
            "pickle_exists": False,
            "stats_exists": False,
            "histograms_exists": False,
            "error": str(e)
        }

@router.post("/{analysis_id}/create-cache")
async def create_analysis_cache(
    analysis_id: str,
    result_db: Session = Depends(get_result_db)
):
    """Manually create cache files for an analysis from Excel file"""
    try:
        # Get analysis result
        from app.models.result_analysis_result import AnalysisResult
        analysis_result = result_db.query(AnalysisResult).filter(
            AnalysisResult.id == analysis_id
        ).first()
        
        if not analysis_result:
            raise HTTPException(status_code=404, detail="Analysis result not found")
        
        if not analysis_result.results_file:
            raise HTTPException(status_code=404, detail="No results file found for this analysis")
        
        # Read Excel file
        df = pd.read_excel(analysis_result.results_file)
        print(f"Loaded Excel file with {len(df)} rows and {len(df.columns)} columns")
        print(f"Columns: {list(df.columns)}")
        
        # Identify columns for caching
        key_columns = ['gene_symbol'] if 'gene_symbol' in df.columns else ['ensg_id'] if 'ensg_id' in df.columns else []
        score_columns = [col for col in df.columns if col.endswith('_SCORE')]
        scoring_columns = [col for col in df.columns if col not in key_columns + score_columns]
        
        print(f"Cache columns - key: {key_columns}, score: {score_columns}, scoring: {scoring_columns[:5]}...")
        
        # Create cache
        cache_service = ResultCacheService()
        cache_metadata = cache_service.create_optimized_result_cache(
            analysis_id=analysis_id,
            results_df=df,
            key_columns=key_columns,
            score_columns=score_columns,
            scoring_columns=scoring_columns
        )
        
        return {
            "success": True,
            "analysis_id": analysis_id,
            "cache_metadata": cache_metadata,
            "message": f"Cache created successfully: {cache_metadata['file_size_mb']:.2f} MB"
        }
        
    except Exception as e:
        print(f"Error creating cache: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create cache: {str(e)}")
