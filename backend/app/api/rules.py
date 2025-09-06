from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from typing import List, Optional
from app.models.database import get_db
from app.models.rule import Rule
from app.schemas.rule import RuleCreate, RuleResponse
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
    db: Session = Depends(get_db)
):
    query = db.query(Rule).filter(Rule.is_active == True)
    
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
async def get_rule(rule_id: str, db: Session = Depends(get_db)):
    rule = db.query(Rule).filter(Rule.id == rule_id, Rule.is_active == True).first()
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

@router.delete("/{rule_id}")
async def delete_rule(rule_id: str, db: Session = Depends(get_db)):
    rule = db.query(Rule).filter(Rule.id == rule_id, Rule.is_active == True).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    rule.is_active = False
    db.commit()
    return {"message": "Rule deleted successfully"}

@router.post("/{rule_id}/test")
async def test_rule(rule_id: str, sample_data: dict, db: Session = Depends(get_db)):
    rule = db.query(Rule).filter(Rule.id == rule_id, Rule.is_active == True).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    rule_engine = RuleEngine()
    result = rule_engine.test_rule(rule, sample_data)
    return {"result": result}