import pandas as pd
import numpy as np
from typing import List, Dict, Any, Union
from app.models.rule import Rule
from app.models.rubric import Rubric
from app.services.rule_engine import RuleEngine
from app.services.rubric_engine import RubricEngine

class AnalysisExecutor:
    def __init__(self):
        self.rule_engine = RuleEngine()
        self.rubric_engine = RubricEngine()
    
    def execute_mixed_analysis(
        self, 
        individual_rules: List[Rule], 
        rubrics: List[Rubric], 
        dataset: pd.DataFrame,
        rubric_rules_map: Dict[str, List] = None
    ) -> pd.DataFrame:
        """Execute combination of individual rules and rubrics on dataset"""
        
        # Create a copy to avoid modifying original
        results_df = dataset.copy()
        
        # Execute individual rules
        for rule in individual_rules:
            rule_scores = []
            for _, row in dataset.iterrows():
                row_dict = row.to_dict()
                score = self.rule_engine.execute_rule(rule, row_dict)
                rule_scores.append(score)
            
            # Add rule scores as new column
            results_df[f"{rule.name}_SCORE"] = rule_scores
        
        # Execute rubrics
        for rubric in rubrics:
            rubric_scores = []
            rubric_rules = rubric_rules_map.get(str(rubric.id), []) if rubric_rules_map else None
            for _, row in dataset.iterrows():
                row_dict = row.to_dict()
                score = self.rubric_engine.execute_rubric(rubric, row_dict, rubric_rules)
                rubric_scores.append(score)
            
            # Add rubric scores as new column
            results_df[f"{rubric.name}_RUBRIC_SCORE"] = rubric_scores
        
        # Calculate total score
        score_columns = [col for col in results_df.columns if col.endswith('_SCORE')]
        if score_columns:
            results_df['TOTAL_SCORE'] = results_df[score_columns].sum(axis=1, skipna=True)
            
            # Sort by total score (descending)
            results_df = results_df.sort_values('TOTAL_SCORE', ascending=False)
        
        return results_df
    
    def execute_individual_rules_only(
        self, 
        rules: List[Rule], 
        dataset: pd.DataFrame
    ) -> pd.DataFrame:
        """Execute only individual rules"""
        return self.execute_mixed_analysis(rules, [], dataset)
    
    def execute_rubrics_only(
        self, 
        rubrics: List[Rubric], 
        dataset: pd.DataFrame,
        rubric_rules_map: Dict[str, List] = None
    ) -> pd.DataFrame:
        """Execute only rubrics"""
        return self.execute_mixed_analysis([], rubrics, dataset, rubric_rules_map)
    
    def execute_rubric_with_excel_output(
        self, 
        rubric: Rubric, 
        dataset: pd.DataFrame,
        rubric_rules: List = None,
        output_file: str = None
    ) -> pd.DataFrame:
        """Execute a single rubric and create Excel output with two sheets"""
        # Execute rubric without weights
        results_df = self.rubric_engine.execute_rubric_on_dataset_no_weights(rubric, dataset, rubric_rules)
        
        if output_file:
            # Create Excel writer
            with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
                # Sheet 1: Gene scores only (gene identifier + individual rule scores + total score)
                score_columns = [col for col in results_df.columns if col.endswith('_SCORE')]
                gene_id_columns = ['gene_symbol', 'ensg_id'] if 'gene_symbol' in results_df.columns else ['ensg_id'] if 'ensg_id' in results_df.columns else []
                
                # Create gene scores sheet
                gene_scores_df = results_df[gene_id_columns + score_columns].copy()
                gene_scores_df.to_excel(writer, sheet_name='Gene_Scores', index=False)
                
                # Sheet 2: Full data joined with scores
                results_df.to_excel(writer, sheet_name='Data_with_Scores', index=False)
        
        return results_df
    
    def execute_rules_analysis(
        self, 
        rules: List[Rule], 
        dataset: pd.DataFrame
    ) -> pd.DataFrame:
        """Execute individual rules analysis (alias for execute_individual_rules_only)"""
        return self.execute_individual_rules_only(rules, dataset)
    
    def get_analysis_summary(self, results_df: pd.DataFrame) -> Dict[str, Any]:
        """Get summary statistics for analysis results"""
        score_columns = [col for col in results_df.columns if col.endswith('_SCORE')]
        
        summary = {
            "total_genes": len(results_df),
            "score_columns": score_columns,
            "has_total_score": 'TOTAL_SCORE' in results_df.columns
        }
        
        if 'TOTAL_SCORE' in results_df.columns:
            total_scores = results_df['TOTAL_SCORE'].dropna()
            summary.update({
                "total_score_stats": {
                    "min": float(total_scores.min()),
                    "max": float(total_scores.max()),
                    "mean": float(total_scores.mean()),
                    "median": float(total_scores.median()),
                    "std": float(total_scores.std())
                },
                "top_genes": results_df.head(10)[['gene_name', 'TOTAL_SCORE']].to_dict('records') if 'gene_name' in results_df.columns else []
            })
        
        return summary