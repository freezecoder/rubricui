import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.models.database import engine

def migrate_admin_attributes():
    """Add visibility and enabled columns to existing tables"""
    print("Starting migration to add admin control attributes...")
    
    with engine.connect() as conn:
        # Start a transaction
        trans = conn.begin()
        
        try:
            # Add columns to rules table
            print("Adding admin columns to rules table...")
            conn.execute(text("""
                ALTER TABLE rules 
                ADD COLUMN visibility VARCHAR(20) DEFAULT 'public'
            """))
            conn.execute(text("""
                ALTER TABLE rules 
                ADD COLUMN enabled BOOLEAN DEFAULT 1
            """))
            
            # Add columns to rubrics table
            print("Adding admin columns to rubrics table...")
            conn.execute(text("""
                ALTER TABLE rubrics 
                ADD COLUMN visibility VARCHAR(20) DEFAULT 'public'
            """))
            conn.execute(text("""
                ALTER TABLE rubrics 
                ADD COLUMN enabled BOOLEAN DEFAULT 1
            """))
            
            # Add columns to datasets table
            print("Adding admin columns to datasets table...")
            conn.execute(text("""
                ALTER TABLE datasets 
                ADD COLUMN visibility VARCHAR(20) DEFAULT 'public'
            """))
            conn.execute(text("""
                ALTER TABLE datasets 
                ADD COLUMN enabled BOOLEAN DEFAULT 1
            """))
            
            # Commit the transaction
            trans.commit()
            print("Migration completed successfully!")
            print("Added visibility and enabled columns to rules, rubrics, and datasets tables.")
            
        except Exception as e:
            # Rollback on error
            trans.rollback()
            print(f"Migration failed: {str(e)}")
            raise

def check_migration_status():
    """Check if the migration has already been applied"""
    print("Checking migration status...")
    
    with engine.connect() as conn:
        try:
            # Check if visibility column exists in rules table
            result = conn.execute(text("""
                SELECT COUNT(*) as count 
                FROM pragma_table_info('rules') 
                WHERE name = 'visibility'
            """))
            visibility_exists = result.fetchone()[0] > 0
            
            # Check if enabled column exists in rules table
            result = conn.execute(text("""
                SELECT COUNT(*) as count 
                FROM pragma_table_info('rules') 
                WHERE name = 'enabled'
            """))
            enabled_exists = result.fetchone()[0] > 0
            
            if visibility_exists and enabled_exists:
                print("Migration already applied - admin columns exist in rules table")
                return True
            else:
                print("Migration needed - admin columns missing")
                return False
                
        except Exception as e:
            print(f"Error checking migration status: {str(e)}")
            return False

if __name__ == "__main__":
    if not check_migration_status():
        migrate_admin_attributes()
    else:
        print("Migration not needed - admin columns already exist")
