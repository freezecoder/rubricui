import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.database import engine
from sqlalchemy import inspect

def check_database():
    """Check which tables exist in the database"""
    print("Checking database tables...")
    
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    print(f"Tables found: {tables}")
    
    for table_name in tables:
        print(f"\nTable: {table_name}")
        columns = inspector.get_columns(table_name)
        for column in columns:
            print(f"  - {column['name']}: {column['type']}")

if __name__ == "__main__":
    check_database()