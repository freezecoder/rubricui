from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.models.database import get_db
from app.models.rubric import Rubric
from app.models.rubric_rule import RubricRule
from app.schemas.rubric import RubricCreate, RubricResponse, RubricRuleCreate
from app.services.rubric_engine import RubricEngine
import uuid

router = APIRouter()

@router.post("/", response_model=RubricResponse)
async def create_rubric(rubric: RubricCreate, db: Session = Depends(get_db)):
    db_rubric = Rubric(**rubric.dict())
    db.add(db_rubric)
    db.commit()
    db.refresh(db_rubric)
    return db_rubric

@router.get("/", response_model=List[RubricResponse])
async def list_rubrics(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    rubrics = db.query(Rubric).filter(Rubric.is_active == True).offset(skip).limit(limit).all()
    return rubrics

@router.get("/{rubric_id}", response_model=RubricResponse)
async def get_rubric(rubric_id: str, db: Session = Depends(get_db)):
    rubric = db.query(Rubric).filter(Rubric.id == rubric_id, Rubric.is_active == True).first()
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")
    return rubric

@router.put("/{rubric_id}", response_model=RubricResponse)
async def update_rubric(rubric_id: str, rubric_update: RubricCreate, db: Session = Depends(get_db)):
    rubric = db.query(Rubric).filter(Rubric.id == rubric_id, Rubric.is_active == True).first()
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")
    
    for key, value in rubric_update.dict().items():
        setattr(rubric, key, value)
    
    db.commit()
    db.refresh(rubric)
    return rubric

@router.delete("/{rubric_id}")
async def delete_rubric(rubric_id: uuid.UUID, db: Session = Depends(get_db)):
    rubric = db.query(Rubric).filter(Rubric.id == rubric_id, Rubric.is_active == True).first()
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")
    
    rubric.is_active = False
    db.commit()
    return {"message": "Rubric deleted successfully"}

@router.post("/{rubric_id}/rules")
async def add_rule_to_rubric(
    rubric_id: uuid.UUID, 
    rule_data: RubricRuleCreate, 
    db: Session = Depends(get_db)
):
    rubric = db.query(Rubric).filter(Rubric.id == rubric_id, Rubric.is_active == True).first()
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")
    
    # Check if rule exists
    from app.models.rule import Rule
    rule = db.query(Rule).filter(Rule.id == rule_data.rule_id, Rule.is_active == True).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    # Create association
    rubric_rule = RubricRule(
        rubric_id=rubric_id,
        rule_id=rule_data.rule_id,
        weight=rule_data.weight,
        order_index=rule_data.order_index
    )
    db.add(rubric_rule)
    db.commit()
    db.refresh(rubric_rule)
    return rubric_rule

@router.delete("/{rubric_id}/rules/{rule_id}")
async def remove_rule_from_rubric(rubric_id: uuid.UUID, rule_id: uuid.UUID, db: Session = Depends(get_db)):
    rubric_rule = db.query(RubricRule).filter(
        RubricRule.rubric_id == rubric_id,
        RubricRule.rule_id == rule_id
    ).first()
    
    if not rubric_rule:
        raise HTTPException(status_code=404, detail="Rule not found in rubric")
    
    db.delete(rubric_rule)
    db.commit()
    return {"message": "Rule removed from rubric successfully"}