from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.models.database import get_db
from app.models.project import Project
from app.models.rule import Rule
from app.models.rubric import Rubric
from app.models.rubric_rule import RubricRule
from app.models.dataset import Dataset
from app.models.execution_record import ExecutionRecord
from app.services.analysis_executor import AnalysisExecutor
from app.services.file_processor import FileProcessor
import uuid
import os
from datetime import datetime, timedelta

router = APIRouter()

# Store for background job status
job_status = {}

@router.post("/execute")
async def execute_analysis(
    background_tasks: BackgroundTasks,
    project_id: uuid.UUID,
    rule_ids: List[uuid.UUID] = [],
    rubric_ids: List[uuid.UUID] = [],
    db: Session = Depends(get_db)
):
    """Execute analysis with selected rules and rubrics"""
    
    # Validate project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Validate input data file exists
    if not project.input_data_file or not os.path.exists(project.input_data_file):
        raise HTTPException(status_code=404, detail="Project data file not found")
    
    # Validate rules exist and are active
    valid_rules = []
    if rule_ids:
        valid_rules = db.query(Rule).filter(
            Rule.id.in_(rule_ids),
            Rule.is_active == True
        ).all()
        
        if len(valid_rules) != len(rule_ids):
            raise HTTPException(status_code=400, detail="Some rules not found or inactive")
    
    # Validate rubrics exist and are active
    valid_rubrics = []
    if rubric_ids:
        valid_rubrics = db.query(Rubric).filter(
            Rubric.id.in_(rubric_ids),
            Rubric.is_active == True
        ).all()
        
        if len(valid_rubrics) != len(rubric_ids):
            raise HTTPException(status_code=400, detail="Some rubrics not found or inactive")
    
    # Create job ID
    job_id = str(uuid.uuid4())
    
    # Start background task
    background_tasks.add_task(
        run_analysis,
        job_id,
        project_id,
        [rule.id for rule in valid_rules],
        [rubric.id for rubric in valid_rubrics],
        db
    )
    
    return {"job_id": job_id, "status": "started"}

@router.get("/status/{job_id}")
async def get_analysis_status(job_id: str):
    """Get status of analysis job"""
    if job_id not in job_status:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return job_status[job_id]

@router.get("/preview")
async def preview_analysis(
    project_id: uuid.UUID,
    rule_ids: List[uuid.UUID] = [],
    rubric_ids: List[uuid.UUID] = [],
    db: Session = Depends(get_db)
):
    """Preview analysis configuration without executing"""
    
    # Validate project exists
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get rules and rubrics
    rules = []
    rubrics = []
    
    if rule_ids:
        rules = db.query(Rule).filter(
            Rule.id.in_(rule_ids),
            Rule.is_active == True
        ).all()
    
    if rubric_ids:
        rubrics = db.query(Rubric).filter(
            Rubric.id.in_(rubric_ids),
            Rubric.is_active == True
        ).all()
    
    # Get data preview
    file_processor = FileProcessor()
    try:
        data_preview = file_processor.get_file_preview(project.input_data_file, max_rows=5)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading data file: {str(e)}")
    
    return {
        "project_name": project.name,
        "rules": [{"id": str(rule.id), "name": rule.name} for rule in rules],
        "rubrics": [{"id": str(rubric.id), "name": rubric.name} for rubric in rubrics],
        "data_preview": data_preview,
        "estimated_computation": len(data_preview["data"]) * (len(rules) + len(rubrics))
    }

async def run_analysis(
    job_id: str,
    project_id: uuid.UUID,
    rule_ids: List[uuid.UUID],
    rubric_ids: List[uuid.UUID],
    db: Session
):
    """Background task to run analysis"""
    
    try:
        job_status[job_id] = {"status": "running", "progress": 0, "message": "Starting analysis"}
        
        # Get project and data
        project = db.query(Project).filter(Project.id == project_id).first()
        
        job_status[job_id] = {"status": "running", "progress": 10, "message": "Loading data"}
        
        # Load data
        file_processor = FileProcessor()
        df = file_processor.process_file_for_analysis(project.input_data_file)
        
        job_status[job_id] = {"status": "running", "progress": 20, "message": "Loading rules and rubrics"}
        
        # Get rules and rubrics
        rules = db.query(Rule).filter(Rule.id.in_(rule_ids), Rule.is_active == True).all()
        rubrics = db.query(Rubric).filter(Rubric.id.in_(rubric_ids), Rubric.is_active == True).all()
        
        job_status[job_id] = {"status": "running", "progress": 30, "message": "Executing analysis"}
        
        # Execute analysis
        executor = AnalysisExecutor()
        results = executor.execute_mixed_analysis(rules, rubrics, df)
        
        job_status[job_id] = {"status": "running", "progress": 80, "message": "Saving results"}
        
        # Save results
        results_file = f"results/{project_id}_results.xlsx"
        os.makedirs("results", exist_ok=True)
        results.to_excel(results_file, index=False)
        
        # Update project
        project.results = results_file
        project.applied_rules = [str(rule.id) for rule in rules]
        project.applied_rubrics = [str(rubric.id) for rubric in rubrics]
        
        db.commit()
        
        job_status[job_id] = {
            "status": "completed", 
            "progress": 100, 
            "message": "Analysis completed successfully",
            "results_file": results_file,
            "total_genes": len(results)
        }
        
    except Exception as e:
        job_status[job_id] = {
            "status": "failed", 
            "progress": 0, 
            "message": f"Analysis failed: {str(e)}"
        }

@router.post("/execute-rubric")
async def execute_analysis_with_rubric(
    background_tasks: BackgroundTasks,
    request: dict,
    db: Session = Depends(get_db)
):
    """Execute analysis with a specific rubric and dataset"""
    
    try:
        # Extract parameters from request body
        project_id = request.get("project_id")
        rubric_id = request.get("rubric_id")
        dataset_id = request.get("dataset_id")
        
        print(f"Received request: project_id={project_id}, rubric_id={rubric_id}, dataset_id={dataset_id}")
        
        if not project_id or not rubric_id or not dataset_id:
            raise HTTPException(status_code=400, detail="Missing required parameters: project_id, rubric_id, dataset_id")
        
        # Validate project exists
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Validate rubric exists
        rubric = db.query(Rubric).filter(Rubric.id == rubric_id, Rubric.is_active == True).first()
        if not rubric:
            raise HTTPException(status_code=404, detail="Rubric not found")
        
        # Validate dataset exists
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        # Create execution record
        execution_id = str(uuid.uuid4())
        execution_record = ExecutionRecord(
            id=execution_id,
            project_id=project_id,
            execution_type='rubric',
            executed_items=[rubric_id],
            status='pending',
            execution_date=datetime.utcnow()
        )
        db.add(execution_record)
        db.commit()
        
        # Start background task
        background_tasks.add_task(
            run_rubric_analysis,
            execution_id,
            project_id,
            rubric_id,
            dataset_id,
            db
        )
    
        return {
            "id": execution_id,
            "project_id": project_id,
            "rubric_id": rubric_id,
            "dataset_id": dataset_id,
            "status": "pending",
            "progress": 0,
            "message": "Analysis queued",
            "started_at": execution_record.execution_date.isoformat()
        }
    except Exception as e:
        import traceback
        print(f"Error in execute_analysis_with_rubric: {str(e)}")
        print(f"Error type: {type(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/execution/{execution_id}")
async def get_analysis_execution(
    execution_id: str,
    db: Session = Depends(get_db)
):
    """Get analysis execution status"""
    execution = db.query(ExecutionRecord).filter(ExecutionRecord.id == execution_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    return {
        "id": execution.id,
        "project_id": execution.project_id,
        "status": execution.status,
        "progress": 0,  # Not available in current model
        "message": "Analysis in progress" if execution.status == 'running' else "Analysis completed" if execution.status == 'completed' else "Analysis failed" if execution.status == 'failed' else "Analysis pending",
        "results_file": execution.results_file,
        "total_genes": 0,  # Not available in current model
        "started_at": execution.execution_date.isoformat(),
        "completed_at": (execution.execution_date + timedelta(seconds=execution.execution_time_seconds)).isoformat() if execution.execution_time_seconds else None,
        "error": execution.error_message
    }

@router.get("/results/{execution_id}")
async def get_analysis_results(
    execution_id: str,
    db: Session = Depends(get_db)
):
    """Get analysis results"""
    execution = db.query(ExecutionRecord).filter(ExecutionRecord.id == execution_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    if execution.status != 'completed':
        raise HTTPException(status_code=400, detail="Analysis not completed yet")
    
    if not execution.results_file or not os.path.exists(execution.results_file):
        raise HTTPException(status_code=404, detail="Results file not found")
    
    # Load results and calculate statistics
    try:
        import pandas as pd
        import numpy as np
        df = pd.read_excel(execution.results_file)
        
        # Calculate score distribution - only for numeric score columns
        score_columns = [col for col in df.columns if col.endswith('_SCORE') and df[col].dtype in ['int64', 'float64']]
        score_distribution = {}
        
        for col in score_columns:
            try:
                # Get valid (non-null, non-infinite) values
                valid_values = df[col].dropna()
                valid_values = valid_values[np.isfinite(valid_values)]
                
                if len(valid_values) == 0:
                    score_distribution[col] = {
                        "min": None,
                        "max": None,
                        "mean": None,
                        "median": None,
                        "std": None
                    }
                else:
                    score_distribution[col] = {
                        "min": float(valid_values.min()),
                        "max": float(valid_values.max()),
                        "mean": float(valid_values.mean()),
                        "median": float(valid_values.median()),
                        "std": float(valid_values.std()) if len(valid_values) > 1 else 0.0
                    }
            except (ValueError, TypeError) as e:
                print(f"Warning: Could not calculate statistics for column {col}: {e}")
                score_distribution[col] = {
                    "min": None,
                    "max": None,
                    "mean": None,
                    "median": None,
                    "std": None
                }
                continue
        
        # Get sample gene scores
        gene_scores = []
        for _, row in df.head(100).iterrows():
            scores = {}
            for col in score_columns:
                if col in row and pd.notna(row[col]) and np.isfinite(row[col]):
                    scores[col] = float(row[col])
            
            # Handle total score with NaN/infinite value checking
            total_score = row.get('TOTAL_SCORE', 0)
            if pd.notna(total_score) and np.isfinite(total_score):
                total_score = float(total_score)
            else:
                total_score = None
            
            gene_scores.append({
                "gene_id": str(row.get('ensg_id', '')),
                "gene_name": str(row.get('gene_symbol', '')),
                "scores": scores,
                "total_score": total_score
            })
        
        # Try to find the corresponding analysis result ID
        analysis_result_id = None
        try:
            from app.models.result_database import get_result_db
            from app.models.result_analysis_result import AnalysisResult
            result_db = next(get_result_db())
            analysis_result = result_db.query(AnalysisResult).filter(
                AnalysisResult.results_file == execution.results_file
            ).first()
            if analysis_result:
                analysis_result_id = analysis_result.id
        except Exception as e:
            print(f"Could not find analysis result ID for execution {execution_id}: {e}")

        return {
            "execution_id": execution_id,
            "analysis_result_id": analysis_result_id,  # Add analysis result ID
            "status": "completed",
            "results_file": execution.results_file,
            "total_genes": len(df),
            "score_distribution": score_distribution,
            "gene_scores": gene_scores,
            "completed_at": (execution.execution_date + timedelta(seconds=execution.execution_time_seconds)).isoformat() if execution.execution_time_seconds else execution.execution_date.isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading results: {str(e)}")

async def run_rubric_analysis(
    execution_id: str,
    project_id: str,
    rubric_id: str,
    dataset_id: str,
    db: Session
):
    """Background task to run rubric-based analysis"""
    
    # Create a new database session for the background task
    from app.models.database import SessionLocal
    db_session = SessionLocal()
    
    try:
        print(f"Starting analysis for execution {execution_id}")
        print(f"Parameters: project_id={project_id}, rubric_id={rubric_id}, dataset_id={dataset_id}")
        
        # Update status to running
        execution = db_session.query(ExecutionRecord).filter(ExecutionRecord.id == execution_id).first()
        if not execution:
            raise Exception(f"Execution record {execution_id} not found")
            
        execution.status = 'running'
        db_session.commit()
        
        # Get dataset
        print(f"Loading dataset {dataset_id}")
        dataset = db_session.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            raise Exception(f"Dataset {dataset_id} not found")
        print(f"Dataset loaded: {dataset.name}, file_path: {dataset.file_path}")
        
        # Get rubric with its rules
        rubric = db_session.query(Rubric).filter(Rubric.id == rubric_id).first()
        if not rubric:
            raise Exception(f"Rubric {rubric_id} not found")
        
        # Get rubric rules
        print(f"Querying rubric rules for rubric_id: {rubric_id}")
        rubric_rules = db_session.query(RubricRule).filter(
            RubricRule.rubric_id == rubric_id,
            RubricRule.is_active == True
        ).all()
        print(f"Found {len(rubric_rules)} active rubric rules")
        
        rule_ids = [rr.rule_id for rr in rubric_rules]
        print(f"Rule IDs: {rule_ids}")
        rules = db_session.query(Rule).filter(
            Rule.id.in_(rule_ids),
            Rule.is_active == True
        ).all()
        
        # Create a mapping of rule_id to rule for easy lookup
        rule_map = {rule.id: rule for rule in rules}
        
        # Add rule objects to rubric_rules for easier access
        for rr in rubric_rules:
            rr.rule = rule_map.get(rr.rule_id)
        
        print(f"Loaded {len(rubric_rules)} rubric rules with {len(rules)} active rules")
        
        # Load dataset data from pickle file for better performance
        from app.services.dataset_processor import DatasetProcessor
        dataset_processor = DatasetProcessor()
        df = dataset_processor.load_dataset(dataset_id)
        
        # Execute rubric analysis using analysis executor with Excel output
        executor = AnalysisExecutor()
        
        # Save results with two sheets
        results_dir = f"results/{project_id}"
        os.makedirs(results_dir, exist_ok=True)
        results_file = f"{results_dir}/{execution_id}_results.xlsx"
        
        # Execute rubric and create Excel output with two sheets
        results = executor.execute_rubric_with_excel_output(rubric, df, rubric_rules, results_file)
        
        # Cache creation will happen after analysis result is created
        
        # Update execution record
        execution.status = 'completed'
        execution.results_file = results_file
        execution.execution_time_seconds = (datetime.utcnow() - execution.execution_date).total_seconds()
        db_session.commit()
        
        # Also save to the new AnalysisResult system for frontend compatibility
        try:
            from app.services.result_analysis_service import ResultAnalysisService
            from app.models.result_database import get_result_db
            
            result_db = next(get_result_db())
            service = ResultAnalysisService()
            
            # Create analysis result record
            analysis_result = service.create_analysis_result(
                project_id=project_id,
                rubric_id=rubric_id,
                dataset_id=dataset_id,
                key_column="gene_symbol"
            )
            
            # Update with execution details using the same database session
            analysis_result.status = 'completed'
            analysis_result.total_genes_processed = len(results) if results is not None and not results.empty else 0
            analysis_result.total_rules_executed = len(rubric_rules)
            analysis_result.execution_time_seconds = execution.execution_time_seconds
            analysis_result.results_file = results_file
            
            # Commit using the service's database session
            service.result_db.commit()
            print(f"Analysis result saved to new system: {analysis_result.id}")
            
            # Create optimized result cache using analysis result ID
            try:
                from app.services.result_cache_service import ResultCacheService
                
                # Identify columns for caching based on actual results DataFrame
                key_columns = ['gene_symbol'] if 'gene_symbol' in results.columns else ['ensg_id'] if 'ensg_id' in results.columns else []
                
                # Get actual score columns from results DataFrame
                score_columns = [col for col in results.columns if col.endswith('_SCORE')]
                print(f"Found score columns in results: {score_columns}")
                
                # Get columns used for scoring (from original dataset)
                scoring_columns = [col for col in df.columns if col not in key_columns + score_columns]
                
                print(f"Cache columns - key: {key_columns}, score: {score_columns}, scoring: {scoring_columns[:5]}...")
                
                cache_service = ResultCacheService()
                cache_metadata = cache_service.create_optimized_result_cache(
                    analysis_id=analysis_result.id,  # Use analysis result ID instead of execution ID
                    results_df=results,
                    key_columns=key_columns,
                    score_columns=score_columns,
                    scoring_columns=scoring_columns
                )
                
                print(f"Created optimized result cache for analysis {analysis_result.id}: {cache_metadata['file_size_mb']:.2f} MB")
                
            except Exception as cache_error:
                print(f"Warning: Failed to create result cache: {str(cache_error)}")
                import traceback
                traceback.print_exc()
            
        except Exception as e:
            print(f"Warning: Failed to save to new analysis result system: {e}")
            import traceback
            traceback.print_exc()
        
    except Exception as e:
        # Update execution record with error
        try:
            execution = db_session.query(ExecutionRecord).filter(ExecutionRecord.id == execution_id).first()
            if execution:
                execution.status = 'failed'
                execution.error_message = str(e)
                execution.execution_time_seconds = (datetime.utcnow() - execution.execution_date).total_seconds()
                db_session.commit()
                print(f"Analysis failed for execution {execution_id}: {str(e)}")
                
                # Also save failed execution to the new AnalysisResult system
                try:
                    from app.services.result_analysis_service import ResultAnalysisService
                    from app.models.result_database import get_result_db
                    
                    result_db = next(get_result_db())
                    service = ResultAnalysisService()
                    
                    # Create analysis result record for failed execution
                    analysis_result = service.create_analysis_result(
                        project_id=project_id,
                        rubric_id=rubric_id,
                        dataset_id=dataset_id,
                        key_column="gene_symbol"
                    )
                    
                    # Update with failure details using the same database session
                    analysis_result.status = 'failed'
                    analysis_result.error_message = str(e)
                    analysis_result.execution_time_seconds = execution.execution_time_seconds
                    
                    # Commit using the service's database session
                    service.result_db.commit()
                    print(f"Failed analysis result saved to new system: {analysis_result.id}")
                    
                except Exception as result_error:
                    print(f"Warning: Failed to save failed execution to new system: {result_error}")
                    import traceback
                    traceback.print_exc()
                    
        except Exception as db_error:
            print(f"Failed to update execution record with error: {db_error}")
    finally:
        # Close the database session
        db_session.close()