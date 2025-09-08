#!/usr/bin/env python3
"""
Migration script to add the dataset_histograms table to the database.

This script creates the new table for storing histogram data for dataset columns.
It's safe to run multiple times and will not affect existing data.
"""

import sqlite3
import sys
import os
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

def create_histogram_table(db_path: str = "backend/rubrics.db"):
    """Create the dataset_histograms table"""
    
    # Connect to the database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if the table already exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='dataset_histograms'
        """)
        
        if cursor.fetchone():
            print("✅ Table 'dataset_histograms' already exists. Skipping creation.")
            return True
        
        # Create the dataset_histograms table
        cursor.execute("""
            CREATE TABLE dataset_histograms (
                id VARCHAR(32) PRIMARY KEY,
                dataset_id VARCHAR(32) NOT NULL,
                column_id VARCHAR(32) NOT NULL,
                bin_count INTEGER NOT NULL,
                bin_edges TEXT NOT NULL,  -- JSON array of bin edge values
                bin_counts TEXT NOT NULL, -- JSON array of bin counts
                min_value REAL NOT NULL,
                max_value REAL NOT NULL,
                total_count INTEGER NOT NULL,
                null_count INTEGER DEFAULT 0,
                created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (dataset_id) REFERENCES datasets (id) ON DELETE CASCADE,
                FOREIGN KEY (column_id) REFERENCES dataset_columns (id) ON DELETE CASCADE
            )
        """)
        
        # Create indexes for better performance
        cursor.execute("""
            CREATE INDEX idx_dataset_histograms_dataset_id 
            ON dataset_histograms (dataset_id)
        """)
        
        cursor.execute("""
            CREATE INDEX idx_dataset_histograms_column_id 
            ON dataset_histograms (column_id)
        """)
        
        cursor.execute("""
            CREATE INDEX idx_dataset_histograms_created_date 
            ON dataset_histograms (created_date)
        """)
        
        # Commit the changes
        conn.commit()
        print("✅ Successfully created 'dataset_histograms' table with indexes.")
        
        return True
        
    except Exception as e:
        print(f"❌ Error creating histogram table: {e}")
        conn.rollback()
        return False
        
    finally:
        conn.close()

def verify_table_structure(db_path: str = "backend/rubrics.db"):
    """Verify the table structure is correct"""
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Get table info
        cursor.execute("PRAGMA table_info(dataset_histograms)")
        columns = cursor.fetchall()
        
        if not columns:
            print("❌ Table 'dataset_histograms' does not exist.")
            return False
        
        print("✅ Table 'dataset_histograms' structure:")
        for col in columns:
            print(f"  - {col[1]} ({col[2]}) {'NOT NULL' if col[3] else 'NULL'} {'PRIMARY KEY' if col[5] else ''}")
        
        # Check indexes
        cursor.execute("PRAGMA index_list(dataset_histograms)")
        indexes = cursor.fetchall()
        
        print("✅ Indexes:")
        for idx in indexes:
            print(f"  - {idx[1]} ({'UNIQUE' if idx[2] else 'NON-UNIQUE'})")
        
        return True
        
    except Exception as e:
        print(f"❌ Error verifying table structure: {e}")
        return False
        
    finally:
        conn.close()

def main():
    """Main migration function"""
    
    print("🚀 Starting histogram table migration...")
    
    # Check if database file exists
    db_path = "backend/rubrics.db"
    if not os.path.exists(db_path):
        print(f"❌ Database file '{db_path}' not found.")
        print("Please run this script from the backend directory.")
        return False
    
    # Create the table
    if not create_histogram_table(db_path):
        return False
    
    # Verify the structure
    if not verify_table_structure(db_path):
        return False
    
    print("🎉 Histogram table migration completed successfully!")
    print("\nNext steps:")
    print("1. Restart the backend server to load the new model")
    print("2. Test histogram generation with existing datasets")
    print("3. Update dataset upload process to generate histograms automatically")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
