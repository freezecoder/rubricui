import pandas as pd
import numpy as np
import pickle
import os
import re
from typing import Dict, List, Tuple, Optional, Any
from pathlib import Path
from sqlalchemy.orm import Session
from app.models.dataset import Dataset, DatasetColumn
from app.schemas.dataset import DatasetCreate, DatasetColumnCreate
import uuid
from datetime import datetime

class DatasetProcessor:
    def __init__(self, upload_dir: str = "uploads", datasets_dir: str = "datasets"):
        self.upload_dir = Path(upload_dir)
        self.datasets_dir = Path(datasets_dir)
        
        # Create directories if they don't exist
        self.upload_dir.mkdir(exist_ok=True)
        self.datasets_dir.mkdir(exist_ok=True)
    
    def sanitize_column_name(self, column_name: str) -> str:
        """
        Sanitize column name for rubric references:
        - Convert to lowercase
        - Replace spaces with underscores
        - Remove special characters except underscores
        - Ensure it starts with a letter or underscore
        """
        # Convert to lowercase
        sanitized = column_name.lower()
        
        # Replace spaces with underscores
        sanitized = sanitized.replace(' ', '_')
        
        # Remove special characters except underscores and alphanumeric
        sanitized = re.sub(r'[^a-z0-9_]', '', sanitized)
        
        # Ensure it starts with a letter or underscore
        if sanitized and not sanitized[0].isalpha() and sanitized[0] != '_':
            sanitized = f"col_{sanitized}"
        
        # Ensure it's not empty
        if not sanitized:
            sanitized = f"column_{uuid.uuid4().hex[:8]}"
        
        return sanitized
    
    def analyze_column(self, series: pd.Series, column_name: str) -> Dict[str, Any]:
        """
        Analyze a single column and return its statistics
        """
        column_stats = {
            'original_name': column_name,
            'sanitized_name': self.sanitize_column_name(column_name),
            'column_type': 'unknown',
            'null_count': series.isnull().sum(),
            'unique_count': series.nunique()
        }
        
        # Determine column type
        if 'SCORE' in column_name:
            column_stats['column_type'] = 'score'
        elif pd.api.types.is_numeric_dtype(series):
            column_stats['column_type'] = 'numeric'
            
            # Calculate numeric statistics with proper NaN/infinity handling
            numeric_series = pd.to_numeric(series, errors='coerce')
            if not numeric_series.empty:
                mean_val = numeric_series.mean()
                median_val = numeric_series.median()
                min_val = numeric_series.min()
                max_val = numeric_series.max()
                std_val = numeric_series.std()
                
                column_stats.update({
                    'mean_value': None if pd.isna(mean_val) else float(mean_val),
                    'median_value': None if pd.isna(median_val) else float(median_val),
                    'min_value': None if pd.isna(min_val) else float(min_val),
                    'max_value': None if pd.isna(max_val) else float(max_val),
                    'std_deviation': None if pd.isna(std_val) else float(std_val)
                })
            else:
                column_stats.update({
                    'mean_value': None,
                    'median_value': None,
                    'min_value': None,
                    'max_value': None,
                    'std_deviation': None
                })
        else:
            column_stats['column_type'] = 'string'
            
            # Calculate string statistics
            string_series = series.astype(str)
            value_counts = string_series.value_counts()
            if not value_counts.empty:
                column_stats.update({
                    'most_common_value': str(value_counts.index[0]),
                    'most_common_count': int(value_counts.iloc[0])
                })
        
        return column_stats
    
    def process_file(self, file_path: str, dataset_info: DatasetCreate) -> Tuple[Dataset, List[DatasetColumn]]:
        """
        Process an uploaded file and create Dataset and DatasetColumn records
        """
        file_path = Path(file_path)
        
        # Read the file
        if file_path.suffix.lower() in ['.xlsx', '.xls']:
            df = pd.read_excel(file_path)
        elif file_path.suffix.lower() == '.csv':
            df = pd.read_csv(file_path)
        else:
            raise ValueError(f"Unsupported file format: {file_path.suffix}")
        
        # Generate unique dataset ID
        dataset_id = uuid.uuid4().hex
        
        # Create file paths
        pickled_filename = f"{dataset_id}.pkl"
        pickled_path = self.datasets_dir / pickled_filename
        
        # Save pickled dataframe
        with open(pickled_path, 'wb') as f:
            pickle.dump(df, f)
        
        # Analyze columns
        column_stats = []
        numeric_count = 0
        string_count = 0
        score_count = 0
        
        for idx, column_name in enumerate(df.columns):
            stats = self.analyze_column(df[column_name], column_name)
            stats['column_index'] = idx
            column_stats.append(stats)
            
            # Count column types
            if stats['column_type'] == 'numeric':
                numeric_count += 1
            elif stats['column_type'] == 'string':
                string_count += 1
            elif stats['column_type'] == 'score':
                score_count += 1
        
        # Create Dataset record
        dataset = Dataset(
            id=dataset_id,
            name=dataset_info.name,
            description=dataset_info.description,
            owner_name=dataset_info.owner_name,
            organization=dataset_info.organization,
            disease_area_study=dataset_info.disease_area_study,
            tags=dataset_info.tags,
            original_filename=file_path.name,
            file_path=str(file_path),
            pickled_path=str(pickled_path),
            num_rows=len(df),
            num_columns=len(df.columns),
            num_numeric_columns=numeric_count,
            num_string_columns=string_count,
            num_score_columns=score_count
        )
        
        # Create DatasetColumn records
        columns = []
        for stats in column_stats:
            column = DatasetColumn(
                id=uuid.uuid4().hex,
                dataset_id=dataset_id,
                original_name=stats['original_name'],
                sanitized_name=stats['sanitized_name'],
                column_type=stats['column_type'],
                column_index=stats['column_index'],
                mean_value=stats.get('mean_value'),
                median_value=stats.get('median_value'),
                min_value=stats.get('min_value'),
                max_value=stats.get('max_value'),
                std_deviation=stats.get('std_deviation'),
                null_count=stats.get('null_count', 0),
                unique_count=stats.get('unique_count'),
                most_common_value=stats.get('most_common_value'),
                most_common_count=stats.get('most_common_count')
            )
            columns.append(column)
        
        return dataset, columns
    
    def load_dataset(self, dataset_id: str) -> pd.DataFrame:
        """
        Load a pickled dataset from disk
        """
        dataset_path = self.datasets_dir / f"{dataset_id}.pkl"
        
        if not dataset_path.exists():
            raise FileNotFoundError(f"Dataset file not found: {dataset_path}")
        
        with open(dataset_path, 'rb') as f:
            df = pickle.load(f)
        
        return df
    
    def get_column_mapping(self, db: Session, dataset_id: str) -> Dict[str, str]:
        """
        Get mapping of sanitized column names to original column names
        """
        columns = db.query(DatasetColumn).filter(
            DatasetColumn.dataset_id == dataset_id
        ).all()
        
        return {col.sanitized_name: col.original_name for col in columns}
    
    def validate_dataset_for_rubric(self, db: Session, dataset_id: str, required_columns: List[str]) -> Dict[str, Any]:
        """
        Validate that a dataset has all required columns for a rubric
        """
        columns = db.query(DatasetColumn).filter(
            DatasetColumn.dataset_id == dataset_id
        ).all()
        
        available_columns = {col.sanitized_name for col in columns}
        missing_columns = [col for col in required_columns if col not in available_columns]
        
        return {
            'is_valid': len(missing_columns) == 0,
            'missing_columns': missing_columns,
            'available_columns': list(available_columns),
            'total_columns': len(columns)
        }
    
    def cleanup_dataset_files(self, dataset_id: str) -> bool:
        """
        Remove dataset files from disk
        """
        try:
            pickled_path = self.datasets_dir / f"{dataset_id}.pkl"
            if pickled_path.exists():
                pickled_path.unlink()
            return True
        except Exception as e:
            print(f"Error cleaning up dataset files: {e}")
            return False
