import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.models.database import SessionLocal, engine, Base
from app.models.rule import Rule
from app.models.rubric import Rubric
from app.models.rubric_rule import RubricRule
import uuid
from datetime import datetime
import pandas as pd

def parse_r_condition(condition_str):
    """Parse R-style condition string to Python format"""
    # Replace R-specific syntax with Python equivalents
    condition = condition_str.replace("NA_real_", "None")
    condition = condition.replace("&", "and")
    condition = condition.replace("|", "or")
    return condition

def load_rules_from_tsv(file_path):
    """Load rules from TSV file"""
    df = pd.read_csv(file_path, sep='\t')
    
    rules = []
    for _, row in df.iterrows():
        # Parse column mapping
        column_mapping = {}
        if pd.notna(row['column_mapping_to_ruleset']):
            # Extract variable mappings from R list format
            mapping_str = row['column_mapping_to_ruleset']
            if 'list(' in mapping_str:
                # Simple parsing of R list format
                mapping_str = mapping_str.replace('list(', '').replace(')', '')
                # Split by commas and extract key-value pairs
                pairs = mapping_str.split(',')
                for pair in pairs:
                    if '=' in pair:
                        key, value = pair.split('=', 1)
                        key = key.strip()
                        value = value.strip()
                        # Remove e$gene_table$ prefix and quotes
                        value = value.replace("e$gene_table$", "").replace("'", "").replace("\"", "")
                        column_mapping[key] = value
        
        rule = {
            'name': row['name'],
            'description': row['rulesetDesc'] if pd.notna(row['rulesetDesc']) else f"Rule for {row['name']}",
            'owner_name': 'System',
            'organization': 'Example Organization',
            'disease_area_study': 'LUSC',
            'tags': ['example', 'lusc', 'system-loaded'],
            'ruleset_conditions': [
                "x > 0.5 ~ 6",
                "x > 0.3 and x <= 0.5 ~ 4", 
                "x > 0.1 and x <= 0.3 ~ 2",
                "True ~ None"
            ],  # Default conditions for now
            'column_mapping': column_mapping if column_mapping else {"x": row['name'].lower()},
            'weight': 1.0,
            'is_active': True
        }
        rules.append(rule)
    
    return rules

def load_rules_from_txt(file_path):
    """Load rules from the original TXT file with complete rule definitions"""
    df = pd.read_csv(file_path, sep='\t')
    
    rules = []
    for _, row in df.iterrows():
        # Parse ruleset conditions from R list format
        conditions = []
        if pd.notna(row['ruleset']):
            ruleset_str = row['ruleset']
            if 'list(' in ruleset_str:
                # Extract conditions from R list
                ruleset_str = ruleset_str.replace('list(', '').replace(')', '')
                # Split by commas but handle quoted strings
                condition_parts = []
                current_part = ""
                in_quotes = False
                
                for char in ruleset_str:
                    if char == '"' or char == "'":
                        in_quotes = not in_quotes
                    elif char == ',' and not in_quotes:
                        condition_parts.append(current_part.strip())
                        current_part = ""
                        continue
                    current_part += char
                
                if current_part:
                    condition_parts.append(current_part.strip())
                
                for condition in condition_parts:
                    if '~' in condition:
                        conditions.append(condition.strip())
        
        # Parse column mapping
        column_mapping = {}
        if pd.notna(row['column_mapping']):
            mapping_str = row['column_mapping']
            if 'list(' in mapping_str:
                mapping_str = mapping_str.replace('list(', '').replace(')', '')
                pairs = mapping_str.split(',')
                for pair in pairs:
                    if '=' in pair:
                        key, value = pair.split('=', 1)
                        key = key.strip()
                        value = value.strip()
                        value = value.replace("e$gene_table$", "").replace("'", "").replace("\"", "")
                        column_mapping[key] = value
        
        rule = {
            'name': row['name'],
            'description': row['description'] if pd.notna(row['description']) else f"Rule for {row['name']}",
            'owner_name': 'System',
            'organization': 'Example Organization',
            'disease_area_study': 'LUSC',
            'tags': ['example', 'lusc', 'system-loaded', 'complete-ruleset'],
            'ruleset_conditions': conditions if conditions else [
                "x > 0.5 ~ 6",
                "x > 0.3 and x <= 0.5 ~ 4", 
                "x > 0.1 and x <= 0.3 ~ 2",
                "True ~ None"
            ],
            'column_mapping': column_mapping if column_mapping else {"x": row['name'].lower()},
            'weight': 1.0,
            'is_active': True
        }
        rules.append(rule)
    
    return rules

def create_example_rubric(db: Session, rule_ids):
    """Create an example rubric with the loaded rules"""
    rubric = Rubric(
        id=uuid.uuid4(),
        name="LUSC Complete Analysis Rubric",
        description="Complete rubric for LUSC analysis using all available rules",
        owner_name="System",
        organization="Example Organization",
        disease_area_study="LUSC",
        tags=["example", "complete", "lusc"],
        is_active=True
    )
    db.add(rubric)
    db.commit()
    db.refresh(rubric)
    
    # Add rules to rubric with weights
    for i, rule_id in enumerate(rule_ids):
        rubric_rule = RubricRule(
            rubric_id=rubric.id,
            rule_id=rule_id,
            weight=1.0,
            order_index=i,
            is_active=True
        )
        db.add(rubric_rule)
    
    db.commit()
    return rubric

def main():
    """Main function to load example data"""
    # Create database tables
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        # Load rules from the complete TXT file
        print("Loading rules from rules.model.txt...")
        rules_data = load_rules_from_txt('/Users/zayed/Downloads/ai_apps/rubricrunner/models/rules.model.txt')
        
        rule_ids = []
        for rule_data in rules_data:
            rule = Rule(**rule_data)
            db.add(rule)
            db.flush()
            rule_ids.append(rule.id)
        
        db.commit()
        print(f"Loaded {len(rule_ids)} rules successfully")
        
        # Create example rubric
        print("Creating example rubric...")
        rubric = create_example_rubric(db, rule_ids)
        print(f"Created rubric: {rubric.name} with {len(rule_ids)} rules")
        
        # Copy example data file to uploads directory
        import shutil
        uploads_dir = '/Users/zayed/Downloads/ai_apps/rubricrunner/backend/uploads'
        os.makedirs(uploads_dir, exist_ok=True)
        
        src_file = '/Users/zayed/Downloads/ai_apps/rubricrunner/data/lusc_input.xlsx'
        dst_file = os.path.join(uploads_dir, 'lusc_example_data.xlsx')
        shutil.copy2(src_file, dst_file)
        print(f"Copied example data to {dst_file}")
        
        # Create a project with the example data
        from app.models.project import Project
        project = Project(
            id=uuid.uuid4(),
            name="LUSC Example Analysis",
            description="Example project using LUSC data and complete rule set",
            owner_name="System",
            organization="Example Organization",
            input_data_file=dst_file,
            applied_rules=[],
            applied_rubrics=[],
            results=None,
            execution_history=[]
        )
        db.add(project)
        db.commit()
        print(f"Created example project: {project.name}")
        
        print("\nExample data loaded successfully!")
        print(f"- {len(rule_ids)} rules loaded")
        print(f"- 1 rubric created with all rules")
        print(f"- 1 project created with example data")
        print(f"\nProject ID: {project.id}")
        print(f"Rubric ID: {rubric.id}")
        
    except Exception as e:
        print(f"Error loading example data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()