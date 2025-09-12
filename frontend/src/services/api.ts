import { Rule, Rubric, RubricRule, Project, DataPreview, AnalysisPreview, AnalysisResult, AnalysisExecutionResponse, RuleTestResult, Dataset, DatasetSummary, DatasetStats, DatasetColumn, DatasetColumnMapping, DatasetValidationResult, ProjectDataset, RubricValidationResult, RubricRulesResponse, AnalysisExecution, AnalysisResults, DatasetHistogram, DatasetHistogramWithColumn, DatasetHistogramRequest, AnalysisResultWithDetails, AnalysisResultsResponse, AnalysisSummaryResponse, AnalysisExecutionRequest, AnalysisResultWithInfo, DatasetType } from '@/types';
import { notify } from '@/lib/notifications';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

class ApiService {
  private async fetchWithError(url: string, options?: RequestInit) {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Health check API
  async checkHealth(): Promise<{ status: string; timestamp: string }> {
    try {
      // Use direct backend URL for health check since it's not under /api prefix
      const backendUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:8000';
      const response = await fetch(`${backendUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        return await response.json();
      } else {
        throw new Error(`Health check failed with status: ${response.status}`);
      }
    } catch (error) {
      throw new Error(`API is unreachable: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Rules API
  async getRules(sortBy?: string, sortOrder?: string): Promise<Rule[]> {
    const params = new URLSearchParams();
    if (sortBy) params.append('sort_by', sortBy);
    if (sortOrder) params.append('sort_order', sortOrder);
    
    const queryString = params.toString();
    return this.fetchWithError(`/rules${queryString ? `?${queryString}` : ''}`);
  }

  async getRule(id: string): Promise<Rule> {
    return this.fetchWithError(`/rules/${id}`);
  }

  async createRule(rule: Omit<Rule, 'id' | 'created_date' | 'modified_date'>): Promise<Rule> {
    return this.fetchWithError('/rules', {
      method: 'POST',
      body: JSON.stringify(rule),
    });
  }

  async updateRule(id: string, rule: Omit<Rule, 'id' | 'created_date' | 'modified_date'>): Promise<Rule> {
    return this.fetchWithError(`/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(rule),
    });
  }

  async deleteRule(id: string): Promise<void> {
    return this.fetchWithError(`/rules/${id}`, {
      method: 'DELETE',
    });
  }

  async bulkDeleteRules(ruleIds: string[]): Promise<{ message: string; deleted_count: number; deleted_ids: string[] }> {
    return this.fetchWithError('/rules/bulk', {
      method: 'DELETE',
      body: JSON.stringify(ruleIds),
    });
  }

  async testRule(id: string, sampleData: Record<string, string | number | boolean>): Promise<RuleTestResult> {
    return this.fetchWithError(`/rules/${id}/test`, {
      method: 'POST',
      body: JSON.stringify(sampleData),
    });
  }

  async cloneRule(id: string, newName: string): Promise<Rule> {
    return this.fetchWithError(`/rules/${id}/clone`, {
      method: 'POST',
      body: JSON.stringify({ new_name: newName }),
    });
  }

  // Rubrics API
  async getRubrics(): Promise<Rubric[]> {
    return this.fetchWithError('/rubrics');
  }

  async getRubric(id: string): Promise<Rubric> {
    return this.fetchWithError(`/rubrics/${id}`);
  }

  async createRubric(rubric: Omit<Rubric, 'id' | 'created_date' | 'modified_date'>): Promise<Rubric> {
    return this.fetchWithError('/rubrics', {
      method: 'POST',
      body: JSON.stringify(rubric),
    });
  }

  async createRubricFromTSV(
    rubricData: {
      name: string;
      description?: string;
      owner_name?: string;
      organization?: string;
      disease_area_study?: string;
      tags?: string[];
      visibility?: 'public' | 'private' | 'hidden';
      enabled?: boolean;
    },
    file: File
  ): Promise<Rubric> {
    const formData = new FormData();
    
    // Add rubric data as form fields
    formData.append('name', rubricData.name);
    if (rubricData.description) formData.append('description', rubricData.description);
    if (rubricData.owner_name) formData.append('owner_name', rubricData.owner_name);
    if (rubricData.organization) formData.append('organization', rubricData.organization);
    if (rubricData.disease_area_study) formData.append('disease_area_study', rubricData.disease_area_study);
    if (rubricData.tags && rubricData.tags.length > 0) {
      formData.append('tags', rubricData.tags.join(','));
    }
    formData.append('visibility', rubricData.visibility || 'public');
    formData.append('enabled', String(rubricData.enabled !== false));
    
    // Add the file
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/rubrics/upload-tsv`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async createRubricFromJSON(
    rubricData: {
      name: string;
      description?: string;
      owner_name?: string;
      organization?: string;
      disease_area_study?: string;
      tags?: string[];
      visibility?: 'public' | 'private' | 'hidden';
      enabled?: boolean;
    },
    file: File
  ): Promise<Rubric> {
    const formData = new FormData();
    
    // Add rubric data as form fields
    formData.append('name', rubricData.name);
    if (rubricData.description) formData.append('description', rubricData.description);
    if (rubricData.owner_name) formData.append('owner_name', rubricData.owner_name);
    if (rubricData.organization) formData.append('organization', rubricData.organization);
    if (rubricData.disease_area_study) formData.append('disease_area_study', rubricData.disease_area_study);
    if (rubricData.tags && rubricData.tags.length > 0) {
      formData.append('tags', rubricData.tags.join(','));
    }
    formData.append('visibility', rubricData.visibility || 'public');
    formData.append('enabled', String(rubricData.enabled !== false));
    
    // Add the file
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/rubrics/upload-json`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async updateRubric(id: string, rubric: Omit<Rubric, 'id' | 'created_date' | 'modified_date'>): Promise<Rubric> {
    return this.fetchWithError(`/rubrics/${id}`, {
      method: 'PUT',
      body: JSON.stringify(rubric),
    });
  }

  async deleteRubric(id: string): Promise<void> {
    return this.fetchWithError(`/rubrics/${id}`, {
      method: 'DELETE',
    });
  }

  async addRuleToRubric(rubricId: string, ruleId: string, weight: number = 1.0, orderIndex: number = 0): Promise<{ id: string; rubric_id: string; rule_id: string; weight: number; order_index: number; is_active: boolean }> {
    return this.fetchWithError(`/rubrics/${rubricId}/rules`, {
      method: 'POST',
      body: JSON.stringify({ rule_id: ruleId, weight, order_index: orderIndex }),
    });
  }

  async removeRuleFromRubric(rubricId: string, ruleId: string): Promise<void> {
    return this.fetchWithError(`/rubrics/${rubricId}/rules/${ruleId}`, {
      method: 'DELETE',
    });
  }

  async getRubricRules(rubricId: string): Promise<(RubricRule & { rule: Rule })[]> {
    return this.fetchWithError(`/rubrics/${rubricId}/rules`);
  }

  async cloneRubric(id: string, newName: string, copyRules: boolean = true): Promise<Rubric> {
    return this.fetchWithError(`/rubrics/${id}/clone`, {
      method: 'POST',
      body: JSON.stringify({ new_name: newName, copy_rules: copyRules }),
    });
  }

  // Projects API
  async getProjects(): Promise<Project[]> {
    return this.fetchWithError('/projects');
  }

  async getProject(id: string): Promise<Project> {
    return this.fetchWithError(`/projects/${id}`);
  }

  async createProject(project: Omit<Project, 'id' | 'created_date'>): Promise<Project> {
    return this.fetchWithError('/projects', {
      method: 'POST',
      body: JSON.stringify(project),
    });
  }

  async updateProject(id: string, project: Omit<Project, 'id' | 'created_date'>): Promise<Project> {
    return this.fetchWithError(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(project),
    });
  }

  async deleteProject(id: string): Promise<void> {
    return this.fetchWithError(`/projects/${id}`, {
      method: 'DELETE',
    });
  }

  async uploadProjectData(projectId: string, file: File): Promise<{ message: string; file_path: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async previewProjectData(projectId: string): Promise<DataPreview> {
    return this.fetchWithError(`/projects/${projectId}/data-preview`);
  }

  async getProjectDatasets(projectId: string): Promise<ProjectDataset[]> {
    return this.fetchWithError(`/projects/${projectId}/datasets`);
  }

  async deleteProjectDataset(projectId: string, datasetId: string): Promise<void> {
    return this.fetchWithError(`/projects/${projectId}/datasets/${datasetId}`, {
      method: 'DELETE',
    });
  }

  async getAnalysisHistory(projectId: string): Promise<{ execution_history: AnalysisResult[]; total_analyses: number }> {
    // Use the new result-analysis endpoint that queries the separate result database
    const results = await this.fetchWithError(`/result-analysis/project/${projectId}/history`);
    
    // Transform the results to match the expected format
    const execution_history = results.map((result: any) => ({
      job_id: result.id,
      status: result.status,
      progress: result.status === 'completed' ? 100 : 0,
      message: result.name || `Analysis ${result.id.substring(0, 8)}`,
      results_file: result.results_file,
      total_genes: result.total_genes_processed,
      error: result.error_message
    }));
    
    return {
      execution_history,
      total_analyses: execution_history.length
    };
  }

  // Analysis API
  async executeAnalysis(
    projectId: string,
    ruleIds: string[] = [],
    rubricIds: string[] = []
  ): Promise<AnalysisExecutionResponse> {
    const params = new URLSearchParams();
    params.append('project_id', projectId);
    ruleIds.forEach(id => params.append('rule_ids', id));
    rubricIds.forEach(id => params.append('rubric_ids', id));

    return this.fetchWithError(`/analysis/execute?${params.toString()}`, {
      method: 'POST',
    });
  }

  async getAnalysisStatus(jobId: string): Promise<AnalysisResult> {
    return this.fetchWithError(`/analysis/status/${jobId}`);
  }

  async previewAnalysis(
    projectId: string,
    ruleIds: string[] = [],
    rubricIds: string[] = []
  ): Promise<AnalysisPreview> {
    const params = new URLSearchParams();
    params.append('project_id', projectId);
    ruleIds.forEach(id => params.append('rule_ids', id));
    rubricIds.forEach(id => params.append('rubric_ids', id));

    return this.fetchWithError(`/analysis/preview?${params.toString()}`);
  }

  // Datasets API
  async getDatasets(
    skip?: number,
    limit?: number,
    organization?: string,
    owner_name?: string,
    disease_area_study?: string,
    tags?: string,
    dataset_type?: DatasetType
  ): Promise<DatasetSummary[]> {
    const params = new URLSearchParams();
    if (skip !== undefined) params.append('skip', skip.toString());
    if (limit !== undefined) params.append('limit', limit.toString());
    if (organization) params.append('organization', organization);
    if (owner_name) params.append('owner_name', owner_name);
    if (disease_area_study) params.append('disease_area_study', disease_area_study);
    if (tags) params.append('tags', tags);
    if (dataset_type) params.append('dataset_type', dataset_type);
    
    const queryString = params.toString();
    return this.fetchWithError(`/datasets${queryString ? `?${queryString}` : ''}`);
  }

  async getDataset(id: string): Promise<Dataset> {
    return this.fetchWithError(`/datasets/${id}`);
  }

  async createDataset(
    name: string,
    description: string | undefined,
    owner_name: string | undefined,
    organization: string | undefined,
    disease_area_study: string | undefined,
    tags: string | undefined,
    file: File,
    dataset_type: DatasetType = 'input'
  ): Promise<Dataset> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    if (description) formData.append('description', description);
    if (owner_name) formData.append('owner_name', owner_name);
    if (organization) formData.append('organization', organization);
    if (disease_area_study) formData.append('disease_area_study', disease_area_study);
    if (tags) formData.append('tags', tags);
    formData.append('dataset_type', dataset_type);

    const response = await fetch(`${API_BASE_URL}/datasets`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async updateDataset(
    id: string,
    updates: {
      name?: string;
      description?: string;
      owner_name?: string;
      organization?: string;
      disease_area_study?: string;
      tags?: string;
      dataset_type?: DatasetType;
    }
  ): Promise<Dataset> {
    return this.fetchWithError(`/datasets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteDataset(id: string): Promise<{ message: string }> {
    return this.fetchWithError(`/datasets/${id}`, {
      method: 'DELETE',
    });
  }

  async getDatasetColumns(
    datasetId: string,
    columnType?: 'numeric' | 'string' | 'score'
  ): Promise<DatasetColumn[]> {
    const params = new URLSearchParams();
    if (columnType) params.append('column_type', columnType);
    
    const queryString = params.toString();
    return this.fetchWithError(`/datasets/${datasetId}/columns${queryString ? `?${queryString}` : ''}`);
  }

  async getDatasetStats(datasetId: string): Promise<DatasetStats> {
    return this.fetchWithError(`/datasets/${datasetId}/stats`);
  }

  async getDatasetColumnMapping(datasetId: string): Promise<DatasetColumnMapping> {
    return this.fetchWithError(`/datasets/${datasetId}/column-mapping`);
  }

  // Dataset type and join validation API
  async getDatasetTypes(): Promise<{ dataset_types: Array<{ value: string; label: string; description: string }> }> {
    return this.fetchWithError('/datasets/metadata/types');
  }

  async getJoinableDatasets(datasetId: string, datasetType?: DatasetType): Promise<{
    source_dataset_id: string;
    source_dataset_name: string;
    joinable_datasets: Array<{
      dataset_id: string;
      dataset_name: string;
      dataset_type: string;
      common_columns: string[];
      join_column_count: number;
    }>;
    total_joinable: number;
  }> {
    const params = new URLSearchParams();
    if (datasetType) params.append('dataset_type', datasetType);
    
    const queryString = params.toString();
    return this.fetchWithError(`/datasets/${datasetId}/joinable${queryString ? `?${queryString}` : ''}`);
  }

  async validateAnnotationJoin(annotationDatasetId: string, targetDatasetId: string): Promise<{
    annotation_dataset_id: string;
    annotation_dataset_name: string;
    target_dataset_id: string;
    target_dataset_name: string;
    validation_result: {
      is_valid: boolean;
      common_columns: string[];
      annotation_columns: string[];
      target_columns: string[];
      join_column_count: number;
    };
  }> {
    return this.fetchWithError(`/datasets/${annotationDatasetId}/validate-join/${targetDatasetId}`, {
      method: 'POST',
    });
  }

  async validateDatasetForRubric(
    datasetId: string,
    requiredColumns: string[]
  ): Promise<DatasetValidationResult> {
    return this.fetchWithError(`/datasets/${datasetId}/validate-rubric`, {
      method: 'POST',
      body: JSON.stringify(requiredColumns),
    });
  }


  // Rubric Validation API
  async validateRubricForDataset(rubricId: string, datasetId: string): Promise<RubricValidationResult> {
    return this.fetchWithError('/rubric-validate/validate', {
      method: 'POST',
      body: JSON.stringify({ rubric_id: rubricId, dataset_id: datasetId }),
    });
  }

  async getRubricRulesWithDetails(rubricId: string): Promise<RubricRulesResponse> {
    return this.fetchWithError(`/rubric-validate/${rubricId}/rules`);
  }

  async refreshRubric(rubricId: string): Promise<Rubric> {
    return this.fetchWithError(`/rubric-validate/${rubricId}/refresh`);
  }

  // Enhanced Analysis API
  async executeAnalysisWithRubric(
    projectId: string,
    rubricId: string,
    datasetId: string
  ): Promise<AnalysisExecution> {
    return this.fetchWithError('/analysis/execute-rubric', {
      method: 'POST',
      body: JSON.stringify({ 
        project_id: projectId, 
        rubric_id: rubricId, 
        dataset_id: datasetId 
      }),
    });
  }

  async getAnalysisExecution(executionId: string): Promise<AnalysisExecution> {
    return this.fetchWithError(`/analysis/execution/${executionId}`);
  }

  async getAnalysisResultsByExecution(executionId: string): Promise<AnalysisResults> {
    return this.fetchWithError(`/analysis/results/${executionId}`);
  }


  // Histogram API
  async getDatasetHistograms(datasetId: string, columnId?: string): Promise<DatasetHistogram[]> {
    const params = columnId ? `?column_id=${columnId}` : '';
    return this.fetchWithError(`/datasets/${datasetId}/histograms${params}`);
  }

  async getHistogram(datasetId: string, histogramId: string): Promise<DatasetHistogramWithColumn> {
    return this.fetchWithError(`/datasets/${datasetId}/histograms/${histogramId}`);
  }

  async generateHistograms(datasetId: string, request: DatasetHistogramRequest): Promise<DatasetHistogram[]> {
    return this.fetchWithError(`/datasets/${datasetId}/histograms/generate`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async deleteHistogram(datasetId: string, histogramId: string): Promise<{ message: string }> {
    return this.fetchWithError(`/datasets/${datasetId}/histograms/${histogramId}`, {
      method: 'DELETE',
    });
  }

  async deleteAllHistograms(datasetId: string): Promise<{ message: string }> {
    return this.fetchWithError(`/datasets/${datasetId}/histograms`, {
      method: 'DELETE',
    });
  }

  // Analysis Results API
  async executeAnalysisResult(request: AnalysisExecutionRequest): Promise<AnalysisExecutionResponse> {
    return this.fetchWithError('/analysis-results/execute', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getAnalysisResults(
    projectId?: string,
    rubricId?: string,
    datasetId?: string,
    status?: string,
    limit?: number,
    offset?: number
  ): Promise<AnalysisResult[]> {
    const params = new URLSearchParams();
    if (projectId) params.append('project_id', projectId);
    if (rubricId) params.append('rubric_id', rubricId);
    if (datasetId) params.append('dataset_id', datasetId);
    if (status) params.append('status', status);
    if (limit !== undefined) params.append('limit', limit.toString());
    if (offset !== undefined) params.append('offset', offset.toString());
    
    const queryString = params.toString();
    return this.fetchWithError(`/analysis-results${queryString ? `?${queryString}` : ''}`);
  }

  async getAnalysisResult(id: string): Promise<AnalysisResultWithDetails> {
    return this.fetchWithError(`/analysis-results/${id}`);
  }

  async getAnalysisResultResults(
    id: string,
    limit?: number,
    offset?: number
  ): Promise<AnalysisResultsResponse> {
    const params = new URLSearchParams();
    if (limit !== undefined) params.append('limit', limit.toString());
    if (offset !== undefined) params.append('offset', offset.toString());
    
    const queryString = params.toString();
    return this.fetchWithError(`/analysis-results/${id}/results${queryString ? `?${queryString}` : ''}`);
  }

  async getAnalysisResultSummary(id: string): Promise<AnalysisSummaryResponse> {
    return this.fetchWithError(`/analysis-results/${id}/summary`);
  }

  async deleteAnalysisResult(id: string): Promise<{ message: string }> {
    return this.fetchWithError(`/analysis-results/${id}`, {
      method: 'DELETE',
    });
  }

  async getLatestAnalysisResult(projectId: string): Promise<AnalysisResult | null> {
    return this.fetchWithError(`/analysis-results/project/${projectId}/latest`);
  }

  async getProjectAnalysisResultsHistory(
    projectId: string,
    limit?: number,
    offset?: number
  ): Promise<AnalysisResult[]> {
    const params = new URLSearchParams();
    if (limit !== undefined) params.append('limit', limit.toString());
    if (offset !== undefined) params.append('offset', offset.toString());
    
    const queryString = params.toString();
    return this.fetchWithError(`/analysis-results/project/${projectId}/history${queryString ? `?${queryString}` : ''}`);
  }

  // Enhanced methods with notifications
  async createRuleWithNotification(rule: Omit<Rule, 'id' | 'created_date' | 'modified_date'>): Promise<Rule> {
    try {
      const result = await this.createRule(rule);
      notify.created('Rule', rule.name);
      return result;
    } catch (error) {
      notify.operationFailed('Rule creation', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async updateRuleWithNotification(id: string, rule: Omit<Rule, 'id' | 'created_date' | 'modified_date'>): Promise<Rule> {
    try {
      const result = await this.updateRule(id, rule);
      notify.updated('Rule', rule.name);
      return result;
    } catch (error) {
      notify.operationFailed('Rule update', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async deleteRuleWithNotification(id: string, ruleName?: string): Promise<void> {
    try {
      await this.deleteRule(id);
      notify.deleted('Rule', ruleName);
    } catch (error) {
      notify.operationFailed('Rule deletion', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async bulkDeleteRulesWithNotification(ruleIds: string[], ruleNames?: string[]): Promise<{ message: string; deleted_count: number; deleted_ids: string[] }> {
    try {
      const result = await this.bulkDeleteRules(ruleIds);
      const count = result.deleted_count;
      if (count === 1) {
        notify.deleted('Rule', ruleNames?.[0]);
      } else {
        notify.operationCompleted(`Bulk deletion of ${count} rules`);
      }
      return result;
    } catch (error) {
      notify.operationFailed('Bulk rule deletion', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async cloneRuleWithNotification(id: string, newName: string, originalName?: string): Promise<Rule> {
    try {
      const result = await this.cloneRule(id, newName);
      notify.operationCompleted(`Rule "${originalName || 'Unknown'}" cloned as "${newName}"`);
      return result;
    } catch (error) {
      notify.operationFailed('Rule cloning', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async createRubricWithNotification(rubric: Omit<Rubric, 'id' | 'created_date' | 'modified_date'>): Promise<Rubric> {
    try {
      const result = await this.createRubric(rubric);
      notify.created('Rubric', rubric.name);
      return result;
    } catch (error) {
      notify.operationFailed('Rubric creation', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async createRubricFromTSVWithNotification(
    rubricData: {
      name: string;
      description?: string;
      owner_name?: string;
      organization?: string;
      disease_area_study?: string;
      tags?: string[];
      visibility?: 'public' | 'private' | 'hidden';
      enabled?: boolean;
    },
    file: File
  ): Promise<Rubric> {
    try {
      const result = await this.createRubricFromTSV(rubricData, file);
      notify.created('Rubric', rubricData.name);
      return result;
    } catch (error) {
      notify.operationFailed('Rubric creation from file', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async createRubricFromJSONWithNotification(
    rubricData: {
      name: string;
      description?: string;
      owner_name?: string;
      organization?: string;
      disease_area_study?: string;
      tags?: string[];
      visibility?: 'public' | 'private' | 'hidden';
      enabled?: boolean;
    },
    file: File
  ): Promise<Rubric> {
    try {
      const result = await this.createRubricFromJSON(rubricData, file);
      notify.created('Rubric', rubricData.name);
      return result;
    } catch (error) {
      notify.operationFailed('Rubric creation from JSON file', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async updateRubricWithNotification(id: string, rubric: Omit<Rubric, 'id' | 'created_date' | 'modified_date'>): Promise<Rubric> {
    try {
      const result = await this.updateRubric(id, rubric);
      notify.updated('Rubric', rubric.name);
      return result;
    } catch (error) {
      notify.operationFailed('Rubric update', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async deleteRubricWithNotification(id: string, rubricName?: string): Promise<void> {
    try {
      await this.deleteRubric(id);
      notify.deleted('Rubric', rubricName);
    } catch (error) {
      notify.operationFailed('Rubric deletion', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async cloneRubricWithNotification(id: string, newName: string, copyRules: boolean = true, originalName?: string): Promise<Rubric> {
    try {
      const result = await this.cloneRubric(id, newName, copyRules);
      const mode = copyRules ? 'with copied rules' : 'sharing rules';
      notify.operationCompleted(`Rubric "${originalName || 'Unknown'}" cloned as "${newName}" (${mode})`);
      return result;
    } catch (error) {
      notify.operationFailed('Rubric cloning', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async createProjectWithNotification(project: Omit<Project, 'id' | 'created_date'>): Promise<Project> {
    try {
      const result = await this.createProject(project);
      notify.created('Project', project.name);
      return result;
    } catch (error) {
      notify.operationFailed('Project creation', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async updateProjectWithNotification(id: string, project: Omit<Project, 'id' | 'created_date'>): Promise<Project> {
    try {
      const result = await this.updateProject(id, project);
      notify.updated('Project', project.name);
      return result;
    } catch (error) {
      notify.operationFailed('Project update', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async deleteProjectWithNotification(id: string, projectName?: string): Promise<void> {
    try {
      await this.deleteProject(id);
      notify.deleted('Project', projectName);
    } catch (error) {
      notify.operationFailed('Project deletion', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async uploadProjectDataWithNotification(projectId: string, file: File): Promise<{ message: string; file_path: string }> {
    try {
      const result = await this.uploadProjectData(projectId, file);
      notify.uploaded(file.name);
      return result;
    } catch (error) {
      notify.operationFailed('File upload', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async createDatasetWithNotification(
    name: string,
    description: string | undefined,
    owner_name: string | undefined,
    organization: string | undefined,
    disease_area_study: string | undefined,
    tags: string | undefined,
    file: File,
    dataset_type: DatasetType = 'input'
  ): Promise<Dataset> {
    try {
      const result = await this.createDataset(name, description, owner_name, organization, disease_area_study, tags, file, dataset_type);
      notify.created('Dataset', name);
      return result;
    } catch (error) {
      notify.operationFailed('Dataset creation', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async updateDatasetWithNotification(
    id: string,
    updates: {
      name?: string;
      description?: string;
      owner_name?: string;
      organization?: string;
      disease_area_study?: string;
      tags?: string;
    }
  ): Promise<Dataset> {
    try {
      const result = await this.updateDataset(id, updates);
      notify.updated('Dataset', updates.name);
      return result;
    } catch (error) {
      notify.operationFailed('Dataset update', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async deleteDatasetWithNotification(id: string, datasetName?: string): Promise<{ message: string }> {
    try {
      const result = await this.deleteDataset(id);
      notify.deleted('Dataset', datasetName);
      return result;
    } catch (error) {
      notify.operationFailed('Dataset deletion', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async deleteProjectDatasetWithNotification(projectId: string, datasetId: string, datasetName?: string): Promise<void> {
    try {
      await this.deleteProjectDataset(projectId, datasetId);
      notify.deleted('Dataset', datasetName);
    } catch (error) {
      notify.operationFailed('Dataset removal', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async executeAnalysisWithNotification(
    projectId: string,
    ruleIds: string[] = [],
    rubricIds: string[] = [],
    projectName?: string
  ): Promise<AnalysisExecutionResponse> {
    try {
      notify.analysisStarted(projectName);
      const result = await this.executeAnalysis(projectId, ruleIds, rubricIds);
      notify.analysisCompleted(projectName);
      return result;
    } catch (error) {
      notify.analysisFailed(projectName, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async executeAnalysisWithRubricWithNotification(
    projectId: string,
    rubricId: string,
    datasetId: string,
    projectName?: string
  ): Promise<AnalysisExecution> {
    try {
      notify.analysisStarted(projectName);
      const result = await this.executeAnalysisWithRubric(projectId, rubricId, datasetId);
      notify.analysisCompleted(projectName);
      return result;
    } catch (error) {
      notify.analysisFailed(projectName, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async executeAnalysisResultWithNotification(
    request: AnalysisExecutionRequest,
    projectName?: string
  ): Promise<AnalysisExecutionResponse> {
    try {
      notify.analysisStarted(projectName);
      const result = await this.executeAnalysisResult(request);
      notify.analysisCompleted(projectName);
      return result;
    } catch (error) {
      notify.analysisFailed(projectName, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  async deleteAnalysisResultWithNotification(id: string, analysisName?: string): Promise<{ message: string }> {
    try {
      const result = await this.deleteAnalysisResult(id);
      notify.deleted('Analysis', analysisName);
      return result;
    } catch (error) {
      notify.operationFailed('Analysis deletion', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }
}

export const apiService = new ApiService();