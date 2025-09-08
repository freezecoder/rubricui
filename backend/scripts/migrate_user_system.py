#!/usr/bin/env python3
"""
Migration script to add user system and update existing tables with user relationships.
This script adds the new user tables and updates existing tables to support user ownership.
"""

import sqlite3
import os
import sys
from pathlib import Path

# Add the parent directory to the path so we can import our models
sys.path.append(str(Path(__file__).parent.parent))

def migrate_database():
    """Run the user system migration"""
    
    # Database path
    db_path = Path(__file__).parent.parent / "rubrics.db"
    
    if not db_path.exists():
        print(f"Database not found at {db_path}")
        return False
    
    print(f"Migrating database at {db_path}")
    
    # Connect to the database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if users table already exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        if cursor.fetchone():
            print("Users table already exists. Skipping user table creation.")
        else:
            # Create users table
            print("Creating users table...")
            cursor.execute("""
                CREATE TABLE users (
                    id VARCHAR(32) PRIMARY KEY,
                    username VARCHAR(255) UNIQUE NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    full_name VARCHAR(255) NOT NULL,
                    hashed_password VARCHAR(255) NOT NULL,
                    role VARCHAR(20) DEFAULT 'user',
                    is_active BOOLEAN DEFAULT 1,
                    is_verified BOOLEAN DEFAULT 0,
                    organization VARCHAR(255),
                    department VARCHAR(255),
                    bio TEXT,
                    avatar_url VARCHAR(500),
                    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    modified_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_login DATETIME
                )
            """)
            
            # Create indexes for users table
            cursor.execute("CREATE INDEX idx_users_username ON users(username)")
            cursor.execute("CREATE INDEX idx_users_email ON users(email)")
            cursor.execute("CREATE INDEX idx_users_role ON users(role)")
            cursor.execute("CREATE INDEX idx_users_is_active ON users(is_active)")
            
            print("Users table created successfully.")
        
        # Check if project_shares table already exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='project_shares'")
        if cursor.fetchone():
            print("Project shares table already exists. Skipping creation.")
        else:
            # Create project_shares table
            print("Creating project_shares table...")
            cursor.execute("""
                CREATE TABLE project_shares (
                    id VARCHAR(32) PRIMARY KEY,
                    project_id VARCHAR(32) NOT NULL,
                    user_id VARCHAR(32) NOT NULL,
                    permission_level VARCHAR(20) DEFAULT 'viewer',
                    can_view BOOLEAN DEFAULT 1,
                    can_edit BOOLEAN DEFAULT 0,
                    can_delete BOOLEAN DEFAULT 0,
                    can_share BOOLEAN DEFAULT 0,
                    shared_by VARCHAR(32) NOT NULL,
                    shared_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    expires_at DATETIME,
                    FOREIGN KEY (project_id) REFERENCES projects(id),
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    FOREIGN KEY (shared_by) REFERENCES users(id)
                )
            """)
            
            # Create indexes for project_shares table
            cursor.execute("CREATE INDEX idx_project_shares_project_id ON project_shares(project_id)")
            cursor.execute("CREATE INDEX idx_project_shares_user_id ON project_shares(user_id)")
            cursor.execute("CREATE INDEX idx_project_shares_shared_by ON project_shares(shared_by)")
            
            print("Project shares table created successfully.")
        
        # Check if rubric_shares table already exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='rubric_shares'")
        if cursor.fetchone():
            print("Rubric shares table already exists. Skipping creation.")
        else:
            # Create rubric_shares table
            print("Creating rubric_shares table...")
            cursor.execute("""
                CREATE TABLE rubric_shares (
                    id VARCHAR(32) PRIMARY KEY,
                    rubric_id VARCHAR(32) NOT NULL,
                    user_id VARCHAR(32) NOT NULL,
                    permission_level VARCHAR(20) DEFAULT 'viewer',
                    can_view BOOLEAN DEFAULT 1,
                    can_edit BOOLEAN DEFAULT 0,
                    can_delete BOOLEAN DEFAULT 0,
                    can_share BOOLEAN DEFAULT 0,
                    shared_by VARCHAR(32) NOT NULL,
                    shared_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    expires_at DATETIME,
                    FOREIGN KEY (rubric_id) REFERENCES rubrics(id),
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    FOREIGN KEY (shared_by) REFERENCES users(id)
                )
            """)
            
            # Create indexes for rubric_shares table
            cursor.execute("CREATE INDEX idx_rubric_shares_rubric_id ON rubric_shares(rubric_id)")
            cursor.execute("CREATE INDEX idx_rubric_shares_user_id ON rubric_shares(user_id)")
            cursor.execute("CREATE INDEX idx_rubric_shares_shared_by ON rubric_shares(shared_by)")
            
            print("Rubric shares table created successfully.")
        
        # Check if owner_id columns already exist in existing tables
        tables_to_update = [
            ('projects', 'owner_id'),
            ('rules', 'owner_id'),
            ('rubrics', 'owner_id'),
            ('datasets', 'owner_id')
        ]
        
        for table_name, column_name in tables_to_update:
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = [column[1] for column in cursor.fetchall()]
            
            if column_name not in columns:
                print(f"Adding {column_name} column to {table_name} table...")
                cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} VARCHAR(32)")
                
                # Add foreign key constraint (SQLite doesn't support adding FK constraints to existing tables,
                # but we can create an index for performance)
                cursor.execute(f"CREATE INDEX idx_{table_name}_{column_name} ON {table_name}({column_name})")
                
                print(f"Added {column_name} column to {table_name} table.")
            else:
                print(f"{column_name} column already exists in {table_name} table.")
        
        # Create a default admin user if no users exist
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        
        if user_count == 0:
            print("Creating default admin user...")
            import uuid
            import bcrypt
            
            admin_id = uuid.uuid4().hex
            admin_password = "admin123"  # Change this in production!
            salt = bcrypt.gensalt()
            hashed_password = bcrypt.hashpw(admin_password.encode('utf-8'), salt).decode('utf-8')
            
            cursor.execute("""
                INSERT INTO users (
                    id, username, email, full_name, hashed_password, 
                    role, is_active, is_verified, organization
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                admin_id,
                "admin",
                "admin@rubricrunner.com",
                "System Administrator",
                hashed_password,
                "admin",
                1,  # is_active
                1,  # is_verified
                "RubricRunner"
            ))
            
            print("Default admin user created:")
            print("  Username: admin")
            print("  Password: admin123")
            print("  Email: admin@rubricrunner.com")
            print("  Role: admin")
            print("\n⚠️  IMPORTANT: Change the default password in production!")
        
        # Commit all changes
        conn.commit()
        print("\n✅ Migration completed successfully!")
        
        # Show summary
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM project_shares")
        project_shares_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM rubric_shares")
        rubric_shares_count = cursor.fetchone()[0]
        
        print(f"\nDatabase Summary:")
        print(f"  Users: {user_count}")
        print(f"  Project Shares: {project_shares_count}")
        print(f"  Rubric Shares: {rubric_shares_count}")
        
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
        return False
        
    finally:
        conn.close()

if __name__ == "__main__":
    success = migrate_database()
    sys.exit(0 if success else 1)
