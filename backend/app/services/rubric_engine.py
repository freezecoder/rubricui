from typing import Dict, List, Any, Union
import pandas as pd
from app.models.rubric import Rubric
from app.models.rubric_rule import RubricRule
from app.models.rule import Rule
from app.services.rule_engine import RuleEngine

class RubricEngine:
    def __init__(self):
        self.rule_engine = RuleEngine()
    
    def execute_rubric(self, rubric: Rubric, data_row: Dict[str, Any], rubric_rules: List = None) -> float:
        """Execute a complete rubric on a single data row"""
        total_score = 0.0
        
        # Use provided rubric_rules or try to get from rubric object
        if rubric_rules is None:
            if hasattr(rubric, 'rubric_rules') and rubric.rubric_rules:
                active_rules = [
                    rr for rr in rubric.rubric_rules 
                    if rr.is_active and rr.rule.is_active
                ]
            else:
                # If no rubric_rules provided and not loaded, return 0
                return 0.0
        else:
            active_rules = [
                rr for rr in rubric_rules 
                if rr.is_active and rr.rule.is_active
            ]
        
        # Sort by order_index
        active_rules.sort(key=lambda x: x.order_index)
        
        # Execute each rule and apply weight
        for rubric_rule in active_rules:
            rule_score = self.rule_engine.execute_rule(rubric_rule.rule, data_row)
            if rule_score is not None and not pd.isna(rule_score):
                weighted_score = rule_score * rubric_rule.weight
                total_score += weighted_score
        
        return total_score
    
    def test_rubric(self, rubric: Rubric, sample_data: Dict[str, Any]) -> Dict[str, Any]:
        """Test a rubric on sample data and return detailed results"""
        result = {
            "rubric_name": rubric.name,
            "rule_results": [],
            "total_score": 0.0,
            "error": None
        }
        
        try:
            # Get all active rules in the rubric
            active_rules = [
                rr for rr in rubric.rubric_rules 
                if rr.is_active and rr.rule.is_active
            ]
            
            # Sort by order_index
            active_rules.sort(key=lambda x: x.order_index)
            
            # Execute each rule
            for rubric_rule in active_rules:
                rule_result = self.rule_engine.test_rule(rubric_rule.rule, sample_data)
                rule_score = rule_result.get("final_score")
                
                if rule_score is not None and not pd.isna(rule_score):
                    weighted_score = rule_score * rubric_rule.weight
                    result["total_score"] += weighted_score
                else:
                    weighted_score = 0.0
                
                result["rule_results"].append({
                    "rule_name": rubric_rule.rule.name,
                    "weight": rubric_rule.weight,
                    "raw_score": rule_score,
                    "weighted_score": weighted_score,
                    "details": rule_result
                })
            
            return result
            
        except Exception as e:
            result["error"] = str(e)
            return result
    
    def execute_rubric_on_dataset(self, rubric: Rubric, dataset: pd.DataFrame) -> pd.DataFrame:
        """Execute a complete rubric on an entire dataset"""
        # Create a copy to avoid modifying original
        results_df = dataset.copy()
        
        # Get all active rules in the rubric
        active_rules = [
            rr for rr in rubric.rubric_rules 
            if rr.is_active and rr.rule.is_active
        ]
        
        # Sort by order_index
        active_rules.sort(key=lambda x: x.order_index)
        
        # Execute each rule and store individual scores
        for rubric_rule in active_rules:
            rule_scores = []
            for _, row in dataset.iterrows():
                row_dict = row.to_dict()
                rule_score = self.rule_engine.execute_rule(rubric_rule.rule, row_dict)
                rule_scores.append(rule_score)
            
            # Add individual rule scores as new column
            results_df[f"{rubric_rule.rule.name}_SCORE"] = rule_scores
        
        # Calculate weighted total score
        total_scores = []
        for _, row in dataset.iterrows():
            row_dict = row.to_dict()
            total_score = self.execute_rubric(rubric, row_dict)
            total_scores.append(total_score)
        
        # Add total rubric score
        results_df[f"{rubric.name}_RUBRIC_SCORE"] = total_scores
        
        # Sort by total score (descending)
        results_df = results_df.sort_values(f"{rubric.name}_RUBRIC_SCORE", ascending=False)
        
        return results_df
    
    def execute_rubric_on_dataset_no_weights(self, rubric: Rubric, dataset: pd.DataFrame, rubric_rules: List = None) -> pd.DataFrame:
        """Execute a complete rubric on an entire dataset WITHOUT weights - just sum individual rule scores"""
        # Create a copy to avoid modifying original
        results_df = dataset.copy()
        
        # Use provided rubric_rules or try to get from rubric object
        if rubric_rules is None:
            if hasattr(rubric, 'rubric_rules') and rubric.rubric_rules:
                active_rules = [
                    rr for rr in rubric.rubric_rules 
                    if rr.is_active and hasattr(rr, 'rule') and rr.rule and rr.rule.is_active
                ]
            else:
                # If no rubric_rules provided and not loaded, return empty scores
                results_df[f"{rubric.name}_RUBRIC_SCORE"] = [0.0] * len(dataset)
                return results_df
        else:
            active_rules = [
                rr for rr in rubric_rules 
                if rr.is_active and hasattr(rr, 'rule') and rr.rule and rr.rule.is_active
            ]
        
        # Sort by order_index
        active_rules.sort(key=lambda x: x.order_index)
        
        print(f"Executing rubric '{rubric.name}' with {len(active_rules)} active rules")
        
        # Execute each rule and store individual scores
        for rubric_rule in active_rules:
            rule_scores = []
            print(f"Executing rule: {rubric_rule.rule.name}")
            
            for _, row in dataset.iterrows():
                row_dict = row.to_dict()
                rule_score = self.rule_engine.execute_rule(rubric_rule.rule, row_dict)
                if rule_score is None or pd.isna(rule_score):
                    rule_score = 0.0
                rule_scores.append(rule_score)
            
            # Add individual rule scores as new column
            results_df[f"{rubric_rule.rule.name}_SCORE"] = rule_scores
            print(f"Rule {rubric_rule.rule.name} completed. Sample scores: {rule_scores[:5]}")
        
        # Calculate total score by summing all individual rule scores (NO WEIGHTS)
        score_columns = [col for col in results_df.columns if col.endswith('_SCORE') and not col.endswith('_RUBRIC_SCORE')]
        print(f"Score columns for total calculation: {score_columns}")
        
        if score_columns:
            # Sum all individual rule scores for each row
            results_df[f"{rubric.name}_RUBRIC_SCORE"] = results_df[score_columns].sum(axis=1, skipna=True)
        else:
            results_df[f"{rubric.name}_RUBRIC_SCORE"] = [0.0] * len(dataset)
        
        # Sort by total score (descending)
        results_df = results_df.sort_values(f"{rubric.name}_RUBRIC_SCORE", ascending=False)
        
        print(f"Rubric execution completed. Total score range: {results_df[f'{rubric.name}_RUBRIC_SCORE'].min()} to {results_df[f'{rubric.name}_RUBRIC_SCORE'].max()}")
        
        return results_df