#!/usr/bin/env python3
"""
Test script for the new result cache functionality
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.result_cache_service import ResultCacheService
import pandas as pd
import numpy as np

def test_result_cache():
    """Test the result cache service functionality"""
    
    print("🧪 Testing Result Cache Service...")
    
    # Create test data
    test_analysis_id = "test_analysis_123"
    
    # Create sample results DataFrame
    np.random.seed(42)
    n_genes = 1000
    
    results_df = pd.DataFrame({
        'gene_symbol': [f'GENE_{i:04d}' for i in range(n_genes)],
        'total_score': np.random.normal(0.5, 0.2, n_genes),
        'rule1_score': np.random.normal(0.3, 0.15, n_genes),
        'rule2_score': np.random.normal(0.7, 0.1, n_genes),
        'expression_value': np.random.exponential(2, n_genes),
        'mutation_status': np.random.choice(['WT', 'MUT'], n_genes),
        'copy_number': np.random.normal(0, 1, n_genes)
    })
    
    # Add some null values to test statistics
    results_df.loc[results_df.index[:50], 'rule1_score'] = np.nan
    results_df.loc[results_df.index[50:100], 'rule2_score'] = np.nan
    
    print(f"📊 Created test data with {len(results_df)} rows and {len(results_df.columns)} columns")
    
    # Initialize cache service
    cache_service = ResultCacheService()
    
    # Test cache creation
    print("💾 Creating optimized result cache...")
    
    key_columns = ['gene_symbol']
    score_columns = ['total_score', 'rule1_score', 'rule2_score']
    scoring_columns = ['expression_value', 'mutation_status', 'copy_number']
    
    try:
        cache_metadata = cache_service.create_optimized_result_cache(
            analysis_id=test_analysis_id,
            results_df=results_df,
            key_columns=key_columns,
            score_columns=score_columns,
            scoring_columns=scoring_columns
        )
        
        print(f"✅ Cache created successfully!")
        print(f"   - File size: {cache_metadata['file_size_mb']:.2f} MB")
        print(f"   - Total rows: {cache_metadata['total_rows']}")
        print(f"   - Available columns: {len(cache_metadata['columns']['available_columns'])}")
        
    except Exception as e:
        print(f"❌ Failed to create cache: {str(e)}")
        return False
    
    # Test cache loading
    print("\n📖 Testing cache loading...")
    
    try:
        # Load cached results
        cached_df = cache_service.load_result_cache(test_analysis_id)
        if cached_df is not None:
            print(f"✅ Loaded cached results: {len(cached_df)} rows, {len(cached_df.columns)} columns")
        else:
            print("❌ Failed to load cached results")
            return False
        
        # Load score statistics
        score_stats = cache_service.load_score_statistics(test_analysis_id)
        if score_stats:
            print(f"✅ Loaded score statistics for {len(score_stats)} score columns")
            for score_name, stats in score_stats.items():
                print(f"   - {score_name}: {stats['valid_percentage']}% valid ({stats['count']}/{stats['count'] + stats['null_count']})")
        else:
            print("❌ Failed to load score statistics")
            return False
        
        # Load metadata
        metadata = cache_service.load_cache_metadata(test_analysis_id)
        if metadata:
            print(f"✅ Loaded cache metadata")
        else:
            print("❌ Failed to load cache metadata")
            return False
            
    except Exception as e:
        print(f"❌ Failed to load cache: {str(e)}")
        return False
    
    # Test cache listing
    print("\n📋 Testing cache listing...")
    
    try:
        cached_analyses = cache_service.list_cached_analyses()
        print(f"✅ Found {len(cached_analyses)} cached analyses")
        
        cache_info = cache_service.get_cache_size()
        print(f"✅ Cache size: {cache_info['total_size_mb']} MB, {cache_info['file_count']} files")
        
    except Exception as e:
        print(f"❌ Failed to list caches: {str(e)}")
        return False
    
    # Test cache deletion
    print("\n🗑️ Testing cache deletion...")
    
    try:
        success = cache_service.delete_result_cache(test_analysis_id)
        if success:
            print("✅ Cache deleted successfully")
        else:
            print("❌ Failed to delete cache")
            return False
            
    except Exception as e:
        print(f"❌ Failed to delete cache: {str(e)}")
        return False
    
    print("\n🎉 All tests passed! Result cache service is working correctly.")
    return True

if __name__ == "__main__":
    success = test_result_cache()
    sys.exit(0 if success else 1)
