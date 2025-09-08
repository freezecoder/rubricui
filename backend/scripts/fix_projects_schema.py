import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import sqlite3
from app.models.database import engine, Base

def fix_projects_schema():
    """Fix the projects table schema by adding missing columns"""
    print("Fixing projects table schema...")
    
    # Connect to the database
    conn = sqlite3.connect('backend/rubrics.db')
    cursor = conn.cursor()
    
    try:
        # Check current schema
        cursor.execute('PRAGMA table_info(projects)')
        columns = cursor.fetchall()
        column_names = [col[1] for col in columns]
        print(f"Current columns: {column_names}")
        
        # Add owner_id if it doesn't exist
        if 'owner_id' not in column_names:
            print("Adding owner_id column...")
            cursor.execute('ALTER TABLE projects ADD COLUMN owner_id VARCHAR(32)')
            print("owner_id column added!")
        else:
            print("owner_id column already exists")
        
        # Check if we need to add any other missing columns
        expected_columns = [
            'id', 'name', 'description', 'owner_name', 'owner_id', 
            'organization', 'created_date', 'input_data_file', 
            'applied_rules', 'applied_rubrics', 'results', 'execution_history'
        ]
        
        missing_columns = [col for col in expected_columns if col not in column_names]
        if missing_columns:
            print(f"Missing columns: {missing_columns}")
            for col in missing_columns:
                if col == 'owner_id':
                    cursor.execute('ALTER TABLE projects ADD COLUMN owner_id VARCHAR(32)')
                elif col == 'applied_rules':
                    cursor.execute('ALTER TABLE projects ADD COLUMN applied_rules JSON')
                elif col == 'applied_rubrics':
                    cursor.execute('ALTER TABLE projects ADD COLUMN applied_rubrics JSON')
                elif col == 'execution_history':
                    cursor.execute('ALTER TABLE projects ADD COLUMN execution_history JSON')
                print(f"Added {col} column")
        
        # Verify the schema
        cursor.execute('PRAGMA table_info(projects)')
        columns = cursor.fetchall()
        print("Final schema:")
        for col in columns:
            print(f"  {col[1]} ({col[2]})")
        
        conn.commit()
        print("Schema fix completed successfully!")
        
    except Exception as e:
        print(f"Error during schema fix: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    fix_projects_schema()
