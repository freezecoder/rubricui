#!/usr/bin/env python3
"""
Standalone Analysis Executor

This script reads a YAML configuration file exported from the frontend
and executes the analysis independently for reproducibility and debugging.

Usage:
    python standalone_analysis_executor.py <config.yaml> [options]

Options:
    --output-dir DIR     Output directory for results (default: ./results)
    --verbose           Enable verbose logging
    --dry-run          Validate configuration without executing
    --help             Show this help message
"""

import argparse
import yaml
import sys
import os
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List
import pandas as pd
import numpy as np

# Add the backend app directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.models.database import SessionLocal, engine
from app.models.rule import Rule
from app.models.rubric import Rubric
from app.models.rubric_rule import RubricRule
from app.models.dataset import Dataset
from app.models.project import Project
from app.services.analysis_executor import AnalysisExecutor
from app.services.file_processor import FileProcessor
from app.services.rule_engine import RuleEngine
from app.services.rubric_engine import RubricEngine

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('standalone_analysis.log')
    ]
)
logger = logging.getLogger(__name__)

class StandaloneAnalysisExecutor:
    def __init__(self, config_path: str, output_dir: str = "./results", verbose: bool = False):
        self.config_path = config_path
        self.output_dir = Path(output_dir)
        self.verbose = verbose
        self.config = None
        self.db_session = None
        
        # Create output directory
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        if verbose:
            logging.getLogger().setLevel(logging.DEBUG)
    
    def load_config(self) -> Dict[str, Any]:
        """Load and validate YAML configuration"""
        try:
            with open(self.config_path, 'r') as f:
                self.config = yaml.safe_load(f)
            
            logger.info(f"Loaded configuration from {self.config_path}")
            logger.info(f"Project: {self.config['metadata']['project_name']}")
            logger.info(f"Export date: {self.config['metadata']['export_date']}")
            
            return self.config
        except Exception as e:
            logger.error(f"Failed to load configuration: {e}")
            raise
    
    def validate_config(self) -> bool:
        """Validate the configuration structure and required fields"""
        required_sections = ['metadata', 'analysis', 'project', 'rubric', 'dataset', 'validation']
        
        for section in required_sections:
            if section not in self.config:
                logger.error(f"Missing required section: {section}")
                return False
        
        # Validate analysis parameters
        analysis = self.config['analysis']
        required_analysis_fields = ['project_id', 'rubric_id', 'dataset_id', 'execution_type']
        for field in required_analysis_fields:
            if field not in analysis:
                logger.error(f"Missing required analysis field: {field}")
                return False
        
        # Validate rubric has rules
        if not self.config['rubric']['rules']:
            logger.error("Rubric must have at least one rule")
            return False
        
        logger.info("Configuration validation passed")
        return True
    
    def connect_database(self):
        """Connect to the database"""
        try:
            self.db_session = SessionLocal()
            logger.info("Connected to database")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise
    
    def load_rubric_data(self) -> tuple[List[Rule], Rubric]:
        """Load rubric and its rules from database"""
        try:
            rubric_id = self.config['analysis']['rubric_id']
            
            # Load rubric
            rubric = self.db_session.query(Rubric).filter(Rubric.id == rubric_id).first()
            if not rubric:
                raise ValueError(f"Rubric {rubric_id} not found in database")
            
            # Load rubric rules
            rubric_rules = self.db_session.query(RubricRule).filter(
                RubricRule.rubric_id == rubric_id,
                RubricRule.is_active == True
            ).all()
            
            rule_ids = [rr.rule_id for rr in rubric_rules]
            rules = self.db_session.query(Rule).filter(
                Rule.id.in_(rule_ids),
                Rule.is_active == True
            ).all()
            
            logger.info(f"Loaded rubric '{rubric.name}' with {len(rules)} rules")
            
            return rules, rubric
        except Exception as e:
            logger.error(f"Failed to load rubric data: {e}")
            raise
    
    def load_dataset(self) -> pd.DataFrame:
        """Load dataset from file"""
        try:
            dataset_config = self.config['dataset']
            file_path = dataset_config['file_path']
            
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"Dataset file not found: {file_path}")
            
            file_processor = FileProcessor()
            df = file_processor.process_file_for_analysis(file_path)
            
            logger.info(f"Loaded dataset '{dataset_config['name']}' with {len(df)} rows and {len(df.columns)} columns")
            
            return df
        except Exception as e:
            logger.error(f"Failed to load dataset: {e}")
            raise
    
    def execute_analysis(self, rules: List[Rule], rubric: Rubric, df: pd.DataFrame) -> pd.DataFrame:
        """Execute the analysis using the rubric and rules"""
        try:
            logger.info("Starting analysis execution...")
            
            # Create analysis executor
            executor = AnalysisExecutor()
            
            # Prepare rubric rules mapping
            rubric_rules_map = {str(rubric.id): []}
            
            # Load rubric rules from database for proper mapping
            rubric_rules = self.db_session.query(RubricRule).filter(
                RubricRule.rubric_id == rubric.id,
                RubricRule.is_active == True
            ).all()
            
            # Add rule objects to rubric_rules for easier access
            rule_map = {rule.id: rule for rule in rules}
            for rr in rubric_rules:
                if rr.rule_id in rule_map:
                    rr.rule = rule_map[rr.rule_id]
                    rubric_rules_map[str(rubric.id)].append(rr)
            
            # Execute rubric analysis
            results = executor.execute_rubrics_only([rubric], df, rubric_rules_map)
            
            logger.info(f"Analysis completed. Results shape: {results.shape}")
            
            return results
        except Exception as e:
            logger.error(f"Analysis execution failed: {e}")
            raise
    
    def save_results(self, results: pd.DataFrame) -> str:
        """Save analysis results to file"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            project_name = self.config['metadata']['project_name'].replace(' ', '_')
            rubric_name = self.config['rubric']['name'].replace(' ', '_')
            
            filename = f"{project_name}_{rubric_name}_{timestamp}_results.xlsx"
            output_path = self.output_dir / filename
            
            results.to_excel(output_path, index=False)
            
            logger.info(f"Results saved to: {output_path}")
            
            # Also save a summary
            summary_path = self.output_dir / f"{project_name}_{rubric_name}_{timestamp}_summary.txt"
            with open(summary_path, 'w') as f:
                f.write(f"Analysis Summary\n")
                f.write(f"================\n\n")
                f.write(f"Project: {self.config['metadata']['project_name']}\n")
                f.write(f"Rubric: {self.config['rubric']['name']}\n")
                f.write(f"Dataset: {self.config['dataset']['name']}\n")
                f.write(f"Execution Date: {datetime.now().isoformat()}\n")
                f.write(f"Total Genes: {len(results)}\n")
                f.write(f"Total Rules: {len(self.config['rubric']['rules'])}\n")
                f.write(f"Compatible Rules: {self.config['validation']['compatible_rules']}\n")
                f.write(f"Results File: {output_path}\n")
                
                # Score distribution
                score_columns = [col for col in results.columns if col.endswith('_SCORE')]
                if score_columns:
                    f.write(f"\nScore Distribution:\n")
                    for col in score_columns:
                        if col in results.columns:
                            f.write(f"  {col}: mean={results[col].mean():.3f}, std={results[col].std():.3f}\n")
            
            logger.info(f"Summary saved to: {summary_path}")
            
            return str(output_path)
        except Exception as e:
            logger.error(f"Failed to save results: {e}")
            raise
    
    def generate_debug_report(self, results: pd.DataFrame) -> str:
        """Generate a detailed debug report"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            project_name = self.config['metadata']['project_name'].replace(' ', '_')
            
            debug_path = self.output_dir / f"{project_name}_{timestamp}_debug_report.txt"
            
            with open(debug_path, 'w') as f:
                f.write(f"Debug Report\n")
                f.write(f"============\n\n")
                
                # Configuration details
                f.write(f"Configuration:\n")
                f.write(f"  Project ID: {self.config['analysis']['project_id']}\n")
                f.write(f"  Rubric ID: {self.config['analysis']['rubric_id']}\n")
                f.write(f"  Dataset ID: {self.config['analysis']['dataset_id']}\n")
                f.write(f"  Execution Type: {self.config['analysis']['execution_type']}\n\n")
                
                # Dataset info
                f.write(f"Dataset Information:\n")
                f.write(f"  Name: {self.config['dataset']['name']}\n")
                f.write(f"  File: {self.config['dataset']['file_path']}\n")
                f.write(f"  Rows: {self.config['dataset']['statistics']['total_rows']}\n")
                f.write(f"  Columns: {self.config['dataset']['statistics']['total_columns']}\n")
                f.write(f"  Numeric Columns: {self.config['dataset']['statistics']['numeric_columns']}\n\n")
                
                # Rubric info
                f.write(f"Rubric Information:\n")
                f.write(f"  Name: {self.config['rubric']['name']}\n")
                f.write(f"  Organization: {self.config['rubric']['organization']}\n")
                f.write(f"  Disease Area: {self.config['rubric']['disease_area']}\n")
                f.write(f"  Total Rules: {len(self.config['rubric']['rules'])}\n\n")
                
                # Rules details
                f.write(f"Rules Details:\n")
                for i, rule in enumerate(self.config['rubric']['rules']):
                    f.write(f"  {i+1}. {rule['name']}\n")
                    f.write(f"     Weight: {rule['weight']}\n")
                    f.write(f"     Organization: {rule['organization']}\n")
                    f.write(f"     Conditions: {rule['conditions'][:100]}...\n\n")
                
                # Validation results
                f.write(f"Validation Results:\n")
                f.write(f"  Valid: {self.config['validation']['is_valid']}\n")
                f.write(f"  Compatible Rules: {self.config['validation']['compatible_rules']}\n")
                f.write(f"  Total Rules: {self.config['validation']['total_rules']}\n")
                if self.config['validation']['missing_columns']:
                    f.write(f"  Missing Columns: {', '.join(self.config['validation']['missing_columns'])}\n")
                f.write(f"\n")
                
                # Results summary
                f.write(f"Results Summary:\n")
                f.write(f"  Total Rows: {len(results)}\n")
                f.write(f"  Total Columns: {len(results.columns)}\n")
                
                score_columns = [col for col in results.columns if col.endswith('_SCORE')]
                f.write(f"  Score Columns: {len(score_columns)}\n")
                
                if score_columns:
                    f.write(f"  Score Statistics:\n")
                    for col in score_columns:
                        if col in results.columns:
                            f.write(f"    {col}:\n")
                            f.write(f"      Mean: {results[col].mean():.3f}\n")
                            f.write(f"      Std: {results[col].std():.3f}\n")
                            f.write(f"      Min: {results[col].min():.3f}\n")
                            f.write(f"      Max: {results[col].max():.3f}\n")
                            f.write(f"      Nulls: {results[col].isnull().sum()}\n")
                
                # Sample results
                f.write(f"\nSample Results (first 10 rows):\n")
                sample_cols = ['ensg_id', 'gene_symbol'] + score_columns[:5]  # Show key columns and first 5 scores
                available_cols = [col for col in sample_cols if col in results.columns]
                if available_cols:
                    sample_data = results[available_cols].head(10)
                    f.write(sample_data.to_string(index=False))
            
            logger.info(f"Debug report saved to: {debug_path}")
            return str(debug_path)
        except Exception as e:
            logger.error(f"Failed to generate debug report: {e}")
            raise
    
    def run(self, dry_run: bool = False) -> Dict[str, Any]:
        """Run the complete analysis pipeline"""
        try:
            logger.info("Starting standalone analysis execution...")
            
            # Load and validate configuration
            self.load_config()
            if not self.validate_config():
                raise ValueError("Configuration validation failed")
            
            if dry_run:
                logger.info("Dry run completed successfully - configuration is valid")
                return {"status": "validated", "dry_run": True}
            
            # Connect to database
            self.connect_database()
            
            # Load data
            rules, rubric = self.load_rubric_data()
            df = self.load_dataset()
            
            # Execute analysis
            results = self.execute_analysis(rules, rubric, df)
            
            # Save results
            results_path = self.save_results(results)
            debug_path = self.generate_debug_report(results)
            
            logger.info("Analysis execution completed successfully")
            
            return {
                "status": "completed",
                "results_file": results_path,
                "debug_report": debug_path,
                "total_genes": len(results),
                "total_rules": len(rules)
            }
            
        except Exception as e:
            logger.error(f"Analysis execution failed: {e}")
            raise
        finally:
            if self.db_session:
                self.db_session.close()

def main():
    parser = argparse.ArgumentParser(
        description="Standalone Analysis Executor for Targetminer Rubrics",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python standalone_analysis_executor.py config.yaml
  python standalone_analysis_executor.py config.yaml --output-dir ./my_results
  python standalone_analysis_executor.py config.yaml --verbose --dry-run
        """
    )
    
    parser.add_argument('config', help='Path to YAML configuration file')
    parser.add_argument('--output-dir', default='./results', 
                       help='Output directory for results (default: ./results)')
    parser.add_argument('--verbose', action='store_true', 
                       help='Enable verbose logging')
    parser.add_argument('--dry-run', action='store_true', 
                       help='Validate configuration without executing')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.config):
        logger.error(f"Configuration file not found: {args.config}")
        sys.exit(1)
    
    try:
        executor = StandaloneAnalysisExecutor(
            config_path=args.config,
            output_dir=args.output_dir,
            verbose=args.verbose
        )
        
        result = executor.run(dry_run=args.dry_run)
        
        if result["status"] == "completed":
            print(f"\n✅ Analysis completed successfully!")
            print(f"📊 Results: {result['results_file']}")
            print(f"🔍 Debug Report: {result['debug_report']}")
            print(f"🧬 Total Genes: {result['total_genes']:,}")
            print(f"📋 Total Rules: {result['total_rules']}")
        elif result["status"] == "validated":
            print(f"\n✅ Configuration validation passed!")
            print(f"📝 Ready for execution")
        
    except Exception as e:
        logger.error(f"Execution failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
