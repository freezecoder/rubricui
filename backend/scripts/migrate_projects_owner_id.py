import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import sqlite3
from app.models.database import engine, Base
from app.models.project import Project
from app.models.user import User

def migrate_projects_owner_id():
    """Add owner_id column to projects table if it doesn't exist"""
    print("Checking projects table schema...")
    
    # Connect to the database
    conn = sqlite3.connect('backend/rubrics.db')
    cursor = conn.cursor()
    
    try:
        # Check if owner_id column exists
        cursor.execute('PRAGMA table_info(projects)')
        columns = cursor.fetchall()
        column_names = [col[1] for col in columns]
        
        if 'owner_id' not in column_names:
            print("Adding owner_id column to projects table...")
            cursor.execute('ALTER TABLE projects ADD COLUMN owner_id VARCHAR(32)')
            print("owner_id column added successfully!")
        else:
            print("owner_id column already exists in projects table")
        
        # Check if users table exists and create if needed
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        users_table = cursor.fetchone()
        
        if not users_table:
            print("Creating users table...")
            # Create users table using SQLAlchemy
            User.__table__.create(engine, checkfirst=True)
            print("Users table created successfully!")
        else:
            print("Users table already exists")
        
        # Check if project_shares table exists and create if needed
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='project_shares'")
        project_shares_table = cursor.fetchone()
        
        if not project_shares_table:
            print("Creating project_shares table...")
            from app.models.user import ProjectShare
            ProjectShare.__table__.create(engine, checkfirst=True)
            print("project_shares table created successfully!")
        else:
            print("project_shares table already exists")
        
        # Check if rubric_shares table exists and create if needed
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='rubric_shares'")
        rubric_shares_table = cursor.fetchone()
        
        if not rubric_shares_table:
            print("Creating rubric_shares table...")
            from app.models.user import RubricShare
            RubricShare.__table__.create(engine, checkfirst=True)
            print("rubric_shares table created successfully!")
        else:
            print("rubric_shares table already exists")
        
        conn.commit()
        print("Migration completed successfully!")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_projects_owner_id()
