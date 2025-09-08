from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, and_, or_
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import uuid

from app.models.database import get_db
from app.models.view_permission import ViewPermission, UserViewPermission, PermissionGroup, UserPermissionGroup
from app.models.user import User
from app.schemas.view_permission import (
    ViewPermissionCreate, ViewPermissionUpdate, ViewPermissionResponse, ViewPermissionSummary,
    UserViewPermissionCreate, UserViewPermissionUpdate, UserViewPermissionResponse, UserViewPermissionSummary,
    PermissionGroupCreate, PermissionGroupUpdate, PermissionGroupResponse, PermissionGroupSummary,
    UserPermissionGroupCreate, UserPermissionGroupUpdate, UserPermissionGroupResponse,
    UserPermissionSummary, PermissionMatrix, BulkPermissionUpdate, BulkGroupAssignment,
    PermissionValidator, PermissionType, ViewCategory
)
from app.middleware.auth import get_current_admin_user

router = APIRouter()

# ViewPermission endpoints
@router.post("/views", response_model=ViewPermissionResponse)
async def create_view_permission(
    view_permission: ViewPermissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Create a new view permission definition (admin only)"""
    
    # Check if view_name already exists
    existing = db.query(ViewPermission).filter(ViewPermission.view_name == view_permission.view_name).first()
    if existing:
        raise HTTPException(status_code=400, detail="View permission with this name already exists")
    
    db_view_permission = ViewPermission(**view_permission.dict())
    db.add(db_view_permission)
    db.commit()
    db.refresh(db_view_permission)
    return db_view_permission

@router.get("/views", response_model=List[ViewPermissionResponse])
async def list_view_permissions(
    skip: int = 0,
    limit: int = 100,
    category: Optional[ViewCategory] = Query(None, description="Filter by view category"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    is_system: Optional[bool] = Query(None, description="Filter by system views"),
    db: Session = Depends(get_db)
):
    """List all view permission definitions"""
    
    query = db.query(ViewPermission)
    
    if category:
        query = query.filter(ViewPermission.view_category == category)
    if is_active is not None:
        query = query.filter(ViewPermission.is_active == is_active)
    if is_system is not None:
        query = query.filter(ViewPermission.is_system_view == is_system)
    
    view_permissions = query.order_by(ViewPermission.view_name).offset(skip).limit(limit).all()
    return view_permissions

@router.get("/views/{view_id}", response_model=ViewPermissionResponse)
async def get_view_permission(
    view_id: str,
    db: Session = Depends(get_db)
):
    """Get a specific view permission definition"""
    
    view_permission = db.query(ViewPermission).filter(ViewPermission.id == view_id).first()
    if not view_permission:
        raise HTTPException(status_code=404, detail="View permission not found")
    
    return view_permission

@router.put("/views/{view_id}", response_model=ViewPermissionResponse)
async def update_view_permission(
    view_id: str,
    view_permission_update: ViewPermissionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Update a view permission definition (admin only)"""
    
    view_permission = db.query(ViewPermission).filter(ViewPermission.id == view_id).first()
    if not view_permission:
        raise HTTPException(status_code=404, detail="View permission not found")
    
    # Prevent modification of system views
    if view_permission.is_system_view:
        raise HTTPException(status_code=403, detail="Cannot modify system view permissions")
    
    update_data = view_permission_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(view_permission, field, value)
    
    view_permission.modified_date = datetime.utcnow()
    db.commit()
    db.refresh(view_permission)
    return view_permission

@router.delete("/views/{view_id}")
async def delete_view_permission(
    view_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Delete a view permission definition (admin only)"""
    
    view_permission = db.query(ViewPermission).filter(ViewPermission.id == view_id).first()
    if not view_permission:
        raise HTTPException(status_code=404, detail="View permission not found")
    
    # Prevent deletion of system views
    if view_permission.is_system_view:
        raise HTTPException(status_code=403, detail="Cannot delete system view permissions")
    
    # Check if any user permissions reference this view
    user_permissions_count = db.query(UserViewPermission).filter(
        UserViewPermission.view_permission_id == view_id
    ).count()
    
    if user_permissions_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete view permission. {user_permissions_count} user permissions reference this view."
        )
    
    db.delete(view_permission)
    db.commit()
    return {"message": "View permission deleted successfully"}

# UserViewPermission endpoints
@router.post("/user-permissions", response_model=UserViewPermissionResponse)
async def create_user_view_permission(
    user_permission: UserViewPermissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Create a new user view permission (admin only)"""
    
    # Validate user exists
    user = db.query(User).filter(User.id == user_permission.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Validate view permission exists
    view_permission = db.query(ViewPermission).filter(ViewPermission.id == user_permission.view_permission_id).first()
    if not view_permission:
        raise HTTPException(status_code=404, detail="View permission not found")
    
    # Check if permission already exists
    existing = db.query(UserViewPermission).filter(
        and_(
            UserViewPermission.user_id == user_permission.user_id,
            UserViewPermission.view_permission_id == user_permission.view_permission_id
        )
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="User already has permissions for this view")
    
    # Validate permission hierarchy
    permissions = {
        'can_view': user_permission.can_view,
        'can_create': user_permission.can_create,
        'can_edit': user_permission.can_edit,
        'can_delete': user_permission.can_delete,
        'can_admin': user_permission.can_admin
    }
    
    if not PermissionValidator.validate_permission_hierarchy(permissions):
        raise HTTPException(status_code=400, detail="Invalid permission hierarchy")
    
    # Normalize permissions
    normalized_permissions = PermissionValidator.normalize_permissions(permissions)
    
    # Create the permission
    permission_data = user_permission.dict()
    permission_data.update(normalized_permissions)
    
    db_user_permission = UserViewPermission(**permission_data)
    db.add(db_user_permission)
    db.commit()
    db.refresh(db_user_permission)
    
    # Load related data for response
    db.refresh(db_user_permission)
    return db_user_permission

@router.get("/user-permissions", response_model=List[UserViewPermissionResponse])
async def list_user_view_permissions(
    skip: int = 0,
    limit: int = 100,
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    view_permission_id: Optional[str] = Query(None, description="Filter by view permission ID"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: Session = Depends(get_db)
):
    """List user view permissions"""
    
    query = db.query(UserViewPermission)
    
    if user_id:
        query = query.filter(UserViewPermission.user_id == user_id)
    if view_permission_id:
        query = query.filter(UserViewPermission.view_permission_id == view_permission_id)
    if is_active is not None:
        query = query.filter(UserViewPermission.is_active == is_active)
    
    user_permissions = query.order_by(UserViewPermission.created_date.desc()).offset(skip).limit(limit).all()
    return user_permissions

@router.get("/user-permissions/{permission_id}", response_model=UserViewPermissionResponse)
async def get_user_view_permission(
    permission_id: str,
    db: Session = Depends(get_db)
):
    """Get a specific user view permission"""
    
    user_permission = db.query(UserViewPermission).filter(UserViewPermission.id == permission_id).first()
    if not user_permission:
        raise HTTPException(status_code=404, detail="User view permission not found")
    
    return user_permission

@router.put("/user-permissions/{permission_id}", response_model=UserViewPermissionResponse)
async def update_user_view_permission(
    permission_id: str,
    permission_update: UserViewPermissionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Update a user view permission (admin only)"""
    
    user_permission = db.query(UserViewPermission).filter(UserViewPermission.id == permission_id).first()
    if not user_permission:
        raise HTTPException(status_code=404, detail="User view permission not found")
    
    # Get current permissions and merge with updates
    current_permissions = {
        'can_view': user_permission.can_view,
        'can_create': user_permission.can_create,
        'can_edit': user_permission.can_edit,
        'can_delete': user_permission.can_delete,
        'can_admin': user_permission.can_admin
    }
    
    update_data = permission_update.dict(exclude_unset=True)
    
    # Update permissions if provided
    for perm in ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_admin']:
        if perm in update_data:
            current_permissions[perm] = update_data[perm]
    
    # Validate permission hierarchy
    if not PermissionValidator.validate_permission_hierarchy(current_permissions):
        raise HTTPException(status_code=400, detail="Invalid permission hierarchy")
    
    # Normalize permissions
    normalized_permissions = PermissionValidator.normalize_permissions(current_permissions)
    
    # Apply updates
    for field, value in update_data.items():
        if field in normalized_permissions:
            setattr(user_permission, field, normalized_permissions[field])
        else:
            setattr(user_permission, field, value)
    
    user_permission.modified_date = datetime.utcnow()
    db.commit()
    db.refresh(user_permission)
    return user_permission

@router.delete("/user-permissions/{permission_id}")
async def delete_user_view_permission(
    permission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Delete a user view permission (admin only)"""
    
    user_permission = db.query(UserViewPermission).filter(UserViewPermission.id == permission_id).first()
    if not user_permission:
        raise HTTPException(status_code=404, detail="User view permission not found")
    
    db.delete(user_permission)
    db.commit()
    return {"message": "User view permission deleted successfully"}

# Bulk operations
@router.post("/user-permissions/bulk", response_model=List[UserViewPermissionResponse])
async def bulk_update_user_permissions(
    bulk_update: BulkPermissionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Bulk update user permissions for a specific view (admin only)"""
    
    # Validate view permission exists
    view_permission = db.query(ViewPermission).filter(ViewPermission.id == bulk_update.view_permission_id).first()
    if not view_permission:
        raise HTTPException(status_code=404, detail="View permission not found")
    
    # Validate all users exist
    users = db.query(User).filter(User.id.in_(bulk_update.user_ids)).all()
    if len(users) != len(bulk_update.user_ids):
        raise HTTPException(status_code=404, detail="One or more users not found")
    
    # Validate permission hierarchy
    if not PermissionValidator.validate_permission_hierarchy(bulk_update.permissions):
        raise HTTPException(status_code=400, detail="Invalid permission hierarchy")
    
    # Normalize permissions
    normalized_permissions = PermissionValidator.normalize_permissions(bulk_update.permissions)
    
    created_permissions = []
    
    for user_id in bulk_update.user_ids:
        # Check if permission already exists
        existing = db.query(UserViewPermission).filter(
            and_(
                UserViewPermission.user_id == user_id,
                UserViewPermission.view_permission_id == bulk_update.view_permission_id
            )
        ).first()
        
        if existing:
            # Update existing permission
            for perm, value in normalized_permissions.items():
                setattr(existing, perm, value)
            existing.modified_date = datetime.utcnow()
            existing.notes = bulk_update.notes
            created_permissions.append(existing)
        else:
            # Create new permission
            permission_data = {
                'user_id': user_id,
                'view_permission_id': bulk_update.view_permission_id,
                'granted_by': bulk_update.granted_by,
                'notes': bulk_update.notes,
                **normalized_permissions
            }
            
            db_user_permission = UserViewPermission(**permission_data)
            db.add(db_user_permission)
            created_permissions.append(db_user_permission)
    
    db.commit()
    
    # Refresh all permissions
    for permission in created_permissions:
        db.refresh(permission)
    
    return created_permissions

# User permission summary
@router.get("/users/{user_id}/permissions", response_model=UserPermissionSummary)
async def get_user_permission_summary(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Get complete permission summary for a user (admin only)"""
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get direct permissions
    direct_permissions = db.query(UserViewPermission).filter(
        and_(
            UserViewPermission.user_id == user_id,
            UserViewPermission.is_active == True
        )
    ).all()
    
    # Get group permissions
    group_permissions = db.query(UserPermissionGroup).filter(
        and_(
            UserPermissionGroup.user_id == user_id,
            UserPermissionGroup.is_active == True
        )
    ).all()
    
    # Calculate effective permissions
    effective_permissions = {}
    
    # Start with direct permissions
    for perm in direct_permissions:
        view_name = perm.view_permission.view_name
        permissions = []
        
        if perm.can_view:
            permissions.append(PermissionType.VIEW)
        if perm.can_create:
            permissions.append(PermissionType.CREATE)
        if perm.can_edit:
            permissions.append(PermissionType.EDIT)
        if perm.can_delete:
            permissions.append(PermissionType.DELETE)
        if perm.can_admin:
            permissions.append(PermissionType.ADMIN)
        
        effective_permissions[view_name] = permissions
    
    # Add group permissions (group permissions can extend but not override direct permissions)
    for group_perm in group_permissions:
        if group_perm.permission_group and group_perm.permission_group.default_permissions:
            for view_name, permissions in group_perm.permission_group.default_permissions.items():
                if view_name not in effective_permissions:
                    effective_permissions[view_name] = permissions
                else:
                    # Merge permissions (union of both)
                    current_perms = set(effective_permissions[view_name])
                    group_perms = set(permissions)
                    effective_permissions[view_name] = list(current_perms.union(group_perms))
    
    return UserPermissionSummary(
        user_id=user.id,
        username=user.username,
        full_name=user.full_name,
        direct_permissions=[
            UserViewPermissionSummary(
                id=perm.id,
                view_name=perm.view_permission.view_name,
                view_display_name=perm.view_permission.view_display_name,
                can_view=perm.can_view,
                can_create=perm.can_create,
                can_edit=perm.can_edit,
                can_delete=perm.can_delete,
                can_admin=perm.can_admin,
                is_active=perm.is_active,
                expires_at=perm.expires_at
            ) for perm in direct_permissions
        ],
        group_permissions=group_permissions,
        effective_permissions=effective_permissions
    )

# Permission matrix
@router.get("/matrix", response_model=PermissionMatrix)
async def get_permission_matrix(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Get complete permission matrix for all users and views (admin only)"""
    
    # Get all views
    views = db.query(ViewPermission).filter(ViewPermission.is_active == True).all()
    
    # Get all users
    users = db.query(User).filter(User.is_active == True).all()
    
    # Get all user permissions
    user_permissions = db.query(UserViewPermission).filter(UserViewPermission.is_active == True).all()
    
    # Build permission matrix
    permissions = {}
    
    for user in users:
        permissions[user.id] = {}
        
        # Initialize with no permissions
        for view in views:
            permissions[user.id][view.view_name] = []
        
        # Add direct permissions
        for perm in user_permissions:
            if perm.user_id == user.id:
                view_name = perm.view_permission.view_name
                user_perms = []
                
                if perm.can_view:
                    user_perms.append(PermissionType.VIEW)
                if perm.can_create:
                    user_perms.append(PermissionType.CREATE)
                if perm.can_edit:
                    user_perms.append(PermissionType.EDIT)
                if perm.can_delete:
                    user_perms.append(PermissionType.DELETE)
                if perm.can_admin:
                    user_perms.append(PermissionType.ADMIN)
                
                permissions[user.id][view_name] = user_perms
    
    return PermissionMatrix(
        views=[ViewPermissionSummary(
            id=view.id,
            view_name=view.view_name,
            view_display_name=view.view_display_name,
            view_category=view.view_category,
            is_active=view.is_active,
            is_system_view=view.is_system_view
        ) for view in views],
        users=[{"id": user.id, "username": user.username, "full_name": user.full_name} for user in users],
        permissions=permissions
    )
