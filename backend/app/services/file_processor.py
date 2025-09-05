import pandas as pd
import numpy as np
from typing import Dict, List, Any, Union
import os

class FileProcessor:
    def __init__(self):
        self.supported_extensions = ['.xlsx', '.xls', '.csv']
    
    def validate_file(self, file_path: str) -> Dict[str, Any]:
        """Validate file structure and return basic info"""
        try:
            # Check file extension
            _, ext = os.path.splitext(file_path)
            if ext.lower() not in self.supported_extensions:
                raise ValueError(f"Unsupported file type: {ext}")
            
            # Read file based on extension
            if ext.lower() in ['.xlsx', '.xls']:
                df = pd.read_excel(file_path)
            elif ext.lower() == '.csv':
                df = pd.read_csv(file_path)
            
            # Analyze structure
            data_info = {
                "row_count": len(df),
                "column_count": len(df.columns),
                "columns": list(df.columns),
                "column_types": {col: str(dtype) for col, dtype in df.dtypes.items()},
                "has_missing_values": df.isnull().any().any(),
                "missing_value_count": df.isnull().sum().sum()
            }
            
            # Categorize columns based on the PRD
            score_columns = [col for col in df.columns if 'SCORE' in col.upper()]
            annotation_columns = []
            data_columns = []
            
            for col in df.columns:
                if col in score_columns:
                    continue
                # Simple heuristic for annotation vs data columns
                if any(keyword in col.lower() for keyword in ['desc', 'name', 'id', 'hpa', 'goal']):
                    annotation_columns.append(col)
                else:
                    data_columns.append(col)
            
            data_info["column_categories"] = {
                "score_columns": score_columns,
                "data_columns": data_columns,
                "annotation_columns": annotation_columns
            }
            
            return data_info
            
        except Exception as e:
            raise ValueError(f"File validation failed: {str(e)}")
    
    def get_file_preview(self, file_path: str, max_rows: int = 10) -> Dict[str, Any]:
        """Get a preview of the file content"""
        try:
            # Read file
            _, ext = os.path.splitext(file_path)
            if ext.lower() in ['.xlsx', '.xls']:
                df = pd.read_excel(file_path)
            elif ext.lower() == '.csv':
                df = pd.read_csv(file_path)
            else:
                raise ValueError(f"Unsupported file type: {ext}")
            
            # Limit rows for preview
            preview_df = df.head(max_rows)
            
            return {
                "total_rows": len(df),
                "preview_rows": len(preview_df),
                "columns": list(preview_df.columns),
                "data": preview_df.to_dict('records'),
                "column_types": {col: str(dtype) for col, dtype in preview_df.dtypes.items()}
            }
            
        except Exception as e:
            raise ValueError(f"Error reading file preview: {str(e)}")
    
    def process_file_for_analysis(self, file_path: str) -> pd.DataFrame:
        """Process file and return DataFrame ready for analysis"""
        try:
            # Read file
            _, ext = os.path.splitext(file_path)
            if ext.lower() in ['.xlsx', '.xls']:
                df = pd.read_excel(file_path)
            elif ext.lower() == '.csv':
                df = pd.read_csv(file_path)
            else:
                raise ValueError(f"Unsupported file type: {ext}")
            
            # Basic data cleaning
            # Remove completely empty rows
            df = df.dropna(how='all')
            
            # Convert column names to lowercase for consistency
            df.columns = df.columns.str.lower()
            
            return df
            
        except Exception as e:
            raise ValueError(f"Error processing file: {str(e)}")
    
    def get_column_stats(self, df: pd.DataFrame, column_name: str) -> Dict[str, Any]:
        """Get statistics for a specific column"""
        if column_name not in df.columns:
            raise ValueError(f"Column '{column_name}' not found")
        
        col_data = df[column_name]
        stats = {
            "name": column_name,
            "type": str(col_data.dtype),
            "count": len(col_data),
            "null_count": col_data.isnull().sum(),
            "null_percentage": (col_data.isnull().sum() / len(col_data)) * 100
        }
        
        if pd.api.types.is_numeric_dtype(col_data):
            stats.update({
                "min": float(col_data.min()),
                "max": float(col_data.max()),
                "mean": float(col_data.mean()),
                "median": float(col_data.median()),
                "std": float(col_data.std()),
                "q25": float(col_data.quantile(0.25)),
                "q75": float(col_data.quantile(0.75))
            })
        else:
            stats.update({
                "unique_values": col_data.nunique(),
                "top_values": col_data.value_counts().head(10).to_dict()
            })
        
        return stats