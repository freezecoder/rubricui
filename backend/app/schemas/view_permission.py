from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class PermissionType(str, Enum):
    """Available permission types"""
    VIEW = "view"
    CREATE = "create"
    EDIT = "edit"
    DELETE = "delete"
    ADMIN = "admin"

class ViewCategory(str, Enum):
    """View categories for organization"""
    GENERAL = "general"
    ADMIN = "admin"
    ANALYSIS = "analysis"
    DATA = "data"
    USER_MANAGEMENT = "user_management"

# ViewPermission Schemas
class ViewPermissionBase(BaseModel):
    view_name: str = Field(..., min_length=1, max_length=100, description="Unique view identifier")
    view_display_name: str = Field(..., min_length=1, max_length=255, description="Human-readable view name")
    view_description: Optional[str] = Field(None, description="Description of the view")
    available_permissions: List[PermissionType] = Field(..., description="Available permission types for this view")
    view_category: ViewCategory = Field(ViewCategory.GENERAL, description="Category for organizing views")
    view_route: Optional[str] = Field(None, description="Frontend route path")
    api_endpoint: Optional[str] = Field(None, description="Backend API endpoint")
    is_active: bool = Field(True, description="Whether the view is active")
    is_system_view: bool = Field(False, description="Whether this is a system view that cannot be deleted")

class ViewPermissionCreate(ViewPermissionBase):
    pass

class ViewPermissionUpdate(BaseModel):
    view_display_name: Optional[str] = Field(None, min_length=1, max_length=255)
    view_description: Optional[str] = None
    available_permissions: Optional[List[PermissionType]] = None
    view_category: Optional[ViewCategory] = None
    view_route: Optional[str] = None
    api_endpoint: Optional[str] = None
    is_active: Optional[bool] = None

class ViewPermissionResponse(ViewPermissionBase):
    id: str
    created_date: datetime
    modified_date: datetime
    
    class Config:
        from_attributes = True

class ViewPermissionSummary(BaseModel):
    id: str
    view_name: str
    view_display_name: str
    view_category: ViewCategory
    is_active: bool
    is_system_view: bool

# UserViewPermission Schemas
class UserViewPermissionBase(BaseModel):
    user_id: str = Field(..., description="ID of the user")
    view_permission_id: str = Field(..., description="ID of the view permission")
    can_view: bool = Field(False, description="Can view this area")
    can_create: bool = Field(False, description="Can create new items")
    can_edit: bool = Field(False, description="Can edit existing items")
    can_delete: bool = Field(False, description="Can delete items")
    can_admin: bool = Field(False, description="Full admin access to this view")
    expires_at: Optional[datetime] = Field(None, description="Optional expiration date")
    is_active: bool = Field(True, description="Whether the permission is active")
    permission_context: Optional[Dict[str, Any]] = Field(None, description="Additional permission context")
    notes: Optional[str] = Field(None, description="Admin notes about the permission")

class UserViewPermissionCreate(UserViewPermissionBase):
    granted_by: str = Field(..., description="ID of the user granting the permission")

class UserViewPermissionUpdate(BaseModel):
    can_view: Optional[bool] = None
    can_create: Optional[bool] = None
    can_edit: Optional[bool] = None
    can_delete: Optional[bool] = None
    can_admin: Optional[bool] = None
    expires_at: Optional[datetime] = None
    is_active: Optional[bool] = None
    permission_context: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None

class UserViewPermissionResponse(UserViewPermissionBase):
    id: str
    granted_by: str
    granted_date: datetime
    created_date: datetime
    modified_date: datetime
    
    # Include related data
    view_permission: Optional[ViewPermissionSummary] = None
    user: Optional[Dict[str, str]] = None  # Basic user info
    granter: Optional[Dict[str, str]] = None  # Basic granter info
    
    class Config:
        from_attributes = True

class UserViewPermissionSummary(BaseModel):
    id: str
    view_name: str
    view_display_name: str
    can_view: bool
    can_create: bool
    can_edit: bool
    can_delete: bool
    can_admin: bool
    is_active: bool
    expires_at: Optional[datetime]

# PermissionGroup Schemas
class PermissionGroupBase(BaseModel):
    group_name: str = Field(..., min_length=1, max_length=100, description="Unique group identifier")
    group_display_name: str = Field(..., min_length=1, max_length=255, description="Human-readable group name")
    group_description: Optional[str] = Field(None, description="Description of the permission group")
    default_permissions: Dict[str, List[PermissionType]] = Field(..., description="Default permissions for each view")
    is_system_group: bool = Field(False, description="Whether this is a system group that cannot be deleted")
    is_active: bool = Field(True, description="Whether the group is active")

class PermissionGroupCreate(PermissionGroupBase):
    pass

class PermissionGroupUpdate(BaseModel):
    group_display_name: Optional[str] = Field(None, min_length=1, max_length=255)
    group_description: Optional[str] = None
    default_permissions: Optional[Dict[str, List[PermissionType]]] = None
    is_active: Optional[bool] = None

class PermissionGroupResponse(PermissionGroupBase):
    id: str
    created_date: datetime
    modified_date: datetime
    
    class Config:
        from_attributes = True

class PermissionGroupSummary(BaseModel):
    id: str
    group_name: str
    group_display_name: str
    is_active: bool
    is_system_group: bool

# UserPermissionGroup Schemas
class UserPermissionGroupBase(BaseModel):
    user_id: str = Field(..., description="ID of the user")
    permission_group_id: str = Field(..., description="ID of the permission group")
    expires_at: Optional[datetime] = Field(None, description="Optional expiration date")
    is_active: bool = Field(True, description="Whether the group assignment is active")
    assignment_notes: Optional[str] = Field(None, description="Notes about the group assignment")

class UserPermissionGroupCreate(UserPermissionGroupBase):
    assigned_by: str = Field(..., description="ID of the user assigning the group")

class UserPermissionGroupUpdate(BaseModel):
    expires_at: Optional[datetime] = None
    is_active: Optional[bool] = None
    assignment_notes: Optional[str] = None

class UserPermissionGroupResponse(UserPermissionGroupBase):
    id: str
    assigned_by: str
    assigned_date: datetime
    created_date: datetime
    modified_date: datetime
    
    # Include related data
    permission_group: Optional[PermissionGroupSummary] = None
    user: Optional[Dict[str, str]] = None  # Basic user info
    assigner: Optional[Dict[str, str]] = None  # Basic assigner info
    
    class Config:
        from_attributes = True

# Combined permission schemas for user management
class UserPermissionSummary(BaseModel):
    """Summary of all permissions for a user"""
    user_id: str
    username: str
    full_name: str
    direct_permissions: List[UserViewPermissionSummary]
    group_permissions: List[UserPermissionGroupResponse]
    effective_permissions: Dict[str, List[PermissionType]]  # Computed effective permissions

class PermissionMatrix(BaseModel):
    """Matrix showing all users and their permissions across all views"""
    views: List[ViewPermissionSummary]
    users: List[Dict[str, str]]  # Basic user info
    permissions: Dict[str, Dict[str, List[PermissionType]]]  # user_id -> view_name -> permissions

# Bulk operation schemas
class BulkPermissionUpdate(BaseModel):
    user_ids: List[str] = Field(..., description="List of user IDs to update")
    view_permission_id: str = Field(..., description="View permission to update")
    permissions: Dict[str, bool] = Field(..., description="Permission updates (can_view, can_create, etc.)")
    granted_by: str = Field(..., description="ID of the user making the update")
    notes: Optional[str] = Field(None, description="Notes about the bulk update")

class BulkGroupAssignment(BaseModel):
    user_ids: List[str] = Field(..., description="List of user IDs to assign to group")
    permission_group_id: str = Field(..., description="Permission group to assign")
    assigned_by: str = Field(..., description="ID of the user making the assignment")
    assignment_notes: Optional[str] = Field(None, description="Notes about the assignment")

# Validation helpers
class PermissionValidator:
    @staticmethod
    def validate_permission_hierarchy(permissions: Dict[str, bool]) -> bool:
        """Validate that permission hierarchy is maintained (admin > delete > edit > create > view)"""
        if permissions.get('can_admin', False):
            return True  # Admin permission overrides all others
        
        if permissions.get('can_delete', False) and not permissions.get('can_edit', False):
            return False  # Cannot delete without edit permission
        
        if permissions.get('can_edit', False) and not permissions.get('can_view', False):
            return False  # Cannot edit without view permission
        
        if permissions.get('can_create', False) and not permissions.get('can_view', False):
            return False  # Cannot create without view permission
        
        return True
    
    @staticmethod
    def normalize_permissions(permissions: Dict[str, bool]) -> Dict[str, bool]:
        """Normalize permissions based on hierarchy"""
        normalized = permissions.copy()
        
        # If admin is true, set all others to true
        if normalized.get('can_admin', False):
            normalized.update({
                'can_view': True,
                'can_create': True,
                'can_edit': True,
                'can_delete': True
            })
        
        # If delete is true, ensure edit and view are true
        if normalized.get('can_delete', False):
            normalized['can_edit'] = True
            normalized['can_view'] = True
        
        # If edit is true, ensure view is true
        if normalized.get('can_edit', False):
            normalized['can_view'] = True
        
        # If create is true, ensure view is true
        if normalized.get('can_create', False):
            normalized['can_view'] = True
        
        return normalized
