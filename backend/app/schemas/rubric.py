from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from datetime import datetime

class RubricRuleCreate(BaseModel):
    rule_id: str  # Changed from uuid.UUID to str for SQLite compatibility
    weight: float = 1.0
    order_index: int = 0

class RubricCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    owner_name: Optional[str] = None
    organization: Optional[str] = None
    disease_area_study: Optional[str] = None
    tags: Optional[List[str]] = []
    visibility: str = Field(default="public", pattern="^(public|private|hidden)$")
    enabled: bool = True

class RubricResponse(BaseModel):
    id: str  # Changed from uuid.UUID to str for SQLite compatibility
    name: str
    description: Optional[str]
    owner_name: Optional[str]
    organization: Optional[str]
    disease_area_study: Optional[str]
    tags: Optional[List[str]]
    created_date: datetime
    modified_date: datetime
    is_active: bool
    visibility: str
    enabled: bool

    class Config:
        from_attributes = True

class RubricAdminUpdate(BaseModel):
    """Schema for admin updates to rubric visibility and enabled status"""
    visibility: Optional[str] = Field(None, pattern="^(public|private|hidden)$")
    enabled: Optional[bool] = None
    is_active: Optional[bool] = None