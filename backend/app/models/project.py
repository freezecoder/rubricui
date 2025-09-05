from sqlalchemy import Column, String, Text, DateTime, JSON
from app.models.database import Base, UUIDType
import uuid
from datetime import datetime

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(UUIDType, primary_key=True, default=lambda: uuid.uuid4().hex)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    owner_name = Column(String(255))
    organization = Column(String(255))
    created_date = Column(DateTime, default=datetime.utcnow)
    input_data_file = Column(String(500))
    applied_rules = Column(JSON, default=list)
    applied_rubrics = Column(JSON, default=list)
    results = Column(String(500))
    execution_history = Column(JSON, default=list)