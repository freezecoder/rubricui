# Analysis results have been moved to a separate database (rubric_result.db)
# This file is kept for backward compatibility but the models are now in:
# - app.models.result_analysis_result for the new result database models
# - app.models.result_database for the result database configuration

# The old models are preserved here for reference during migration
# but should not be used in new code.

from sqlalchemy import Column, String, DateTime, ForeignKey, Float, Integer, Text
from sqlalchemy.orm import relationship
from app.models.database import Base
import uuid
from datetime import datetime

# DEPRECATED: These models are kept for migration purposes only
# Use app.models.result_analysis_result for new analysis result functionality

class AnalysisResult(Base):
    """DEPRECATED: Main analysis result table - moved to separate database"""
    __tablename__ = "analysis_results"
    
    id = Column(String(32), primary_key=True, default=lambda: uuid.uuid4().hex)
    project_id = Column(String(32), ForeignKey("projects.id"), nullable=False)
    rubric_id = Column(String(32), ForeignKey("rubrics.id"), nullable=False)
    dataset_id = Column(String(32), ForeignKey("datasets.id"), nullable=False)
    created_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Analysis metadata
    total_genes_processed = Column(Integer, nullable=False, default=0)
    total_rules_executed = Column(Integer, nullable=False, default=0)
    execution_time_seconds = Column(Float, nullable=True)
    status = Column(String(50), nullable=False, default="completed")  # pending, running, completed, failed
    error_message = Column(Text, nullable=True)
    
    # Results file path (optional, for backward compatibility)
    results_file = Column(String(500), nullable=True)
    
    # Relationships
    project = relationship("Project", back_populates="analysis_results")
    rubric = relationship("Rubric", back_populates="analysis_results")
    dataset = relationship("Dataset", back_populates="analysis_results")
    details = relationship("AnalysisResultDetail", back_populates="analysis_result", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<AnalysisResult(id={self.id}, project_id={self.project_id}, rubric_id={self.rubric_id}, status={self.status})>"


class AnalysisResultDetail(Base):
    """DEPRECATED: Long format table - moved to separate database with wide format"""
    __tablename__ = "analysis_result_details"
    
    id = Column(String(32), primary_key=True, default=lambda: uuid.uuid4().hex)
    analysis_result_id = Column(String(32), ForeignKey("analysis_results.id"), nullable=False)
    
    # Key columns for identifying the data row
    key_column = Column(String(100), nullable=False)  # e.g., "gene_symbol"
    key_column_value = Column(String(200), nullable=False)  # e.g., "TP53"
    key_column_2 = Column(String(100), nullable=True)  # Reserved for future use
    key_column_2_value = Column(String(200), nullable=True)  # Reserved for future use
    
    # Rule execution results
    rule_id = Column(String(32), ForeignKey("rules.id"), nullable=False)
    rule_name = Column(String(200), nullable=False)  # Denormalized for performance
    rule_score = Column(Float, nullable=True)  # Individual rule score
    rule_weight = Column(Float, nullable=True)  # Weight applied to this rule in the rubric
    weighted_score = Column(Float, nullable=True)  # rule_score * rule_weight
    
    # Total score for this gene across all rules in the rubric
    total_score = Column(Float, nullable=True)
    
    # Additional metadata
    execution_order = Column(Integer, nullable=True)  # Order of rule execution in rubric
    created_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    analysis_result = relationship("AnalysisResult", back_populates="details")
    rule = relationship("Rule")
    
    def __repr__(self):
        return f"<AnalysisResultDetail(id={self.id}, analysis_result_id={self.analysis_result_id}, key_value={self.key_column_value}, rule_name={self.rule_name}, score={self.rule_score})>"
