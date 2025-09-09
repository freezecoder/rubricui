from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class DatasetType(str, Enum):
    INPUT = "input"
    OUTPUT = "output"
    ANNOTATIONS = "annotations"
    RUBRIC = "rubric"

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
    dataset_type: DatasetType = Field(default=DatasetType.INPUT)
    visibility: str = Field(default="public", pattern="^(public|private|hidden)$")
    enabled: bool = True

class DatasetUpload(BaseModel):
    """Schema for dataset upload with file information"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    owner_name: Optional[str] = None
    organization: Optional[str] = None
    disease_area_study: Optional[str] = None
    tags: Optional[str] = None
    filename: str = Field(..., min_length=1)
    dataset_type: DatasetType = Field(default=DatasetType.INPUT)
    visibility: str = Field(default="public", pattern="^(public|private|hidden)$")
    enabled: bool = True

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
    
    # Dataset type and timestamps
    dataset_type: DatasetType
    created_date: datetime
    modified_date: datetime
    
    # Admin control attributes
    visibility: str
    enabled: bool
    
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
    dataset_type: DatasetType
    created_date: datetime
    modified_date: datetime
    visibility: str
    enabled: bool

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

class DatasetAdminUpdate(BaseModel):
    """Schema for admin updates to dataset visibility and enabled status"""
    dataset_type: Optional[DatasetType] = None
    visibility: Optional[str] = Field(None, pattern="^(public|private|hidden)$")
    enabled: Optional[bool] = None

class DatasetHistogramCreate(BaseModel):
    """Schema for creating histogram data"""
    dataset_id: str = Field(..., min_length=1, max_length=32)
    column_id: str = Field(..., min_length=1, max_length=32)
    bin_count: int = Field(..., ge=1, le=1000)
    bin_edges: List[float] = Field(..., min_items=2)
    bin_counts: List[int] = Field(..., min_items=1)
    min_value: float
    max_value: float
    total_count: int = Field(..., ge=0)
    null_count: int = Field(default=0, ge=0)

class DatasetHistogramResponse(BaseModel):
    """Schema for histogram API responses"""
    id: str
    dataset_id: str
    column_id: str
    bin_count: int
    bin_edges: List[float]
    bin_counts: List[int]
    min_value: float
    max_value: float
    total_count: int
    null_count: int
    created_date: datetime

    class Config:
        from_attributes = True

class DatasetHistogramSummary(BaseModel):
    """Lightweight histogram summary for lists"""
    id: str
    column_id: str
    bin_count: int
    min_value: float
    max_value: float
    total_count: int
    null_count: int
    created_date: datetime

    class Config:
        from_attributes = True

class DatasetHistogramWithColumn(BaseModel):
    """Histogram response with column information"""
    histogram: DatasetHistogramResponse
    column: DatasetColumnResponse

class DatasetHistogramRequest(BaseModel):
    """Request for histogram generation"""
    dataset_id: str
    column_ids: Optional[List[str]] = None  # If None, generate for all numeric columns
    bin_count: int = Field(default=30, ge=5, le=100)  # Default to 30 bins
    force_regenerate: bool = Field(default=False)  # Force regeneration even if exists
