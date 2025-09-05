from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from datetime import datetime
import uuid

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    owner_name: Optional[str] = None
    organization: Optional[str] = None

class ProjectResponse(BaseModel):
    id: str  # Changed from uuid.UUID to str for SQLite compatibility
    name: str
    description: Optional[str]
    owner_name: Optional[str]
    organization: Optional[str]
    created_date: datetime
    input_data_file: Optional[str]
    applied_rules: List[str] = []  # Changed from List[uuid.UUID] to List[str]
    applied_rubrics: List[str] = []  # Changed from List[uuid.UUID] to List[str]
    results: Optional[str]
    execution_history: List[Dict] = []

    class Config:
        from_attributes = True