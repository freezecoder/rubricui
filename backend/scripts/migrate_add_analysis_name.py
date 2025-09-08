#!/usr/bin/env python3
"""
Migration script to add 'name' column to analysis_results table in the result database.
This script adds the name field to existing analysis results.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.models.result_database import result_engine, ResultBase
from app.models.result_analysis_result import AnalysisResult
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate_add_analysis_name():
    """Add name column to analysis_results table if it doesn't exist"""
    
    engine = result_engine
    
    try:
        with engine.connect() as conn:
            # Check if name column already exists
            result = conn.execute(text("""
                SELECT COUNT(*) as count 
                FROM pragma_table_info('analysis_results') 
                WHERE name = 'name'
            """))
            
            column_exists = result.fetchone()[0] > 0
            
            if column_exists:
                logger.info("Column 'name' already exists in analysis_results table")
                return
            
            # Add the name column
            logger.info("Adding 'name' column to analysis_results table...")
            conn.execute(text("""
                ALTER TABLE analysis_results 
                ADD COLUMN name VARCHAR(200)
            """))
            
            # Update existing records with default names
            logger.info("Updating existing analysis results with default names...")
            conn.execute(text("""
                UPDATE analysis_results 
                SET name = 'Analysis ' || substr(id, 1, 8) || ' - ' || datetime(created_date, 'localtime')
                WHERE name IS NULL
            """))
            
            conn.commit()
            logger.info("Successfully added 'name' column to analysis_results table")
            
    except Exception as e:
        logger.error(f"Error during migration: {e}")
        raise

if __name__ == "__main__":
    migrate_add_analysis_name()
