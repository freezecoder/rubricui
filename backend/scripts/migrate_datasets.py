#!/usr/bin/env python3
"""
Database migration script to add Dataset and DatasetColumn tables
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.database import engine, Base
from app.models.dataset import Dataset, DatasetColumn

def migrate_datasets():
    """Create the new dataset tables"""
    print("Creating Dataset and DatasetColumn tables...")
    
    try:
        # Create the new tables
        Dataset.__table__.create(engine, checkfirst=True)
        DatasetColumn.__table__.create(engine, checkfirst=True)
        
        print("✅ Dataset tables created successfully!")
        print("   - datasets table")
        print("   - dataset_columns table")
        
    except Exception as e:
        print(f"❌ Error creating dataset tables: {e}")
        return False
    
    return True

if __name__ == "__main__":
    success = migrate_datasets()
    if success:
        print("\n🎉 Migration completed successfully!")
    else:
        print("\n💥 Migration failed!")
        sys.exit(1)
