import pandas as pd
import numpy as np
import pickle
import os
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path
from datetime import datetime
import json

class ResultCacheService:
    """Service for caching analysis results and score statistics for fast access"""
    
    def __init__(self, cache_dir: str = None):
        if cache_dir is None:
            # Use absolute path relative to the backend directory
            import os
            backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            cache_dir = os.path.join(backend_dir, "results_cache")
        
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
        print(f"ResultCacheService initialized with cache directory: {self.cache_dir.absolute()}")
    
    def create_optimized_result_cache(
        self, 
        analysis_id: str, 
        results_df: pd.DataFrame, 
        key_columns: List[str],
        score_columns: List[str],
        scoring_columns: List[str]
    ) -> Dict[str, Any]:
        """
        Create an optimized result pickle file with only necessary columns
        and pre-calculate score statistics for fast access.
        
        Args:
            analysis_id: ID of the analysis
            results_df: Full results DataFrame
            key_columns: List of key columns (e.g., gene_symbol)
            score_columns: List of score columns (e.g., total_score, rule scores)
            scoring_columns: List of columns used for scoring
            
        Returns:
            Dictionary with cache info and statistics
        """
        try:
            # Create optimized DataFrame with only necessary columns
            all_columns = list(set(key_columns + score_columns + scoring_columns))
            available_columns = [col for col in all_columns if col in results_df.columns]
            
            optimized_df = results_df[available_columns].copy()
            
            # Save optimized pickle file
            pickle_filename = f"res_{analysis_id}.pkl"
            pickle_path = self.cache_dir / pickle_filename
            
            with open(pickle_path, 'wb') as f:
                pickle.dump(optimized_df, f)
            
            # Calculate and cache score statistics
            score_stats = self._calculate_score_statistics(optimized_df, score_columns)
            
            # Calculate and cache histograms for score columns
            histograms = self._calculate_score_histograms(optimized_df, score_columns)
            
            # Save statistics cache
            stats_filename = f"stats_{analysis_id}.json"
            stats_path = self.cache_dir / stats_filename
            
            with open(stats_path, 'w') as f:
                json.dump(score_stats, f, indent=2, default=str)
            
            # Save histograms cache
            histograms_filename = f"histograms_{analysis_id}.json"
            histograms_path = self.cache_dir / histograms_filename
            
            with open(histograms_path, 'w') as f:
                json.dump(histograms, f, indent=2, default=str)
            
            # Create cache metadata
            cache_metadata = {
                "analysis_id": analysis_id,
                "created_at": datetime.utcnow().isoformat(),
                "pickle_file": str(pickle_path),
                "stats_file": str(stats_path),
                "histograms_file": str(histograms_path),
                "total_rows": len(optimized_df),
                "columns": {
                    "key_columns": key_columns,
                    "score_columns": score_columns,
                    "scoring_columns": scoring_columns,
                    "available_columns": available_columns
                },
                "file_size_mb": pickle_path.stat().st_size / (1024 * 1024)
            }
            
            # Save metadata
            metadata_filename = f"meta_{analysis_id}.json"
            metadata_path = self.cache_dir / metadata_filename
            
            with open(metadata_path, 'w') as f:
                json.dump(cache_metadata, f, indent=2, default=str)
            
            return cache_metadata
            
        except Exception as e:
            raise Exception(f"Failed to create result cache: {str(e)}")
    
    def _calculate_score_statistics(self, df: pd.DataFrame, score_columns: List[str]) -> Dict[str, Any]:
        """Calculate comprehensive score statistics for all score columns"""
        stats = {}
        
        for col in score_columns:
            if col not in df.columns:
                continue
                
            # Get valid (non-null) values
            valid_values = df[col].dropna()
            total_rows = len(df)
            valid_count = len(valid_values)
            
            if valid_count == 0:
                stats[col] = {
                    "count": 0,
                    "valid_percentage": 0.0,
                    "min": None,
                    "max": None,
                    "mean": None,
                    "median": None,
                    "std": None,
                    "null_count": total_rows,
                    "null_percentage": 100.0
                }
            else:
                stats[col] = {
                    "count": valid_count,
                    "valid_percentage": round((valid_count / total_rows) * 100, 2),
                    "min": float(valid_values.min()),
                    "max": float(valid_values.max()),
                    "mean": float(valid_values.mean()),
                    "median": float(valid_values.median()),
                    "std": float(valid_values.std()) if len(valid_values) > 1 else 0.0,
                    "null_count": total_rows - valid_count,
                    "null_percentage": round(((total_rows - valid_count) / total_rows) * 100, 2)
                }
        
        return stats
    
    def _calculate_score_histograms(self, df: pd.DataFrame, score_columns: List[str]) -> Dict[str, Any]:
        """Calculate histograms for all score columns"""
        histograms = {}
        
        for col in score_columns:
            if col not in df.columns:
                continue
                
            # Get valid (non-null, non-infinite) values
            valid_values = df[col].dropna()
            valid_values = valid_values[np.isfinite(valid_values)]
            
            if len(valid_values) == 0:
                histograms[col] = {
                    "bins": [],
                    "counts": [],
                    "bin_edges": [],
                    "valid_count": 0,
                    "total_count": len(df)
                }
            else:
                try:
                    # Calculate histogram with appropriate number of bins
                    # Use Sturges' rule: bins = ceil(log2(n)) + 1, but cap at 50 for performance
                    n_bins = min(50, max(10, int(np.ceil(np.log2(len(valid_values))) + 1)))
                    
                    counts, bin_edges = np.histogram(valid_values, bins=n_bins)
                    
                    # Convert to JSON-serializable format
                    histograms[col] = {
                        "bins": [float(x) for x in bin_edges[:-1]],  # Left edges of bins
                        "counts": [int(x) for x in counts],
                        "bin_edges": [float(x) for x in bin_edges],
                        "valid_count": len(valid_values),
                        "total_count": len(df),
                        "bin_width": float(bin_edges[1] - bin_edges[0]) if len(bin_edges) > 1 else 0.0
                    }
                except Exception as e:
                    print(f"Warning: Could not calculate histogram for column {col}: {e}")
                    histograms[col] = {
                        "bins": [],
                        "counts": [],
                        "bin_edges": [],
                        "valid_count": 0,
                        "total_count": len(df),
                        "error": str(e)
                    }
        
        return histograms
    
    def load_result_cache(self, analysis_id: str) -> Optional[pd.DataFrame]:
        """Load optimized result DataFrame from cache"""
        pickle_filename = f"res_{analysis_id}.pkl"
        pickle_path = self.cache_dir / pickle_filename
        
        print(f"Looking for cache file: {pickle_path}")
        
        if not pickle_path.exists():
            print(f"Cache file not found: {pickle_path}")
            return None
        
        try:
            with open(pickle_path, 'rb') as f:
                df = pickle.load(f)
                print(f"Successfully loaded cache file: {len(df)} rows, {len(df.columns)} columns")
                return df
        except Exception as e:
            print(f"Failed to load result cache: {str(e)}")
            return None
    
    def load_score_statistics(self, analysis_id: str) -> Optional[Dict[str, Any]]:
        """Load cached score statistics"""
        stats_filename = f"stats_{analysis_id}.json"
        stats_path = self.cache_dir / stats_filename
        
        if not stats_path.exists():
            return None
        
        try:
            with open(stats_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Failed to load score statistics: {str(e)}")
            return None
    
    def load_score_histograms(self, analysis_id: str) -> Optional[Dict[str, Any]]:
        """Load cached score histograms"""
        histograms_filename = f"histograms_{analysis_id}.json"
        histograms_path = self.cache_dir / histograms_filename
        
        if not histograms_path.exists():
            return None
        
        try:
            with open(histograms_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Failed to load score histograms: {str(e)}")
            return None
    
    def load_cache_metadata(self, analysis_id: str) -> Optional[Dict[str, Any]]:
        """Load cache metadata"""
        metadata_filename = f"meta_{analysis_id}.json"
        metadata_path = self.cache_dir / metadata_filename
        
        if not metadata_path.exists():
            return None
        
        try:
            with open(metadata_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Failed to load cache metadata: {str(e)}")
            return None
    
    def delete_result_cache(self, analysis_id: str) -> bool:
        """Delete all cache files for an analysis"""
        try:
            files_to_delete = [
                f"res_{analysis_id}.pkl",
                f"stats_{analysis_id}.json",
                f"meta_{analysis_id}.json"
            ]
            
            deleted_count = 0
            for filename in files_to_delete:
                file_path = self.cache_dir / filename
                if file_path.exists():
                    file_path.unlink()
                    deleted_count += 1
            
            return deleted_count > 0
        except Exception as e:
            print(f"Failed to delete result cache: {str(e)}")
            return False
    
    def list_cached_analyses(self) -> List[Dict[str, Any]]:
        """List all cached analyses with metadata"""
        cached_analyses = []
        
        try:
            for metadata_file in self.cache_dir.glob("meta_*.json"):
                try:
                    with open(metadata_file, 'r') as f:
                        metadata = json.load(f)
                        cached_analyses.append(metadata)
                except Exception as e:
                    print(f"Failed to read metadata file {metadata_file}: {str(e)}")
                    continue
        
        except Exception as e:
            print(f"Failed to list cached analyses: {str(e)}")
        
        return sorted(cached_analyses, key=lambda x: x.get('created_at', ''), reverse=True)
    
    def get_cache_size(self) -> Dict[str, Any]:
        """Get total cache size and file count"""
        try:
            total_size = 0
            file_count = 0
            
            for file_path in self.cache_dir.iterdir():
                if file_path.is_file():
                    total_size += file_path.stat().st_size
                    file_count += 1
            
            return {
                "total_size_mb": round(total_size / (1024 * 1024), 2),
                "file_count": file_count,
                "cache_dir": str(self.cache_dir)
            }
        except Exception as e:
            return {
                "total_size_mb": 0,
                "file_count": 0,
                "cache_dir": str(self.cache_dir),
                "error": str(e)
            }
