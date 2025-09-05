from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from datetime import datetime
import uuid

class RuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    owner_name: Optional[str] = None
    organization: Optional[str] = None
    disease_area_study: Optional[str] = None
    tags: Optional[List[str]] = []
    ruleset_conditions: List[str]
    column_mapping: Dict[str, str]
    weight: float = 1.0

class RuleResponse(BaseModel):
    id: str  # Changed from uuid.UUID to str for SQLite compatibility
    name: str
    description: Optional[str]
    owner_name: Optional[str]
    organization: Optional[str]
    disease_area_study: Optional[str]
    tags: Optional[List[str]]
    ruleset_conditions: List[str]
    column_mapping: Dict[str, str]
    weight: float
    created_date: datetime
    modified_date: datetime
    is_active: bool

    class Config:
        from_attributes = True