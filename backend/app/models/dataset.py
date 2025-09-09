from sqlalchemy import Column, String, Text, DateTime, Integer, ForeignKey, Float, Boolean, JSON, Enum
from sqlalchemy.orm import relationship
from app.models.database import Base
import uuid
from datetime import datetime
import enum

class DatasetType(enum.Enum):
    INPUT = "input"
    OUTPUT = "output"
    ANNOTATIONS = "annotations"
    RUBRIC = "rubric"

class Dataset(Base):
    __tablename__ = "datasets"
    
    id = Column(String(32), primary_key=True, default=lambda: uuid.uuid4().hex)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    owner_name = Column(String(255))  # Keep for backward compatibility
    owner_id = Column(String(32), ForeignKey("users.id"))  # New user relationship
    organization = Column(String(255))
    disease_area_study = Column(String(255))  # DAS
    tags = Column(String(500))  # Comma-separated tags for SQLite compatibility
    
    # File information
    original_filename = Column(String(500), nullable=False)
    file_path = Column(String(500), nullable=False)  # Path to original file
    pickled_path = Column(String(500), nullable=False)  # Path to pickled dataframe
    
    # Dataset metadata
    num_rows = Column(Integer, nullable=False)
    num_columns = Column(Integer, nullable=False)
    num_numeric_columns = Column(Integer, default=0)
    num_string_columns = Column(Integer, default=0)
    num_score_columns = Column(Integer, default=0)
    
    # Timestamps
    created_date = Column(DateTime, default=datetime.utcnow)
    modified_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Dataset type and admin control attributes
    dataset_type = Column(String(20), default="input", nullable=False)
    visibility = Column(String(20), default="public")  # "public", "private", "hidden"
    enabled = Column(Boolean, default=True)  # Whether the dataset is enabled for use
    
    # Relationships
    columns = relationship("DatasetColumn", back_populates="dataset", cascade="all, delete-orphan")
    histograms = relationship("DatasetHistogram", back_populates="dataset", cascade="all, delete-orphan")
    owner_user = relationship("User", back_populates="owned_datasets", foreign_keys=[owner_id])
    analysis_results = relationship("AnalysisResult", back_populates="dataset", cascade="all, delete-orphan")

class DatasetColumn(Base):
    __tablename__ = "dataset_columns"
    
    id = Column(String(32), primary_key=True, default=lambda: uuid.uuid4().hex)
    dataset_id = Column(String(32), ForeignKey("datasets.id"), nullable=False)
    
    # Column information
    original_name = Column(String(255), nullable=False)  # Original column name from file
    sanitized_name = Column(String(255), nullable=False)  # Sanitized name for rubric references
    column_type = Column(String(50), nullable=False)  # 'numeric', 'string', 'score'
    column_index = Column(Integer, nullable=False)  # Position in the dataset
    
    # Numeric column statistics (only for numeric columns)
    mean_value = Column(Float)
    median_value = Column(Float)
    min_value = Column(Float)
    max_value = Column(Float)
    std_deviation = Column(Float)
    null_count = Column(Integer, default=0)
    unique_count = Column(Integer)
    
    # String column statistics (only for string columns)
    most_common_value = Column(String(500))
    most_common_count = Column(Integer)
    
    # Timestamps
    created_date = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    dataset = relationship("Dataset", back_populates="columns")
    histograms = relationship("DatasetHistogram", back_populates="column", cascade="all, delete-orphan")

class DatasetHistogram(Base):
    __tablename__ = "dataset_histograms"
    
    id = Column(String(32), primary_key=True, default=lambda: uuid.uuid4().hex)
    dataset_id = Column(String(32), ForeignKey("datasets.id"), nullable=False)
    column_id = Column(String(32), ForeignKey("dataset_columns.id"), nullable=False)
    
    # Histogram configuration
    bin_count = Column(Integer, nullable=False)  # Number of bins used
    bin_edges = Column(JSON, nullable=False)  # Array of bin edge values
    bin_counts = Column(JSON, nullable=False)  # Array of counts for each bin
    
    # Histogram metadata
    min_value = Column(Float, nullable=False)  # Minimum value in the data
    max_value = Column(Float, nullable=False)  # Maximum value in the data
    total_count = Column(Integer, nullable=False)  # Total number of non-null values
    null_count = Column(Integer, default=0)  # Number of null/NaN values
    
    # Timestamps
    created_date = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    dataset = relationship("Dataset", back_populates="histograms")
    column = relationship("DatasetColumn", back_populates="histograms")
