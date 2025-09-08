from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, func
from typing import List, Optional
from datetime import datetime, timedelta
import bcrypt

from app.models.database import get_db
from app.models.user import User, ProjectShare, RubricShare
from app.schemas.user import (
    UserCreate, UserResponse, UserUpdate, UserSummary, UserLogin, 
    UserToken, ProjectShareCreate, ProjectShareUpdate, ProjectShareResponse,
    RubricShareCreate, RubricShareUpdate, RubricShareResponse, UserStats
)
from app.middleware.auth import (
    create_access_token, get_current_user, get_current_admin_user,
    get_current_manager_or_admin_user, ACCESS_TOKEN_EXPIRE_MINUTES
)

router = APIRouter()

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))

@router.post("/", response_model=UserResponse)
async def create_user(user: UserCreate, db: Session = Depends(get_db)):
    """Create a new user"""
    # Check if username already exists
    existing_user = db.query(User).filter(User.username == user.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Check if email already exists
    existing_email = db.query(User).filter(User.email == user.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    hashed_password = hash_password(user.password)
    db_user = User(
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        organization=user.organization,
        department=user.department,
        bio=user.bio,
        hashed_password=hashed_password,
        role=user.role
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.get("/", response_model=List[UserSummary])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    role: Optional[str] = Query(None, description="Filter by role: user, manager, admin"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    is_verified: Optional[bool] = Query(None, description="Filter by verified status"),
    search: Optional[str] = Query(None, description="Search by username, email, or full name"),
    sort_by: Optional[str] = Query("created_date", description="Sort by field: username, email, created_date, last_login"),
    sort_order: Optional[str] = Query("desc", description="Sort order: asc or desc"),
    db: Session = Depends(get_db)
):
    """List users with filtering and sorting"""
    query = db.query(User)
    
    # Apply filters
    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    if is_verified is not None:
        query = query.filter(User.is_verified == is_verified)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (User.username.ilike(search_term)) |
            (User.email.ilike(search_term)) |
            (User.full_name.ilike(search_term))
        )
    
    # Apply sorting
    if sort_by == "username":
        order_func = asc(User.username) if sort_order == "asc" else desc(User.username)
    elif sort_by == "email":
        order_func = asc(User.email) if sort_order == "asc" else desc(User.email)
    elif sort_by == "created_date":
        order_func = asc(User.created_date) if sort_order == "asc" else desc(User.created_date)
    elif sort_by == "last_login":
        order_func = asc(User.last_login) if sort_order == "asc" else desc(User.last_login)
    else:
        order_func = desc(User.created_date)
    
    query = query.order_by(order_func)
    users = query.offset(skip).limit(limit).all()
    return users

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, db: Session = Depends(get_db)):
    """Get a specific user by ID"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.put("/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, user_update: UserUpdate, db: Session = Depends(get_db)):
    """Update a user"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check for username conflicts
    if user_update.username and user_update.username != user.username:
        existing_user = db.query(User).filter(User.username == user_update.username).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already taken")
    
    # Check for email conflicts
    if user_update.email and user_update.email != user.email:
        existing_email = db.query(User).filter(User.email == user_update.email).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already taken")
    
    # Update fields
    update_data = user_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)
    
    user.modified_date = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return user

@router.delete("/{user_id}")
async def delete_user(user_id: str, db: Session = Depends(get_db)):
    """Delete a user (soft delete by setting is_active to False)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_active = False
    user.modified_date = datetime.utcnow()
    db.commit()
    return {"message": "User deleted successfully"}

@router.post("/login", response_model=UserToken)
async def login_user(login_data: UserLogin, db: Session = Depends(get_db)):
    """Authenticate a user and return a token"""
    user = db.query(User).filter(User.username == login_data.username).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()
    
    # Create JWT token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id, "username": user.username, "role": user.role},
        expires_delta=access_token_expires
    )
    
    return UserToken(
        access_token=access_token,
        token_type="bearer",
        user=user
    )

@router.get("/stats/overview", response_model=UserStats)
async def get_user_stats(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get user statistics for admin dashboard"""
    # Total users
    total_users = db.query(User).count()
    
    # Active users
    active_users = db.query(User).filter(User.is_active == True).count()
    
    # Verified users
    verified_users = db.query(User).filter(User.is_verified == True).count()
    
    # Users by role
    users_by_role = {}
    for role in ["user", "manager", "admin"]:
        count = db.query(User).filter(User.role == role, User.is_active == True).count()
        users_by_role[role] = count
    
    # Recent registrations (last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    recent_registrations = db.query(User).filter(
        User.created_date >= thirty_days_ago,
        User.is_active == True
    ).count()
    
    # Users with content (simplified for now)
    users_with_projects = db.query(User).join(User.owned_projects).distinct().count()
    users_with_rules = db.query(User).join(User.owned_rules).distinct().count()
    users_with_rubrics = db.query(User).join(User.owned_rubrics).distinct().count()
    
    return UserStats(
        total_users=total_users,
        active_users=active_users,
        verified_users=verified_users,
        users_by_role=users_by_role,
        recent_registrations=recent_registrations,
        users_with_projects=users_with_projects,
        users_with_rules=users_with_rules,
        users_with_rubrics=users_with_rubrics
    )

# Project sharing endpoints
@router.post("/{user_id}/projects/{project_id}/share", response_model=ProjectShareResponse)
async def share_project(
    user_id: str,
    project_id: str,
    share_data: ProjectShareCreate,
    db: Session = Depends(get_db)
):
    """Share a project with a user"""
    # Verify user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # TODO: Verify project exists and user has permission to share
    # For now, create the share record
    
    project_share = ProjectShare(
        project_id=project_id,
        user_id=share_data.user_id,
        permission_level=share_data.permission_level,
        can_view=share_data.can_view,
        can_edit=share_data.can_edit,
        can_delete=share_data.can_delete,
        can_share=share_data.can_share,
        shared_by=user_id,
        expires_at=share_data.expires_at
    )
    
    db.add(project_share)
    db.commit()
    db.refresh(project_share)
    
    # TODO: Include user and sharer details in response
    return project_share

# Rubric sharing endpoints
@router.post("/{user_id}/rubrics/{rubric_id}/share", response_model=RubricShareResponse)
async def share_rubric(
    user_id: str,
    rubric_id: str,
    share_data: RubricShareCreate,
    db: Session = Depends(get_db)
):
    """Share a rubric with a user"""
    # Verify user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # TODO: Verify rubric exists and user has permission to share
    # For now, create the share record
    
    rubric_share = RubricShare(
        rubric_id=rubric_id,
        user_id=share_data.user_id,
        permission_level=share_data.permission_level,
        can_view=share_data.can_view,
        can_edit=share_data.can_edit,
        can_delete=share_data.can_delete,
        can_share=share_data.can_share,
        shared_by=user_id,
        expires_at=share_data.expires_at
    )
    
    db.add(rubric_share)
    db.commit()
    db.refresh(rubric_share)
    
    # TODO: Include user and sharer details in response
    return rubric_share
