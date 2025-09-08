from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.types import TypeDecorator, CHAR
import os
from pathlib import Path
from dotenv import load_dotenv
import uuid

load_dotenv()

# Custom UUID type for SQLite compatibility
class UUIDType(TypeDecorator):
    impl = CHAR(32)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, uuid.UUID):
            return value.hex
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        return uuid.UUID(hex=value)

# Use SQLite3 for development (no PostgreSQL required)
# Ensure database is always in the backend folder with absolute path
# Get the absolute path to the database file
db_path = Path(__file__).parent.parent.parent / "backend" / "rubrics.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{db_path.absolute()}")

# For SQLite, we don't need psycopg2-specific arguments
if "sqlite" in DATABASE_URL:
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # PostgreSQL configuration (kept for compatibility)
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()