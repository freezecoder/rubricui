"""
Service for managing analysis results in the separate result database.
Handles wide format table creation and data operations.
"""

import uuid
import pandas as pd
import os
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime

from app.models.result_database import get_result_db
from app.models.result_analysis_result import (
    AnalysisResult, AnalysisResultTracker, create_rubric_analysis_table
)
from app.schemas.result_analysis_result import (
    ResultAnalysisResultCreate, ResultAnalysisResultUpdate,
    GeneScoreResult, AnalysisResultsResponse, AnalysisSummaryResponse
)


class ResultAnalysisService:
    """Service for managing analysis results in the result database"""
    
    def __init__(self):
        self.result_db = next(get_result_db())
    
    def create_analysis_result(
        self,
        project_id: str,
        rubric_id: str,
        dataset_id: str,
        key_column: str = "gene_symbol",
        key_column_2: Optional[str] = None
    ) -> AnalysisResult:
        """Create a new analysis result record"""
        
        analysis_result = AnalysisResult(
            project_id=project_id,
            rubric_id=rubric_id,
            dataset_id=dataset_id,
            key_column=key_column,
            key_column_2=key_column_2,
            status="pending"
        )
        
        self.result_db.add(analysis_result)
        self.result_db.commit()
        self.result_db.refresh(analysis_result)
        
        return analysis_result
    
    def create_wide_format_table(
        self,
        analysis_result_id: str,
        rubric_id: str,
        rule_names: List[str],
        gene_data: List[Dict[str, Any]]
    ) -> Tuple[str, str]:
        """
        Create a wide format table for analysis results and populate it with data.
        
        Args:
            analysis_result_id: ID of the analysis result
            rubric_id: ID of the rubric
            rule_names: List of rule names for column creation
            gene_data: List of dictionaries containing gene data
            
        Returns:
            Tuple of (table_class, table_name)
        """
        
        # Create the wide format table class
        table_class, table_name = create_rubric_analysis_table(rubric_id, rule_names)
        
        # Create the table in the database
        table_class.__table__.create(self.result_db.bind, checkfirst=True)
        
        # Insert data into the table
        for gene_row in gene_data:
            wide_row = table_class(**gene_row)
            self.result_db.add(wide_row)
        
        self.result_db.commit()
        
        # Create tracker entry
        tracker = AnalysisResultTracker(
            analysis_result_id=analysis_result_id,
            storage_type="wide_table",
            storage_location=table_name
        )
        self.result_db.add(tracker)
        
        # Update analysis result with table name
        analysis_result = self.result_db.query(AnalysisResult).filter(
            AnalysisResult.id == analysis_result_id
        ).first()
        
        if analysis_result:
            analysis_result.results_table_name = table_name
            analysis_result.status = "completed"
            analysis_result.total_genes_processed = len(gene_data)
            analysis_result.total_rules_executed = len(rule_names)
            self.result_db.commit()
        
        return table_class, table_name
    
    def get_analysis_results(
        self,
        analysis_result_id: str,
        limit: int = 1000,
        offset: int = 0
    ) -> AnalysisResultsResponse:
        """Get analysis results from wide format table or Excel file fallback"""
        
        # Get analysis result
        analysis_result = self.result_db.query(AnalysisResult).filter(
            AnalysisResult.id == analysis_result_id
        ).first()
        
        if not analysis_result:
            raise ValueError(f"Analysis result {analysis_result_id} not found")
        
        # Get tracker to find storage location
        tracker = self.result_db.query(AnalysisResultTracker).filter(
            AnalysisResultTracker.analysis_result_id == analysis_result_id
        ).first()
        
        # If no wide table, try to read from Excel file
        if not tracker or tracker.storage_type != "wide_table":
            if analysis_result.results_file and os.path.exists(analysis_result.results_file):
                return self._get_results_from_excel_file(analysis_result, limit, offset)
            else:
                raise ValueError(f"No wide table or results file found for analysis result {analysis_result_id}")
        
        table_name = tracker.storage_location
        
        # Query the wide format table
        query = text(f"""
            SELECT * FROM {table_name} 
            WHERE analysis_result_id = :analysis_result_id
            ORDER BY total_score DESC NULLS LAST, key_column_value
            LIMIT :limit OFFSET :offset
        """)
        
        result = self.result_db.execute(query, {
            "analysis_result_id": analysis_result_id,
            "limit": limit,
            "offset": offset
        })
        
        rows = result.fetchall()
        
        # Convert to GeneScoreResult objects
        gene_results = []
        for row in rows:
            row_dict = dict(row._mapping)
            
            # Extract rule scores, weights, and weighted scores
            rule_scores = []
            rule_weights = []
            weighted_scores = []
            
            for key, value in row_dict.items():
                if key.endswith('_score') and not key.startswith('total_'):
                    rule_name = key[:-6]  # Remove '_score' suffix
                    rule_scores.append({
                        "rule_id": rule_name,
                        "rule_name": rule_name,
                        "rule_score": value
                    })
                elif key.endswith('_weight'):
                    rule_name = key[:-7]  # Remove '_weight' suffix
                    rule_weights.append({
                        "rule_id": rule_name,
                        "rule_name": rule_name,
                        "rule_weight": value
                    })
                elif key.endswith('_weighted_score'):
                    rule_name = key[:-15]  # Remove '_weighted_score' suffix
                    weighted_scores.append({
                        "rule_id": rule_name,
                        "rule_name": rule_name,
                        "weighted_score": value
                    })
            
            gene_result = GeneScoreResult(
                gene_symbol=row_dict.get('key_column_value', ''),
                total_score=row_dict.get('total_score'),
                rule_scores=rule_scores,
                rule_weights=rule_weights,
                weighted_scores=weighted_scores
            )
            gene_results.append(gene_result)
        
        # Get total count for pagination
        count_query = text(f"""
            SELECT COUNT(*) FROM {table_name} 
            WHERE analysis_result_id = :analysis_result_id
        """)
        
        total_count = self.result_db.execute(count_query, {
            "analysis_result_id": analysis_result_id
        }).scalar()
        
        return AnalysisResultsResponse(
            analysis_result=analysis_result,
            results=gene_results,
            pagination={
                "total": total_count,
                "limit": limit,
                "offset": offset,
                "has_more": offset + limit < total_count
            }
        )
    
    def get_analysis_summary(self, analysis_result_id: str) -> AnalysisSummaryResponse:
        """Get summary statistics for an analysis result"""
        
        # Get analysis result
        analysis_result = self.result_db.query(AnalysisResult).filter(
            AnalysisResult.id == analysis_result_id
        ).first()
        
        if not analysis_result:
            raise ValueError(f"Analysis result {analysis_result_id} not found")
        
        # Get tracker to find storage location
        tracker = self.result_db.query(AnalysisResultTracker).filter(
            AnalysisResultTracker.analysis_result_id == analysis_result_id
        ).first()
        
        # If no wide table, try to get summary from Excel file
        if not tracker or tracker.storage_type != "wide_table":
            if analysis_result.results_file and os.path.exists(analysis_result.results_file):
                return self._get_summary_from_excel_file(analysis_result)
            else:
                raise ValueError(f"No wide table or results file found for analysis result {analysis_result_id}")
        
        table_name = tracker.storage_location
        
        # Get table schema to determine rule columns
        inspector = inspect(self.result_db.bind)
        columns = inspector.get_columns(table_name)
        
        rule_columns = [col['name'] for col in columns if col['name'].endswith('_score') and not col['name'].startswith('total_')]
        
        # Calculate statistics
        stats_query = text(f"""
            SELECT 
                COUNT(*) as total_genes,
                AVG(total_score) as avg_score,
                MIN(total_score) as min_score,
                MAX(total_score) as max_score,
                STDDEV(total_score) as std_score
            FROM {table_name} 
            WHERE analysis_result_id = :analysis_result_id
        """)
        
        stats_result = self.result_db.execute(stats_query, {
            "analysis_result_id": analysis_result_id
        }).fetchone()
        
        # Get top genes
        top_genes_query = text(f"""
            SELECT key_column_value, total_score 
            FROM {table_name} 
            WHERE analysis_result_id = :analysis_result_id
            ORDER BY total_score DESC NULLS LAST
            LIMIT 10
        """)
        
        top_genes_result = self.result_db.execute(top_genes_query, {
            "analysis_result_id": analysis_result_id
        }).fetchall()
        
        top_genes = [
            {"gene_symbol": row[0], "total_score": row[1]}
            for row in top_genes_result
        ]
        
        # Calculate rule statistics
        rule_stats = []
        for rule_col in rule_columns:
            rule_name = rule_col[:-6]  # Remove '_score' suffix
            
            rule_stats_query = text(f"""
                SELECT 
                    AVG({rule_col}) as avg_score,
                    MIN({rule_col}) as min_score,
                    MAX({rule_col}) as max_score,
                    COUNT(CASE WHEN {rule_col} IS NOT NULL THEN 1 END) as non_null_count
                FROM {table_name} 
                WHERE analysis_result_id = :analysis_result_id
            """)
            
            rule_stats_result = self.result_db.execute(rule_stats_query, {
                "analysis_result_id": analysis_result_id
            }).fetchone()
            
            rule_stats.append({
                "rule_name": rule_name,
                "avg_score": rule_stats_result[0],
                "min_score": rule_stats_result[1],
                "max_score": rule_stats_result[2],
                "non_null_count": rule_stats_result[3]
            })
        
        return AnalysisSummaryResponse(
            analysis_result_id=analysis_result_id,
            total_genes=stats_result[0] or 0,
            total_rules=len(rule_columns),
            score_statistics={
                "avg_score": stats_result[1],
                "min_score": stats_result[2],
                "max_score": stats_result[3],
                "std_score": stats_result[4]
            },
            top_genes=top_genes,
            rule_statistics=rule_stats
        )
    
    def _get_summary_from_excel_file(self, analysis_result: AnalysisResult) -> AnalysisSummaryResponse:
        """Get summary statistics from Excel file when no wide table exists"""
        
        try:
            # Read the Excel file
            df = pd.read_excel(analysis_result.results_file)
            
            # Get total score column (look for RUBRIC_SCORE or TOTAL_SCORE)
            total_score_col = None
            for col in df.columns:
                if col.endswith('_RUBRIC_SCORE') or col == 'TOTAL_SCORE' or col == 'Total_Score':
                    total_score_col = col
                    break
            
            # Calculate score statistics
            score_stats = {
                "count": len(df),
                "avg_score": None,
                "min_score": None,
                "max_score": None,
                "std_score": None
            }
            
            if total_score_col and total_score_col in df.columns:
                scores = df[total_score_col].dropna()
                if len(scores) > 0:
                    score_stats.update({
                        "avg_score": float(scores.mean()),
                        "min_score": float(scores.min()),
                        "max_score": float(scores.max()),
                        "std_score": float(scores.std())
                    })
            
            # Get top 10 genes by total score
            top_genes = []
            if total_score_col and total_score_col in df.columns:
                # Get gene symbol column
                gene_col = None
                if 'gene_symbol' in df.columns:
                    gene_col = 'gene_symbol'
                elif 'Gene_Symbol' in df.columns:
                    gene_col = 'Gene_Symbol'
                elif len(df.columns) > 0:
                    gene_col = df.columns[0]  # First column
                
                if gene_col:
                    top_df = df.nlargest(10, total_score_col)
                    for _, row in top_df.iterrows():
                        top_genes.append({
                            "gene_symbol": str(row[gene_col]),
                            "total_score": float(row[total_score_col]) if pd.notna(row[total_score_col]) else None
                        })
            
            # Get rule statistics
            rule_stats = {}
            for col in df.columns:
                if col.endswith('_SCORE') and not col.startswith('TOTAL_'):
                    rule_name = col[:-6]  # Remove '_SCORE' suffix
                    scores = df[col].dropna()
                    if len(scores) > 0:
                        rule_stats[rule_name] = {
                            "count": len(scores),
                            "avg_score": float(scores.mean()),
                            "min_score": float(scores.min()),
                            "max_score": float(scores.max()),
                            "std_score": float(scores.std())
                        }
            
            # Convert rule_stats dict to list format
            rule_stats_list = []
            for rule_name, stats in rule_stats.items():
                rule_stats_list.append({
                    "rule_name": rule_name,
                    **stats
                })
            
            # Generate score_distribution for all score columns
            score_distribution = {}
            
            # Add total score to distribution
            if total_score_col and total_score_col in df.columns:
                scores = df[total_score_col].dropna()
                if len(scores) > 0:
                    score_distribution[total_score_col] = {
                        "count": len(scores),
                        "valid_percentage": round((len(scores) / len(df)) * 100, 2),
                        "min": float(scores.min()),
                        "max": float(scores.max()),
                        "mean": float(scores.mean()),
                        "median": float(scores.median()),
                        "std": float(scores.std())
                    }
            
            # Add individual rule scores to distribution
            for col in df.columns:
                if col.endswith('_SCORE') and col != total_score_col:
                    scores = df[col].dropna()
                    if len(scores) > 0:
                        score_distribution[col] = {
                            "count": len(scores),
                            "valid_percentage": round((len(scores) / len(df)) * 100, 2),
                            "min": float(scores.min()),
                            "max": float(scores.max()),
                            "mean": float(scores.mean()),
                            "median": float(scores.median()),
                            "std": float(scores.std())
                        }
            
            return AnalysisSummaryResponse(
                analysis_result_id=analysis_result.id,
                total_genes=analysis_result.total_genes_processed,
                total_rules=analysis_result.total_rules_executed,
                score_statistics=score_stats,
                score_distribution=score_distribution,
                top_genes=top_genes,
                rule_statistics=rule_stats_list
            )
            
        except Exception as e:
            raise ValueError(f"Failed to read summary from Excel file: {str(e)}")
    
    def _get_results_from_excel_file(
        self,
        analysis_result: AnalysisResult,
        limit: int = 1000,
        offset: int = 0
    ) -> AnalysisResultsResponse:
        """Get analysis results from Excel file when no wide table exists"""
        
        try:
            # Read the Excel file
            df = pd.read_excel(analysis_result.results_file)
            
            # Convert to gene results format
            gene_results = []
            for idx, row in df.iterrows():
                if idx < offset:
                    continue
                if len(gene_results) >= limit:
                    break
                
                # Extract rule scores (columns ending with _SCORE)
                rule_scores = []
                rule_weights = []
                weighted_scores = []
                
                for col in df.columns:
                    if col.endswith('_SCORE') and not col.startswith('TOTAL_') and not col.endswith('_RUBRIC_SCORE'):
                        rule_name = col[:-6]  # Remove '_SCORE' suffix
                        rule_score = row[col] if pd.notna(row[col]) else None
                        rule_scores.append({
                            "rule_id": rule_name,  # Use rule_name as rule_id for now
                            "rule_name": rule_name,
                            "rule_score": rule_score
                        })
                    elif col.endswith('_WEIGHT'):
                        rule_name = col[:-7]  # Remove '_WEIGHT' suffix
                        rule_weight = row[col] if pd.notna(row[col]) else None
                        rule_weights.append({
                            "rule_id": rule_name,
                            "rule_name": rule_name,
                            "rule_weight": rule_weight
                        })
                    elif col.endswith('_WEIGHTED_SCORE'):
                        rule_name = col[:-15]  # Remove '_WEIGHTED_SCORE' suffix
                        weighted_score = row[col] if pd.notna(row[col]) else None
                        weighted_scores.append({
                            "rule_id": rule_name,
                            "rule_name": rule_name,
                            "weighted_score": weighted_score
                        })
                
                # Get gene symbol (assuming first column or gene_symbol column)
                gene_symbol = None
                if 'gene_symbol' in df.columns:
                    gene_symbol = row['gene_symbol']
                elif 'Gene_Symbol' in df.columns:
                    gene_symbol = row['Gene_Symbol']
                elif len(df.columns) > 0:
                    gene_symbol = row.iloc[0]  # First column
                
                # Get total score (look for RUBRIC_SCORE or TOTAL_SCORE)
                total_score = None
                for col in df.columns:
                    if col.endswith('_RUBRIC_SCORE') or col == 'TOTAL_SCORE' or col == 'Total_Score':
                        total_score = row[col] if pd.notna(row[col]) else None
                        break
                
                gene_result = GeneScoreResult(
                    gene_symbol=str(gene_symbol) if gene_symbol is not None else f"Gene_{idx}",
                    total_score=total_score,
                    rule_scores=rule_scores,
                    rule_weights=rule_weights,
                    weighted_scores=weighted_scores
                )
                gene_results.append(gene_result)
            
            return AnalysisResultsResponse(
                analysis_result=analysis_result,
                results=gene_results,
                pagination={
                    "total": len(df),
                    "limit": limit,
                    "offset": offset,
                    "has_more": offset + limit < len(df)
                }
            )
            
        except Exception as e:
            raise ValueError(f"Failed to read results from Excel file: {str(e)}")
    
    def delete_analysis_result(self, analysis_result_id: str) -> bool:
        """Delete an analysis result and its associated data"""
        
        # Get analysis result
        analysis_result = self.result_db.query(AnalysisResult).filter(
            AnalysisResult.id == analysis_result_id
        ).first()
        
        if not analysis_result:
            return False
        
        # Get tracker to find storage location
        tracker = self.result_db.query(AnalysisResultTracker).filter(
            AnalysisResultTracker.analysis_result_id == analysis_result_id
        ).first()
        
        if tracker and tracker.storage_type == "wide_table":
            # Drop the wide format table
            table_name = tracker.storage_location
            drop_query = text(f"DROP TABLE IF EXISTS {table_name}")
            self.result_db.execute(drop_query)
        
        # Delete tracker
        if tracker:
            self.result_db.delete(tracker)
        
        # Delete analysis result
        self.result_db.delete(analysis_result)
        self.result_db.commit()
        
        return True
    
    def list_analysis_results(
        self,
        project_id: Optional[str] = None,
        rubric_id: Optional[str] = None,
        dataset_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[AnalysisResult]:
        """List analysis results with optional filtering"""
        
        query = self.result_db.query(AnalysisResult)
        
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
    
    def get_gene_scores(
        self,
        analysis_result_id: str,
        gene_symbols: List[str]
    ) -> List[GeneScoreResult]:
        """Get scores for specific genes"""
        
        # Get tracker to find storage location
        tracker = self.result_db.query(AnalysisResultTracker).filter(
            AnalysisResultTracker.analysis_result_id == analysis_result_id
        ).first()
        
        if not tracker or tracker.storage_type != "wide_table":
            raise ValueError(f"No wide table found for analysis result {analysis_result_id}")
        
        table_name = tracker.storage_location
        
        # Query for specific genes
        placeholders = ','.join([f':gene_{i}' for i in range(len(gene_symbols))])
        query = text(f"""
            SELECT * FROM {table_name} 
            WHERE analysis_result_id = :analysis_result_id
            AND key_column_value IN ({placeholders})
        """)
        
        params = {"analysis_result_id": analysis_result_id}
        for i, gene_symbol in enumerate(gene_symbols):
            params[f"gene_{i}"] = gene_symbol
        
        result = self.result_db.execute(query, params)
        rows = result.fetchall()
        
        # Convert to GeneScoreResult objects
        gene_results = []
        for row in rows:
            row_dict = dict(row._mapping)
            
            # Extract rule scores, weights, and weighted scores
            rule_scores = []
            rule_weights = []
            weighted_scores = []
            
            for key, value in row_dict.items():
                if key.endswith('_score') and not key.startswith('total_'):
                    rule_name = key[:-6]  # Remove '_score' suffix
                    rule_scores.append({
                        "rule_id": rule_name,
                        "rule_name": rule_name,
                        "rule_score": value
                    })
                elif key.endswith('_weight'):
                    rule_name = key[:-7]  # Remove '_weight' suffix
                    rule_weights.append({
                        "rule_id": rule_name,
                        "rule_name": rule_name,
                        "rule_weight": value
                    })
                elif key.endswith('_weighted_score'):
                    rule_name = key[:-15]  # Remove '_weighted_score' suffix
                    weighted_scores.append({
                        "rule_id": rule_name,
                        "rule_name": rule_name,
                        "weighted_score": value
                    })
            
            gene_result = GeneScoreResult(
                gene_symbol=row_dict.get('key_column_value', ''),
                total_score=row_dict.get('total_score'),
                rule_scores=rule_scores,
                rule_weights=rule_weights,
                weighted_scores=weighted_scores
            )
            gene_results.append(gene_result)
        
        return gene_results
