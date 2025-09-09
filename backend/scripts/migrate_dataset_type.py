#!/usr/bin/env python3
"""
Migration script to add dataset_type column to existing datasets.
This script adds the dataset_type column with default value 'input' to all existing datasets.
"""

import sys
import os
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.models.database import DATABASE_URL

def migrate_dataset_type():
    """Add dataset_type column to datasets table"""
    
    # Create database connection
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    print("Starting dataset_type migration...")
    
    try:
        with engine.connect() as connection:
            # Check if dataset_type column already exists
            result = connection.execute(text("""
                SELECT COUNT(*) as count 
                FROM pragma_table_info('datasets') 
                WHERE name = 'dataset_type'
            """))
            
            column_exists = result.fetchone()[0] > 0
            
            if column_exists:
                print("dataset_type column already exists. Skipping migration.")
                return
            
            print("Adding dataset_type column to datasets table...")
            
            # Add the dataset_type column with default value 'input'
            connection.execute(text("""
                ALTER TABLE datasets 
                ADD COLUMN dataset_type VARCHAR(20) DEFAULT 'input' NOT NULL
            """))
            
            # Update any existing NULL values to 'input' (shouldn't be any, but just in case)
            connection.execute(text("""
                UPDATE datasets 
                SET dataset_type = 'input' 
                WHERE dataset_type IS NULL
            """))
            
            connection.commit()
            print("Successfully added dataset_type column to datasets table.")
            
            # Verify the migration
            result = connection.execute(text("""
                SELECT COUNT(*) as count 
                FROM datasets 
                WHERE dataset_type = 'input'
            """))
            
            input_count = result.fetchone()[0]
            print(f"Verified: {input_count} datasets now have dataset_type = 'input'")
            
    except Exception as e:
        print(f"Error during migration: {e}")
        raise
    finally:
        engine.dispose()

def verify_migration():
    """Verify that the migration was successful"""
    
    engine = create_engine(DATABASE_URL)
    
    try:
        with engine.connect() as connection:
            # Check column exists
            result = connection.execute(text("""
                SELECT COUNT(*) as count 
                FROM pragma_table_info('datasets') 
                WHERE name = 'dataset_type'
            """))
            
            column_exists = result.fetchone()[0] > 0
            
            if not column_exists:
                print("ERROR: dataset_type column was not created!")
                return False
            
            # Check all datasets have a type
            result = connection.execute(text("""
                SELECT COUNT(*) as count 
                FROM datasets 
                WHERE dataset_type IS NULL
            """))
            
            null_count = result.fetchone()[0]
            
            if null_count > 0:
                print(f"ERROR: {null_count} datasets have NULL dataset_type!")
                return False
            
            # Show distribution of dataset types
            result = connection.execute(text("""
                SELECT dataset_type, COUNT(*) as count 
                FROM datasets 
                GROUP BY dataset_type
            """))
            
            print("\nDataset type distribution:")
            for row in result:
                print(f"  {row[0]}: {row[1]} datasets")
            
            print("\nMigration verification successful!")
            return True
            
    except Exception as e:
        print(f"Error during verification: {e}")
        return False
    finally:
        engine.dispose()

if __name__ == "__main__":
    print("Dataset Type Migration Script")
    print("=" * 40)
    
    # Run migration
    migrate_dataset_type()
    
    # Verify migration
    print("\nVerifying migration...")
    success = verify_migration()
    
    if success:
        print("\n✅ Migration completed successfully!")
    else:
        print("\n❌ Migration verification failed!")
        sys.exit(1)
