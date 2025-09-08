from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class AnalysisResultBase(BaseModel):
    """Base schema for analysis result"""
    project_id: str
    rubric_id: str
    dataset_id: str
    total_genes_processed: int = 0
    total_rules_executed: int = 0
    execution_time_seconds: Optional[float] = None
    status: str = "completed"
    error_message: Optional[str] = None
    results_file: Optional[str] = None


class AnalysisResultCreate(AnalysisResultBase):
    """Schema for creating analysis result"""
    pass


class AnalysisResultUpdate(BaseModel):
    """Schema for updating analysis result"""
    status: Optional[str] = None
    error_message: Optional[str] = None
    execution_time_seconds: Optional[float] = None
    results_file: Optional[str] = None


class AnalysisResultDetailBase(BaseModel):
    """Base schema for analysis result detail"""
    analysis_result_id: str
    key_column: str
    key_column_value: str
    key_column_2: Optional[str] = None
    key_column_2_value: Optional[str] = None
    rule_id: str
    rule_name: str
    rule_score: Optional[float] = None
    rule_weight: Optional[float] = None
    weighted_score: Optional[float] = None
    total_score: Optional[float] = None
    execution_order: Optional[int] = None


class AnalysisResultDetailCreate(AnalysisResultDetailBase):
    """Schema for creating analysis result detail"""
    pass


class AnalysisResultDetailResponse(BaseModel):
    """Schema for analysis result detail response"""
    id: str
    analysis_result_id: str
    key_column: str
    key_column_value: str
    key_column_2: Optional[str] = None
    key_column_2_value: Optional[str] = None
    rule_id: str
    rule_name: str
    rule_score: Optional[float] = None
    rule_weight: Optional[float] = None
    weighted_score: Optional[float] = None
    total_score: Optional[float] = None
    execution_order: Optional[int] = None
    created_date: datetime

    class Config:
        from_attributes = True


class AnalysisResultResponse(BaseModel):
    """Schema for analysis result response"""
    id: str
    project_id: str
    rubric_id: str
    dataset_id: str
    created_date: datetime
    modified_date: datetime
    total_genes_processed: int
    total_rules_executed: int
    execution_time_seconds: Optional[float] = None
    status: str
    error_message: Optional[str] = None
    results_file: Optional[str] = None

    class Config:
        from_attributes = True


class AnalysisResultWithDetails(AnalysisResultResponse):
    """Schema for analysis result with details"""
    details: List[AnalysisResultDetailResponse] = []


class GeneScoreResult(BaseModel):
    """Schema for gene score result"""
    gene_symbol: str
    total_score: Optional[float] = None
    rule_scores: List[Dict[str, Any]] = []


class AnalysisResultsResponse(BaseModel):
    """Schema for paginated analysis results response"""
    analysis_result: AnalysisResultResponse
    results: List[GeneScoreResult]
    pagination: Dict[str, Any]


class AnalysisSummaryResponse(BaseModel):
    """Schema for analysis summary response"""
    analysis_result_id: str
    total_genes: int
    total_rules: int
    score_statistics: Dict[str, Any]
    top_genes: List[Dict[str, Any]]
    rule_statistics: List[Dict[str, Any]]


class AnalysisExecutionRequest(BaseModel):
    """Schema for analysis execution request"""
    project_id: str
    rubric_id: str
    dataset_id: str
    key_column: str = "gene_symbol"


class AnalysisExecutionResponse(BaseModel):
    """Schema for analysis execution response"""
    id: str
    project_id: str
    rubric_id: str
    dataset_id: str
    status: str
    total_genes_processed: int
    total_rules_executed: int
    execution_time_seconds: Optional[float] = None
    created_date: datetime
    error_message: Optional[str] = None
