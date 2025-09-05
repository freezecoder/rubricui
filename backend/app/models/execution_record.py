from sqlalchemy import Column, String, Text, DateTime, JSON, ForeignKey, Float
from app.models.database import Base, UUIDType
import uuid
from datetime import datetime

class ExecutionRecord(Base):
    __tablename__ = "execution_records"
    
    id = Column(UUIDType, primary_key=True, default=lambda: uuid.uuid4().hex)
    project_id = Column(UUIDType, ForeignKey("projects.id"), nullable=False)
    execution_type = Column(String(50), nullable=False)  # "rule" or "rubric"
    executed_items = Column(JSON, default=list)  # IDs of rules or rubrics executed
    execution_date = Column(DateTime, default=datetime.utcnow)
    status = Column(String(50), nullable=False)  # "pending", "running", "completed", "failed"
    results_file = Column(String(500))
    execution_time_seconds = Column(Float)
    error_message = Column(Text)