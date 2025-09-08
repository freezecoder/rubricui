from sqlalchemy import Column, String, Text, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from app.models.database import Base, UUIDType
import uuid
from datetime import datetime

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(String(32), primary_key=True, default=lambda: uuid.uuid4().hex)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    owner_name = Column(String(255))  # Keep for backward compatibility
    owner_id = Column(String(32), ForeignKey("users.id"))  # New user relationship
    organization = Column(String(255))
    created_date = Column(DateTime, default=datetime.utcnow)
    input_data_file = Column(String(500))
    applied_rules = Column(JSON, default=list)
    applied_rubrics = Column(JSON, default=list)
    results = Column(String(500))
    execution_history = Column(JSON, default=list)
    
    # Relationships
    owner = relationship("User", back_populates="owned_projects", foreign_keys=[owner_id])
    shares = relationship("ProjectShare", back_populates="project", cascade="all, delete-orphan")
    analysis_results = relationship("AnalysisResult", back_populates="project", cascade="all, delete-orphan")