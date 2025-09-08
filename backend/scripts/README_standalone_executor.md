# Standalone Analysis Executor

This directory contains tools for running analysis configurations independently of the web interface, enabling reproducibility and debugging of the rubric runner pipeline.

## Overview

The standalone execution system consists of:

1. **YAML Configuration Export** - Frontend functionality to export analysis configurations
2. **Standalone Analysis Executor** - Python script to execute analysis from YAML configs

## YAML Configuration Export

### Frontend Integration

The analysis page (`/projects/[id]/analysis`) now includes an "Export Config" button that generates a YAML file containing:

- Project metadata and settings
- Selected rubric and its rules
- Dataset information and statistics
- Validation results
- Execution settings

### YAML Structure

```yaml
metadata:
  export_date: "2025-01-08T15:30:00.000Z"
  export_version: "1.0.0"
  project_name: "LUSC Example Analysis"
  project_id: "f1908a17647043b583f985ec0d838d70"

analysis:
  project_id: "f1908a17647043b583f985ec0d838d70"
  rubric_id: "b67cb49cc4ae435181502e4e1517a109"
  dataset_id: "6957a07f15b04b94985453725497ab7f"
  execution_type: "rubric"

project:
  id: "f1908a17647043b583f985ec0d838d70"
  name: "LUSC Example Analysis"
  description: "Example project using LUSC data"
  created_date: "2025-01-08T10:00:00.000Z"
  owner_id: "admin"

rubric:
  id: "b67cb49cc4ae435181502e4e1517a109"
  name: "LUSC Marker Agnostic"
  description: "LUSC Marker Agnostic rubric"
  organization: "nj"
  disease_area: "LUSC"
  created_date: "2025-01-08T10:00:00.000Z"
  rules:
    - id: "rule_1"
      name: "magnitude_expr_median"
      description: "Expression Magnitude (Median)"
      weight: 1
      order_index: 0
      conditions: "TRUE ~ 0"
      variables: "tcga_expr_percentile_rank"
      organization: "nj"
      disease_area: "LUSC"

dataset:
  id: "6957a07f15b04b94985453725497ab7f"
  name: "lusc_input"
  filename: "lusc_input.xlsx"
  upload_date: "2025-01-08T10:00:00.000Z"
  size: 19604
  status: "ready"
  file_path: "/path/to/lusc_input.xlsx"
  statistics:
    total_rows: 19604
    total_columns: 81
    numeric_columns: 49
    score_columns: 12

validation:
  is_valid: true
  compatible_rules: 8
  total_rules: 11
  missing_columns: []
  validation_date: "2025-01-08T15:30:00.000Z"

execution_settings:
  key_column: "ensg_id"
  output_format: "excel"
  include_intermediate_results: true
  save_to_database: true
```

## Standalone Analysis Executor

### Installation

1. Install required dependencies:
```bash
cd backend
pip install -r requirements.txt
```

2. Ensure the database is set up and contains the required data:
```bash
python scripts/init_db.py
python scripts/load_example_data.py
```

### Usage

#### Basic Execution
```bash
python scripts/standalone_analysis_executor.py config.yaml
```

#### With Custom Output Directory
```bash
python scripts/standalone_analysis_executor.py config.yaml --output-dir ./my_results
```

#### Dry Run (Validation Only)
```bash
python scripts/standalone_analysis_executor.py config.yaml --dry-run
```

#### Verbose Logging
```bash
python scripts/standalone_analysis_executor.py config.yaml --verbose
```

### Command Line Options

- `config` - Path to YAML configuration file (required)
- `--output-dir DIR` - Output directory for results (default: ./results)
- `--verbose` - Enable verbose logging
- `--dry-run` - Validate configuration without executing
- `--help` - Show help message

### Output Files

The executor generates several output files:

1. **Results File** - Excel file with analysis results
   - Format: `{project_name}_{rubric_name}_{timestamp}_results.xlsx`
   - Contains gene scores and analysis results

2. **Summary File** - Text summary of the analysis
   - Format: `{project_name}_{rubric_name}_{timestamp}_summary.txt`
   - Contains metadata and statistics

3. **Debug Report** - Detailed debug information
   - Format: `{project_name}_{timestamp}_debug_report.txt`
   - Contains configuration details, validation results, and sample data

4. **Log File** - Execution log
   - File: `standalone_analysis.log`
   - Contains detailed execution logs

### Example Output

```
✅ Analysis completed successfully!
📊 Results: ./results/LUSC_Example_Analysis_LUSC_Marker_Agnostic_20250108_153000_results.xlsx
🔍 Debug Report: ./results/LUSC_Example_Analysis_20250108_153000_debug_report.txt
🧬 Total Genes: 19,604
📋 Total Rules: 11
```

## Use Cases

### 1. Reproducibility
- Export analysis configurations from the web interface
- Re-run analyses with identical parameters
- Verify results across different environments

### 2. Debugging
- Isolate analysis execution from web interface
- Generate detailed debug reports
- Test rule modifications independently

### 3. Batch Processing
- Process multiple configurations in sequence
- Integrate with external workflow systems
- Automated analysis pipelines

### 4. Development and Testing
- Test new rules and rubrics
- Validate analysis logic changes
- Performance testing and optimization

## Troubleshooting

### Common Issues

1. **Configuration File Not Found**
   - Ensure the YAML file path is correct
   - Check file permissions

2. **Database Connection Failed**
   - Verify database is running
   - Check database configuration
   - Ensure required data is loaded

3. **Dataset File Not Found**
   - Verify dataset file path in configuration
   - Check file permissions
   - Ensure file format is supported

4. **Analysis Execution Failed**
   - Check rule conditions and variables
   - Verify dataset column names match rule variables
   - Review validation results in configuration

### Debug Mode

Use `--verbose` flag for detailed logging:
```bash
python scripts/standalone_analysis_executor.py config.yaml --verbose
```

### Validation Mode

Use `--dry-run` to validate configuration without execution:
```bash
python scripts/standalone_analysis_executor.py config.yaml --dry-run
```

## Integration with CI/CD

The standalone executor can be integrated into continuous integration pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Analysis
  run: |
    python backend/scripts/standalone_analysis_executor.py test_config.yaml --output-dir ./test_results
```

## Security Considerations

- YAML files may contain sensitive file paths
- Ensure proper file permissions on configuration files
- Consider sanitizing paths in exported configurations
- Validate YAML files before execution

## Performance

- The executor uses the same analysis engine as the web interface
- Memory usage scales with dataset size
- Consider dataset size when running multiple analyses
- Use appropriate system resources for large datasets
