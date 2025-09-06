#!/usr/bin/env python3
"""
Test script for the new Dataset API functionality
"""

import requests
import json
import pandas as pd
import io
from pathlib import Path

# API base URL
BASE_URL = "http://localhost:8000/api"

def test_dataset_endpoints():
    """Test all dataset API endpoints"""
    
    print("🧪 Testing Dataset API Endpoints")
    print("=" * 50)
    
    # Test 1: List datasets (should be empty initially)
    print("\n1. Testing GET /datasets (list datasets)")
    try:
        response = requests.get(f"{BASE_URL}/datasets")
        if response.status_code == 200:
            datasets = response.json()
            print(f"✅ Success: Found {len(datasets)} datasets")
            print(f"   Response: {json.dumps(datasets, indent=2)}")
        else:
            print(f"❌ Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Exception: {e}")
    
    # Test 2: Create a sample dataset
    print("\n2. Testing POST /datasets (create dataset)")
    
    # Create sample Excel data
    sample_data = {
        'Gene_ID': ['GENE001', 'GENE002', 'GENE003', 'GENE004', 'GENE005'],
        'Expression_Score': [0.8, 0.6, 0.4, 0.9, 0.3],
        'Mutation_Score': [0.2, 0.7, 0.1, 0.8, 0.5],
        'Protein_Level': [1.2, 0.8, 1.5, 0.9, 1.1],
        'Tissue_Type': ['Lung', 'Lung', 'Liver', 'Lung', 'Liver'],
        'Disease_Status': ['Normal', 'Cancer', 'Normal', 'Cancer', 'Normal']
    }
    
    df = pd.DataFrame(sample_data)
    
    # Save to temporary Excel file
    temp_file = Path("temp_test_data.xlsx")
    df.to_excel(temp_file, index=False)
    
    try:
        # Upload the dataset
        with open(temp_file, 'rb') as f:
            files = {'file': ('test_dataset.xlsx', f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
            data = {
                'name': 'Test Genomics Dataset',
                'description': 'Sample dataset for testing the API',
                'owner_name': 'Test User',
                'organization': 'Test Lab',
                'disease_area_study': 'Lung Cancer',
                'tags': 'test,genomics,lung'
            }
            
            response = requests.post(f"{BASE_URL}/datasets", files=files, data=data)
            
            if response.status_code == 200:
                dataset = response.json()
                dataset_id = dataset['id']
                print(f"✅ Success: Created dataset with ID {dataset_id}")
                print(f"   Dataset: {dataset['name']}")
                print(f"   Rows: {dataset['num_rows']}, Columns: {dataset['num_columns']}")
                print(f"   Numeric: {dataset['num_numeric_columns']}, String: {dataset['num_string_columns']}, Score: {dataset['num_score_columns']}")
                
                # Test 3: Get specific dataset
                print(f"\n3. Testing GET /datasets/{dataset_id}")
                response = requests.get(f"{BASE_URL}/datasets/{dataset_id}")
                if response.status_code == 200:
                    dataset_detail = response.json()
                    print(f"✅ Success: Retrieved dataset details")
                    print(f"   Columns: {len(dataset_detail['columns'])}")
                else:
                    print(f"❌ Error: {response.status_code} - {response.text}")
                
                # Test 4: Get dataset columns
                print(f"\n4. Testing GET /datasets/{dataset_id}/columns")
                response = requests.get(f"{BASE_URL}/datasets/{dataset_id}/columns")
                if response.status_code == 200:
                    columns = response.json()
                    print(f"✅ Success: Retrieved {len(columns)} columns")
                    for col in columns:
                        print(f"   - {col['original_name']} -> {col['sanitized_name']} ({col['column_type']})")
                else:
                    print(f"❌ Error: {response.status_code} - {response.text}")
                
                # Test 5: Get dataset stats
                print(f"\n5. Testing GET /datasets/{dataset_id}/stats")
                response = requests.get(f"{BASE_URL}/datasets/{dataset_id}/stats")
                if response.status_code == 200:
                    stats = response.json()
                    print(f"✅ Success: Retrieved dataset statistics")
                    print(f"   Total rows: {stats['total_rows']}")
                    print(f"   Total columns: {stats['total_columns']}")
                    print(f"   Numeric columns: {stats['numeric_columns']}")
                else:
                    print(f"❌ Error: {response.status_code} - {response.text}")
                
                # Test 6: Get column mapping
                print(f"\n6. Testing GET /datasets/{dataset_id}/column-mapping")
                response = requests.get(f"{BASE_URL}/datasets/{dataset_id}/column-mapping")
                if response.status_code == 200:
                    mapping = response.json()
                    print(f"✅ Success: Retrieved column mapping")
                    print(f"   Mapping: {mapping['column_mapping']}")
                else:
                    print(f"❌ Error: {response.status_code} - {response.text}")
                
                # Test 7: Validate dataset for rubric
                print(f"\n7. Testing POST /datasets/{dataset_id}/validate-rubric")
                required_columns = ['expression_score', 'mutation_score', 'protein_level']
                response = requests.post(
                    f"{BASE_URL}/datasets/{dataset_id}/validate-rubric",
                    json=required_columns
                )
                if response.status_code == 200:
                    validation = response.json()
                    print(f"✅ Success: Validated dataset for rubric")
                    print(f"   Valid: {validation['validation_result']['is_valid']}")
                    print(f"   Missing: {validation['validation_result']['missing_columns']}")
                else:
                    print(f"❌ Error: {response.status_code} - {response.text}")
                
                # Test 8: Update dataset
                print(f"\n8. Testing PUT /datasets/{dataset_id}")
                update_data = {
                    'name': 'Updated Test Dataset',
                    'description': 'Updated description for testing'
                }
                response = requests.put(f"{BASE_URL}/datasets/{dataset_id}", json=update_data)
                if response.status_code == 200:
                    updated_dataset = response.json()
                    print(f"✅ Success: Updated dataset")
                    print(f"   New name: {updated_dataset['name']}")
                else:
                    print(f"❌ Error: {response.status_code} - {response.text}")
                
                # Test 9: Delete dataset
                print(f"\n9. Testing DELETE /datasets/{dataset_id}")
                response = requests.delete(f"{BASE_URL}/datasets/{dataset_id}")
                if response.status_code == 200:
                    result = response.json()
                    print(f"✅ Success: Deleted dataset")
                    print(f"   Message: {result['message']}")
                else:
                    print(f"❌ Error: {response.status_code} - {response.text}")
                
            else:
                print(f"❌ Error: {response.status_code} - {response.text}")
                
    except Exception as e:
        print(f"❌ Exception: {e}")
    finally:
        # Clean up temporary file
        if temp_file.exists():
            temp_file.unlink()
    
    print("\n" + "=" * 50)
    print("🎉 Dataset API testing completed!")

if __name__ == "__main__":
    test_dataset_endpoints()
