from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import os
from typing import List, Optional
from datetime import datetime
import uuid

from app.models.database import SessionLocal, engine, Base
from app.api import rules, rubrics, projects, analysis, datasets
from app.services.file_processor import FileProcessor

# Import all models to ensure they're registered with Base metadata
from app.models import Rule, Rubric, RubricRule, Project, ExecutionRecord, Dataset, DatasetColumn

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Rubrics/Rubric Runner API",
    description="Genomics data analysis application for scoring rules and rubrics",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],  # Next.js frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Include routers
app.include_router(rules.router, prefix="/api/rules", tags=["rules"])
app.include_router(rubrics.router, prefix="/api/rubrics", tags=["rubrics"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["analysis"])
app.include_router(datasets.router, prefix="/api/datasets", tags=["datasets"])

@app.get("/")
async def root():
    return {"message": "Rubrics/Rubric Runner API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now()}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)