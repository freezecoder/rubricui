from typing import Dict, List, Any, Union
from app.models.rubric import Rubric
from app.models.rubric_rule import RubricRule
from app.models.rule import Rule
from app.services.rule_engine import RuleEngine

class RubricEngine:
    def __init__(self):
        self.rule_engine = RuleEngine()
    
    def execute_rubric(self, rubric: Rubric, data_row: Dict[str, Any]) -> float:
        """Execute a complete rubric on a single data row"""
        total_score = 0.0
        
        # Get all active rules in the rubric
        active_rules = [
            rr for rr in rubric.rubric_rules 
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