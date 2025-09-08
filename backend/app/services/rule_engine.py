import pandas as pd
import numpy as np
from typing import Dict, List, Any, Union
from app.models.rule import Rule

class RuleEngine:
    def __init__(self):
        self.condition_cache = {}
    
    def parse_condition(self, condition: str) -> tuple:
        """Parse a condition string into condition and score parts"""
        if "~" in condition:
            condition_part, score_part = condition.split("~", 1)
            condition_part = condition_part.strip()
            score_part = score_part.strip()
            
            # Remove extra quotes if present
            if condition_part.startswith('"') and condition_part.endswith('"'):
                condition_part = condition_part[1:-1]
            if score_part.startswith('"') and score_part.endswith('"'):
                score_part = score_part[1:-1]
            
            # Handle NA_real_ case
            if score_part == "NA_real_":
                score = np.nan
            else:
                try:
                    score = float(score_part)
                except ValueError:
                    score = score_part
            
            return condition_part, score
        else:
            raise ValueError(f"Invalid condition format: {condition}")
    
    def evaluate_condition(self, condition: str, data: Dict[str, Any]) -> bool:
        """Evaluate a condition against the data"""
        try:
            # Replace column references with actual values
            for key, value in data.items():
                if isinstance(value, str):
                    condition = condition.replace(key, f"'{value}'")
                elif pd.isna(value) or (isinstance(value, float) and np.isnan(value)):
                    # Handle NaN values - any comparison with NaN should return False
                    # Replace the entire condition with False if it contains NaN
                    if key in condition:
                        return False
                else:
                    condition = condition.replace(key, str(value))
            
            # Convert R-style operators to Python equivalents
            condition = condition.replace("&", "and")
            condition = condition.replace("|", "or")
            
            # Handle special cases for TRUE and FALSE
            if condition.strip() == 'TRUE':
                return True
            elif condition.strip() == 'FALSE':
                return False
            
            # Check if condition contains any NaN references that weren't caught above
            if 'nan' in condition.lower():
                return False
            
            # Evaluate the condition with safe context including math functions
            safe_dict = {
                'True': True,
                'False': False,
                'TRUE': True,
                'FALSE': False,
                'true': True,
                'false': False,
                'nan': float('nan'),
                'float': float,
                'int': int,
                'abs': abs,
                'min': min,
                'max': max
            }
            return eval(condition, {"__builtins__": {}}, safe_dict)
        except Exception as e:
            print(f"Error evaluating condition '{condition}': {e}")
            return False
    
    def execute_rule(self, rule: Rule, data_row: Dict[str, Any]) -> Union[float, None]:
        """Execute a rule on a single data row"""
        try:
            # Apply column mapping
            mapped_data = {}
            for var_name, column_path in rule.column_mapping.items():
                # Extract column name from path like "gene_table.aster_25gene_correlation"
                if "." in column_path:
                    column_name = column_path.split(".")[-1]
                else:
                    column_name = column_path
                
                if column_name in data_row:
                    mapped_data[var_name] = data_row[column_name]
                else:
                    mapped_data[var_name] = None
            
            # Evaluate conditions in order
            for condition_str in rule.ruleset_conditions:
                condition, score = self.parse_condition(condition_str)
                
                if self.evaluate_condition(condition, mapped_data):
                    return score
            
            # No condition matched - this should not happen if TRUE ~ 0 is present
            # But if it does, return 0 as default (matching R's case_when behavior)
            return 0.0
            
        except Exception as e:
            print(f"Error executing rule '{rule.name}': {e}")
            return 0.0
    
    def test_rule(self, rule: Rule, sample_data: Dict[str, Any]) -> Dict[str, Any]:
        """Test a rule on sample data and return detailed results"""
        result = {
            "rule_name": rule.name,
            "mapped_data": {},
            "condition_results": [],
            "final_score": None,
            "error": None
        }
        
        try:
            # Apply column mapping
            mapped_data = {}
            for var_name, column_path in rule.column_mapping.items():
                if "." in column_path:
                    column_name = column_path.split(".")[-1]
                else:
                    column_name = column_path
                
                if column_name in sample_data:
                    mapped_data[var_name] = sample_data[column_name]
                else:
                    mapped_data[var_name] = None
            
            result["mapped_data"] = mapped_data
            
            # Evaluate conditions
            for condition_str in rule.ruleset_conditions:
                condition, score = self.parse_condition(condition_str)
                condition_result = self.evaluate_condition(condition, mapped_data)
                
                result["condition_results"].append({
                    "condition": condition_str,
                    "evaluated": condition,
                    "result": condition_result,
                    "score": score
                })
                
                if condition_result:
                    result["final_score"] = score
                    break
            
            return result
            
        except Exception as e:
            result["error"] = str(e)
            return result