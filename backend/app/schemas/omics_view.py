"""
Pydantic schemas for Omics View API
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
from datetime import datetime


class GeneFilterRequest(BaseModel):
    """Request schema for filtering genes"""
    
    # Filter by score ranges
    min_total_score: Optional[float] = None
    max_total_score: Optional[float] = None
    
    # Filter by specific rule scores
    rule_score_filters: Optional[Dict[str, Dict[str, float]]] = None  # rule_name -> {min, max}
    
    # Filter by gene symbols
    gene_symbols: Optional[List[str]] = None
    
    # Filter by annotations (future)
    annotation_filters: Optional[Dict[str, Any]] = None
    
    # Filter by numeric column values
    numeric_column_filters: Optional[Dict[str, Dict[str, float]]] = None  # column -> {min, max}


class GeneSortRequest(BaseModel):
    """Request schema for sorting genes"""
    
    sort_by: str = Field(..., description="Field to sort by: total_score, gene_symbol, or rule name")
    sort_order: str = Field("desc", description="Sort order: asc or desc")
    
    # Secondary sort criteria
    secondary_sort_by: Optional[str] = None
    secondary_sort_order: Optional[str] = "asc"
    
    # Custom sort criteria
    custom_sort_values: Optional[Dict[str, float]] = None  # gene_symbol -> sort_value


class ColorSchemeRequest(BaseModel):
    """Request schema for color scheme configuration"""
    
    heatmap_type: str = Field(..., description="Type of heatmap: rubric_scores, numeric_columns, annotations")
    
    # Color scheme options
    color_palette: str = Field("viridis", description="Color palette: viridis, plasma, inferno, magma, coolwarm, RdYlBu")
    
    # Value range for color mapping
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    
    # Color scheme for categorical data
    categorical_colors: Optional[Dict[str, str]] = None  # category -> hex color
    
    # Display options
    show_legend: bool = True
    show_values: bool = False
    show_grid: bool = True


class GeneListUploadRequest(BaseModel):
    """Request schema for uploading gene list"""
    
    gene_symbols: List[str] = Field(..., description="List of gene symbols to match")
    
    # Upload options
    case_sensitive: bool = False
    exact_match: bool = True
    
    # Additional filters
    min_total_score: Optional[float] = None
    max_total_score: Optional[float] = None


class HeatmapData(BaseModel):
    """Schema for heatmap data"""
    
    heatmap_type: str
    gene_symbols: List[str]
    column_names: List[str]
    data_matrix: List[List[Union[float, str, None]]]  # [gene][column] -> value
    
    # Metadata
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    missing_values: int = 0
    
    # Color scheme
    color_scheme: Optional[ColorSchemeRequest] = None


class GeneAnnotation(BaseModel):
    """Schema for gene annotation data"""
    
    gene_symbol: str
    annotation_type: str
    annotation_value: Union[str, float, bool]
    confidence: Optional[float] = None
    source: Optional[str] = None


class OmicsViewData(BaseModel):
    """Main schema for omics view data"""
    
    analysis_id: str
    analysis_name: Optional[str] = None
    
    # Gene data
    gene_symbols: List[str]
    total_genes: int
    displayed_genes: int
    
    # Heatmap data
    rubric_scores_heatmap: Optional[HeatmapData] = None
    numeric_columns_heatmap: Optional[HeatmapData] = None
    annotations_heatmap: Optional[HeatmapData] = None
    
    # Sorting and filtering info
    sort_criteria: Optional[GeneSortRequest] = None
    filter_criteria: Optional[GeneFilterRequest] = None
    sort_by: Optional[str] = None
    sort_order: Optional[str] = None
    
    # Available columns for configuration
    available_rubric_columns: List[str] = []
    available_numeric_columns: List[str] = []
    available_annotation_columns: List[str] = []
    
    # Metadata
    created_at: datetime
    last_updated: datetime


class OmicsViewConfig(BaseModel):
    """Configuration schema for omics view"""
    
    # Display settings
    max_genes_displayed: int = 50
    default_sort_by: str = "total_score"
    default_sort_order: str = "desc"
    
    # Heatmap settings
    show_rubric_scores: bool = True
    show_numeric_columns: bool = True
    show_annotations: bool = False  # Future feature
    
    # Selected columns for each heatmap
    selected_rubric_columns: List[str] = []
    selected_numeric_columns: List[str] = []
    selected_annotation_columns: List[str] = []
    
    # Color schemes
    rubric_scores_color_scheme: Optional[ColorSchemeRequest] = None
    numeric_columns_color_scheme: Optional[ColorSchemeRequest] = None
    annotations_color_scheme: Optional[ColorSchemeRequest] = None


class OmicsViewResponse(BaseModel):
    """Response schema for omics view API calls"""
    
    success: bool
    data: Optional[OmicsViewData] = None
    config: Optional[OmicsViewConfig] = None
    message: Optional[str] = None
    error: Optional[str] = None
    
    # Pagination info
    total_count: Optional[int] = None
    page: Optional[int] = None
    page_size: Optional[int] = None
    total_pages: Optional[int] = None


class GeneScoreInfo(BaseModel):
    """Schema for individual gene score information"""
    
    gene_symbol: str
    total_score: Optional[float] = None
    rank: Optional[int] = None
    
    # Individual rule scores
    rule_scores: Dict[str, float] = {}
    
    # Numeric column values
    numeric_values: Dict[str, float] = {}
    
    # Annotations (future)
    annotations: List[GeneAnnotation] = []


class HeatmapCellInfo(BaseModel):
    """Schema for heatmap cell information on hover"""
    
    gene_symbol: str
    column_name: str
    value: Union[float, str, None]
    formatted_value: str
    
    # Additional context
    rank: Optional[int] = None
    percentile: Optional[float] = None
    annotation: Optional[str] = None
