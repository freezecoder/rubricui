# Import all models to ensure they're registered with Base metadata
from .rule import Rule
from .rubric import Rubric
from .rubric_rule import RubricRule
from .project import Project
from .execution_record import ExecutionRecord
from .dataset import Dataset, DatasetColumn
from .user import User, ProjectShare, RubricShare
from .view_permission import ViewPermission, UserViewPermission, PermissionGroup, UserPermissionGroup
from .analysis_result import AnalysisResult, AnalysisResultDetail  # DEPRECATED - kept for migration

# Result database models (separate database for analysis results)
from .result_analysis_result import AnalysisResult as ResultAnalysisResult, AnalysisResultTracker, create_rubric_analysis_table

__all__ = [
    "Rule", "Rubric", "RubricRule", "Project", "ExecutionRecord", 
    "Dataset", "DatasetColumn", "User", "ProjectShare", "RubricShare",
    "ViewPermission", "UserViewPermission", "PermissionGroup", "UserPermissionGroup",
    "AnalysisResult", "AnalysisResultDetail",  # DEPRECATED
    "ResultAnalysisResult", "AnalysisResultTracker", "create_rubric_analysis_table"  # New result database models
]