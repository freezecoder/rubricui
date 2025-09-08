#!/usr/bin/env python3
"""
Test script for the standalone analysis executor

This script creates a sample YAML configuration and tests the standalone executor
to ensure it works correctly with the current database setup.
"""

import os
import sys
import yaml
import tempfile
from pathlib import Path

# Add the backend app directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from standalone_analysis_executor import StandaloneAnalysisExecutor

def create_sample_config():
    """Create a sample YAML configuration for testing"""
    
    # This is a sample configuration that should work with the example data
    sample_config = {
        'metadata': {
            'export_date': '2025-01-08T15:30:00.000Z',
            'export_version': '1.0.0',
            'project_name': 'LUSC Example Analysis',
            'project_id': 'f1908a17647043b583f985ec0d838d70'
        },
        'analysis': {
            'project_id': 'f1908a17647043b583f985ec0d838d70',
            'rubric_id': 'b67cb49cc4ae435181502e4e1517a109',
            'dataset_id': '6957a07f15b04b94985453725497ab7f',
            'execution_type': 'rubric'
        },
        'project': {
            'id': 'f1908a17647043b583f985ec0d838d70',
            'name': 'LUSC Example Analysis',
            'description': 'Example project using LUSC data',
            'created_date': '2025-01-08T10:00:00.000Z',
            'owner_id': 'admin'
        },
        'rubric': {
            'id': 'b67cb49cc4ae435181502e4e1517a109',
            'name': 'LUSC Marker Agnostic',
            'description': 'LUSC Marker Agnostic rubric',
            'organization': 'nj',
            'disease_area': 'LUSC',
            'created_date': '2025-01-08T10:00:00.000Z',
            'rules': [
                {
                    'id': 'rule_1',
                    'name': 'magnitude_expr_median',
                    'description': 'Expression Magnitude (Median)',
                    'weight': 1,
                    'order_index': 0,
                    'conditions': 'TRUE ~ 0',
                    'variables': 'tcga_expr_percentile_rank',
                    'organization': 'nj',
                    'disease_area': 'LUSC'
                }
            ]
        },
        'dataset': {
            'id': '6957a07f15b04b94985453725497ab7f',
            'name': 'lusc_input',
            'filename': 'lusc_input.xlsx',
            'upload_date': '2025-01-08T10:00:00.000Z',
            'size': 19604,
            'status': 'ready',
            'file_path': 'backend/uploads/lusc_input.xlsx',  # Adjust path as needed
            'statistics': {
                'total_rows': 19604,
                'total_columns': 81,
                'numeric_columns': 49,
                'score_columns': 12
            }
        },
        'validation': {
            'is_valid': True,
            'compatible_rules': 8,
            'total_rules': 11,
            'missing_columns': [],
            'validation_date': '2025-01-08T15:30:00.000Z'
        },
        'execution_settings': {
            'key_column': 'ensg_id',
            'output_format': 'excel',
            'include_intermediate_results': True,
            'save_to_database': True
        }
    }
    
    return sample_config

def test_config_validation():
    """Test configuration validation"""
    print("🧪 Testing configuration validation...")
    
    # Create temporary config file
    sample_config = create_sample_config()
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
        yaml.dump(sample_config, f)
        config_path = f.name
    
    try:
        # Test validation
        executor = StandaloneAnalysisExecutor(config_path, verbose=True)
        executor.load_config()
        
        if executor.validate_config():
            print("✅ Configuration validation passed")
            return True
        else:
            print("❌ Configuration validation failed")
            return False
    except Exception as e:
        print(f"❌ Configuration validation error: {e}")
        return False
    finally:
        # Clean up
        os.unlink(config_path)

def test_dry_run():
    """Test dry run execution"""
    print("🧪 Testing dry run execution...")
    
    # Create temporary config file
    sample_config = create_sample_config()
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
        yaml.dump(sample_config, f)
        config_path = f.name
    
    try:
        # Test dry run
        executor = StandaloneAnalysisExecutor(config_path, verbose=True)
        result = executor.run(dry_run=True)
        
        if result.get('status') == 'validated':
            print("✅ Dry run execution passed")
            return True
        else:
            print(f"❌ Dry run execution failed: {result}")
            return False
    except Exception as e:
        print(f"❌ Dry run execution error: {e}")
        return False
    finally:
        # Clean up
        os.unlink(config_path)

def main():
    """Run all tests"""
    print("🚀 Starting standalone executor tests...\n")
    
    tests = [
        ("Configuration Validation", test_config_validation),
        ("Dry Run Execution", test_dry_run),
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"Running: {test_name}")
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ Test '{test_name}' failed with exception: {e}")
            results.append((test_name, False))
        print()
    
    # Summary
    print("📊 Test Results Summary:")
    print("=" * 50)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name}: {status}")
        if result:
            passed += 1
    
    print("=" * 50)
    print(f"Total: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
