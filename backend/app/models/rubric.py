from sqlalchemy import Column, String, Text, DateTime, Boolean, JSON
from app.models.database import Base, UUIDType
import uuid
from datetime import datetime

class Rubric(Base):
    __tablename__ = "rubrics"
    
    id = Column(UUIDType, primary_key=True, default=lambda: uuid.uuid4().hex)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    owner_name = Column(String(255))
    organization = Column(String(255))
    disease_area_study = Column(String(255))  # DAS
    tags = Column(JSON)  # Store as JSON for SQLite compatibility
    created_date = Column(DateTime, default=datetime.utcnow)
    modified_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)