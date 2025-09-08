#!/usr/bin/env python3
"""
Example script demonstrating how to use the permissions system.

This script shows how to:
1. Create view permissions
2. Create permission groups
3. Assign permissions to users
4. Check user permissions
5. Manage bulk permissions

Usage:
    python scripts/example_permissions_usage.py
"""

import sys
import os
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy.orm import Session
from app.models.database import SessionLocal
from app.models.view_permission import ViewPermission, UserViewPermission, PermissionGroup, UserPermissionGroup
from app.models.user import User
from app.schemas.view_permission import PermissionType, ViewCategory

def create_example_view_permission(db: Session):
    """Create an example custom view permission"""
    print("Creating example view permission...")
    
    # Check if example view already exists
    existing = db.query(ViewPermission).filter(ViewPermission.view_name == "example_view").first()
    if existing:
        print("  - Example view permission already exists")
        return existing
    
    view_permission = ViewPermission(
        view_name="example_view",
        view_display_name="Example Custom View",
        view_description="An example custom view for demonstration purposes",
        available_permissions=["view", "create", "edit", "delete", "admin"],
        view_category=ViewCategory.GENERAL,
        view_route="/example",
        api_endpoint="/api/example",
        is_system_view=False
    )
    
    db.add(view_permission)
    db.commit()
    db.refresh(view_permission)
    
    print(f"  ✓ Created view permission: {view_permission.view_display_name}")
    return view_permission

def create_example_permission_group(db: Session):
    """Create an example custom permission group"""
    print("Creating example permission group...")
    
    # Check if example group already exists
    existing = db.query(PermissionGroup).filter(PermissionGroup.group_name == "example_group").first()
    if existing:
        print("  - Example permission group already exists")
        return existing
    
    permission_group = PermissionGroup(
        group_name="example_group",
        group_display_name="Example Group",
        group_description="An example permission group for demonstration",
        default_permissions={
            "rules": ["view", "create"],
            "rubrics": ["view"],
            "projects": ["view", "create", "edit"],
            "datasets": ["view"],
            "analysis": ["view", "create"]
        },
        is_system_group=False
    )
    
    db.add(permission_group)
    db.commit()
    db.refresh(permission_group)
    
    print(f"  ✓ Created permission group: {permission_group.group_display_name}")
    return permission_group

def assign_permissions_to_user(db: Session, user: User, view_permission: ViewPermission):
    """Assign specific permissions to a user"""
    print(f"Assigning permissions to user: {user.username}")
    
    # Check if permission already exists
    existing = db.query(UserViewPermission).filter(
        UserViewPermission.user_id == user.id,
        UserViewPermission.view_permission_id == view_permission.id
    ).first()
    
    if existing:
        print("  - User already has permissions for this view")
        return existing
    
    user_permission = UserViewPermission(
        user_id=user.id,
        view_permission_id=view_permission.id,
        can_view=True,
        can_create=True,
        can_edit=False,
        can_delete=False,
        can_admin=False,
        granted_by=user.id,  # Self-granted for example
        notes="Example permission assignment"
    )
    
    db.add(user_permission)
    db.commit()
    db.refresh(user_permission)
    
    print(f"  ✓ Assigned permissions to {user.username}")
    return user_permission

def assign_user_to_group(db: Session, user: User, permission_group: PermissionGroup):
    """Assign a user to a permission group"""
    print(f"Assigning user {user.username} to group: {permission_group.group_display_name}")
    
    # Check if user is already in group
    existing = db.query(UserPermissionGroup).filter(
        UserPermissionGroup.user_id == user.id,
        UserPermissionGroup.permission_group_id == permission_group.id
    ).first()
    
    if existing:
        print("  - User is already in this group")
        return existing
    
    user_group = UserPermissionGroup(
        user_id=user.id,
        permission_group_id=permission_group.id,
        assigned_by=user.id,  # Self-assigned for example
        assignment_notes="Example group assignment"
    )
    
    db.add(user_group)
    db.commit()
    db.refresh(user_group)
    
    print(f"  ✓ Assigned {user.username} to {permission_group.group_display_name}")
    return user_group

def check_user_permissions(db: Session, user: User):
    """Check and display all permissions for a user"""
    print(f"\nChecking permissions for user: {user.username}")
    print("=" * 50)
    
    # Get direct permissions
    direct_permissions = db.query(UserViewPermission).filter(
        UserViewPermission.user_id == user.id,
        UserViewPermission.is_active == True
    ).all()
    
    print("Direct Permissions:")
    if direct_permissions:
        for perm in direct_permissions:
            permissions = []
            if perm.can_view:
                permissions.append("view")
            if perm.can_create:
                permissions.append("create")
            if perm.can_edit:
                permissions.append("edit")
            if perm.can_delete:
                permissions.append("delete")
            if perm.can_admin:
                permissions.append("admin")
            
            print(f"  - {perm.view_permission.view_display_name}: {', '.join(permissions)}")
    else:
        print("  - No direct permissions")
    
    # Get group permissions
    group_permissions = db.query(UserPermissionGroup).filter(
        UserPermissionGroup.user_id == user.id,
        UserPermissionGroup.is_active == True
    ).all()
    
    print("\nGroup Memberships:")
    if group_permissions:
        for group_perm in group_permissions:
            print(f"  - {group_perm.permission_group.group_display_name}")
            if group_perm.permission_group.default_permissions:
                for view_name, perms in group_perm.permission_group.default_permissions.items():
                    print(f"    - {view_name}: {', '.join(perms)}")
    else:
        print("  - No group memberships")
    
    # Calculate effective permissions
    print("\nEffective Permissions:")
    effective_permissions = {}
    
    # Start with direct permissions
    for perm in direct_permissions:
        view_name = perm.view_permission.view_name
        permissions = []
        
        if perm.can_view:
            permissions.append("view")
        if perm.can_create:
            permissions.append("create")
        if perm.can_edit:
            permissions.append("edit")
        if perm.can_delete:
            permissions.append("delete")
        if perm.can_admin:
            permissions.append("admin")
        
        effective_permissions[view_name] = permissions
    
    # Add group permissions (union with direct permissions)
    for group_perm in group_permissions:
        if group_perm.permission_group and group_perm.permission_group.default_permissions:
            for view_name, permissions in group_perm.permission_group.default_permissions.items():
                if view_name not in effective_permissions:
                    effective_permissions[view_name] = permissions
                else:
                    # Merge permissions (union)
                    current_perms = set(effective_permissions[view_name])
                    group_perms = set(permissions)
                    effective_permissions[view_name] = list(current_perms.union(group_perms))
    
    if effective_permissions:
        for view_name, permissions in effective_permissions.items():
            print(f"  - {view_name}: {', '.join(permissions)}")
    else:
        print("  - No effective permissions")

def list_all_permissions(db: Session):
    """List all available view permissions and groups"""
    print("\nAvailable View Permissions:")
    print("=" * 50)
    
    view_permissions = db.query(ViewPermission).filter(ViewPermission.is_active == True).all()
    for vp in view_permissions:
        print(f"  - {vp.view_name}: {vp.view_display_name}")
        print(f"    Category: {vp.view_category}")
        print(f"    Available permissions: {', '.join(vp.available_permissions)}")
        print(f"    System view: {vp.is_system_view}")
        print()
    
    print("Available Permission Groups:")
    print("=" * 50)
    
    permission_groups = db.query(PermissionGroup).filter(PermissionGroup.is_active == True).all()
    for pg in permission_groups:
        print(f"  - {pg.group_name}: {pg.group_display_name}")
        print(f"    Description: {pg.group_description}")
        print(f"    System group: {pg.is_system_group}")
        if pg.default_permissions:
            print("    Default permissions:")
            for view_name, permissions in pg.default_permissions.items():
                print(f"      - {view_name}: {', '.join(permissions)}")
        print()

def main():
    print("Permissions System Usage Example")
    print("=" * 60)
    
    db = SessionLocal()
    
    try:
        # Get a user to work with (use the first user found)
        user = db.query(User).first()
        if not user:
            print("No users found in the database. Please create a user first.")
            return
        
        print(f"Working with user: {user.username} ({user.full_name})")
        print()
        
        # List all available permissions
        list_all_permissions(db)
        
        # Create example view permission
        view_permission = create_example_view_permission(db)
        print()
        
        # Create example permission group
        permission_group = create_example_permission_group(db)
        print()
        
        # Assign specific permissions to user
        assign_permissions_to_user(db, user, view_permission)
        print()
        
        # Assign user to permission group
        assign_user_to_group(db, user, permission_group)
        print()
        
        # Check user permissions
        check_user_permissions(db, user)
        
        print("\n" + "=" * 60)
        print("Example completed successfully!")
        print("You can now use the API endpoints to manage permissions:")
        print("- GET /api/view-permissions/views")
        print("- GET /api/view-permissions/user-permissions")
        print("- GET /api/view-permissions/users/{user_id}/permissions")
        print("- POST /api/view-permissions/user-permissions")
        print("- POST /api/view-permissions/user-permissions/bulk")
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
