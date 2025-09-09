from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from app.models.database import get_db
from app.models.rubric import Rubric
from app.models.rubric_rule import RubricRule
from app.models.rule import Rule
from app.schemas.rubric import RubricCreate, RubricResponse, RubricRuleCreate, RubricAdminUpdate
from app.services.rubric_engine import RubricEngine
import uuid
import csv
import io
import pandas as pd
import json

router = APIRouter()

@router.post("/", response_model=RubricResponse)
async def create_rubric(rubric: RubricCreate, db: Session = Depends(get_db)):
    db_rubric = Rubric(**rubric.dict())
    db.add(db_rubric)
    db.commit()
    db.refresh(db_rubric)
    return db_rubric

@router.post("/upload-tsv", response_model=RubricResponse)
async def create_rubric_from_tsv(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    owner_name: Optional[str] = Form(None),
    organization: Optional[str] = Form(None),
    disease_area_study: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    visibility: str = Form("public"),
    enabled: bool = Form(True),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Create a rubric from a TSV/CSV file containing rules"""
    
    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    if not file.filename.endswith(('.tsv', '.txt', '.csv', '.xlsx')):
        raise HTTPException(
            status_code=400, 
            detail="Unsupported file format. Please upload TSV (.tsv), CSV (.csv), Excel (.xlsx), or text (.txt) files."
        )
    
    # Parse tags
    tag_list = []
    if tags:
        tag_list = [tag.strip() for tag in tags.split(',') if tag.strip()]
    
    # Create the rubric first
    rubric_data = RubricCreate(
        name=name,
        description=description,
        owner_name=owner_name,
        organization=organization,
        disease_area_study=disease_area_study,
        tags=tag_list,
        visibility=visibility,
        enabled=enabled
    )
    
    db_rubric = Rubric(**rubric_data.dict())
    db.add(db_rubric)
    db.commit()
    db.refresh(db_rubric)
    
    try:
        # Read and parse file based on file type
        content = await file.read()
        
        if file.filename.endswith('.xlsx'):
            # Parse Excel file
            df = pd.read_excel(io.BytesIO(content))
            # Convert DataFrame to list of dictionaries
            file_data = df.to_dict('records')
        else:
            # Parse CSV/TSV file
            content_str = content.decode('utf-8')
            
            # Detect delimiter and parse content
            # Try to detect delimiter by checking the first line
            first_line = content_str.split('\n')[0] if content_str else ''
            delimiter = '\t'  # Default to tab
            if ',' in first_line and first_line.count(',') > first_line.count('\t'):
                delimiter = ','
            
            # Parse content with detected delimiter
            file_reader = csv.DictReader(io.StringIO(content_str), delimiter=delimiter)
            file_data = list(file_reader)
        
        # Validate required columns
        required_columns = ['name', 'rulesetDesc', 'ruleset', 'varList']
        if file_data and not all(col in file_data[0].keys() for col in required_columns):
            raise HTTPException(
                status_code=400,
                detail=f"File must contain columns: {', '.join(required_columns)}"
            )
        
        # Process each row and create rules
        rules_created = 0
        for row_num, row in enumerate(file_data, start=2):  # Start at 2 because of header
            try:
                # Create rule from file row
                # Handle NaN values from Excel files
                def safe_str(value):
                    return str(value) if pd.notna(value) else ''
                
                # Parse the ruleset conditions - split by newlines or semicolons
                ruleset_conditions = []
                ruleset_value = safe_str(row.get('ruleset', ''))
                if ruleset_value.strip():
                    # Split by newlines first, then by semicolons
                    conditions = ruleset_value.strip().replace('\n', ';').split(';')
                    ruleset_conditions = [cond.strip() for cond in conditions if cond.strip()]
                else:
                    # If no ruleset, create a default condition
                    ruleset_conditions = ['TRUE ~ 0']
                
                # Parse the variable mapping from varList
                column_mapping = {}
                var_list_value = safe_str(row.get('varList', ''))
                if var_list_value.strip():
                    # Parse varList format: list(x=e$gene_table$column1, y=e$gene_table$column2)
                    var_list_str = var_list_value.strip()
                    if var_list_str.startswith('list(') and var_list_str.endswith(')'):
                        # Extract the content inside list()
                        content = var_list_str[5:-1]  # Remove 'list(' and ')'
                        # Split by comma and parse each variable
                        variables = content.split(',')
                        for var in variables:
                            var = var.strip()
                            if '=' in var:
                                var_name, var_value = var.split('=', 1)
                                var_name = var_name.strip()
                                var_value = var_value.strip()
                                # Extract column name from e$gene_table$column format
                                if 'e$gene_table$' in var_value:
                                    column_name = var_value.split('e$gene_table$')[-1]
                                    column_mapping[var_name] = column_name
                                else:
                                    column_mapping[var_name] = var_value
                
                rule_data = {
                    'name': safe_str(row.get('name', '')).strip(),
                    'description': safe_str(row.get('rulesetDesc', '')).strip(),
                    'ruleset_conditions': ruleset_conditions,
                    'column_mapping': column_mapping,
                    'owner_name': owner_name,
                    'organization': organization,
                    'disease_area_study': disease_area_study,
                    'tags': tag_list,
                    'visibility': visibility,
                    'enabled': enabled,
                    'weight': 1.0
                }
                
                # Create the rule
                db_rule = Rule(**rule_data)
                db.add(db_rule)
                db.flush()  # Flush to get the rule ID
                
                # Add rule to rubric
                rubric_rule = RubricRule(
                    rubric_id=db_rubric.id,
                    rule_id=db_rule.id,
                    weight=1.0,
                    order_index=rules_created
                )
                db.add(rubric_rule)
                rules_created += 1
                
            except Exception as e:
                # Log the error but continue processing other rows
                print(f"Error processing row {row_num}: {str(e)}")
                continue
        
        db.commit()
        
        # Return the created rubric with rule count
        response = RubricResponse.from_orm(db_rubric)
        return response
        
    except Exception as e:
        # If there's an error processing the file, clean up the created rubric
        db.delete(db_rubric)
        db.commit()
        raise HTTPException(
            status_code=400,
            detail=f"Error processing file: {str(e)}"
        )

@router.post("/upload-json", response_model=RubricResponse)
async def create_rubric_from_json(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    owner_name: Optional[str] = Form(None),
    organization: Optional[str] = Form(None),
    disease_area_study: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    visibility: str = Form("public"),
    enabled: bool = Form(True),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload a JSON file containing rules with proper nested ruleset structure"""
    
    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    if not file.filename.endswith('.json'):
        raise HTTPException(
            status_code=400, 
            detail="Unsupported file format. Please upload JSON (.json) files."
        )
    
    # Parse tags
    tag_list = []
    if tags:
        tag_list = [tag.strip() for tag in tags.split(',') if tag.strip()]
    
    # Create the rubric first
    rubric_data = RubricCreate(
        name=name,
        description=description,
        owner_name=owner_name,
        organization=organization,
        disease_area_study=disease_area_study,
        tags=tag_list,
        visibility=visibility,
        enabled=enabled
    )
    
    db_rubric = Rubric(**rubric_data.dict())
    db.add(db_rubric)
    db.commit()
    db.refresh(db_rubric)
    
    try:
        # Read and parse JSON file
        content = await file.read()
        content_str = content.decode('utf-8')
        
        # Parse JSON content
        try:
            # The JSON file contains a string that needs to be parsed again
            json_data = json.loads(content_str)
            if isinstance(json_data, list) and len(json_data) > 0:
                # If it's a list with one string element, parse that string
                if isinstance(json_data[0], str):
                    rules_data = json.loads(json_data[0])
                else:
                    rules_data = json_data
            else:
                rules_data = json_data
        except json.JSONDecodeError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid JSON format: {str(e)}"
            )
        
        # Validate that we have a list of rules
        if not isinstance(rules_data, list):
            raise HTTPException(
                status_code=400,
                detail="JSON file must contain a list of rules"
            )
        
        # Process each rule
        rules_created = 0
        for rule_num, rule_data in enumerate(rules_data, start=1):
            try:
                # Extract rule information
                rule_name = rule_data.get('name', '').strip()
                rule_description = rule_data.get('rulesetDesc', '').strip()
                ruleset = rule_data.get('ruleset', [])
                var_list = rule_data.get('varList', '')
                
                if not rule_name:
                    print(f"Skipping rule {rule_num}: No name provided")
                    continue
                
                # Parse ruleset conditions from nested array structure
                ruleset_conditions = []
                if isinstance(ruleset, list):
                    for condition_group in ruleset:
                        if isinstance(condition_group, list):
                            # Each group contains conditions like ["x < 10 ~ 4"]
                            for condition in condition_group:
                                if isinstance(condition, str) and condition.strip():
                                    ruleset_conditions.append(condition.strip())
                        elif isinstance(condition_group, str) and condition_group.strip():
                            # Direct string condition
                            ruleset_conditions.append(condition_group.strip())
                
                # If no conditions found, create a default
                if not ruleset_conditions:
                    ruleset_conditions = ['TRUE ~ 0']
                
                # Parse the variable mapping from varList
                column_mapping = {}
                if var_list and isinstance(var_list, str):
                    var_list_str = var_list.strip()
                    if var_list_str.startswith('list(') and var_list_str.endswith(')'):
                        # Extract the content inside list()
                        content = var_list_str[5:-1]  # Remove 'list(' and ')'
                        # Split by comma and parse each variable
                        variables = content.split(',')
                        for var in variables:
                            var = var.strip()
                            if '=' in var:
                                var_name, var_value = var.split('=', 1)
                                var_name = var_name.strip()
                                var_value = var_value.strip()
                                # Extract column name from e$gene_table$column format
                                if 'e$gene_table$' in var_value:
                                    column_name = var_value.split('e$gene_table$')[-1]
                                    column_mapping[var_name] = column_name
                                else:
                                    column_mapping[var_name] = var_value
                
                # Create rule data
                rule_create_data = {
                    'name': rule_name,
                    'description': rule_description,
                    'ruleset_conditions': ruleset_conditions,
                    'column_mapping': column_mapping,
                    'owner_name': owner_name,
                    'organization': organization,
                    'disease_area_study': disease_area_study,
                    'tags': tag_list,
                    'visibility': visibility,
                    'enabled': enabled,
                    'weight': 1.0
                }
                
                # Create the rule
                db_rule = Rule(**rule_create_data)
                db.add(db_rule)
                db.flush()  # Flush to get the rule ID
                
                # Add rule to rubric
                rubric_rule = RubricRule(
                    rubric_id=db_rubric.id,
                    rule_id=db_rule.id,
                    weight=1.0,
                    order_index=rules_created
                )
                db.add(rubric_rule)
                rules_created += 1
                
            except Exception as e:
                # Log the error but continue processing other rules
                print(f"Error processing rule {rule_num}: {str(e)}")
                continue
        
        db.commit()
        
        # Return the created rubric with rule count
        response = RubricResponse.from_orm(db_rubric)
        return response
        
    except Exception as e:
        # If there's an error processing the file, clean up the created rubric
        db.delete(db_rubric)
        db.commit()
        raise HTTPException(
            status_code=400,
            detail=f"Error processing JSON file: {str(e)}"
        )

@router.get("/", response_model=List[RubricResponse])
async def list_rubrics(
    skip: int = 0, 
    limit: int = 100,
    visibility: Optional[str] = Query(None, description="Filter by visibility: public, private, hidden"),
    enabled: Optional[bool] = Query(None, description="Filter by enabled status"),
    admin_view: bool = Query(False, description="Include all rubrics regardless of visibility (admin only)"),
    db: Session = Depends(get_db)
):
    query = db.query(Rubric).filter(Rubric.is_active == True)
    
    # Apply visibility and enabled filters (unless admin view)
    if not admin_view:
        query = query.filter(Rubric.visibility == "public")
        query = query.filter(Rubric.enabled == True)
    else:
        # Admin view - apply filters if specified
        if visibility:
            query = query.filter(Rubric.visibility == visibility)
        if enabled is not None:
            query = query.filter(Rubric.enabled == enabled)
    
    rubrics = query.offset(skip).limit(limit).all()
    return rubrics

@router.get("/{rubric_id}", response_model=RubricResponse)
async def get_rubric(
    rubric_id: str, 
    admin_view: bool = Query(False, description="Include hidden rubrics (admin only)"),
    db: Session = Depends(get_db)
):
    query = db.query(Rubric).filter(Rubric.id == rubric_id, Rubric.is_active == True)
    
    # Apply visibility filter unless admin view
    if not admin_view:
        query = query.filter(Rubric.visibility == "public")
        query = query.filter(Rubric.enabled == True)
    
    rubric = query.first()
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
async def delete_rubric(rubric_id: str, db: Session = Depends(get_db)):
    rubric = db.query(Rubric).filter(Rubric.id == rubric_id, Rubric.is_active == True).first()
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")
    
    rubric.is_active = False
    db.commit()
    return {"message": "Rubric deleted successfully"}

@router.post("/{rubric_id}/rules")
async def add_rule_to_rubric(
    rubric_id: str, 
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

@router.get("/{rubric_id}/rules")
async def get_rubric_rules(rubric_id: str, db: Session = Depends(get_db)):
    from app.models.rule import Rule
    
    rubric_rules = db.query(RubricRule).filter(
        RubricRule.rubric_id == rubric_id,
        RubricRule.is_active == True
    ).order_by(RubricRule.order_index).all()
    
    # Get the associated rules
    result = []
    for rubric_rule in rubric_rules:
        rule = db.query(Rule).filter(Rule.id == rubric_rule.rule_id, Rule.is_active == True).first()
        if rule:
            result.append({
                "id": rubric_rule.id,
                "rubric_id": rubric_rule.rubric_id,
                "rule_id": rubric_rule.rule_id,
                "weight": rubric_rule.weight,
                "order_index": rubric_rule.order_index,
                "is_active": rubric_rule.is_active,
                "rule": rule
            })
    
    return result

@router.patch("/{rubric_id}/admin", response_model=RubricResponse)
async def admin_update_rubric(rubric_id: str, admin_update: RubricAdminUpdate, db: Session = Depends(get_db)):
    """Admin endpoint to update rubric visibility and enabled status"""
    rubric = db.query(Rubric).filter(Rubric.id == rubric_id, Rubric.is_active == True).first()
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")
    
    # Update only the fields provided in the admin update
    update_data = admin_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(rubric, key, value)
    
    db.commit()
    db.refresh(rubric)
    return rubric

@router.post("/{rubric_id}/clone", response_model=RubricResponse)
async def clone_rubric(rubric_id: str, request: dict, db: Session = Depends(get_db)):
    """Clone an existing rubric with a new name and ID
    
    Options for rules:
    - copy_rules=True: Create copies of all rules (default)
    - copy_rules=False: Share the same rules between rubrics
    """
    # Find the original rubric
    original_rubric = db.query(Rubric).filter(Rubric.id == rubric_id, Rubric.is_active == True).first()
    if not original_rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")
    
    # Extract parameters from request body
    new_name = request.get('new_name')
    copy_rules = request.get('copy_rules', True)  # Default to copying rules
    
    if not new_name:
        raise HTTPException(status_code=400, detail="new_name is required in request body")
    
    # Check if a rubric with the new name already exists
    existing_rubric = db.query(Rubric).filter(Rubric.name == new_name, Rubric.is_active == True).first()
    if existing_rubric:
        raise HTTPException(status_code=400, detail=f"A rubric with the name '{new_name}' already exists")
    
    # Get all rules associated with the original rubric
    rubric_rules = db.query(RubricRule).filter(
        RubricRule.rubric_id == rubric_id,
        RubricRule.is_active == True
    ).order_by(RubricRule.order_index).all()
    
    if not rubric_rules:
        raise HTTPException(status_code=400, detail="Cannot clone rubric: no rules found in original rubric")
    
    # Create the new rubric
    cloned_rubric_data = {
        'name': new_name,
        'description': original_rubric.description,
        'owner_name': original_rubric.owner_name,
        'owner_id': original_rubric.owner_id,
        'organization': original_rubric.organization,
        'disease_area_study': original_rubric.disease_area_study,
        'tags': original_rubric.tags.copy() if original_rubric.tags else [],
        'visibility': original_rubric.visibility,
        'enabled': original_rubric.enabled
    }
    
    cloned_rubric = Rubric(**cloned_rubric_data)
    db.add(cloned_rubric)
    db.flush()  # Flush to get the new rubric ID
    
    if copy_rules:
        # Clone each rule and add it to the new rubric
        for rubric_rule in rubric_rules:
            # Get the original rule
            original_rule = db.query(Rule).filter(Rule.id == rubric_rule.rule_id, Rule.is_active == True).first()
            if not original_rule:
                continue  # Skip if rule doesn't exist
            
            # Create a new rule with the same data but new ID
            cloned_rule_data = {
                'name': f"{original_rule.name} (Copy)",
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
            
            cloned_rule = Rule(**cloned_rule_data)
            db.add(cloned_rule)
            db.flush()  # Flush to get the new rule ID
            
            # Create the rubric-rule association
            new_rubric_rule = RubricRule(
                rubric_id=cloned_rubric.id,
                rule_id=cloned_rule.id,
                weight=rubric_rule.weight,
                order_index=rubric_rule.order_index
            )
            db.add(new_rubric_rule)
    else:
        # Share the same rules between rubrics
        for rubric_rule in rubric_rules:
            # Create new rubric-rule association with the same rule ID
            new_rubric_rule = RubricRule(
                rubric_id=cloned_rubric.id,
                rule_id=rubric_rule.rule_id,
                weight=rubric_rule.weight,
                order_index=rubric_rule.order_index
            )
            db.add(new_rubric_rule)
    
    db.commit()
    db.refresh(cloned_rubric)
    
    return cloned_rubric

@router.delete("/{rubric_id}/rules/{rule_id}")
async def remove_rule_from_rubric(rubric_id: str, rule_id: str, db: Session = Depends(get_db)):
    rubric_rule = db.query(RubricRule).filter(
        RubricRule.rubric_id == rubric_id,
        RubricRule.rule_id == rule_id
    ).first()
    
    if not rubric_rule:
        raise HTTPException(status_code=404, detail="Rule not found in rubric")
    
    db.delete(rubric_rule)
    db.commit()
    return {"message": "Rule removed from rubric successfully"}