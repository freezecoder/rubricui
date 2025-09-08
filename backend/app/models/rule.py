from sqlalchemy import Column, String, Text, Float, DateTime, Boolean, JSON, ForeignKey
from sqlalchemy.orm import relationship
from app.models.database import Base, UUIDType
import uuid
from datetime import datetime

class Rule(Base):
    __tablename__ = "rules"
    
    id = Column(String(32), primary_key=True, default=lambda: uuid.uuid4().hex)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    owner_name = Column(String(255))  # Keep for backward compatibility
    owner_id = Column(String(32), ForeignKey("users.id"))  # New user relationship
    organization = Column(String(255))
    disease_area_study = Column(String(255))  # DAS
    tags = Column(JSON)  # Store as JSON for SQLite compatibility
    ruleset_conditions = Column(JSON)  # List of condition strings
    column_mapping = Column(JSON)  # Dict mapping variables to columns
    weight = Column(Float, default=1.0)
    created_date = Column(DateTime, default=datetime.utcnow)
    modified_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Admin control attributes
    visibility = Column(String(20), default="public")  # "public", "private", "hidden"
    enabled = Column(Boolean, default=True)  # Whether the rule is enabled for use
    
    # Relationships
    owner_user = relationship("User", back_populates="owned_rules", foreign_keys=[owner_id])