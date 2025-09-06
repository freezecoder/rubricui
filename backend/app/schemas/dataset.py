from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class DatasetColumnCreate(BaseModel):
    original_name: str = Field(..., min_length=1, max_length=255)
    sanitized_name: str = Field(..., min_length=1, max_length=255)
    column_type: str = Field(..., pattern="^(numeric|string|score)$")
    column_index: int = Field(..., ge=0)
    
    # Numeric statistics (optional, only for numeric columns)
    mean_value: Optional[float] = None
    median_value: Optional[float] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    std_deviation: Optional[float] = None
    null_count: Optional[int] = 0
    unique_count: Optional[int] = None
    
    # String statistics (optional, only for string columns)
    most_common_value: Optional[str] = None
    most_common_count: Optional[int] = None

class DatasetColumnResponse(BaseModel):
    id: str
    dataset_id: str
    original_name: str
    sanitized_name: str
    column_type: str
    column_index: int
    
    # Numeric statistics
    mean_value: Optional[float]
    median_value: Optional[float]
    min_value: Optional[float]
    max_value: Optional[float]
    std_deviation: Optional[float]
    null_count: Optional[int]
    unique_count: Optional[int]
    
    # String statistics
    most_common_value: Optional[str]
    most_common_count: Optional[int]
    
    created_date: datetime

    class Config:
        from_attributes = True

class DatasetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    owner_name: Optional[str] = None
    organization: Optional[str] = None
    disease_area_study: Optional[str] = None
    tags: Optional[str] = None  # Comma-separated tags

class DatasetUpload(BaseModel):
    """Schema for dataset upload with file information"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    owner_name: Optional[str] = None
    organization: Optional[str] = None
    disease_area_study: Optional[str] = None
    tags: Optional[str] = None
    filename: str = Field(..., min_length=1)

class DatasetResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    owner_name: Optional[str]
    organization: Optional[str]
    disease_area_study: Optional[str]
    tags: Optional[str]
    
    # File information
    original_filename: str
    file_path: str
    pickled_path: str
    
    # Dataset metadata
    num_rows: int
    num_columns: int
    num_numeric_columns: int
    num_string_columns: int
    num_score_columns: int
    
    # Timestamps
    created_date: datetime
    modified_date: datetime
    
    # Relationships
    columns: List[DatasetColumnResponse] = []

    class Config:
        from_attributes = True

class DatasetSummary(BaseModel):
    """Lightweight dataset summary for lists"""
    id: str
    name: str
    description: Optional[str]
    owner_name: Optional[str]
    organization: Optional[str]
    disease_area_study: Optional[str]
    tags: Optional[str]
    original_filename: str
    num_rows: int
    num_columns: int
    num_numeric_columns: int
    num_string_columns: int
    num_score_columns: int
    created_date: datetime
    modified_date: datetime

    class Config:
        from_attributes = True

class DatasetStats(BaseModel):
    """Dataset statistics for analysis"""
    total_rows: int
    total_columns: int
    numeric_columns: int
    string_columns: int
    score_columns: int
    column_details: List[DatasetColumnResponse]
    
class DatasetAnalysisRequest(BaseModel):
    """Request for dataset analysis"""
    dataset_id: str
    include_column_stats: bool = True
    include_data_preview: bool = False
    preview_rows: int = 10
