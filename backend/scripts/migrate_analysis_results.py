#!/usr/bin/env python3
"""
Migration script to add analysis results tables to the database.

This script creates the analysis_results and analysis_result_details tables
to store structured analysis results from rubric execution.
"""

import sys
import os
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine, text
from app.models.database import DATABASE_URL, Base
from app.models.analysis_result import AnalysisResult, AnalysisResultDetail

def migrate_analysis_results():
    """Create analysis results tables"""
    
    print("Starting analysis results migration...")
    
    # Create engine
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    
    try:
        # Check if tables already exist
        with engine.connect() as conn:
            # Check if analysis_results table exists
            result = conn.execute(text("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='analysis_results'
            """))
            analysis_results_exists = result.fetchone() is not None
            
            # Check if analysis_result_details table exists
            result = conn.execute(text("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='analysis_result_details'
            """))
            analysis_details_exists = result.fetchone() is not None
            
            if analysis_results_exists and analysis_details_exists:
                print("Analysis results tables already exist. Skipping migration.")
                return True
        
        # Create tables
        print("Creating analysis_results table...")
        AnalysisResult.__table__.create(engine, checkfirst=True)
        
        print("Creating analysis_result_details table...")
        AnalysisResultDetail.__table__.create(engine, checkfirst=True)
        
        print("✅ Analysis results migration completed successfully!")
        
        # Verify tables were created
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name IN ('analysis_results', 'analysis_result_details')
                ORDER BY name
            """))
            tables = [row[0] for row in result.fetchall()]
            print(f"Created tables: {', '.join(tables)}")
        
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        return False

def rollback_analysis_results():
    """Rollback analysis results tables (for testing)"""
    
    print("Rolling back analysis results migration...")
    
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    
    try:
        with engine.connect() as conn:
            # Drop tables in reverse order (due to foreign key constraints)
            conn.execute(text("DROP TABLE IF EXISTS analysis_result_details"))
            conn.execute(text("DROP TABLE IF EXISTS analysis_results"))
            conn.commit()
        
        print("✅ Rollback completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Rollback failed: {str(e)}")
        return False

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Migrate analysis results tables")
    parser.add_argument("--rollback", action="store_true", help="Rollback the migration")
    
    args = parser.parse_args()
    
    if args.rollback:
        success = rollback_analysis_results()
    else:
        success = migrate_analysis_results()
    
    sys.exit(0 if success else 1)
