from sqlalchemy import Column, String, DateTime, ForeignKey, Float, Integer, Text, Index
from sqlalchemy.orm import relationship
from app.models.result_database import ResultBase
import uuid
from datetime import datetime

class AnalysisResult(ResultBase):
    """Main analysis result table storing analysis metadata in the result database"""
    __tablename__ = "analysis_results"
    
    id = Column(String(32), primary_key=True, default=lambda: uuid.uuid4().hex)
    project_id = Column(String(32), nullable=False)  # Reference to main database
    rubric_id = Column(String(32), nullable=False)   # Reference to main database
    dataset_id = Column(String(32), nullable=False)  # Reference to main database
    created_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Analysis metadata
    name = Column(String(200), nullable=True)  # User-defined analysis name
    total_genes_processed = Column(Integer, nullable=False, default=0)
    total_rules_executed = Column(Integer, nullable=False, default=0)
    execution_time_seconds = Column(Float, nullable=True)
    status = Column(String(50), nullable=False, default="completed")  # pending, running, completed, failed
    error_message = Column(Text, nullable=True)
    
    # Results storage strategy
    results_table_name = Column(String(100), nullable=True)  # Name of the wide format table
    key_column = Column(String(100), nullable=False, default="gene_symbol")  # Primary key column name
    key_column_2 = Column(String(100), nullable=True)  # Secondary key column (optional)
    
    # Results file path (optional, for backward compatibility)
    results_file = Column(String(500), nullable=True)
    
    # Create indexes for fast lookups
    __table_args__ = (
        Index('idx_analysis_results_project_id', 'project_id'),
        Index('idx_analysis_results_rubric_id', 'rubric_id'),
        Index('idx_analysis_results_dataset_id', 'dataset_id'),
        Index('idx_analysis_results_status', 'status'),
        Index('idx_analysis_results_created_date', 'created_date'),
    )
    
    def __repr__(self):
        return f"<AnalysisResult(id={self.id}, project_id={self.project_id}, rubric_id={self.rubric_id}, status={self.status})>"


class AnalysisResultWide(ResultBase):
    """Base class for wide format analysis result tables"""
    __abstract__ = True
    
    id = Column(String(32), primary_key=True, default=lambda: uuid.uuid4().hex)
    analysis_result_id = Column(String(32), ForeignKey("analysis_results.id"), nullable=False)
    key_column_value = Column(String(200), nullable=False)  # e.g., "TP53"
    key_column_2_value = Column(String(200), nullable=True)  # Secondary key value
    total_score = Column(Float, nullable=True)
    created_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Create indexes for fast lookups
    __table_args__ = (
        Index('idx_wide_analysis_result_id', 'analysis_result_id'),
        Index('idx_wide_key_column_value', 'key_column_value'),
        Index('idx_wide_total_score', 'total_score'),
    )


def create_rubric_analysis_table(rubric_id: str, rule_names: list) -> str:
    """
    Dynamically create a wide format table for a specific rubric analysis.
    Returns the table name.
    """
    table_name = f"rubric_{rubric_id}_analysis_result"
    
    # Create columns for each rule score
    columns = {
        '__tablename__': table_name,
        '__table_args__': (
            Index(f'idx_{table_name}_analysis_result_id', 'analysis_result_id'),
            Index(f'idx_{table_name}_key_column_value', 'key_column_value'),
            Index(f'idx_{table_name}_total_score', 'total_score'),
        )
    }
    
    # Add base columns
    columns.update({
        'id': Column(String(32), primary_key=True, default=lambda: uuid.uuid4().hex),
        'analysis_result_id': Column(String(32), ForeignKey("analysis_results.id"), nullable=False),
        'key_column_value': Column(String(200), nullable=False),
        'key_column_2_value': Column(String(200), nullable=True),
        'total_score': Column(Float, nullable=True),
        'created_date': Column(DateTime, default=datetime.utcnow, nullable=False),
    })
    
    # Add columns for each rule score
    for rule_name in rule_names:
        # Sanitize rule name for column name
        safe_rule_name = rule_name.replace(' ', '_').replace('-', '_').replace('.', '_').replace('(', '').replace(')', '')
        safe_rule_name = ''.join(c for c in safe_rule_name if c.isalnum() or c == '_')
        if safe_rule_name[0].isdigit():
            safe_rule_name = f"rule_{safe_rule_name}"
        
        columns[f"{safe_rule_name}_score"] = Column(Float, nullable=True)
        columns[f"{safe_rule_name}_weight"] = Column(Float, nullable=True)
        columns[f"{safe_rule_name}_weighted_score"] = Column(Float, nullable=True)
    
    # Create the table class
    table_class = type(f"Rubric{rubric_id}AnalysisResult", (AnalysisResultWide,), columns)
    
    return table_class, table_name


class AnalysisResultTracker(ResultBase):
    """Table to track where analysis result details are stored"""
    __tablename__ = "analysis_result_tracker"
    
    id = Column(String(32), primary_key=True, default=lambda: uuid.uuid4().hex)
    analysis_result_id = Column(String(32), ForeignKey("analysis_results.id"), nullable=False)
    storage_type = Column(String(50), nullable=False)  # "wide_table", "file", "long_table"
    storage_location = Column(String(500), nullable=False)  # Table name, file path, or table name
    created_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Create indexes
    __table_args__ = (
        Index('idx_tracker_analysis_result_id', 'analysis_result_id'),
        Index('idx_tracker_storage_type', 'storage_type'),
    )
    
    def __repr__(self):
        return f"<AnalysisResultTracker(id={self.id}, analysis_result_id={self.analysis_result_id}, storage_type={self.storage_type}, storage_location={self.storage_location})>"
