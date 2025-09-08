#!/usr/bin/env python3
"""
Script to generate histograms for existing datasets that don't have histogram data.

This script will:
1. Find all datasets in the database
2. Check which ones are missing histogram data
3. Generate histograms for numeric columns in those datasets
4. Provide a summary of the results
"""

import sys
import os
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy.orm import Session
from app.models.database import get_db
from app.models.dataset import Dataset, DatasetColumn, DatasetHistogram
from app.services.dataset_processor import DatasetProcessor

def find_datasets_missing_histograms(db: Session):
    """Find datasets that don't have histogram data"""
    
    # Get all datasets
    all_datasets = db.query(Dataset).all()
    
    datasets_missing_histograms = []
    
    for dataset in all_datasets:
        # Check if this dataset has any histograms
        histogram_count = db.query(DatasetHistogram).filter(
            DatasetHistogram.dataset_id == dataset.id
        ).count()
        
        if histogram_count == 0:
            # Check if this dataset has numeric columns
            numeric_columns = db.query(DatasetColumn).filter(
                DatasetColumn.dataset_id == dataset.id,
                DatasetColumn.column_type.in_(['numeric', 'score'])
            ).count()
            
            if numeric_columns > 0:
                datasets_missing_histograms.append({
                    'dataset': dataset,
                    'numeric_columns': numeric_columns
                })
    
    return datasets_missing_histograms

def generate_histograms_for_dataset(db: Session, dataset, processor: DatasetProcessor, bin_count: int = 30):
    """Generate histograms for a specific dataset"""
    
    try:
        print(f"  🔄 Generating histograms for dataset: {dataset.name}")
        
        # Generate histograms
        histograms = processor.generate_histograms_for_dataset(db, dataset.id, bin_count)
        
        if histograms:
            # Save to database
            for histogram in histograms:
                db.add(histogram)
            db.commit()
            
            print(f"  ✅ Generated {len(histograms)} histograms successfully")
            return len(histograms)
        else:
            print(f"  ⚠️  No histograms generated (no valid numeric data)")
            return 0
            
    except Exception as e:
        print(f"  ❌ Error generating histograms: {e}")
        db.rollback()
        return 0

def main():
    """Main function to generate missing histograms"""
    
    print("🚀 Starting histogram generation for existing datasets...\n")
    
    # Initialize dataset processor
    processor = DatasetProcessor()
    
    # Get database session
    db = next(get_db())
    
    try:
        # Find datasets missing histograms
        datasets_missing = find_datasets_missing_histograms(db)
        
        if not datasets_missing:
            print("✅ All datasets already have histogram data!")
            return True
        
        print(f"📊 Found {len(datasets_missing)} datasets missing histogram data:")
        
        total_histograms_generated = 0
        successful_datasets = 0
        
        for i, item in enumerate(datasets_missing, 1):
            dataset = item['dataset']
            numeric_columns = item['numeric_columns']
            
            print(f"\n📈 Dataset {i}/{len(datasets_missing)}: {dataset.name}")
            print(f"  📊 Dataset ID: {dataset.id}")
            print(f"  📈 Numeric columns: {numeric_columns}")
            print(f"  📅 Created: {dataset.created_date}")
            
            # Generate histograms for this dataset
            histograms_generated = generate_histograms_for_dataset(db, dataset, processor)
            
            if histograms_generated > 0:
                total_histograms_generated += histograms_generated
                successful_datasets += 1
        
        # Summary
        print(f"\n📊 Summary:")
        print(f"  - Datasets processed: {len(datasets_missing)}")
        print(f"  - Successful datasets: {successful_datasets}")
        print(f"  - Total histograms generated: {total_histograms_generated}")
        
        if successful_datasets > 0:
            print(f"\n🎉 Successfully generated histograms for {successful_datasets} datasets!")
            print(f"📈 Total of {total_histograms_generated} histograms are now available.")
        else:
            print(f"\n⚠️  No histograms were generated. Check the error messages above.")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during histogram generation: {e}")
        return False
        
    finally:
        db.close()

def verify_histogram_generation():
    """Verify that histograms were generated correctly"""
    
    print("\n🔍 Verifying histogram generation...")
    
    db = next(get_db())
    
    try:
        # Get total counts
        total_datasets = db.query(Dataset).count()
        total_histograms = db.query(DatasetHistogram).count()
        
        print(f"📊 Database status:")
        print(f"  - Total datasets: {total_datasets}")
        print(f"  - Total histograms: {total_histograms}")
        
        # Get datasets with histograms
        datasets_with_histograms = db.query(Dataset).join(DatasetHistogram).distinct().count()
        print(f"  - Datasets with histograms: {datasets_with_histograms}")
        
        # Show some sample histogram data
        sample_histograms = db.query(DatasetHistogram).limit(3).all()
        
        if sample_histograms:
            print(f"\n📈 Sample histogram data:")
            for i, hist in enumerate(sample_histograms, 1):
                print(f"  Histogram {i}:")
                print(f"    - Dataset ID: {hist.dataset_id}")
                print(f"    - Column ID: {hist.column_id}")
                print(f"    - Bin count: {hist.bin_count}")
                print(f"    - Data range: {hist.min_value} to {hist.max_value}")
                print(f"    - Total values: {hist.total_count}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during verification: {e}")
        return False
        
    finally:
        db.close()

if __name__ == "__main__":
    print("=" * 60)
    print("📊 HISTOGRAM GENERATION FOR EXISTING DATASETS")
    print("=" * 60)
    
    # Generate missing histograms
    success = main()
    
    if success:
        # Verify the results
        verify_histogram_generation()
        
        print("\n" + "=" * 60)
        print("🎉 HISTOGRAM GENERATION COMPLETED!")
        print("=" * 60)
        print("\nNext steps:")
        print("1. Restart the backend server to ensure all changes are loaded")
        print("2. Test the histogram API endpoints")
        print("3. View histograms in the API documentation at http://localhost:8000/docs")
        print("4. Integrate histogram visualization in the frontend")
    else:
        print("\n❌ Histogram generation failed. Check the error messages above.")
    
    sys.exit(0 if success else 1)
