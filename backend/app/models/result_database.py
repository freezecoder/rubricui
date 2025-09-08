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

# Separate database for analysis results - rubric_result.db
# Ensure database is always in the backend folder with absolute path
db_path = Path(__file__).parent.parent / "rubric_result.db"
RESULT_DATABASE_URL = os.getenv("RESULT_DATABASE_URL", f"sqlite:///{db_path.absolute()}")

# For SQLite, we don't need psycopg2-specific arguments
if "sqlite" in RESULT_DATABASE_URL:
    result_engine = create_engine(RESULT_DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # PostgreSQL configuration (kept for compatibility)
    result_engine = create_engine(RESULT_DATABASE_URL)

ResultSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=result_engine)

ResultBase = declarative_base()

# Dependency to get result database session
def get_result_db():
    db = ResultSessionLocal()
    try:
        yield db
    finally:
        db.close()
