from sqlalchemy import Column, String, Text, DateTime, Boolean, JSON, ForeignKey
from sqlalchemy.orm import relationship
from app.models.database import Base, UUIDType
import uuid
from datetime import datetime

class Rubric(Base):
    __tablename__ = "rubrics"
    
    id = Column(String(32), primary_key=True, default=lambda: uuid.uuid4().hex)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    owner_name = Column(String(255))  # Keep for backward compatibility
    owner_id = Column(String(32), ForeignKey("users.id"))  # New user relationship
    organization = Column(String(255))
    disease_area_study = Column(String(255))  # DAS
    tags = Column(JSON)  # Store as JSON for SQLite compatibility
    created_date = Column(DateTime, default=datetime.utcnow)
    modified_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Admin control attributes
    visibility = Column(String(20), default="public")  # "public", "private", "hidden"
    enabled = Column(Boolean, default=True)  # Whether the rubric is enabled for use
    
    # Relationships
    owner_user = relationship("User", back_populates="owned_rubrics", foreign_keys=[owner_id])
    shares = relationship("RubricShare", back_populates="rubric", cascade="all, delete-orphan")
    analysis_results = relationship("AnalysisResult", back_populates="rubric", cascade="all, delete-orphan")