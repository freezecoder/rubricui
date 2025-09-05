import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.database import engine, Base

def init_database():
    """Initialize the database with all tables"""
    print("Initializing SQLite database...")
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    print("Database initialized successfully!")
    print("Database file: rubrics.db")

if __name__ == "__main__":
    init_database()