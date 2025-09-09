"""
Service utilities for Omics View data processing and manipulation
"""

import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect
from typing import List, Dict, Any, Optional, Tuple
import json
import pickle
from datetime import datetime
from sklearn.preprocessing import MinMaxScaler, StandardScaler, OneHotEncoder

from app.schemas.omics_view import (
    OmicsViewData, GeneFilterRequest, GeneSortRequest, HeatmapData,
    ColorSchemeRequest, GeneListUploadRequest, GeneAnnotation
)


class OmicsDataService:
    """Service for processing omics view data"""
    
    def __init__(self, db_session: Session):
        self.db = db_session
    
    def _apply_scaling(self, data: pd.DataFrame, scaling_method: str = 'none') -> pd.DataFrame:
        """
        Apply scaling to numeric columns of a DataFrame
        
        Args:
            data: DataFrame to scale
            scaling_method: 'minmax', 'standard', or 'none'
            
        Returns:
            Scaled DataFrame
        """
        if scaling_method == 'none' or data.empty:
            return data
        
        # Create a copy to avoid modifying original data
        scaled_data = data.copy()
        
        # Get numeric columns only
        numeric_columns = scaled_data.select_dtypes(include=[np.number]).columns
        
        if len(numeric_columns) == 0:
            return scaled_data
        
        try:
            if scaling_method == 'minmax':
                # Min-Max Normalization: scales values to [0, 1] range
                # Handle columns with zero variance (constant values)
                for col in numeric_columns:
                    col_data = scaled_data[col].dropna()
                    if len(col_data) > 0:
                        if col_data.std() == 0 or col_data.std() == np.nan:
                            # Constant column - set all values to 0.5 (middle of 0-1 range)
                            scaled_data[col] = 0.5
                        else:
                            # Normal min-max scaling
                            scaler = MinMaxScaler()
                            scaled_data[[col]] = scaler.fit_transform(scaled_data[[col]])
                
            elif scaling_method == 'standard':
                # Standardization: mean=0, std=1
                # Handle columns with zero variance (constant values)
                for col in numeric_columns:
                    col_data = scaled_data[col].dropna()
                    if len(col_data) > 0:
                        if col_data.std() == 0 or col_data.std() == np.nan:
                            # Constant column - set all values to 0 (mean-centered)
                            scaled_data[col] = 0.0
                        else:
                            # Normal standardization
                            scaler = StandardScaler()
                            scaled_data[[col]] = scaler.fit_transform(scaled_data[[col]])
                
        except Exception as e:
            # If scaling fails, return original data
            print(f"Scaling failed: {e}")
            return data
        
        # Clean up any NaN or Infinity values that might have been created
        scaled_data = self._clean_scaled_data(scaled_data)
        
        return scaled_data
    
    def _clean_scaled_data(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Clean scaled data by replacing NaN and Infinity values with None for JSON serialization
        
        Args:
            data: DataFrame to clean
            
        Returns:
            Cleaned DataFrame
        """
        # Replace NaN and Infinity values with None for JSON compliance
        data = data.replace([np.inf, -np.inf], None)
        data = data.where(pd.notna(data), None)
        
        return data
    
    async def get_omics_view_data(
        self,
        analysis_id: str,
        table_name: Optional[str] = None,
        limit: int = 50,
        sort_by: str = "total_score",
        sort_order: str = "desc",
        filter_genes: Optional[List[str]] = None,
        annotation_filter: Optional[str] = None,
        scaling_methods: Optional[Dict[str, str]] = None
    ) -> OmicsViewData:
        """Get complete omics view data for visualization"""
        
        # Get base gene data - try wide table first, then cache
        if table_name:
            gene_data = await self._get_gene_data(
                analysis_id, table_name, limit, sort_by, sort_order, filter_genes
            )
        else:
            gene_data = await self._get_gene_data_from_cache(
                analysis_id, limit, sort_by, sort_order, filter_genes
            )
        
        if gene_data is None or gene_data.empty:
            raise ValueError("No gene data found")
        
        gene_symbols = gene_data['gene_symbol'].tolist()
        
        # Set default scaling methods if not provided
        if scaling_methods is None:
            scaling_methods = {
                'rubric_scores': 'none',
                'numeric_columns': 'none', 
                'annotations': 'none'
            }
        
        # Get heatmap data for each type
        rubric_scores_heatmap = await self._get_rubric_scores_heatmap(
            analysis_id, table_name, gene_symbols, gene_data, scaling_methods.get('rubric_scores', 'none')
        )
        
        numeric_columns_heatmap = await self._get_numeric_columns_heatmap(
            analysis_id, table_name, gene_symbols, gene_data, scaling_methods.get('numeric_columns', 'none')
        )
        
        annotations_heatmap = await self._get_annotations_heatmap(
            analysis_id, table_name, gene_symbols, gene_data, scaling_methods.get('annotations', 'none')
        )
        
        # Get available columns
        available_columns = await self.get_available_columns(analysis_id, table_name)
        
        return OmicsViewData(
            analysis_id=analysis_id,
            analysis_name=f"Analysis {analysis_id[:8]}",
            gene_symbols=gene_symbols,
            total_genes=len(gene_data),
            displayed_genes=len(gene_symbols),
            rubric_scores_heatmap=rubric_scores_heatmap,
            numeric_columns_heatmap=numeric_columns_heatmap,
            annotations_heatmap=annotations_heatmap,
            sort_by=sort_by,
            sort_order=sort_order,
            available_rubric_columns=available_columns.get('rubric_columns', []),
            available_numeric_columns=available_columns.get('numeric_columns', []),
            available_annotation_columns=available_columns.get('annotation_columns', []),
            created_at=datetime.utcnow(),
            last_updated=datetime.utcnow()
        )
    
    async def _get_gene_data(
        self,
        analysis_id: str,
        table_name: str,
        limit: int,
        sort_by: str,
        sort_order: str,
        filter_genes: Optional[List[str]] = None
    ) -> pd.DataFrame:
        """Get base gene data with sorting and filtering"""
        
        # Build query
        query_parts = [f"SELECT * FROM {table_name}"]
        query_parts.append(f"WHERE analysis_result_id = :analysis_id")
        
        params = {"analysis_id": analysis_id}
        
        # Add gene filter if provided
        if filter_genes:
            placeholders = ','.join([f':gene_{i}' for i in range(len(filter_genes))])
            query_parts.append(f"AND key_column_value IN ({placeholders})")
            for i, gene in enumerate(filter_genes):
                params[f'gene_{i}'] = gene
        
        # Add sorting
        if sort_by == "total_score":
            order_clause = f"ORDER BY total_score {sort_order.upper()} NULLS LAST"
        elif sort_by == "gene_symbol":
            order_clause = f"ORDER BY key_column_value {sort_order.upper()}"
        else:
            # Sort by specific rule score
            order_clause = f"ORDER BY {sort_by}_score {sort_order.upper()} NULLS LAST"
        
        query_parts.append(order_clause)
        query_parts.append(f"LIMIT {limit}")
        
        query = " ".join(query_parts)
        
        # Execute query
        result = self.db.execute(text(query), params)
        rows = result.fetchall()
        
        if not rows:
            return pd.DataFrame()
        
        # Convert to DataFrame
        columns = result.keys()
        data = [dict(zip(columns, row)) for row in rows]
        df = pd.DataFrame(data)
        
        return df
    
    async def _get_rubric_scores_heatmap(
        self,
        analysis_id: str,
        table_name: Optional[str],
        gene_symbols: List[str],
        gene_data: pd.DataFrame,
        scaling_method: str = 'none'
    ) -> Optional[HeatmapData]:
        """Get rubric scores heatmap data"""
        
        if table_name:
            # Use wide table data
            inspector = inspect(self.db.bind)
            columns = inspector.get_columns(table_name)
            
            # Find score columns (ending with _score but not total_score)
            score_columns = [
                col['name'] for col in columns 
                if col['name'].endswith('_score') and not col['name'].startswith('total_')
            ]
            
            # Add total_score as the first column if it exists
            total_score_col = None
            for col in columns:
                if col['name'] == 'total_score' or col['name'].endswith('_RUBRIC_SCORE'):
                    total_score_col = col['name']
                    break
            
            if total_score_col:
                score_columns = [total_score_col] + score_columns
            
            if not score_columns:
                return None
            
            # Get data for these columns
            placeholders = ','.join([f':gene_{i}' for i in range(len(gene_symbols))])
            score_cols_str = ','.join(score_columns)
            
            query = f"""
                SELECT key_column_value, {score_cols_str}
                FROM {table_name}
                WHERE analysis_result_id = :analysis_id
                AND key_column_value IN ({placeholders})
                ORDER BY total_score DESC NULLS LAST
            """
            
            params = {"analysis_id": analysis_id}
            for i, gene in enumerate(gene_symbols):
                params[f'gene_{i}'] = gene
            
            result = self.db.execute(text(query), params)
            rows = result.fetchall()
            
            if not rows:
                return None
            
            # Convert to matrix format
            data_matrix = []
            for row in rows:
                row_data = []
                for col in score_columns:
                    value = getattr(row, col)
                    if value is not None:
                        try:
                            float_val = float(value)
                            # Handle NaN and infinity values
                            if pd.isna(float_val) or float_val == float('inf') or float_val == float('-inf'):
                                row_data.append(None)
                            else:
                                row_data.append(float_val)
                        except (ValueError, TypeError):
                            row_data.append(None)
                    else:
                        row_data.append(None)
                data_matrix.append(row_data)
        else:
            # Use cache data
            score_columns = [col for col in gene_data.columns if col.endswith('_SCORE') and not col.startswith('total_')]
            
            # Add total_score as the first column if it exists
            total_score_col = None
            for col in gene_data.columns:
                if col == 'total_score' or col.endswith('_RUBRIC_SCORE'):
                    total_score_col = col
                    break
            
            if total_score_col:
                score_columns = [total_score_col] + score_columns
            
            if not score_columns:
                return None
            
            # Filter data for selected genes
            filtered_data = gene_data[gene_data['gene_symbol'].isin(gene_symbols)]
            
            # Convert to matrix format
            data_matrix = []
            for _, row in filtered_data.iterrows():
                row_data = []
                for col in score_columns:
                    value = row[col]
                    if value is not None:
                        try:
                            float_val = float(value)
                            # Handle NaN and infinity values
                            if pd.isna(float_val) or float_val == float('inf') or float_val == float('-inf'):
                                row_data.append(None)
                            else:
                                row_data.append(float_val)
                        except (ValueError, TypeError):
                            row_data.append(None)
                    else:
                        row_data.append(None)
                data_matrix.append(row_data)
        
        # Apply scaling if requested
        if scaling_method != 'none':
            # Convert to DataFrame for scaling
            df = pd.DataFrame(data_matrix, columns=score_columns)
            df_scaled = self._apply_scaling(df, scaling_method)
            data_matrix = df_scaled.values.tolist()
            
            # Additional safety check: ensure all values are JSON serializable
            data_matrix = [[None if (isinstance(v, float) and (np.isnan(v) or np.isinf(v))) else v 
                           for v in row] for row in data_matrix]
        
        # Calculate min/max values
        all_values = [v for row in data_matrix for v in row if v is not None]
        min_value = min(all_values) if all_values else 0
        max_value = max(all_values) if all_values else 0
        
        return HeatmapData(
            heatmap_type="rubric_scores",
            gene_symbols=gene_symbols,
            column_names=score_columns,
            data_matrix=data_matrix,
            min_value=min_value,
            max_value=max_value,
            missing_values=sum(1 for row in data_matrix for v in row if v is None)
        )
    
    async def _get_numeric_columns_heatmap(
        self,
        analysis_id: str,
        table_name: Optional[str],
        gene_symbols: List[str],
        gene_data: pd.DataFrame,
        scaling_method: str = 'none'
    ) -> Optional[HeatmapData]:
        """Get numeric columns heatmap data"""
        
        if table_name:
            # Use wide table data
            inspector = inspect(self.db.bind)
            columns = inspector.get_columns(table_name)
            
            # Find numeric columns (excluding score columns and key columns)
            numeric_columns = [
                col['name'] for col in columns 
                if (col['type'].python_type in [float, int] and 
                    not col['name'].endswith('_score') and 
                    not col['name'].startswith('key_') and
                    not col['name'].startswith('analysis_') and
                    col['name'] not in ['total_score', 'total_weighted_score'])
            ]
            
            # Limit to most significant columns (configurable)
            significant_columns = numeric_columns[:20]  # Top 20 numeric columns
            
            if not significant_columns:
                return None
            
            # Get data for these columns
            placeholders = ','.join([f':gene_{i}' for i in range(len(gene_symbols))])
            numeric_cols_str = ','.join(significant_columns)
            
            query = f"""
                SELECT key_column_value, {numeric_cols_str}
                FROM {table_name}
                WHERE analysis_result_id = :analysis_id
                AND key_column_value IN ({placeholders})
                ORDER BY total_score DESC NULLS LAST
            """
            
            params = {"analysis_id": analysis_id}
            for i, gene in enumerate(gene_symbols):
                params[f'gene_{i}'] = gene
            
            result = self.db.execute(text(query), params)
            rows = result.fetchall()
            
            if not rows:
                return None
            
            # Convert to matrix format
            data_matrix = []
            for row in rows:
                row_data = []
                for col in significant_columns:
                    value = getattr(row, col)
                    if value is not None:
                        try:
                            float_val = float(value)
                            # Handle NaN and infinity values
                            if pd.isna(float_val) or float_val == float('inf') or float_val == float('-inf'):
                                row_data.append(None)
                            else:
                                row_data.append(float_val)
                        except (ValueError, TypeError):
                            row_data.append(None)
                    else:
                        row_data.append(None)
                data_matrix.append(row_data)
        else:
            # Use cache data
            # Find numeric columns (excluding score columns and key columns)
            numeric_columns = [
                col for col in gene_data.columns 
                if (not col.endswith('_SCORE') and 
                    not col.startswith('key_') and
                    not col.startswith('analysis_') and
                    col not in ['total_score', 'total_weighted_score', 'gene_symbol', 'ensg_id', 'Gene description'] and
                    col not in ['team_review', 'assessment_status', 'Tiers_Internal', 'Reliability (IH)', 'FinalSurfaceLabel_Method2'])
            ]
            
            # Limit to most significant columns (configurable)
            significant_columns = numeric_columns[:20]  # Top 20 numeric columns
            
            if not significant_columns:
                return None
            
            # Filter data for selected genes
            filtered_data = gene_data[gene_data['gene_symbol'].isin(gene_symbols)]
            
            # Convert to matrix format
            data_matrix = []
            for _, row in filtered_data.iterrows():
                row_data = []
                for col in significant_columns:
                    value = row[col]
                    if value is not None:
                        try:
                            float_val = float(value)
                            # Handle NaN and infinity values
                            if pd.isna(float_val) or float_val == float('inf') or float_val == float('-inf'):
                                row_data.append(None)
                            else:
                                row_data.append(float_val)
                        except (ValueError, TypeError):
                            row_data.append(None)
                    else:
                        row_data.append(None)
                data_matrix.append(row_data)
        
        # Apply scaling if requested
        if scaling_method != 'none':
            # Convert to DataFrame for scaling
            df = pd.DataFrame(data_matrix, columns=significant_columns)
            df_scaled = self._apply_scaling(df, scaling_method)
            data_matrix = df_scaled.values.tolist()
            
            # Additional safety check: ensure all values are JSON serializable
            data_matrix = [[None if (isinstance(v, float) and (np.isnan(v) or np.isinf(v))) else v 
                           for v in row] for row in data_matrix]
        
        # Calculate min/max values
        all_values = [v for row in data_matrix for v in row if v is not None]
        min_value = min(all_values) if all_values else 0
        max_value = max(all_values) if all_values else 0
        
        return HeatmapData(
            heatmap_type="numeric_columns",
            gene_symbols=gene_symbols,
            column_names=significant_columns,
            data_matrix=data_matrix,
            min_value=min_value,
            max_value=max_value,
            missing_values=sum(1 for row in data_matrix for v in row if v is None)
        )
    
    async def _get_annotations_heatmap(
        self,
        analysis_id: str,
        table_name: Optional[str],
        gene_symbols: List[str],
        gene_data: pd.DataFrame,
        scaling_method: str = 'none'
    ) -> Optional[HeatmapData]:
        """Get annotations heatmap data from real annotation dataset with both categorical and numeric columns"""
        
        try:
            # Load annotation dataset
            annotation_data = self._load_annotation_dataset()
            if annotation_data is None or annotation_data.empty:
                return None
            
            # Join with gene symbols on gene_symbol column
            gene_df = pd.DataFrame({'gene_symbol': gene_symbols})
            merged_data = gene_df.merge(annotation_data, on='gene_symbol', how='left')
            
            # Select categorical columns for OneHotEncoder (excluding high-cardinality columns)
            categorical_columns = [
                'FinalSurfaceLabel_Method2',
                'apical_negative_manual_tissuedetail',
                'apical_positive_manual_tissuedetail'
            ]
            
            # Filter to only include columns that exist in the dataset
            available_categorical_columns = [col for col in categorical_columns if col in merged_data.columns]
            
            # Select numeric columns (exclude gene_symbol and categorical columns)
            numeric_columns = []
            for col in merged_data.columns:
                if (col != 'gene_symbol' and 
                    col not in available_categorical_columns and
                    pd.api.types.is_numeric_dtype(merged_data[col])):
                    numeric_columns.append(col)
            
            # If no columns available, return None
            if not available_categorical_columns and not numeric_columns:
                return None
            
            # Prepare final data matrix and column names
            final_data_matrix = []
            final_column_names = []
            
            # Process categorical columns with OneHotEncoder
            if available_categorical_columns:
                categorical_data = merged_data[available_categorical_columns].fillna('Unknown')
                encoder = OneHotEncoder(sparse_output=False, handle_unknown='ignore')
                encoded_data = encoder.fit_transform(categorical_data)
                feature_names = encoder.get_feature_names_out(available_categorical_columns)
                
                # Add encoded categorical data
                final_data_matrix.extend(encoded_data.T.tolist())
                final_column_names.extend(feature_names.tolist())
            
            # Process numeric columns (no transformation, just scaling if needed)
            if numeric_columns:
                numeric_data = merged_data[numeric_columns].fillna(0)  # Fill NaN with 0 for numeric columns
                
                # Add numeric data
                final_data_matrix.extend(numeric_data.T.values.tolist())
                final_column_names.extend(numeric_columns)
            
            # Transpose to get rows as genes and columns as features
            data_matrix = list(map(list, zip(*final_data_matrix)))
            
            # Apply scaling if requested
            if scaling_method != 'none':
                df = pd.DataFrame(data_matrix, columns=final_column_names)
                df_scaled = self._apply_scaling(df, scaling_method)
                data_matrix = df_scaled.values.tolist()
                data_matrix = [[None if (isinstance(v, float) and (np.isnan(v) or np.isinf(v))) else v 
                               for v in row] for row in data_matrix]
            
            # Calculate min/max values
            flat_values = [v for row in data_matrix for v in row if v is not None]
            min_value = min(flat_values) if flat_values else 0
            max_value = max(flat_values) if flat_values else 1
            
            return HeatmapData(
                heatmap_type="annotations",
                gene_symbols=gene_symbols,
                column_names=final_column_names,
                data_matrix=data_matrix,
                min_value=min_value,
                max_value=max_value,
                missing_values=sum(1 for row in data_matrix for v in row if v is None)
            )
            
        except Exception as e:
            print(f"Error loading annotation data: {e}")
            return None
    
    def _load_annotation_dataset(self) -> Optional[pd.DataFrame]:
        """Load the annotation dataset from pickle file"""
        try:
            annotation_dataset_path = "datasets/738809ee46504730b47f3a8fea6b7e98.pkl"
            with open(annotation_dataset_path, 'rb') as f:
                df = pickle.load(f)
            return df
        except Exception as e:
            print(f"Error loading annotation dataset: {e}")
            return None
    
    def _get_annotation_feature_names(self) -> List[str]:
        """Get feature names for annotation columns (both OneHotEncoded categorical and numeric)"""
        try:
            # Load annotation dataset
            annotation_data = self._load_annotation_dataset()
            if annotation_data is None or annotation_data.empty:
                return []
            
            # Select categorical columns for OneHotEncoder (excluding high-cardinality columns)
            categorical_columns = [
                'FinalSurfaceLabel_Method2',
                'apical_negative_manual_tissuedetail',
                'apical_positive_manual_tissuedetail'
            ]
            
            # Filter to only include columns that exist in the dataset
            available_categorical_columns = [col for col in categorical_columns if col in annotation_data.columns]
            
            # Select numeric columns (exclude gene_symbol and categorical columns)
            numeric_columns = []
            for col in annotation_data.columns:
                if (col != 'gene_symbol' and 
                    col not in available_categorical_columns and
                    pd.api.types.is_numeric_dtype(annotation_data[col])):
                    numeric_columns.append(col)
            
            final_feature_names = []
            
            # Add OneHotEncoded categorical feature names
            if available_categorical_columns:
                categorical_data = annotation_data[available_categorical_columns].fillna('Unknown')
                encoder = OneHotEncoder(sparse_output=False, handle_unknown='ignore')
                encoder.fit(categorical_data)
                feature_names = encoder.get_feature_names_out(available_categorical_columns)
                final_feature_names.extend(feature_names.tolist())
            
            # Add numeric column names
            final_feature_names.extend(numeric_columns)
            
            return final_feature_names
            
        except Exception as e:
            print(f"Error getting annotation feature names: {e}")
            return []
    
    async def filter_genes(
        self,
        analysis_id: str,
        table_name: str,
        filter_request: GeneFilterRequest
    ) -> List[str]:
        """Filter genes based on criteria"""
        
        query_parts = [f"SELECT key_column_value FROM {table_name}"]
        query_parts.append("WHERE analysis_result_id = :analysis_id")
        
        params = {"analysis_id": analysis_id}
        
        # Add score filters
        if filter_request.min_total_score is not None:
            query_parts.append("AND total_score >= :min_total_score")
            params["min_total_score"] = filter_request.min_total_score
        
        if filter_request.max_total_score is not None:
            query_parts.append("AND total_score <= :max_total_score")
            params["max_total_score"] = filter_request.max_total_score
        
        # Add gene symbol filters
        if filter_request.gene_symbols:
            placeholders = ','.join([f':gene_{i}' for i in range(len(filter_request.gene_symbols))])
            query_parts.append(f"AND key_column_value IN ({placeholders})")
            for i, gene in enumerate(filter_request.gene_symbols):
                params[f'gene_{i}'] = gene
        
        # Add rule score filters
        if filter_request.rule_score_filters:
            for rule_name, score_range in filter_request.rule_score_filters.items():
                if 'min' in score_range:
                    query_parts.append(f"AND {rule_name}_score >= :{rule_name}_min")
                    params[f"{rule_name}_min"] = score_range['min']
                if 'max' in score_range:
                    query_parts.append(f"AND {rule_name}_score <= :{rule_name}_max")
                    params[f"{rule_name}_max"] = score_range['max']
        
        query = " ".join(query_parts)
        
        result = self.db.execute(text(query), params)
        rows = result.fetchall()
        
        return [row[0] for row in rows]
    
    async def sort_genes(
        self,
        analysis_id: str,
        table_name: str,
        sort_request: GeneSortRequest
    ) -> List[str]:
        """Sort genes based on criteria"""
        
        query_parts = [f"SELECT key_column_value FROM {table_name}"]
        query_parts.append("WHERE analysis_result_id = :analysis_id")
        
        params = {"analysis_id": analysis_id}
        
        # Add sorting
        if sort_request.sort_by == "total_score":
            order_clause = f"ORDER BY total_score {sort_request.sort_order.upper()} NULLS LAST"
        elif sort_request.sort_by == "gene_symbol":
            order_clause = f"ORDER BY key_column_value {sort_request.sort_order.upper()}"
        else:
            order_clause = f"ORDER BY {sort_request.sort_by}_score {sort_request.sort_order.upper()} NULLS LAST"
        
        # Add secondary sort
        if sort_request.secondary_sort_by:
            if sort_request.secondary_sort_by == "gene_symbol":
                order_clause += f", key_column_value {sort_request.secondary_sort_order.upper()}"
            else:
                order_clause += f", {sort_request.secondary_sort_by}_score {sort_request.secondary_sort_order.upper()} NULLS LAST"
        
        query_parts.append(order_clause)
        
        query = " ".join(query_parts)
        
        result = self.db.execute(text(query), params)
        rows = result.fetchall()
        
        return [row[0] for row in rows]
    
    async def process_gene_list(
        self,
        analysis_id: str,
        table_name: str,
        gene_list_request: GeneListUploadRequest
    ) -> List[Dict[str, Any]]:
        """Process uploaded gene list and return matching genes"""
        
        # Build query to find matching genes
        placeholders = ','.join([f':gene_{i}' for i in range(len(gene_list_request.gene_symbols))])
        
        query_parts = [f"SELECT key_column_value, total_score FROM {table_name}"]
        query_parts.append("WHERE analysis_result_id = :analysis_id")
        
        if gene_list_request.case_sensitive:
            query_parts.append(f"AND key_column_value IN ({placeholders})")
        else:
            query_parts.append(f"AND LOWER(key_column_value) IN ({placeholders})")
        
        params = {"analysis_id": analysis_id}
        for i, gene in enumerate(gene_list_request.gene_symbols):
            if gene_list_request.case_sensitive:
                params[f'gene_{i}'] = gene
            else:
                params[f'gene_{i}'] = gene.lower()
        
        # Add score filters
        if gene_list_request.min_total_score is not None:
            query_parts.append("AND total_score >= :min_total_score")
            params["min_total_score"] = gene_list_request.min_total_score
        
        if gene_list_request.max_total_score is not None:
            query_parts.append("AND total_score <= :max_total_score")
            params["max_total_score"] = gene_list_request.max_total_score
        
        query_parts.append("ORDER BY total_score DESC NULLS LAST")
        
        query = " ".join(query_parts)
        
        result = self.db.execute(text(query), params)
        rows = result.fetchall()
        
        # Convert to list of dictionaries
        matching_genes = []
        for row in rows:
            matching_genes.append({
                "gene_symbol": row[0],
                "total_score": row[1],
                "matched": True
            })
        
        return matching_genes
    
    async def get_heatmap_data(
        self,
        analysis_id: str,
        table_name: str,
        heatmap_type: str,
        gene_symbols: Optional[List[str]] = None
    ) -> HeatmapData:
        """Get specific heatmap data"""
        
        if heatmap_type == "rubric_scores":
            return await self._get_rubric_scores_heatmap(analysis_id, table_name, gene_symbols or [])
        elif heatmap_type == "numeric_columns":
            return await self._get_numeric_columns_heatmap(analysis_id, table_name, gene_symbols or [])
        elif heatmap_type == "annotations":
            return await self._get_annotations_heatmap(analysis_id, table_name, gene_symbols or [])
        else:
            raise ValueError(f"Unknown heatmap type: {heatmap_type}")
    
    async def get_available_columns(
        self,
        analysis_id: str,
        table_name: Optional[str]
    ) -> Dict[str, List[str]]:
        """Get available columns for heatmap configuration"""
        
        if table_name:
            # Use wide table data
            inspector = inspect(self.db.bind)
            columns = inspector.get_columns(table_name)
            
            # Categorize columns
            rubric_columns = [
                col['name'] for col in columns 
                if col['name'].endswith('_score') and not col['name'].startswith('total_')
            ]
            
            numeric_columns = [
                col['name'] for col in columns 
                if (col['type'].python_type in [float, int] and 
                    not col['name'].endswith('_score') and 
                    not col['name'].startswith('key_') and
                    not col['name'].startswith('analysis_') and
                    col['name'] not in ['total_score', 'total_weighted_score'])
            ]
        else:
            # Use cache data
            import pickle
            import os
            
            cache_dir = "/Users/zayed/Downloads/ai_apps/rubricrunner/backend/results_cache"
            pickle_file = os.path.join(cache_dir, f"res_{analysis_id}.pkl")
            
            if os.path.exists(pickle_file):
                with open(pickle_file, 'rb') as f:
                    data = pickle.load(f)
                
                # Categorize columns from cache data
                rubric_columns = [
                    col for col in data.columns 
                    if col.endswith('_SCORE') and not col.startswith('total_')
                ]
                
                numeric_columns = [
                    col for col in data.columns 
                    if (not col.endswith('_SCORE') and 
                        not col.startswith('key_') and
                        not col.startswith('analysis_') and
                        col not in ['total_score', 'total_weighted_score', 'gene_symbol', 'ensg_id', 'Gene description'] and
                        col not in ['team_review', 'assessment_status', 'Tiers_Internal', 'Reliability (IH)', 'FinalSurfaceLabel_Method2'])
                ]
            else:
                rubric_columns = []
                numeric_columns = []
        
        # Get annotation columns from OneHotEncoded features
        annotation_columns = self._get_annotation_feature_names()
        
        return {
            "rubric_columns": rubric_columns,
            "numeric_columns": numeric_columns,
            "annotation_columns": annotation_columns
        }
    
    async def update_color_scheme(
        self,
        analysis_id: str,
        color_scheme_request: ColorSchemeRequest
    ) -> ColorSchemeRequest:
        """Update color scheme for heatmap visualization"""
        
        # In a real implementation, this would store the color scheme preferences
        # For now, just return the request
        return color_scheme_request
    
    async def get_gene_annotations(
        self,
        analysis_id: str,
        gene_symbols: Optional[List[str]] = None
    ) -> List[GeneAnnotation]:
        """Get gene annotations (placeholder for future implementation)"""
        
        # Placeholder implementation
        annotations = []
        
        if gene_symbols:
            for gene in gene_symbols:
                # Placeholder annotations
                annotations.extend([
                    GeneAnnotation(
                        gene_symbol=gene,
                        annotation_type="surface_gene",
                        annotation_value=gene in ["EGFR", "VEGFA", "TGFB1"],
                        confidence=0.8,
                        source="placeholder"
                    ),
                    GeneAnnotation(
                        gene_symbol=gene,
                        annotation_type="common_essential",
                        annotation_value=gene in ["EGFR", "AKT1", "MTOR"],
                        confidence=0.9,
                        source="placeholder"
                    )
                ])
        
        return annotations
    
    async def _get_gene_data_from_cache(
        self,
        analysis_id: str,
        limit: int,
        sort_by: str,
        sort_order: str,
        filter_genes: Optional[List[str]] = None
    ) -> pd.DataFrame:
        """Get gene data from cache files when wide tables are not available"""
        
        import pickle
        import json
        import os
        
        # Paths to cache files
        cache_dir = "/Users/zayed/Downloads/ai_apps/rubricrunner/backend/results_cache"
        pickle_file = os.path.join(cache_dir, f"res_{analysis_id}.pkl")
        meta_file = os.path.join(cache_dir, f"meta_{analysis_id}.json")
        
        if not os.path.exists(pickle_file) or not os.path.exists(meta_file):
            raise ValueError(f"Cache files not found for analysis {analysis_id}")
        
        # Load metadata
        with open(meta_file, 'r') as f:
            metadata = json.load(f)
        
        # Load data
        with open(pickle_file, 'rb') as f:
            data = pickle.load(f)
        
        # Convert to DataFrame
        df = pd.DataFrame(data)
        
        # Apply gene filter if provided
        if filter_genes:
            df = df[df['gene_symbol'].isin(filter_genes)]
        
        # Sort data
        if sort_by == "total_score":
            # Look for total score column (usually ends with _RUBRIC_SCORE)
            total_score_col = None
            for col in df.columns:
                if col.endswith('_RUBRIC_SCORE'):
                    total_score_col = col
                    break
            
            if total_score_col:
                df = df.sort_values(total_score_col, ascending=(sort_order == 'asc'))
            else:
                # Fallback to gene_symbol if no total score column found
                df = df.sort_values('gene_symbol', ascending=(sort_order == 'asc'))
        elif sort_by == "gene_symbol":
            df = df.sort_values('gene_symbol', ascending=(sort_order == 'asc'))
        else:
            # Sort by specific column if it exists
            if sort_by in df.columns:
                df = df.sort_values(sort_by, ascending=(sort_order == 'asc'))
        
        # Limit results
        df = df.head(limit)
        
        return df
