export interface Rule {
  id: string;
  name: string;
  description?: string;
  owner_name?: string;
  organization?: string;
  disease_area_study?: string;
  tags?: string[];
  ruleset_conditions: string[];
  column_mapping: Record<string, string>;
  weight: number;
  created_date: string;
  modified_date: string;
  is_active: boolean;
}

export interface Rubric {
  id: string;
  name: string;
  description?: string;
  owner_name?: string;
  organization?: string;
  disease_area_study?: string;
  tags?: string[];
  created_date: string;
  modified_date: string;
  is_active: boolean;
  visibility?: 'public' | 'private' | 'hidden';
  enabled?: boolean;
}

export interface RubricRule {
  id: string;
  rubric_id: string;
  rule_id: string;
  weight: number;
  order_index: number;
  is_active: boolean;
}

export interface ExecutionRecord {
  id: string;
  project_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  message: string;
  results_file?: string;
  started_at: string;
  completed_at?: string;
  error?: string;
}

export interface ProjectDataset {
  id: string;
  name: string;
  filename: string;
  file_path: string;
  size: string;
  upload_date: string;
  status: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  owner_name?: string;
  organization?: string;
  created_date: string;
  input_data_file?: string;
  applied_rules: string[];
  applied_rubrics: string[];
  results?: string;
  execution_history: ExecutionRecord[];
}

export interface DataColumn {
  name: string;
  type: string;
  category: 'score' | 'data' | 'annotation';
  stats?: ColumnStats;
}

export interface ColumnStats {
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  std?: number;
  null_count: number;
  null_percentage: number;
  unique_values?: number;
  top_values?: Record<string, number>;
}

export interface AnalysisResult {
  job_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  message: string;
  results_file?: string;
  total_genes?: number;
  error?: string;
}

export interface RuleCondition {
  condition: string;
  score: number | null;
  result?: boolean;
}

export interface RuleTestResult {
  rule_name: string;
  mapped_data: Record<string, string | number | boolean>;
  condition_results: RuleCondition[];
  final_score: number | null;
  error?: string;
}

export interface DataPreview {
  total_rows: number;
  columns: string[];
  sample_data?: Record<string, unknown>[];
}

export interface AnalysisPreview {
  project_name: string;
  rules: Rule[];
  rubrics: Rubric[];
  estimated_computation: number;
}

export interface AnalysisExecutionResponse {
  job_id: string;
  status: string;
  progress: number;
  message: string;
}

// Dataset Types
export type DatasetType = 'input' | 'output' | 'annotations' | 'rubric';

export interface Dataset {
  id: string;
  name: string;
  description?: string;
  owner_name?: string;
  organization?: string;
  disease_area_study?: string;
  tags?: string;
  dataset_type: DatasetType;
  original_filename: string;
  file_path: string;
  pickled_path: string;
  num_rows: number;
  num_columns: number;
  num_numeric_columns: number;
  num_string_columns: number;
  num_score_columns: number;
  created_date: string;
  modified_date: string;
  columns?: DatasetColumn[];
}

export interface DatasetColumn {
  id: string;
  dataset_id: string;
  original_name: string;
  sanitized_name: string;
  column_type: 'numeric' | 'string' | 'score';
  column_index: number;
  mean_value?: number;
  median_value?: number;
  min_value?: number;
  max_value?: number;
  std_deviation?: number;
  null_count?: number;
  unique_count?: number;
  most_common_value?: string;
  most_common_count?: number;
  created_date: string;
}

export interface DatasetSummary {
  id: string;
  name: string;
  description?: string;
  owner_name?: string;
  organization?: string;
  disease_area_study?: string;
  tags?: string;
  dataset_type: DatasetType;
  original_filename: string;
  num_rows: number;
  num_columns: number;
  num_numeric_columns: number;
  num_string_columns: number;
  num_score_columns: number;
  created_date: string;
  modified_date: string;
}

export interface DatasetStats {
  total_rows: number;
  total_columns: number;
  numeric_columns: number;
  string_columns: number;
  score_columns: number;
  column_details: DatasetColumn[];
}

export interface DatasetColumnMapping {
  dataset_id: string;
  column_mapping: Record<string, string>;
  total_columns: number;
}

export interface DatasetValidationResult {
  dataset_id: string;
  validation_result: {
    is_valid: boolean;
    missing_columns: string[];
    available_columns: string[];
    total_columns: number;
  };
}

// New types for enhanced analysis page
export interface RubricValidationResult {
  is_valid: boolean;
  validation_status: 'Pass' | 'Failure';
  rubric_id: string;
  rubric_name: string;
  dataset_id: string;
  dataset_name: string;
  total_rules: number;
  valid_rules: number;
  invalid_rules: number;
  compatibility_percentage: number;
  color: 'red' | 'orange' | 'light-blue' | 'green' | 'gray';
  status_message: string;
  missing_columns: string[];
  validation_details: RuleValidationDetail[];
  message: string;
}

export interface RuleValidationDetail {
  rule_id: string;
  rule_name: string;
  is_valid: boolean;
  missing_columns: string[];
  available_columns: Array<{
    variable: string;
    column_name: string;
    original_name: string;
  }>;
  column_mapping: Record<string, string>;
}

export interface RubricRulesResponse {
  rubric_id: string;
  rubric_name: string;
  total_rules: number;
  rules: Array<{
    id: string;
    name: string;
    description?: string;
    ruleset_conditions: string[];
    column_mapping: Record<string, string>;
    weight: number;
    rubric_weight: number;
    order_index: number;
    owner_name?: string;
    organization?: string;
    disease_area_study?: string;
    tags: string[];
    created_date?: string;
    modified_date?: string;
  }>;
}

export interface AnalysisExecution {
  id: string;
  project_id: string;
  rubric_id: string;
  dataset_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  message: string;
  results_file?: string;
  total_genes?: number;
  started_at: string;
  completed_at?: string;
  error?: string;
  name?: string;
}

export interface AnalysisResults {
  execution_id: string;
  analysis_result_id?: string;  // Optional analysis result ID
  status: 'completed' | 'failed';
  results_file: string;
  total_genes: number;
  score_distribution: {
    [score_name: string]: {
      min: number;
      max: number;
      mean: number;
      median: number;
      std: number;
      count?: number;
      valid_percentage?: number;
    };
  };
  gene_scores: Array<{
    gene_id: string;
    gene_name: string;
    scores: Record<string, number>;
    total_score: number;
  }>;
  completed_at: string;
}

// Histogram Types
export interface DatasetHistogram {
  id: string;
  dataset_id: string;
  column_id: string;
  bin_count: number;
  bin_edges: number[];
  bin_counts: number[];
  min_value: number;
  max_value: number;
  total_count: number;
  null_count: number;
  created_date: string;
}

export interface DatasetHistogramWithColumn {
  histogram: DatasetHistogram;
  column: DatasetColumn;
}

export interface DatasetHistogramRequest {
  dataset_id: string;
  column_ids?: string[];
  bin_count?: number;
  force_regenerate?: boolean;
}

// Analysis Result Types
export interface AnalysisResult {
  id: string;
  project_id: string;
  rubric_id: string;
  dataset_id: string;
  created_date: string;
  modified_date: string;
  name?: string;
  total_genes_processed: number;
  total_rules_executed: number;
  execution_time_seconds?: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error_message?: string;
  results_file?: string;
}

export interface AnalysisResultDetail {
  id: string;
  analysis_result_id: string;
  key_column: string;
  key_column_value: string;
  key_column_2?: string;
  key_column_2_value?: string;
  rule_id: string;
  rule_name: string;
  rule_score?: number;
  rule_weight?: number;
  weighted_score?: number;
  total_score?: number;
  execution_order?: number;
  created_date: string;
}

export interface AnalysisResultWithDetails extends AnalysisResult {
  details: AnalysisResultDetail[];
}

export interface GeneScoreResult {
  gene_symbol: string;
  total_score?: number;
  rule_scores: Array<{
    rule_id: string;
    rule_name: string;
    rule_score?: number;
    rule_weight?: number;
    weighted_score?: number;
    execution_order?: number;
  }>;
}

export interface AnalysisResultsResponse {
  analysis_result: AnalysisResult;
  results: GeneScoreResult[];
  pagination: {
    limit: number;
    offset: number;
    total_count: number;
  };
}

export interface AnalysisSummaryResponse {
  analysis_result_id: string;
  total_genes: number;
  total_rules: number;
  score_statistics: {
    min?: number;
    max?: number;
    mean?: number;
    median?: number;
    std?: number;
    count?: number;
  };
  score_distribution?: {
    [scoreName: string]: {
      min?: number;
      max?: number;
      mean?: number;
      median?: number;
      std?: number;
      count?: number;
      valid_percentage?: number;
    };
  };
  top_genes: Array<{
    gene_symbol: string;
    total_score: number;
  }>;
  rule_statistics: Array<{
    rule_id: string;
    rule_name: string;
    weight: number;
    score_stats?: {
      min: number;
      max: number;
      mean: number;
      median: number;
      std: number;
    };
  }>;
}

export interface AnalysisExecutionRequest {
  project_id: string;
  rubric_id: string;
  dataset_id: string;
  key_column?: string;
}

export interface AnalysisExecutionResponse {
  id: string;
  project_id: string;
  rubric_id: string;
  dataset_id: string;
  status: string;
  total_genes_processed: number;
  total_rules_executed: number;
  execution_time_seconds?: number;
  created_date: string;
  error_message?: string;
}

// Extended types for analysis with project/rubric/dataset info
export interface AnalysisResultWithInfo extends AnalysisResult {
  project?: {
    id: string;
    name: string;
    owner_name?: string;
  };
  rubric?: {
    id: string;
    name: string;
  };
  dataset?: {
    id: string;
    name: string;
  };
}