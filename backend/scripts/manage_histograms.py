#!/usr/bin/env python3
"""
Comprehensive histogram management script for datasets.

This script provides various operations for managing histograms:
- Generate histograms for datasets missing them
- Regenerate histograms with different bin counts
- Delete histograms for specific datasets
- Show histogram statistics and details
"""

import sys
import os
import argparse
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy.orm import Session
from app.models.database import get_db
from app.models.dataset import Dataset, DatasetColumn, DatasetHistogram
from app.services.dataset_processor import DatasetProcessor

def list_datasets_with_histogram_status(db: Session):
    """List all datasets with their histogram status"""
    
    datasets = db.query(Dataset).all()
    
    print("📊 Dataset Histogram Status:")
    print("=" * 80)
    print(f"{'Dataset Name':<30} {'ID':<12} {'Numeric Cols':<12} {'Histograms':<12} {'Status'}")
    print("-" * 80)
    
    for dataset in datasets:
        # Count numeric columns
        numeric_columns = db.query(DatasetColumn).filter(
            DatasetColumn.dataset_id == dataset.id,
            DatasetColumn.column_type.in_(['numeric', 'score'])
        ).count()
        
        # Count histograms
        histogram_count = db.query(DatasetHistogram).filter(
            DatasetHistogram.dataset_id == dataset.id
        ).count()
        
        # Determine status
        if numeric_columns == 0:
            status = "No numeric data"
        elif histogram_count == 0:
            status = "Missing histograms"
        elif histogram_count < numeric_columns:
            status = "Partial histograms"
        else:
            status = "Complete"
        
        print(f"{dataset.name[:29]:<30} {dataset.id[:11]:<12} {numeric_columns:<12} {histogram_count:<12} {status}")

def generate_missing_histograms(db: Session, processor: DatasetProcessor, bin_count: int = 30, force: bool = False):
    """Generate histograms for datasets that are missing them"""
    
    datasets = db.query(Dataset).all()
    processed_count = 0
    total_histograms = 0
    
    for dataset in datasets:
        # Count numeric columns
        numeric_columns = db.query(DatasetColumn).filter(
            DatasetColumn.dataset_id == dataset.id,
            DatasetColumn.column_type.in_(['numeric', 'score'])
        ).count()
        
        if numeric_columns == 0:
            continue
        
        # Count existing histograms
        existing_histograms = db.query(DatasetHistogram).filter(
            DatasetHistogram.dataset_id == dataset.id
        ).count()
        
        # Skip if histograms exist and not forcing regeneration
        if existing_histograms > 0 and not force:
            continue
        
        print(f"🔄 Processing dataset: {dataset.name}")
        
        try:
            if force and existing_histograms > 0:
                # Delete existing histograms first
                db.query(DatasetHistogram).filter(
                    DatasetHistogram.dataset_id == dataset.id
                ).delete()
                print(f"  🗑️  Deleted {existing_histograms} existing histograms")
            
            # Generate new histograms
            histograms = processor.generate_histograms_for_dataset(db, dataset.id, bin_count)
            
            if histograms:
                for histogram in histograms:
                    db.add(histogram)
                db.commit()
                
                print(f"  ✅ Generated {len(histograms)} histograms")
                total_histograms += len(histograms)
                processed_count += 1
            else:
                print(f"  ⚠️  No histograms generated (no valid numeric data)")
                
        except Exception as e:
            print(f"  ❌ Error: {e}")
            db.rollback()
    
    print(f"\n📊 Summary: Processed {processed_count} datasets, generated {total_histograms} histograms")
    return processed_count, total_histograms

def regenerate_histograms_for_dataset(db: Session, processor: DatasetProcessor, dataset_id: str, bin_count: int = 30):
    """Regenerate histograms for a specific dataset"""
    
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        print(f"❌ Dataset with ID {dataset_id} not found")
        return False
    
    print(f"🔄 Regenerating histograms for dataset: {dataset.name}")
    
    try:
        # Delete existing histograms
        existing_count = db.query(DatasetHistogram).filter(
            DatasetHistogram.dataset_id == dataset_id
        ).count()
        
        if existing_count > 0:
            db.query(DatasetHistogram).filter(
                DatasetHistogram.dataset_id == dataset_id
            ).delete()
            print(f"  🗑️  Deleted {existing_count} existing histograms")
        
        # Generate new histograms
        histograms = processor.generate_histograms_for_dataset(db, dataset_id, bin_count)
        
        if histograms:
            for histogram in histograms:
                db.add(histogram)
            db.commit()
            
            print(f"  ✅ Generated {len(histograms)} new histograms")
            return True
        else:
            print(f"  ⚠️  No histograms generated")
            return False
            
    except Exception as e:
        print(f"  ❌ Error: {e}")
        db.rollback()
        return False

def delete_histograms_for_dataset(db: Session, dataset_id: str):
    """Delete all histograms for a specific dataset"""
    
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        print(f"❌ Dataset with ID {dataset_id} not found")
        return False
    
    try:
        count = db.query(DatasetHistogram).filter(
            DatasetHistogram.dataset_id == dataset_id
        ).count()
        
        if count == 0:
            print(f"Dataset {dataset.name} has no histograms to delete")
            return True
        
        db.query(DatasetHistogram).filter(
            DatasetHistogram.dataset_id == dataset_id
        ).delete()
        db.commit()
        
        print(f"✅ Deleted {count} histograms for dataset: {dataset.name}")
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
        return False

def show_histogram_details(db: Session, dataset_id: str = None):
    """Show detailed histogram information"""
    
    query = db.query(DatasetHistogram)
    
    if dataset_id:
        query = query.filter(DatasetHistogram.dataset_id == dataset_id)
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if dataset:
            print(f"📊 Histogram details for dataset: {dataset.name}")
        else:
            print(f"❌ Dataset with ID {dataset_id} not found")
            return
    else:
        print("📊 All histogram details:")
    
    histograms = query.all()
    
    if not histograms:
        print("No histograms found")
        return
    
    print(f"\nFound {len(histograms)} histograms:")
    print("-" * 100)
    print(f"{'Dataset ID':<12} {'Column ID':<12} {'Bins':<6} {'Min':<12} {'Max':<12} {'Total':<8} {'Nulls':<8}")
    print("-" * 100)
    
    for hist in histograms:
        print(f"{hist.dataset_id[:11]:<12} {hist.column_id[:11]:<12} {hist.bin_count:<6} "
              f"{hist.min_value:<12.3f} {hist.max_value:<12.3f} {hist.total_count:<8} {hist.null_count:<8}")

def main():
    """Main function with command line argument parsing"""
    
    parser = argparse.ArgumentParser(description="Manage dataset histograms")
    parser.add_argument("action", choices=["list", "generate", "regenerate", "delete", "details"], 
                       help="Action to perform")
    parser.add_argument("--dataset-id", help="Specific dataset ID (for regenerate, delete, details)")
    parser.add_argument("--bin-count", type=int, default=30, help="Number of bins for histogram (default: 30)")
    parser.add_argument("--force", action="store_true", help="Force regeneration even if histograms exist")
    
    args = parser.parse_args()
    
    # Initialize processor and database session
    processor = DatasetProcessor()
    db = next(get_db())
    
    try:
        if args.action == "list":
            list_datasets_with_histogram_status(db)
            
        elif args.action == "generate":
            print("🚀 Generating missing histograms...")
            generate_missing_histograms(db, processor, args.bin_count, args.force)
            
        elif args.action == "regenerate":
            if not args.dataset_id:
                print("❌ --dataset-id is required for regenerate action")
                return False
            regenerate_histograms_for_dataset(db, processor, args.dataset_id, args.bin_count)
            
        elif args.action == "delete":
            if not args.dataset_id:
                print("❌ --dataset-id is required for delete action")
                return False
            delete_histograms_for_dataset(db, args.dataset_id)
            
        elif args.action == "details":
            show_histogram_details(db, args.dataset_id)
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
        
    finally:
        db.close()

if __name__ == "__main__":
    print("📊 Dataset Histogram Management Tool")
    print("=" * 50)
    
    success = main()
    sys.exit(0 if success else 1)
