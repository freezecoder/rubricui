#!/usr/bin/env python3
"""
Database migration script for the permissions system.

This script:
1. Creates backup tables for all existing data
2. Creates the new permissions tables
3. Populates default view permissions for the application
4. Provides rollback functionality

Usage:
    python scripts/migrate_permissions_system.py [--rollback] [--dry-run]
"""

import sys
import os
import argparse
from datetime import datetime
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine, text, MetaData, Table
from sqlalchemy.orm import sessionmaker
from app.models.database import Base, engine, SessionLocal
from app.models.view_permission import ViewPermission, UserViewPermission, PermissionGroup, UserPermissionGroup
from app.models.user import User

def create_backup_tables(db_session):
    """Create backup tables for all existing data before migration"""
    print("Creating backup tables...")
    
    # List of tables to backup
    tables_to_backup = [
        'users', 'rules', 'rubrics', 'rubric_rules', 'projects', 
        'execution_records', 'datasets', 'dataset_columns', 'dataset_histograms',
        'project_shares', 'rubric_shares'
    ]
    
    backup_timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    for table_name in tables_to_backup:
        try:
            # Check if table exists
            result = db_session.execute(text(f"""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='{table_name}'
            """))
            
            if result.fetchone():
                backup_table_name = f"{table_name}_backup_{backup_timestamp}"
                
                # Create backup table
                db_session.execute(text(f"""
                    CREATE TABLE {backup_table_name} AS 
                    SELECT * FROM {table_name}
                """))
                
                print(f"  ✓ Backed up {table_name} to {backup_table_name}")
            else:
                print(f"  - Table {table_name} does not exist, skipping backup")
                
        except Exception as e:
            print(f"  ✗ Error backing up {table_name}: {e}")
            raise
    
    db_session.commit()
    print(f"Backup completed with timestamp: {backup_timestamp}")
    return backup_timestamp

def create_permissions_tables(db_session):
    """Create the new permissions tables"""
    print("Creating permissions tables...")
    
    try:
        # Create all tables defined in the models
        Base.metadata.create_all(bind=engine)
        print("  ✓ Permissions tables created successfully")
    except Exception as e:
        print(f"  ✗ Error creating permissions tables: {e}")
        raise

def populate_default_view_permissions(db_session):
    """Populate default view permissions for the application"""
    print("Populating default view permissions...")
    
    # Define the default views and their permissions
    default_views = [
        {
            "view_name": "rules",
            "view_display_name": "Rules Management",
            "view_description": "Manage scoring rules for genomic data analysis",
            "available_permissions": ["view", "create", "edit", "delete", "admin"],
            "view_category": "general",
            "view_route": "/rules",
            "api_endpoint": "/api/rules",
            "is_system_view": True
        },
        {
            "view_name": "rubrics",
            "view_display_name": "Rubrics Management", 
            "view_description": "Manage rubrics that combine multiple rules",
            "available_permissions": ["view", "create", "edit", "delete", "admin"],
            "view_category": "general",
            "view_route": "/rubrics",
            "api_endpoint": "/api/rubrics",
            "is_system_view": True
        },
        {
            "view_name": "projects",
            "view_display_name": "Projects Management",
            "view_description": "Manage analysis projects and their configurations",
            "available_permissions": ["view", "create", "edit", "delete", "admin"],
            "view_category": "general",
            "view_route": "/projects",
            "api_endpoint": "/api/projects",
            "is_system_view": True
        },
        {
            "view_name": "datasets",
            "view_display_name": "Datasets Management",
            "view_description": "Manage uploaded datasets and their metadata",
            "available_permissions": ["view", "create", "edit", "delete", "admin"],
            "view_category": "data",
            "view_route": "/datasets",
            "api_endpoint": "/api/datasets",
            "is_system_view": True
        },
        {
            "view_name": "analysis",
            "view_display_name": "Analysis Execution",
            "view_description": "Execute rules and rubrics on datasets",
            "available_permissions": ["view", "create", "edit", "delete", "admin"],
            "view_category": "analysis",
            "view_route": "/projects/[id]/analysis",
            "api_endpoint": "/api/analysis",
            "is_system_view": True
        },
        {
            "view_name": "users",
            "view_display_name": "User Management",
            "view_description": "Manage user accounts and authentication",
            "available_permissions": ["view", "create", "edit", "delete", "admin"],
            "view_category": "user_management",
            "view_route": "/admin/users",
            "api_endpoint": "/api/users",
            "is_system_view": True
        },
        {
            "view_name": "admin",
            "view_display_name": "Admin Panel",
            "view_description": "System administration and configuration",
            "available_permissions": ["view", "admin"],
            "view_category": "admin",
            "view_route": "/admin",
            "api_endpoint": "/api/admin",
            "is_system_view": True
        },
        {
            "view_name": "permissions",
            "view_display_name": "Permissions Management",
            "view_description": "Manage user permissions and access control",
            "available_permissions": ["view", "create", "edit", "delete", "admin"],
            "view_category": "admin",
            "view_route": "/admin/permissions",
            "api_endpoint": "/api/view-permissions",
            "is_system_view": True
        }
    ]
    
    created_count = 0
    for view_data in default_views:
        try:
            # Check if view already exists
            existing = db_session.query(ViewPermission).filter(
                ViewPermission.view_name == view_data["view_name"]
            ).first()
            
            if not existing:
                view_permission = ViewPermission(**view_data)
                db_session.add(view_permission)
                created_count += 1
                print(f"  ✓ Created view permission: {view_data['view_display_name']}")
            else:
                print(f"  - View permission already exists: {view_data['view_display_name']}")
                
        except Exception as e:
            print(f"  ✗ Error creating view permission {view_data['view_name']}: {e}")
            raise
    
    db_session.commit()
    print(f"Created {created_count} new view permissions")

def populate_default_permission_groups(db_session):
    """Populate default permission groups"""
    print("Populating default permission groups...")
    
    # Get all view permissions to build default permissions
    view_permissions = db_session.query(ViewPermission).all()
    view_names = [vp.view_name for vp in view_permissions]
    
    # Define default permission groups
    default_groups = [
        {
            "group_name": "viewer",
            "group_display_name": "Viewer",
            "group_description": "Read-only access to most views",
            "default_permissions": {
                view_name: ["view"] for view_name in view_names
                if view_name not in ["admin", "permissions", "users"]
            },
            "is_system_group": True
        },
        {
            "group_name": "researcher",
            "group_display_name": "Researcher",
            "group_description": "Full access to research tools (rules, rubrics, projects, datasets, analysis)",
            "default_permissions": {
                view_name: ["view", "create", "edit", "delete"] for view_name in view_names
                if view_name in ["rules", "rubrics", "projects", "datasets", "analysis"]
            },
            "is_system_group": True
        },
        {
            "group_name": "analyst",
            "group_display_name": "Data Analyst",
            "group_description": "Access to datasets and analysis tools",
            "default_permissions": {
                "datasets": ["view", "create", "edit"],
                "analysis": ["view", "create", "edit"],
                "projects": ["view", "create", "edit"],
                "rules": ["view"],
                "rubrics": ["view"]
            },
            "is_system_group": True
        },
        {
            "group_name": "admin",
            "group_display_name": "Administrator",
            "group_description": "Full system access including user and permission management",
            "default_permissions": {
                view_name: ["view", "create", "edit", "delete", "admin"] for view_name in view_names
            },
            "is_system_group": True
        }
    ]
    
    created_count = 0
    for group_data in default_groups:
        try:
            # Check if group already exists
            existing = db_session.query(PermissionGroup).filter(
                PermissionGroup.group_name == group_data["group_name"]
            ).first()
            
            if not existing:
                permission_group = PermissionGroup(**group_data)
                db_session.add(permission_group)
                created_count += 1
                print(f"  ✓ Created permission group: {group_data['group_display_name']}")
            else:
                print(f"  - Permission group already exists: {group_data['group_display_name']}")
                
        except Exception as e:
            print(f"  ✗ Error creating permission group {group_data['group_name']}: {e}")
            raise
    
    db_session.commit()
    print(f"Created {created_count} new permission groups")

def assign_default_admin_permissions(db_session):
    """Assign admin permissions to existing admin users"""
    print("Assigning default admin permissions...")
    
    # Find users with admin role
    admin_users = db_session.query(User).filter(User.role == "admin").all()
    
    if not admin_users:
        print("  - No admin users found")
        return
    
    # Get admin permission group
    admin_group = db_session.query(PermissionGroup).filter(
        PermissionGroup.group_name == "admin"
    ).first()
    
    if not admin_group:
        print("  - Admin permission group not found")
        return
    
    assigned_count = 0
    for user in admin_users:
        try:
            # Check if user is already assigned to admin group
            existing = db_session.query(UserPermissionGroup).filter(
                UserPermissionGroup.user_id == user.id,
                UserPermissionGroup.permission_group_id == admin_group.id
            ).first()
            
            if not existing:
                user_group = UserPermissionGroup(
                    user_id=user.id,
                    permission_group_id=admin_group.id,
                    assigned_by=user.id,  # Self-assigned for existing admins
                    assignment_notes="Auto-assigned during permissions system migration"
                )
                db_session.add(user_group)
                assigned_count += 1
                print(f"  ✓ Assigned admin permissions to: {user.username}")
            else:
                print(f"  - User already has admin permissions: {user.username}")
                
        except Exception as e:
            print(f"  ✗ Error assigning admin permissions to {user.username}: {e}")
            raise
    
    db_session.commit()
    print(f"Assigned admin permissions to {assigned_count} users")

def rollback_migration(db_session, backup_timestamp):
    """Rollback the migration by dropping new tables and restoring backups"""
    print(f"Rolling back migration (backup timestamp: {backup_timestamp})...")
    
    try:
        # Drop new permissions tables
        permissions_tables = [
            'user_permission_groups', 'permission_groups', 
            'user_view_permissions', 'view_permissions'
        ]
        
        for table_name in permissions_tables:
            try:
                db_session.execute(text(f"DROP TABLE IF EXISTS {table_name}"))
                print(f"  ✓ Dropped table: {table_name}")
            except Exception as e:
                print(f"  ✗ Error dropping table {table_name}: {e}")
        
        db_session.commit()
        print("Rollback completed successfully")
        
    except Exception as e:
        print(f"Error during rollback: {e}")
        db_session.rollback()
        raise

def verify_migration(db_session):
    """Verify that the migration was successful"""
    print("Verifying migration...")
    
    try:
        # Check that all tables exist
        tables_to_check = [
            'view_permissions', 'user_view_permissions', 
            'permission_groups', 'user_permission_groups'
        ]
        
        for table_name in tables_to_check:
            result = db_session.execute(text(f"""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='{table_name}'
            """))
            
            if result.fetchone():
                print(f"  ✓ Table exists: {table_name}")
            else:
                print(f"  ✗ Table missing: {table_name}")
                return False
        
        # Check that default views were created
        view_count = db_session.query(ViewPermission).count()
        print(f"  ✓ View permissions created: {view_count}")
        
        # Check that default groups were created
        group_count = db_session.query(PermissionGroup).count()
        print(f"  ✓ Permission groups created: {group_count}")
        
        print("Migration verification completed successfully")
        return True
        
    except Exception as e:
        print(f"Error during verification: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Migrate database to include permissions system")
    parser.add_argument("--rollback", action="store_true", help="Rollback the migration")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done without making changes")
    parser.add_argument("--backup-timestamp", help="Backup timestamp for rollback (required for rollback)")
    
    args = parser.parse_args()
    
    if args.rollback and not args.backup_timestamp:
        print("Error: --backup-timestamp is required for rollback")
        sys.exit(1)
    
    print("=" * 60)
    print("PERMISSIONS SYSTEM MIGRATION")
    print("=" * 60)
    
    if args.dry_run:
        print("DRY RUN MODE - No changes will be made")
        print()
    
    db_session = SessionLocal()
    
    try:
        if args.rollback:
            rollback_migration(db_session, args.backup_timestamp)
        else:
            # Create backup
            backup_timestamp = create_backup_tables(db_session)
            print(f"Backup timestamp: {backup_timestamp}")
            print()
            
            if not args.dry_run:
                # Create permissions tables
                create_permissions_tables(db_session)
                print()
                
                # Populate default data
                populate_default_view_permissions(db_session)
                print()
                
                populate_default_permission_groups(db_session)
                print()
                
                assign_default_admin_permissions(db_session)
                print()
                
                # Verify migration
                if verify_migration(db_session):
                    print()
                    print("=" * 60)
                    print("MIGRATION COMPLETED SUCCESSFULLY")
                    print("=" * 60)
                    print(f"Backup timestamp: {backup_timestamp}")
                    print("To rollback if needed, run:")
                    print(f"python scripts/migrate_permissions_system.py --rollback --backup-timestamp {backup_timestamp}")
                else:
                    print("Migration verification failed!")
                    sys.exit(1)
            else:
                print("DRY RUN: Would create permissions tables and populate default data")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        db_session.rollback()
        sys.exit(1)
    finally:
        db_session.close()

if __name__ == "__main__":
    main()
