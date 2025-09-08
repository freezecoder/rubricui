import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from datetime import datetime
import uuid

from app.models.analysis_result import AnalysisResult, AnalysisResultDetail
from app.models.rubric import Rubric
from app.models.rubric_rule import RubricRule
from app.models.rule import Rule
from app.models.dataset import Dataset
from app.services.rubric_engine import RubricEngine
from app.services.rule_engine import RuleEngine


class AnalysisResultService:
    """Service for managing analysis results and integrating with rubric execution"""
    
    def __init__(self):
        self.rubric_engine = RubricEngine()
        self.rule_engine = RuleEngine()
    
    def execute_rubric_analysis(
        self,
        db: Session,
        project_id: str,
        rubric_id: str,
        dataset_id: str,
        key_column: str = "gene_symbol"
    ) -> AnalysisResult:
        """
        Execute a rubric analysis and save results to database
        
        Args:
            db: Database session
            project_id: ID of the project
            rubric_id: ID of the rubric to execute
            dataset_id: ID of the dataset to analyze
            key_column: Column name to use as the key (default: "gene_symbol")
            
        Returns:
            AnalysisResult: The created analysis result record
        """
        # Validate inputs
        rubric = db.query(Rubric).filter(Rubric.id == rubric_id, Rubric.is_active == True).first()
        if not rubric:
            raise ValueError(f"Rubric {rubric_id} not found or inactive")
        
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            raise ValueError(f"Dataset {dataset_id} not found")
        
        # Load dataset data from pickle file for better performance
        from app.services.dataset_processor import DatasetProcessor
        dataset_processor = DatasetProcessor()
        df = dataset_processor.load_dataset(dataset_id)
        
        # Validate key column exists
        if key_column not in df.columns:
            raise ValueError(f"Key column '{key_column}' not found in dataset")
        
        # Get active rubric rules
        rubric_rules = db.query(RubricRule).filter(
            RubricRule.rubric_id == rubric_id,
            RubricRule.is_active == True
        ).order_by(RubricRule.order_index).all()
        
        if not rubric_rules:
            raise ValueError(f"No active rules found in rubric {rubric_id}")
        
        # Get rule details
        rule_ids = [rr.rule_id for rr in rubric_rules]
        rules = db.query(Rule).filter(
            Rule.id.in_(rule_ids),
            Rule.is_active == True
        ).all()
        
        rule_map = {rule.id: rule for rule in rules}
        
        # Create analysis result record
        analysis_result = AnalysisResult(
            id=str(uuid.uuid4().hex),
            project_id=project_id,
            rubric_id=rubric_id,
            dataset_id=dataset_id,
            total_genes_processed=len(df),
            total_rules_executed=len(rubric_rules),
            status="running"
        )
        db.add(analysis_result)
        db.flush()  # Get the ID
        
        start_time = datetime.utcnow()
        detail_records = []
        
        try:
            # Process each row in the dataset
            for row_idx, (_, row) in enumerate(df.iterrows()):
                row_dict = row.to_dict()
                key_value = str(row.get(key_column, f"row_{row_idx}"))
                
                # Calculate total score for this row
                total_score = 0.0
                
                # Execute each rule in the rubric
                for order_idx, rubric_rule in enumerate(rubric_rules):
                    rule = rule_map.get(rubric_rule.rule_id)
                    if not rule:
                        continue
                    
                    # Execute the rule
                    rule_score = self.rule_engine.execute_rule(rule, row_dict)
                    if rule_score is None or pd.isna(rule_score):
                        rule_score = 0.0
                    
                    # Calculate weighted score
                    weighted_score = rule_score * rubric_rule.weight
                    total_score += weighted_score
                    
                    # Create detail record
                    detail_record = AnalysisResultDetail(
                        id=str(uuid.uuid4().hex),
                        analysis_result_id=analysis_result.id,
                        key_column=key_column,
                        key_column_value=key_value,
                        key_column_2=None,
                        key_column_2_value=None,
                        rule_id=rule.id,
                        rule_name=rule.name,
                        rule_score=float(rule_score),
                        rule_weight=float(rubric_rule.weight),
                        weighted_score=float(weighted_score),
                        total_score=None,  # Will be updated after all rules
                        execution_order=order_idx
                    )
                    detail_records.append(detail_record)
                
                # Update total scores for all detail records of this row
                for detail_record in detail_records[-len(rubric_rules):]:
                    detail_record.total_score = float(total_score)
            
            # Bulk insert detail records
            db.bulk_save_objects(detail_records)
            
            # Update analysis result
            end_time = datetime.utcnow()
            analysis_result.execution_time_seconds = (end_time - start_time).total_seconds()
            analysis_result.status = "completed"
            analysis_result.modified_date = end_time
            
            db.commit()
            
            return analysis_result
            
        except Exception as e:
            # Update analysis result with error
            analysis_result.status = "failed"
            analysis_result.error_message = str(e)
            analysis_result.modified_date = datetime.utcnow()
            db.commit()
            raise
    
    def get_analysis_results(
        self,
        db: Session,
        analysis_result_id: str,
        limit: int = 1000,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Get analysis results with pagination
        
        Args:
            db: Database session
            analysis_result_id: ID of the analysis result
            limit: Maximum number of results to return
            offset: Number of results to skip
            
        Returns:
            Dict containing analysis results and metadata
        """
        # Get analysis result
        analysis_result = db.query(AnalysisResult).filter(
            AnalysisResult.id == analysis_result_id
        ).first()
        
        if not analysis_result:
            raise ValueError(f"Analysis result {analysis_result_id} not found")
        
        # Get detail records with pagination
        detail_records = db.query(AnalysisResultDetail).filter(
            AnalysisResultDetail.analysis_result_id == analysis_result_id
        ).order_by(
            AnalysisResultDetail.key_column_value,
            AnalysisResultDetail.execution_order
        ).offset(offset).limit(limit).all()
        
        # Group by key value for easier consumption
        results_by_gene = {}
        for detail in detail_records:
            key_value = detail.key_column_value
            if key_value not in results_by_gene:
                results_by_gene[key_value] = {
                    "gene_symbol": key_value,
                    "total_score": detail.total_score,
                    "rule_scores": []
                }
            
            results_by_gene[key_value]["rule_scores"].append({
                "rule_id": detail.rule_id,
                "rule_name": detail.rule_name,
                "rule_score": detail.rule_score,
                "rule_weight": detail.rule_weight,
                "weighted_score": detail.weighted_score,
                "execution_order": detail.execution_order
            })
        
        # Convert to list and sort by total score
        results_list = list(results_by_gene.values())
        results_list.sort(key=lambda x: x["total_score"] or 0, reverse=True)
        
        return {
            "analysis_result": {
                "id": analysis_result.id,
                "project_id": analysis_result.project_id,
                "rubric_id": analysis_result.rubric_id,
                "dataset_id": analysis_result.dataset_id,
                "status": analysis_result.status,
                "total_genes_processed": analysis_result.total_genes_processed,
                "total_rules_executed": analysis_result.total_rules_executed,
                "execution_time_seconds": analysis_result.execution_time_seconds,
                "created_date": analysis_result.created_date.isoformat(),
                "modified_date": analysis_result.modified_date.isoformat(),
                "error_message": analysis_result.error_message
            },
            "results": results_list,
            "pagination": {
                "limit": limit,
                "offset": offset,
                "total_count": len(results_list)
            }
        }
    
    def get_analysis_summary(
        self,
        db: Session,
        analysis_result_id: str
    ) -> Dict[str, Any]:
        """
        Get summary statistics for an analysis result
        
        Args:
            db: Database session
            analysis_result_id: ID of the analysis result
            
        Returns:
            Dict containing summary statistics
        """
        # Get analysis result
        analysis_result = db.query(AnalysisResult).filter(
            AnalysisResult.id == analysis_result_id
        ).first()
        
        if not analysis_result:
            raise ValueError(f"Analysis result {analysis_result_id} not found")
        
        # Get all detail records for summary
        detail_records = db.query(AnalysisResultDetail).filter(
            AnalysisResultDetail.analysis_result_id == analysis_result_id
        ).all()
        
        if not detail_records:
            return {
                "analysis_result_id": analysis_result_id,
                "total_genes": 0,
                "total_rules": 0,
                "score_statistics": {},
                "top_genes": [],
                "rule_statistics": []
            }
        
        # Calculate statistics
        total_scores = [d.total_score for d in detail_records if d.total_score is not None]
        unique_genes = set(d.key_column_value for d in detail_records)
        
        # Score statistics
        score_stats = {}
        if total_scores:
            score_stats = {
                "min": float(min(total_scores)),
                "max": float(max(total_scores)),
                "mean": float(np.mean(total_scores)),
                "median": float(np.median(total_scores)),
                "std": float(np.std(total_scores)),
                "count": len(total_scores)
            }
        
        # Top genes (by total score)
        gene_scores = {}
        for detail in detail_records:
            if detail.total_score is not None:
                gene_scores[detail.key_column_value] = detail.total_score
        
        top_genes = sorted(gene_scores.items(), key=lambda x: x[1], reverse=True)[:10]
        
        # Rule statistics
        rule_stats = {}
        for detail in detail_records:
            rule_id = detail.rule_id
            if rule_id not in rule_stats:
                rule_stats[rule_id] = {
                    "rule_name": detail.rule_name,
                    "scores": [],
                    "weights": []
                }
            if detail.rule_score is not None:
                rule_stats[rule_id]["scores"].append(detail.rule_score)
            if detail.rule_weight is not None:
                rule_stats[rule_id]["weights"].append(detail.rule_weight)
        
        # Calculate rule statistics
        rule_statistics = []
        for rule_id, stats in rule_stats.items():
            if stats["scores"]:
                rule_statistics.append({
                    "rule_id": rule_id,
                    "rule_name": stats["rule_name"],
                    "weight": stats["weights"][0] if stats["weights"] else 0,
                    "score_stats": {
                        "min": float(min(stats["scores"])),
                        "max": float(max(stats["scores"])),
                        "mean": float(np.mean(stats["scores"])),
                        "median": float(np.median(stats["scores"])),
                        "std": float(np.std(stats["scores"]))
                    }
                })
        
        return {
            "analysis_result_id": analysis_result_id,
            "total_genes": len(unique_genes),
            "total_rules": len(rule_statistics),
            "score_statistics": score_stats,
            "top_genes": [{"gene_symbol": gene, "total_score": score} for gene, score in top_genes],
            "rule_statistics": rule_statistics
        }
    
    def delete_analysis_result(
        self,
        db: Session,
        analysis_result_id: str
    ) -> bool:
        """
        Delete an analysis result and all its details
        
        Args:
            db: Database session
            analysis_result_id: ID of the analysis result to delete
            
        Returns:
            bool: True if deleted successfully
        """
        analysis_result = db.query(AnalysisResult).filter(
            AnalysisResult.id == analysis_result_id
        ).first()
        
        if not analysis_result:
            return False
        
        # Delete detail records (cascade should handle this, but being explicit)
        db.query(AnalysisResultDetail).filter(
            AnalysisResultDetail.analysis_result_id == analysis_result_id
        ).delete()
        
        # Delete analysis result
        db.delete(analysis_result)
        db.commit()
        
        return True
