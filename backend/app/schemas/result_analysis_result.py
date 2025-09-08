from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class ResultAnalysisResultBase(BaseModel):
    """Base schema for result analysis result"""
    project_id: str
    rubric_id: str
    dataset_id: str
    total_genes_processed: int = 0
    total_rules_executed: int = 0
    execution_time_seconds: Optional[float] = None
    status: str = "completed"
    error_message: Optional[str] = None
    results_file: Optional[str] = None
    key_column: str = "gene_symbol"
    key_column_2: Optional[str] = None
    results_table_name: Optional[str] = None


class ResultAnalysisResultCreate(ResultAnalysisResultBase):
    """Schema for creating result analysis result"""
    pass


class ResultAnalysisResultUpdate(BaseModel):
    """Schema for updating result analysis result"""
    status: Optional[str] = None
    error_message: Optional[str] = None
    execution_time_seconds: Optional[float] = None
    results_file: Optional[str] = None
    results_table_name: Optional[str] = None


class ResultAnalysisResultResponse(BaseModel):
    """Schema for result analysis result response"""
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
    key_column: str
    key_column_2: Optional[str] = None
    results_table_name: Optional[str] = None

    class Config:
        from_attributes = True


class AnalysisResultTrackerBase(BaseModel):
    """Base schema for analysis result tracker"""
    analysis_result_id: str
    storage_type: str  # "wide_table", "file", "long_table"
    storage_location: str  # Table name, file path, or table name


class AnalysisResultTrackerCreate(AnalysisResultTrackerBase):
    """Schema for creating analysis result tracker"""
    pass


class AnalysisResultTrackerResponse(BaseModel):
    """Schema for analysis result tracker response"""
    id: str
    analysis_result_id: str
    storage_type: str
    storage_location: str
    created_date: datetime

    class Config:
        from_attributes = True


class RuleScore(BaseModel):
    """Schema for individual rule score"""
    rule_id: str
    rule_name: str
    rule_score: Optional[float] = None
    rule_weight: Optional[float] = None
    weighted_score: Optional[float] = None

class GeneScoreResult(BaseModel):
    """Schema for gene score result from wide format table"""
    gene_symbol: str
    total_score: Optional[float] = None
    rule_scores: List[RuleScore] = []  # Array of rule scores
    rule_weights: List[RuleScore] = []  # Array of rule weights
    weighted_scores: List[RuleScore] = []  # Array of weighted scores


class AnalysisResultsResponse(BaseModel):
    """Schema for paginated analysis results response"""
    analysis_result: ResultAnalysisResultResponse
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
    results_table_name: Optional[str] = None


class WideTableInfo(BaseModel):
    """Schema for wide table information"""
    table_name: str
    analysis_result_id: str
    total_genes: int
    total_rules: int
    rule_columns: List[str]
    created_date: datetime


class AnalysisResultWithWideTable(ResultAnalysisResultResponse):
    """Schema for analysis result with wide table information"""
    wide_table_info: Optional[WideTableInfo] = None
    tracker: Optional[AnalysisResultTrackerResponse] = None
