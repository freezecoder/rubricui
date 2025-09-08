from sqlalchemy import Column, String, Text, DateTime, Boolean, JSON, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.models.database import Base
import uuid
from datetime import datetime

class ViewPermission(Base):
    """
    Defines available views and their permission types in the application.
    This table serves as a template for what views exist and what permissions are possible.
    """
    __tablename__ = "view_permissions"
    
    id = Column(String(32), primary_key=True, default=lambda: uuid.uuid4().hex)
    view_name = Column(String(100), unique=True, nullable=False, index=True)  # e.g., "rules", "rubrics", "projects"
    view_display_name = Column(String(255), nullable=False)  # e.g., "Rules Management", "Rubrics Management"
    view_description = Column(Text)  # Description of what this view contains
    
    # Available permission types for this view
    available_permissions = Column(JSON, nullable=False)  # ["view", "create", "edit", "delete", "admin"]
    
    # View metadata
    view_category = Column(String(50), default="general")  # "general", "admin", "analysis", "data"
    view_route = Column(String(255))  # Frontend route path, e.g., "/rules", "/admin"
    api_endpoint = Column(String(255))  # Backend API endpoint, e.g., "/api/rules"
    
    # Admin control
    is_active = Column(Boolean, default=True)
    is_system_view = Column(Boolean, default=False)  # System views cannot be deleted
    
    # Timestamps
    created_date = Column(DateTime, default=datetime.utcnow)
    modified_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user_permissions = relationship("UserViewPermission", back_populates="view_permission", cascade="all, delete-orphan")

class UserViewPermission(Base):
    """
    Controls which users have access to which views and with what permissions.
    This is the main table that controls user access to different parts of the application.
    """
    __tablename__ = "user_view_permissions"
    
    id = Column(String(32), primary_key=True, default=lambda: uuid.uuid4().hex)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    view_permission_id = Column(String(32), ForeignKey("view_permissions.id"), nullable=False, index=True)
    
    # Specific permissions for this user on this view
    can_view = Column(Boolean, default=False)
    can_create = Column(Boolean, default=False)
    can_edit = Column(Boolean, default=False)
    can_delete = Column(Boolean, default=False)
    can_admin = Column(Boolean, default=False)  # Full admin access to this view
    
    # Permission metadata
    granted_by = Column(String(32), ForeignKey("users.id"), nullable=False)  # Who granted these permissions
    granted_date = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)  # Optional expiration date
    is_active = Column(Boolean, default=True)
    
    # Additional context
    permission_context = Column(JSON)  # Additional context like organization restrictions, etc.
    notes = Column(Text)  # Admin notes about why permissions were granted
    
    # Timestamps
    created_date = Column(DateTime, default=datetime.utcnow)
    modified_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="view_permissions")
    view_permission = relationship("ViewPermission", back_populates="user_permissions")
    granter = relationship("User", foreign_keys=[granted_by])
    
    # Ensure one permission record per user per view
    __table_args__ = (
        UniqueConstraint('user_id', 'view_permission_id', name='unique_user_view_permission'),
    )

class PermissionGroup(Base):
    """
    Groups of permissions that can be assigned to users as a set.
    Useful for common permission patterns like "researcher", "analyst", "admin".
    """
    __tablename__ = "permission_groups"
    
    id = Column(String(32), primary_key=True, default=lambda: uuid.uuid4().hex)
    group_name = Column(String(100), unique=True, nullable=False, index=True)
    group_display_name = Column(String(255), nullable=False)
    group_description = Column(Text)
    
    # Default permissions for this group
    default_permissions = Column(JSON, nullable=False)  # Dict mapping view_name to permission array
    
    # Group metadata
    is_system_group = Column(Boolean, default=False)  # System groups cannot be deleted
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_date = Column(DateTime, default=datetime.utcnow)
    modified_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user_groups = relationship("UserPermissionGroup", back_populates="permission_group", cascade="all, delete-orphan")

class UserPermissionGroup(Base):
    """
    Associates users with permission groups.
    Users can belong to multiple groups, and permissions are combined.
    """
    __tablename__ = "user_permission_groups"
    
    id = Column(String(32), primary_key=True, default=lambda: uuid.uuid4().hex)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    permission_group_id = Column(String(32), ForeignKey("permission_groups.id"), nullable=False, index=True)
    
    # Assignment metadata
    assigned_by = Column(String(32), ForeignKey("users.id"), nullable=False)
    assigned_date = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)  # Optional expiration date
    is_active = Column(Boolean, default=True)
    
    # Additional context
    assignment_notes = Column(Text)
    
    # Timestamps
    created_date = Column(DateTime, default=datetime.utcnow)
    modified_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="permission_groups")
    permission_group = relationship("PermissionGroup", back_populates="user_groups")
    assigner = relationship("User", foreign_keys=[assigned_by])
    
    # Ensure one group assignment per user per group
    __table_args__ = (
        UniqueConstraint('user_id', 'permission_group_id', name='unique_user_permission_group'),
    )
