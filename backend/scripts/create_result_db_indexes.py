#!/usr/bin/env python3
"""
Script to create performance indexes for the result database.
This script creates indexes for fast gene lookups and analysis result queries.
"""

import os
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.models.result_database import result_engine, ResultSessionLocal
from sqlalchemy import text


def create_performance_indexes():
    """Create performance indexes for the result database"""
    print("Creating performance indexes for result database...")
    
    db = ResultSessionLocal()
    try:
        # Create indexes for analysis_results table
        indexes = [
            # Analysis results table indexes
            "CREATE INDEX IF NOT EXISTS idx_analysis_results_project_id ON analysis_results(project_id)",
            "CREATE INDEX IF NOT EXISTS idx_analysis_results_rubric_id ON analysis_results(rubric_id)",
            "CREATE INDEX IF NOT EXISTS idx_analysis_results_dataset_id ON analysis_results(dataset_id)",
            "CREATE INDEX IF NOT EXISTS idx_analysis_results_status ON analysis_results(status)",
            "CREATE INDEX IF NOT EXISTS idx_analysis_results_created_date ON analysis_results(created_date)",
            "CREATE INDEX IF NOT EXISTS idx_analysis_results_project_rubric ON analysis_results(project_id, rubric_id)",
            "CREATE INDEX IF NOT EXISTS idx_analysis_results_project_dataset ON analysis_results(project_id, dataset_id)",
            "CREATE INDEX IF NOT EXISTS idx_analysis_results_rubric_dataset ON analysis_results(rubric_id, dataset_id)",
            "CREATE INDEX IF NOT EXISTS idx_analysis_results_project_status ON analysis_results(project_id, status)",
            
            # Analysis result tracker table indexes
            "CREATE INDEX IF NOT EXISTS idx_tracker_analysis_result_id ON analysis_result_tracker(analysis_result_id)",
            "CREATE INDEX IF NOT EXISTS idx_tracker_storage_type ON analysis_result_tracker(storage_type)",
            "CREATE INDEX IF NOT EXISTS idx_tracker_storage_location ON analysis_result_tracker(storage_location)",
        ]
        
        for index_sql in indexes:
            print(f"Creating index: {index_sql}")
            db.execute(text(index_sql))
        
        db.commit()
        print("✓ Performance indexes created successfully")
        
    except Exception as e:
        db.rollback()
        print(f"✗ Error creating indexes: {str(e)}")
        raise
    finally:
        db.close()


def create_wide_table_indexes():
    """Create indexes for existing wide format tables"""
    print("Creating indexes for wide format tables...")
    
    db = ResultSessionLocal()
    try:
        # Find all wide format tables
        result = db.execute(text("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name LIKE 'rubric_%_analysis_result'
        """))
        
        wide_tables = [row[0] for row in result.fetchall()]
        print(f"Found {len(wide_tables)} wide format tables")
        
        for table_name in wide_tables:
            print(f"Creating indexes for table: {table_name}")
            
            # Create indexes for each wide table
            table_indexes = [
                f"CREATE INDEX IF NOT EXISTS idx_{table_name}_analysis_result_id ON {table_name}(analysis_result_id)",
                f"CREATE INDEX IF NOT EXISTS idx_{table_name}_key_column_value ON {table_name}(key_column_value)",
                f"CREATE INDEX IF NOT EXISTS idx_{table_name}_total_score ON {table_name}(total_score)",
                f"CREATE INDEX IF NOT EXISTS idx_{table_name}_analysis_key ON {table_name}(analysis_result_id, key_column_value)",
                f"CREATE INDEX IF NOT EXISTS idx_{table_name}_score_desc ON {table_name}(total_score DESC)",
            ]
            
            for index_sql in table_indexes:
                try:
                    db.execute(text(index_sql))
                except Exception as e:
                    print(f"  Warning: Could not create index {index_sql}: {str(e)}")
        
        db.commit()
        print("✓ Wide table indexes created successfully")
        
    except Exception as e:
        db.rollback()
        print(f"✗ Error creating wide table indexes: {str(e)}")
        raise
    finally:
        db.close()


def verify_indexes():
    """Verify that indexes were created successfully"""
    print("Verifying indexes...")
    
    db = ResultSessionLocal()
    try:
        # Check analysis_results indexes
        result = db.execute(text("""
            SELECT name FROM sqlite_master 
            WHERE type='index' AND tbl_name='analysis_results'
        """))
        
        analysis_indexes = [row[0] for row in result.fetchall()]
        print(f"Analysis results table has {len(analysis_indexes)} indexes:")
        for idx in analysis_indexes:
            print(f"  - {idx}")
        
        # Check tracker indexes
        result = db.execute(text("""
            SELECT name FROM sqlite_master 
            WHERE type='index' AND tbl_name='analysis_result_tracker'
        """))
        
        tracker_indexes = [row[0] for row in result.fetchall()]
        print(f"Analysis result tracker table has {len(tracker_indexes)} indexes:")
        for idx in tracker_indexes:
            print(f"  - {idx}")
        
        # Check wide table indexes
        result = db.execute(text("""
            SELECT name FROM sqlite_master 
            WHERE type='index' AND tbl_name LIKE 'rubric_%_analysis_result'
        """))
        
        wide_indexes = [row[0] for row in result.fetchall()]
        print(f"Wide format tables have {len(wide_indexes)} indexes:")
        for idx in wide_indexes:
            print(f"  - {idx}")
        
        print("✓ Index verification completed")
        
    except Exception as e:
        print(f"✗ Error verifying indexes: {str(e)}")
        raise
    finally:
        db.close()


def main():
    """Main function to create all indexes"""
    print("=" * 60)
    print("CREATING RESULT DATABASE PERFORMANCE INDEXES")
    print("=" * 60)
    
    try:
        # Step 1: Create performance indexes
        create_performance_indexes()
        print()
        
        # Step 2: Create wide table indexes
        create_wide_table_indexes()
        print()
        
        # Step 3: Verify indexes
        verify_indexes()
        print()
        
        print("=" * 60)
        print("INDEX CREATION COMPLETED SUCCESSFULLY")
        print("=" * 60)
        print()
        print("The result database now has optimized indexes for:")
        print("- Fast analysis result lookups by project, rubric, dataset")
        print("- Quick gene score queries by gene symbol")
        print("- Efficient sorting by total scores")
        print("- Optimized storage location tracking")
        
    except Exception as e:
        print("=" * 60)
        print("INDEX CREATION FAILED")
        print("=" * 60)
        print(f"Error: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
