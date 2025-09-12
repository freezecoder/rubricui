import { Project, Rubric, ProjectDataset, Dataset, DatasetStats, RubricValidationResult, Rule, RubricRulesResponse } from '@/types';

export interface AnalysisConfig {
  metadata: {
    export_date: string;
    export_version: string;
    project_name: string;
    project_id: string;
  };
  analysis: {
    project_id: string;
    rubric_id: string;
    dataset_id: string;
    execution_type: 'rubric';
  };
  project: {
    id: string;
    name: string;
    description: string;
    created_date: string;
    owner_id: string;
  };
  rubric: {
    id: string;
    name: string;
    description: string;
    organization: string;
    disease_area: string;
    created_date: string;
    rules: Array<{
      id: string;
      name: string;
      description: string;
      weight: number;
      order_index: number;
      conditions: string;
      variables: string;
      organization: string;
      disease_area: string;
    }>;
  };
  dataset: {
    id: string;
    name: string;
    filename: string;
    upload_date: string;
    size: number;
    status: string;
    file_path: string;
    statistics: DatasetStats;
  };
  validation: {
    is_valid: boolean;
    compatible_rules: number;
    total_rules: number;
    missing_columns: string[];
    validation_date: string;
  };
  execution_settings: {
    key_column: string;
    output_format: 'excel' | 'csv';
    include_intermediate_results: boolean;
    save_to_database: boolean;
  };
}

export function generateAnalysisConfig(
  project: Project,
  rubric: Rubric,
  dataset: ProjectDataset,
  datasetStats: DatasetStats,
  validationResult: RubricValidationResult,
  rules: RubricRulesResponse['rules'],
  selectedRubricId: string,
  selectedDatasetId: string
): AnalysisConfig {
  const now = new Date().toISOString();
  
  return {
    metadata: {
      export_date: now,
      export_version: '1.0.0',
      project_name: project.name,
      project_id: project.id
    },
    analysis: {
      project_id: project.id,
      rubric_id: selectedRubricId,
      dataset_id: selectedDatasetId,
      execution_type: 'rubric'
    },
    project: {
      id: project.id,
      name: project.name,
      description: project.description || '',
      created_date: project.created_date,
      owner_id: project.owner_id || ''
    },
    rubric: {
      id: rubric.id,
      name: rubric.name,
      description: rubric.description || '',
      organization: rubric.organization || '',
      disease_area: rubric.disease_area_study || '',
      created_date: rubric.created_date,
      rules: rules.map(rule => ({
        id: rule.id,
        name: rule.name,
        description: rule.description || '',
        weight: rule.weight || 1,
        order_index: rule.order_index || 0,
        conditions: rule.ruleset_conditions?.join('; ') || '',
        variables: Object.keys(rule.column_mapping || {}).join(', '),
        organization: rule.organization || '',
        disease_area: rule.disease_area_study || ''
      }))
    },
    dataset: {
      id: dataset.id,
      name: dataset.name,
      filename: dataset.filename,
      upload_date: dataset.uploadDate,
      size: dataset.size,
      status: dataset.status,
      file_path: dataset.file_path || '',
      statistics: datasetStats
    },
    validation: {
      is_valid: validationResult.is_valid,
      compatible_rules: validationResult.compatible_rules,
      total_rules: validationResult.total_rules,
      missing_columns: validationResult.missing_columns || [],
      validation_date: validationResult.validation_date || now
    },
    execution_settings: {
      key_column: 'ensg_id', // Default key column for gene identification
      output_format: 'excel',
      include_intermediate_results: true,
      save_to_database: true
    }
  };
}

export function downloadYAMLConfig(config: AnalysisConfig, filename?: string): void {
  const yamlContent = convertToYAML(config);
  const blob = new Blob([yamlContent], { type: 'text/yaml' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `analysis_config_${config.metadata.project_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.yaml`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

function convertToYAML(obj: any, indent: number = 0): string {
  const spaces = '  '.repeat(indent);
  let yaml = '';
  
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      yaml += `${spaces}${key}: null\n`;
    } else if (Array.isArray(value)) {
      yaml += `${spaces}${key}:\n`;
      for (const item of value) {
        if (typeof item === 'object' && item !== null) {
          yaml += `${spaces}  - `;
          const itemYaml = convertToYAML(item, indent + 2);
          yaml += itemYaml.substring(spaces.length + 2);
        } else {
          yaml += `${spaces}  - ${formatValue(item)}\n`;
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      yaml += `${spaces}${key}:\n`;
      yaml += convertToYAML(value, indent + 1);
    } else {
      yaml += `${spaces}${key}: ${formatValue(value)}\n`;
    }
  }
  
  return yaml;
}

function formatValue(value: any): string {
  if (typeof value === 'string') {
    // Escape special characters and wrap in quotes if needed
    if (value.includes(':') || value.includes('"') || value.includes("'") || value.includes('\n')) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
  }
  if (typeof value === 'boolean') {
    return value.toString();
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  return String(value);
}

// Simplified version for /run page with Dataset type
export function generateAnalysisConfigSimple(
  project: Project,
  rubricId: string,
  datasetId: string,
  analysisName: string
): AnalysisConfig {
  const now = new Date().toISOString();
  
  return {
    metadata: {
      export_date: now,
      export_version: '1.0.0',
      project_name: analysisName,
      project_id: project.id
    },
    analysis: {
      project_id: project.id,
      rubric_id: rubricId,
      dataset_id: datasetId,
      execution_type: 'rubric'
    },
    project: {
      id: project.id,
      name: project.name,
      description: project.description || '',
      created_date: project.created_date,
      owner_id: project.owner_id || 'system'
    },
    rubric: {
      id: rubricId,
      name: 'Selected Rubric',
      description: 'Rubric selected for analysis',
      organization: 'Unknown',
      disease_area: 'General',
      created_date: now,
      rules: []
    },
    dataset: {
      id: datasetId,
      name: 'Selected Dataset',
      filename: 'dataset.xlsx',
      upload_date: now,
      size: 0,
      status: 'ready',
      file_path: '',
      statistics: {
        total_rows: 0,
        total_columns: 0,
        numeric_columns: 0,
        string_columns: 0,
        score_columns: 0,
        null_counts: {},
        mean_values: {},
        median_values: {},
        std_deviations: {}
      }
    },
    validation: {
      is_valid: true,
      missing_columns: [],
      extra_columns: [],
      validation_date: now
    },
    execution_settings: {
      output_format: 'excel',
      include_debug_info: true,
      generate_summary: true,
      sort_by_total_score: true
    }
  };
}
