import { useState, useEffect, useCallback } from 'react';
import { apiService } from '@/services/api';
import { 
  Project, 
  Rubric, 
  ProjectDataset,
  DatasetStats, 
  DatasetColumn,
  RubricValidationResult, 
  RubricRulesResponse 
} from '@/types';

export const useAnalysisData = (projectId: string) => {
  const [project, setProject] = useState<Project | null>(null);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [datasets, setDatasets] = useState<ProjectDataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const [projectData, rubricsData, datasetsData] = await Promise.all([
        apiService.getProject(projectId),
        apiService.getRubrics(),
        apiService.getProjectDatasets(projectId)
      ]);
      
      setProject(projectData);
      setRubrics(rubricsData);
      setDatasets(datasetsData);
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  return {
    project,
    rubrics,
    datasets,
    loading,
    error,
    refetch: loadInitialData
  };
};

export const useRubricRules = () => {
  const [rubricRules, setRubricRules] = useState<RubricRulesResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const loadRubricRules = useCallback(async (rubricId: string) => {
    try {
      setLoading(true);
      const rulesData = await apiService.getRubricRulesWithDetails(rubricId);
      setRubricRules(rulesData);
    } catch (err) {
      console.error('Failed to load rubric rules:', err);
      setRubricRules(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshRubric = useCallback(async (rubricId: string) => {
    try {
      await apiService.refreshRubric(rubricId);
      await loadRubricRules(rubricId);
    } catch (err) {
      console.error('Failed to refresh rubric:', err);
      throw err;
    }
  }, [loadRubricRules]);

  return {
    rubricRules,
    loading,
    loadRubricRules,
    refreshRubric
  };
};

export const useDatasetData = () => {
  const [datasetStats, setDatasetStats] = useState<DatasetStats | null>(null);
  const [datasetColumns, setDatasetColumns] = useState<DatasetColumn[]>([]);
  const [loading, setLoading] = useState(false);

  const loadDatasetStats = useCallback(async (datasetId: string) => {
    try {
      setLoading(true);
      const statsData = await apiService.getDatasetStats(datasetId);
      setDatasetStats(statsData);
    } catch (err) {
      console.error('Failed to load dataset stats:', err);
      setDatasetStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDatasetColumns = useCallback(async (datasetId: string) => {
    try {
      setLoading(true);
      const columnsData = await apiService.getDatasetColumns(datasetId, 'numeric');
      setDatasetColumns(columnsData);
    } catch (err) {
      console.error('Failed to load dataset columns:', err);
      setDatasetColumns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDatasetData = useCallback(async (datasetId: string) => {
    await Promise.all([
      loadDatasetStats(datasetId),
      loadDatasetColumns(datasetId)
    ]);
  }, [loadDatasetStats, loadDatasetColumns]);

  return {
    datasetStats,
    datasetColumns,
    loading,
    loadDatasetData
  };
};

export const useRubricValidation = () => {
  const [validationResult, setValidationResult] = useState<RubricValidationResult | null>(null);

  const validateRubric = useCallback(async (rubricId: string, datasetId: string) => {
    try {
      const validation = await apiService.validateRubricForDataset(rubricId, datasetId);
      setValidationResult(validation);
      return validation;
    } catch (err) {
      console.error('Failed to validate rubric:', err);
      setValidationResult(null);
      return null;
    }
  }, []);

  const clearValidation = useCallback(() => {
    setValidationResult(null);
  }, []);

  return {
    validationResult,
    validateRubric,
    clearValidation
  };
};
