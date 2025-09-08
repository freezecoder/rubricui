from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.models.database import get_db
from app.models.rubric import Rubric
from app.models.rule import Rule
from app.models.rubric_rule import RubricRule
from app.models.dataset import Dataset
from app.models.dataset import DatasetColumn
from app.services.file_processor import FileProcessor
import pandas as pd

router = APIRouter()

@router.post("/validate")
async def validate_rubric_for_dataset(
    request: dict,
    db: Session = Depends(get_db)
):
    """Validate if a rubric's rules are compatible with a dataset's columns"""
    
    rubric_id = request.get("rubric_id")
    dataset_id = request.get("dataset_id")
    
    if not rubric_id or not dataset_id:
        raise HTTPException(status_code=400, detail="rubric_id and dataset_id are required")
    
    # Get rubric
    rubric = db.query(Rubric).filter(Rubric.id == rubric_id, Rubric.is_active == True).first()
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")
    
    # Get dataset
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # Get rubric rules
    rubric_rules = db.query(RubricRule).filter(
        RubricRule.rubric_id == rubric_id,
        RubricRule.is_active == True
    ).all()
    
    if not rubric_rules:
        return {
            "is_valid": True,
            "validation_status": "Pass",
            "rubric_id": rubric_id,
            "rubric_name": rubric.name,
            "dataset_id": dataset_id,
            "dataset_name": dataset.name,
            "total_rules": 0,
            "valid_rules": 0,
            "invalid_rules": 0,
            "compatibility_percentage": 0,
            "color": "gray",
            "status_message": "No rules in rubric to validate",
            "missing_columns": [],
            "validation_details": [],
            "message": "No rules in rubric to validate"
        }
    
    # Get all rules for this rubric
    rule_ids = [rr.rule_id for rr in rubric_rules]
    rules = db.query(Rule).filter(
        Rule.id.in_(rule_ids),
        Rule.is_active == True
    ).all()
    
    # Get dataset columns
    dataset_columns = db.query(DatasetColumn).filter(
        DatasetColumn.dataset_id == dataset_id
    ).all()
    
    # Create column mapping
    available_columns = {col.sanitized_name: col.original_name for col in dataset_columns}
    
    validation_results = []
    is_valid = True
    missing_columns = set()
    
    for rule in rules:
        rule_validation = {
            "rule_id": rule.id,
            "rule_name": rule.name,
            "is_valid": True,
            "missing_columns": [],
            "available_columns": [],
            "column_mapping": rule.column_mapping or {}
        }
        
        # Check if all required columns from rule's column mapping exist in dataset
        if rule.column_mapping:
            for variable, column_name in rule.column_mapping.items():
                if column_name not in available_columns:
                    rule_validation["missing_columns"].append(column_name)
                    rule_validation["is_valid"] = False
                    missing_columns.add(column_name)
                    is_valid = False
                else:
                    rule_validation["available_columns"].append({
                        "variable": variable,
                        "column_name": column_name,
                        "original_name": available_columns[column_name]
                    })
        
        validation_results.append(rule_validation)
    
    # Calculate compatibility percentage and determine color
    valid_rules_count = len([r for r in validation_results if r["is_valid"]])
    total_rules_count = len(rules)
    compatibility_percentage = (valid_rules_count / total_rules_count) * 100 if total_rules_count > 0 else 0
    
    # Determine validation status: Pass if >=1 rule compatible, Failure if 0 rules compatible
    validation_status = "Pass" if valid_rules_count >= 1 else "Failure"
    
    # Determine color and message based on compatibility
    if valid_rules_count == 0:
        color = "red"
        status_message = "No rules are compatible with dataset columns"
    elif valid_rules_count == 1:
        color = "orange"
        status_message = "Only 1 rule is compatible with dataset columns"
    elif compatibility_percentage > 80:
        color = "green"
        status_message = f"Excellent compatibility: {valid_rules_count}/{total_rules_count} rules are compatible"
    elif compatibility_percentage > 60:
        color = "light-blue"
        status_message = f"Good compatibility: {valid_rules_count}/{total_rules_count} rules are compatible"
    else:
        color = "orange"
        status_message = f"Limited compatibility: {valid_rules_count}/{total_rules_count} rules are compatible"
    
    return {
        "is_valid": valid_rules_count >= 1,  # Pass if at least 1 rule is compatible
        "validation_status": validation_status,
        "rubric_id": rubric_id,
        "rubric_name": rubric.name,
        "dataset_id": dataset_id,
        "dataset_name": dataset.name,
        "total_rules": total_rules_count,
        "valid_rules": valid_rules_count,
        "invalid_rules": len([r for r in validation_results if not r["is_valid"]]),
        "compatibility_percentage": round(compatibility_percentage, 1),
        "color": color,
        "status_message": status_message,
        "missing_columns": list(missing_columns),
        "validation_details": validation_results,
        "message": f"Validation {validation_status.lower()}: {valid_rules_count}/{total_rules_count} rules are compatible with dataset columns"
    }

@router.get("/{rubric_id}/rules")
async def get_rubric_rules(
    rubric_id: str,
    db: Session = Depends(get_db)
):
    """Get all rules for a specific rubric with their details"""
    
    # Get rubric
    rubric = db.query(Rubric).filter(Rubric.id == rubric_id, Rubric.is_active == True).first()
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")
    
    # Get rubric rules with rule details
    rubric_rules = db.query(RubricRule, Rule).join(
        Rule, RubricRule.rule_id == Rule.id
    ).filter(
        RubricRule.rubric_id == rubric_id,
        RubricRule.is_active == True,
        Rule.is_active == True
    ).order_by(RubricRule.order_index).all()
    
    rules_data = []
    for rubric_rule, rule in rubric_rules:
        rules_data.append({
            "id": rule.id,
            "name": rule.name,
            "description": rule.description,
            "ruleset_conditions": rule.ruleset_conditions or [],
            "column_mapping": rule.column_mapping or {},
            "weight": rule.weight,
            "rubric_weight": rubric_rule.weight,
            "order_index": rubric_rule.order_index,
            "owner_name": rule.owner_name,
            "organization": rule.organization,
            "disease_area_study": rule.disease_area_study,
            "tags": rule.tags or [],
            "created_date": rule.created_date.isoformat() if rule.created_date else None,
            "modified_date": rule.modified_date.isoformat() if rule.modified_date else None
        })
    
    return {
        "rubric_id": rubric_id,
        "rubric_name": rubric.name,
        "total_rules": len(rules_data),
        "rules": rules_data
    }

@router.get("/{rubric_id}/refresh")
async def refresh_rubric(
    rubric_id: str,
    db: Session = Depends(get_db)
):
    """Refresh rubric data (useful when rubric has been edited)"""
    
    # Get rubric
    rubric = db.query(Rubric).filter(Rubric.id == rubric_id, Rubric.is_active == True).first()
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")
    
    # Get updated rubric rules count
    rubric_rules_count = db.query(RubricRule).filter(
        RubricRule.rubric_id == rubric_id,
        RubricRule.is_active == True
    ).count()
    
    return {
        "rubric_id": rubric_id,
        "rubric_name": rubric.name,
        "description": rubric.description,
        "organization": rubric.organization,
        "disease_area_study": rubric.disease_area_study,
        "total_rules": rubric_rules_count,
        "is_active": rubric.is_active,
        "created_date": rubric.created_date.isoformat() if rubric.created_date else None,
        "modified_date": rubric.modified_date.isoformat() if rubric.modified_date else None,
        "message": "Rubric data refreshed successfully"
    }
