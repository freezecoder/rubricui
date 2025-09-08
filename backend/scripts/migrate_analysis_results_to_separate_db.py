#!/usr/bin/env python3
"""
Migration script to move analysis results to separate rubric_result.db database
and convert from long format to wide format for better performance and storage efficiency.
"""

import os
import sys
import sqlite3
import pandas as pd
from pathlib import Path
from datetime import datetime
import uuid

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.models.database import engine, Base, SessionLocal
from app.models.result_database import result_engine, ResultBase, ResultSessionLocal
from app.models.analysis_result import AnalysisResult as OldAnalysisResult, AnalysisResultDetail
from app.models.result_analysis_result import AnalysisResult, AnalysisResultTracker, create_rubric_analysis_table
from sqlalchemy import text

def create_result_database():
    """Create the new result database and tables"""
    print("Creating result database tables...")
    ResultBase.metadata.create_all(bind=result_engine)
    print("✓ Result database tables created")

def migrate_analysis_results():
    """Migrate analysis results from main database to result database"""
    print("Starting migration of analysis results...")
    
    # Get database sessions
    main_db = SessionLocal()
    result_db = ResultSessionLocal()
    
    try:
        # Get all analysis results from main database
        old_results = main_db.query(OldAnalysisResult).all()
        print(f"Found {len(old_results)} analysis results to migrate")
        
        for old_result in old_results:
            print(f"Migrating analysis result {old_result.id}...")
            
            # Create new analysis result in result database
            new_result = AnalysisResult(
                id=old_result.id,
                project_id=old_result.project_id,
                rubric_id=old_result.rubric_id,
                dataset_id=old_result.dataset_id,
                created_date=old_result.created_date,
                modified_date=old_result.modified_date,
                total_genes_processed=old_result.total_genes_processed,
                total_rules_executed=old_result.total_rules_executed,
                execution_time_seconds=old_result.execution_time_seconds,
                status=old_result.status,
                error_message=old_result.error_message,
                results_file=old_result.results_file,
                key_column="gene_symbol",  # Default key column
                results_table_name=None  # Will be set after creating wide table
            )
            
            result_db.add(new_result)
            result_db.flush()  # Get the ID without committing
            
            # Get all detail records for this analysis result
            details = main_db.query(AnalysisResultDetail).filter(
                AnalysisResultDetail.analysis_result_id == old_result.id
            ).all()
            
            if details:
                print(f"  Converting {len(details)} detail records to wide format...")
                
                # Group details by key column value (gene)
                gene_data = {}
                rule_names = set()
                
                for detail in details:
                    key_value = detail.key_column_value
                    rule_name = detail.rule_name
                    rule_names.add(rule_name)
                    
                    if key_value not in gene_data:
                        gene_data[key_value] = {
                            'key_column_value': key_value,
                            'key_column_2_value': detail.key_column_2_value,
                            'total_score': detail.total_score,
                            'analysis_result_id': new_result.id
                        }
                    
                    # Store rule-specific data
                    safe_rule_name = rule_name.replace(' ', '_').replace('-', '_').replace('.', '_').replace('(', '').replace(')', '')
                    safe_rule_name = ''.join(c for c in safe_rule_name if c.isalnum() or c == '_')
                    if safe_rule_name[0].isdigit():
                        safe_rule_name = f"rule_{safe_rule_name}"
                    
                    gene_data[key_value][f"{safe_rule_name}_score"] = detail.rule_score
                    gene_data[key_value][f"{safe_rule_name}_weight"] = detail.rule_weight
                    gene_data[key_value][f"{safe_rule_name}_weighted_score"] = detail.weighted_score
                
                # Create wide format table for this rubric
                table_class, table_name = create_rubric_analysis_table(old_result.rubric_id, list(rule_names))
                
                # Create the table in the database
                table_class.__table__.create(result_engine, checkfirst=True)
                
                # Insert data into wide format table
                for gene_data_row in gene_data.values():
                    wide_row = table_class(**gene_data_row)
                    result_db.add(wide_row)
                
                # Update the analysis result with table name
                new_result.results_table_name = table_name
                
                # Create tracker entry
                tracker = AnalysisResultTracker(
                    analysis_result_id=new_result.id,
                    storage_type="wide_table",
                    storage_location=table_name
                )
                result_db.add(tracker)
                
                print(f"  ✓ Created wide table '{table_name}' with {len(gene_data)} genes and {len(rule_names)} rules")
            
            result_db.commit()
            print(f"  ✓ Migrated analysis result {old_result.id}")
        
        print(f"✓ Successfully migrated {len(old_results)} analysis results")
        
    except Exception as e:
        result_db.rollback()
        print(f"✗ Error during migration: {str(e)}")
        raise
    finally:
        main_db.close()
        result_db.close()

def create_indexes():
    """Create additional indexes for performance"""
    print("Creating performance indexes...")
    
    result_db = ResultSessionLocal()
    try:
        # Create additional indexes for fast gene lookups
        result_db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_analysis_results_project_rubric 
            ON analysis_results(project_id, rubric_id)
        """))
        
        result_db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_analysis_results_project_dataset 
            ON analysis_results(project_id, dataset_id)
        """))
        
        result_db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_analysis_results_rubric_dataset 
            ON analysis_results(rubric_id, dataset_id)
        """))
        
        result_db.commit()
        print("✓ Performance indexes created")
        
    except Exception as e:
        result_db.rollback()
        print(f"✗ Error creating indexes: {str(e)}")
        raise
    finally:
        result_db.close()

def verify_migration():
    """Verify the migration was successful"""
    print("Verifying migration...")
    
    main_db = SessionLocal()
    result_db = ResultSessionLocal()
    
    try:
        # Count records in both databases
        old_count = main_db.query(OldAnalysisResult).count()
        new_count = result_db.query(AnalysisResult).count()
        
        print(f"Main database analysis results: {old_count}")
        print(f"Result database analysis results: {new_count}")
        
        if old_count == new_count:
            print("✓ Migration verification successful")
        else:
            print("✗ Migration verification failed - count mismatch")
            
        # Check for wide tables
        cursor = result_db.execute(text("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name LIKE 'rubric_%_analysis_result'
        """))
        wide_tables = cursor.fetchall()
        print(f"✓ Created {len(wide_tables)} wide format tables")
        
        for table in wide_tables:
            table_name = table[0]
            cursor = result_db.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
            count = cursor.fetchone()[0]
            print(f"  - {table_name}: {count} genes")
        
    except Exception as e:
        print(f"✗ Error during verification: {str(e)}")
        raise
    finally:
        main_db.close()
        result_db.close()

def backup_old_tables():
    """Create backup of old analysis result tables"""
    print("Creating backup of old analysis result tables...")
    
    main_db = SessionLocal()
    try:
        # Create backup tables
        main_db.execute(text("""
            CREATE TABLE IF NOT EXISTS analysis_results_backup AS 
            SELECT * FROM analysis_results
        """))
        
        main_db.execute(text("""
            CREATE TABLE IF NOT EXISTS analysis_result_details_backup AS 
            SELECT * FROM analysis_result_details
        """))
        
        main_db.commit()
        print("✓ Backup tables created")
        
    except Exception as e:
        main_db.rollback()
        print(f"✗ Error creating backup: {str(e)}")
        raise
    finally:
        main_db.close()

def main():
    """Main migration function"""
    print("=" * 60)
    print("ANALYSIS RESULTS MIGRATION TO SEPARATE DATABASE")
    print("=" * 60)
    print(f"Migration started at: {datetime.now()}")
    print()
    
    try:
        # Step 1: Create backup
        backup_old_tables()
        print()
        
        # Step 2: Create result database
        create_result_database()
        print()
        
        # Step 3: Migrate data
        migrate_analysis_results()
        print()
        
        # Step 4: Create indexes
        create_indexes()
        print()
        
        # Step 5: Verify migration
        verify_migration()
        print()
        
        print("=" * 60)
        print("MIGRATION COMPLETED SUCCESSFULLY")
        print("=" * 60)
        print(f"Migration completed at: {datetime.now()}")
        print()
        print("Next steps:")
        print("1. Update API endpoints to use new result database")
        print("2. Test the new system with existing data")
        print("3. Remove old analysis result tables from main database (optional)")
        
    except Exception as e:
        print("=" * 60)
        print("MIGRATION FAILED")
        print("=" * 60)
        print(f"Error: {str(e)}")
        print()
        print("The old data is preserved in backup tables.")
        print("You can retry the migration after fixing the issue.")
        sys.exit(1)

if __name__ == "__main__":
    main()
