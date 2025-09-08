from sqlalchemy import Column, String, Text, DateTime, Boolean, JSON, ForeignKey
from sqlalchemy.orm import relationship
from app.models.database import Base
import uuid
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    
    id = Column(String(32), primary_key=True, default=lambda: uuid.uuid4().hex)
    username = Column(String(255), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    
    # Role and permissions
    role = Column(String(20), default="user")  # "user", "manager", "admin"
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    
    # Profile information
    organization = Column(String(255))
    department = Column(String(255))
    bio = Column(Text)
    avatar_url = Column(String(500))
    
    # Timestamps
    created_date = Column(DateTime, default=datetime.utcnow)
    modified_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime)
    
    # Relationships
    owned_projects = relationship("Project", back_populates="owner", foreign_keys="Project.owner_id")
    shared_projects = relationship("ProjectShare", back_populates="user", foreign_keys="ProjectShare.user_id")
    owned_rules = relationship("Rule", back_populates="owner_user", foreign_keys="Rule.owner_id")
    owned_rubrics = relationship("Rubric", back_populates="owner_user", foreign_keys="Rubric.owner_id")
    owned_datasets = relationship("Dataset", back_populates="owner_user", foreign_keys="Dataset.owner_id")
    
    # Permissions system relationships
    view_permissions = relationship("UserViewPermission", back_populates="user", foreign_keys="UserViewPermission.user_id")
    permission_groups = relationship("UserPermissionGroup", back_populates="user", foreign_keys="UserPermissionGroup.user_id")

class ProjectShare(Base):
    __tablename__ = "project_shares"
    
    id = Column(String(32), primary_key=True, default=lambda: uuid.uuid4().hex)
    project_id = Column(String(32), ForeignKey("projects.id"), nullable=False)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False)
    
    # Permission levels
    permission_level = Column(String(20), default="viewer")  # "viewer", "editor", "admin"
    can_view = Column(Boolean, default=True)
    can_edit = Column(Boolean, default=False)
    can_delete = Column(Boolean, default=False)
    can_share = Column(Boolean, default=False)
    
    # Sharing metadata
    shared_by = Column(String(32), ForeignKey("users.id"), nullable=False)
    shared_date = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)  # Optional expiration date
    
    # Relationships
    project = relationship("Project", back_populates="shares")
    user = relationship("User", back_populates="shared_projects", foreign_keys=[user_id])
    sharer = relationship("User", foreign_keys=[shared_by])

class RubricShare(Base):
    __tablename__ = "rubric_shares"
    
    id = Column(String(32), primary_key=True, default=lambda: uuid.uuid4().hex)
    rubric_id = Column(String(32), ForeignKey("rubrics.id"), nullable=False)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False)
    
    # Permission levels
    permission_level = Column(String(20), default="viewer")  # "viewer", "editor", "admin"
    can_view = Column(Boolean, default=True)
    can_edit = Column(Boolean, default=False)
    can_delete = Column(Boolean, default=False)
    can_share = Column(Boolean, default=False)
    
    # Sharing metadata
    shared_by = Column(String(32), ForeignKey("users.id"), nullable=False)
    shared_date = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)  # Optional expiration date
    
    # Relationships
    rubric = relationship("Rubric", back_populates="shares")
    user = relationship("User", foreign_keys=[user_id])
    sharer = relationship("User", foreign_keys=[shared_by])
