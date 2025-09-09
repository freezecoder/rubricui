from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from typing import List, Optional
from app.models.database import get_db
from app.models.rule import Rule
from app.schemas.rule import RuleCreate, RuleResponse, RuleAdminUpdate
from app.services.rule_engine import RuleEngine
import uuid

router = APIRouter()

@router.post("", response_model=RuleResponse)
async def create_rule(rule: RuleCreate, db: Session = Depends(get_db)):
    db_rule = Rule(**rule.dict())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule

@router.get("", response_model=List[RuleResponse])
async def list_rules(
    skip: int = 0, 
    limit: int = 100, 
    sort_by: Optional[str] = Query(None, description="Sort by field: name, created_date, modified_date"),
    sort_order: Optional[str] = Query("desc", description="Sort order: asc or desc"),
    visibility: Optional[str] = Query(None, description="Filter by visibility: public, private, hidden"),
    enabled: Optional[bool] = Query(None, description="Filter by enabled status"),
    admin_view: bool = Query(False, description="Include all rules regardless of visibility (admin only)"),
    db: Session = Depends(get_db)
):
    query = db.query(Rule).filter(Rule.is_active == True)
    
    # Apply visibility and enabled filters (unless admin view)
    if not admin_view:
        query = query.filter(Rule.visibility == "public")
        query = query.filter(Rule.enabled == True)
    else:
        # Admin view - apply filters if specified
        if visibility:
            query = query.filter(Rule.visibility == visibility)
        if enabled is not None:
            query = query.filter(Rule.enabled == enabled)
    
    # Apply sorting
    if sort_by:
        if sort_by == "name":
            order_func = asc(Rule.name) if sort_order == "asc" else desc(Rule.name)
        elif sort_by == "created_date":
            order_func = asc(Rule.created_date) if sort_order == "asc" else desc(Rule.created_date)
        elif sort_by == "modified_date":
            order_func = asc(Rule.modified_date) if sort_order == "asc" else desc(Rule.modified_date)
        else:
            # Default to created_date desc if invalid sort_by
            order_func = desc(Rule.created_date)
        query = query.order_by(order_func)
    else:
        # Default sorting by created_date desc
        query = query.order_by(desc(Rule.created_date))
    
    rules = query.offset(skip).limit(limit).all()
    return rules

@router.get("/{rule_id}", response_model=RuleResponse)
async def get_rule(
    rule_id: str, 
    admin_view: bool = Query(False, description="Include hidden rules (admin only)"),
    db: Session = Depends(get_db)
):
    query = db.query(Rule).filter(Rule.id == rule_id, Rule.is_active == True)
    
    # Apply visibility filter unless admin view
    if not admin_view:
        query = query.filter(Rule.visibility == "public")
        query = query.filter(Rule.enabled == True)
    
    rule = query.first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule

@router.put("/{rule_id}", response_model=RuleResponse)
async def update_rule(rule_id: str, rule_update: RuleCreate, db: Session = Depends(get_db)):
    rule = db.query(Rule).filter(Rule.id == rule_id, Rule.is_active == True).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    for key, value in rule_update.dict().items():
        setattr(rule, key, value)
    
    db.commit()
    db.refresh(rule)
    return rule

@router.delete("/bulk")
async def bulk_delete_rules(rule_ids: List[str], db: Session = Depends(get_db)):
    """Bulk delete multiple rules by setting is_active to False"""
    if not rule_ids:
        raise HTTPException(status_code=400, detail="No rule IDs provided")
    
    # Find all rules that exist and are active
    rules = db.query(Rule).filter(
        Rule.id.in_(rule_ids), 
        Rule.is_active == True
    ).all()
    
    if not rules:
        raise HTTPException(status_code=404, detail="No active rules found with provided IDs")
    
    # Set all found rules to inactive
    for rule in rules:
        rule.is_active = False
    
    db.commit()
    
    return {
        "message": f"Successfully deleted {len(rules)} rules",
        "deleted_count": len(rules),
        "deleted_ids": [rule.id for rule in rules]
    }

@router.delete("/{rule_id}")
async def delete_rule(rule_id: str, db: Session = Depends(get_db)):
    rule = db.query(Rule).filter(Rule.id == rule_id, Rule.is_active == True).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    rule.is_active = False
    db.commit()
    return {"message": "Rule deleted successfully"}

@router.patch("/{rule_id}/admin", response_model=RuleResponse)
async def admin_update_rule(rule_id: str, admin_update: RuleAdminUpdate, db: Session = Depends(get_db)):
    """Admin endpoint to update rule visibility and enabled status"""
    rule = db.query(Rule).filter(Rule.id == rule_id, Rule.is_active == True).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    # Update only the fields provided in the admin update
    update_data = admin_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(rule, key, value)
    
    db.commit()
    db.refresh(rule)
    return rule

@router.post("/{rule_id}/clone", response_model=RuleResponse)
async def clone_rule(rule_id: str, request: dict, db: Session = Depends(get_db)):
    """Clone an existing rule with a new name and ID"""
    # Find the original rule
    original_rule = db.query(Rule).filter(Rule.id == rule_id, Rule.is_active == True).first()
    if not original_rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    # Extract new_name from request body
    new_name = request.get('new_name')
    if not new_name:
        raise HTTPException(status_code=400, detail="new_name is required in request body")
    
    # Check if a rule with the new name already exists
    existing_rule = db.query(Rule).filter(Rule.name == new_name, Rule.is_active == True).first()
    if existing_rule:
        raise HTTPException(status_code=400, detail=f"A rule with the name '{new_name}' already exists")
    
    # Create a new rule with the same data but new ID and name
    cloned_rule_data = {
        'name': new_name,
        'description': original_rule.description,
        'owner_name': original_rule.owner_name,
        'owner_id': original_rule.owner_id,
        'organization': original_rule.organization,
        'disease_area_study': original_rule.disease_area_study,
        'tags': original_rule.tags.copy() if original_rule.tags else [],
        'ruleset_conditions': original_rule.ruleset_conditions.copy() if original_rule.ruleset_conditions else [],
        'column_mapping': original_rule.column_mapping.copy() if original_rule.column_mapping else {},
        'weight': original_rule.weight,
        'visibility': original_rule.visibility,
        'enabled': original_rule.enabled
    }
    
    # Create the cloned rule
    cloned_rule = Rule(**cloned_rule_data)
    db.add(cloned_rule)
    db.commit()
    db.refresh(cloned_rule)
    
    return cloned_rule

@router.post("/{rule_id}/test")
async def test_rule(rule_id: str, sample_data: dict, db: Session = Depends(get_db)):
    rule = db.query(Rule).filter(Rule.id == rule_id, Rule.is_active == True).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    rule_engine = RuleEngine()
    result = rule_engine.test_rule(rule, sample_data)
    return {"result": result}