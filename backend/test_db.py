import sys
import os
sys.path.append('.')

# Set environment variable for SQLite
os.environ['DATABASE_URL'] = 'sqlite:///./rubrics.db'

from app.models.database import SessionLocal
from app.models.rule import Rule
from app.models.rubric import Rubric
from app.models.project import Project

def test_database():
    """Test database connection and contents"""
    session = SessionLocal()
    try:
        # Check all rules (including inactive)
        all_rules = session.query(Rule).all()
        active_rules = session.query(Rule).filter(Rule.is_active == True).all()
        
        print(f'✅ Database connected successfully')
        print(f'📋 Total rules: {len(all_rules)}')
        print(f'📋 Active rules: {len(active_rules)}')
        
        if all_rules:
            print(f'🎯 First rule: {all_rules[0].name}')
            print(f'   Active: {all_rules[0].is_active}')
            print(f'   Conditions: {len(all_rules[0].ruleset_conditions)}')
        
        # Check rubrics
        all_rubrics = session.query(Rubric).all()
        print(f'📊 Total rubrics: {len(all_rubrics)}')
        
        if all_rubrics:
            print(f'🎯 First rubric: {all_rubrics[0].name}')
        
        # Check projects
        all_projects = session.query(Project).all()
        print(f'📁 Total projects: {len(all_projects)}')
        
        if all_projects:
            print(f'🎯 First project: {all_projects[0].name}')
            print(f'   Data file: {all_projects[0].input_data_file is not None}')
            
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    test_database()