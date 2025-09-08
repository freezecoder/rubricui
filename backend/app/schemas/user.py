from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime

class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=255)
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=255)
    organization: Optional[str] = None
    department: Optional[str] = None
    bio: Optional[str] = None

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=255)
    role: str = Field(default="user", pattern="^(user|manager|admin)$")

class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=255)
    email: Optional[EmailStr] = None
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    organization: Optional[str] = None
    department: Optional[str] = None
    bio: Optional[str] = None
    role: Optional[str] = Field(None, pattern="^(user|manager|admin)$")
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None

class UserResponse(UserBase):
    id: str
    role: str
    is_active: bool
    is_verified: bool
    avatar_url: Optional[str]
    created_date: datetime
    modified_date: datetime
    last_login: Optional[datetime]

    class Config:
        from_attributes = True

class UserSummary(BaseModel):
    """Lightweight user summary for lists"""
    id: str
    username: str
    full_name: str
    email: str
    role: str
    organization: Optional[str]
    is_active: bool
    is_verified: bool
    created_date: datetime
    last_login: Optional[datetime]

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    username: str
    password: str

class UserToken(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class ProjectShareCreate(BaseModel):
    user_id: str
    permission_level: str = Field(default="viewer", pattern="^(viewer|editor|admin)$")
    can_view: bool = True
    can_edit: bool = False
    can_delete: bool = False
    can_share: bool = False
    expires_at: Optional[datetime] = None

class ProjectShareUpdate(BaseModel):
    permission_level: Optional[str] = Field(None, pattern="^(viewer|editor|admin)$")
    can_view: Optional[bool] = None
    can_edit: Optional[bool] = None
    can_delete: Optional[bool] = None
    can_share: Optional[bool] = None
    expires_at: Optional[datetime] = None

class ProjectShareResponse(BaseModel):
    id: str
    project_id: str
    user_id: str
    permission_level: str
    can_view: bool
    can_edit: bool
    can_delete: bool
    can_share: bool
    shared_by: str
    shared_date: datetime
    expires_at: Optional[datetime]
    
    # Include user details
    user: UserSummary
    sharer: UserSummary

    class Config:
        from_attributes = True

class RubricShareCreate(BaseModel):
    user_id: str
    permission_level: str = Field(default="viewer", pattern="^(viewer|editor|admin)$")
    can_view: bool = True
    can_edit: bool = False
    can_delete: bool = False
    can_share: bool = False
    expires_at: Optional[datetime] = None

class RubricShareUpdate(BaseModel):
    permission_level: Optional[str] = Field(None, pattern="^(viewer|editor|admin)$")
    can_view: Optional[bool] = None
    can_edit: Optional[bool] = None
    can_delete: Optional[bool] = None
    can_share: Optional[bool] = None
    expires_at: Optional[datetime] = None

class RubricShareResponse(BaseModel):
    id: str
    rubric_id: str
    user_id: str
    permission_level: str
    can_view: bool
    can_edit: bool
    can_delete: bool
    can_share: bool
    shared_by: str
    shared_date: datetime
    expires_at: Optional[datetime]
    
    # Include user details
    user: UserSummary
    sharer: UserSummary

    class Config:
        from_attributes = True

class UserStats(BaseModel):
    """User statistics for admin dashboard"""
    total_users: int
    active_users: int
    verified_users: int
    users_by_role: Dict[str, int]
    recent_registrations: int  # Last 30 days
    users_with_projects: int
    users_with_rules: int
    users_with_rubrics: int
