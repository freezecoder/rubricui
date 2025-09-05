from sqlalchemy import Column, String, Text, Float, DateTime, Boolean, JSON
from app.models.database import Base, UUIDType
import uuid
from datetime import datetime

class Rule(Base):
    __tablename__ = "rules"
    
    id = Column(UUIDType, primary_key=True, default=lambda: uuid.uuid4().hex)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    owner_name = Column(String(255))
    organization = Column(String(255))
    disease_area_study = Column(String(255))  # DAS
    tags = Column(JSON)  # Store as JSON for SQLite compatibility
    ruleset_conditions = Column(JSON)  # List of condition strings
    column_mapping = Column(JSON)  # Dict mapping variables to columns
    weight = Column(Float, default=1.0)
    created_date = Column(DateTime, default=datetime.utcnow)
    modified_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)