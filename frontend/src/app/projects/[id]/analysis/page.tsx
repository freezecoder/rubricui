'use client';

import React, { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { notify } from '@/lib/notifications';
import { generateAnalysisConfig, downloadYAMLConfig } from '@/lib/yamlExport';

// Custom hooks
import { 
  useAnalysisData, 
  useRubricRules, 
  useDatasetData, 
  useRubricValidation,
  useAnalysisExecution,
  useNotifications
} from '@/hooks';

// Components
import { 
  RubricSelectionPanel,
  RulesDisplayPanel,
  DatasetSelectionPanel,
  ColumnsPanel,
  NotificationsPanel,
  AnalysisControls
} from '@/components/analysis';

export default function AnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  // Custom hooks for data management
  const { project, rubrics, datasets, loading, error } = useAnalysisData(projectId);
  const { rubricRules, loading: rulesLoading, loadRubricRules, refreshRubric } = useRubricRules();
  const { datasetStats, datasetColumns, loadDatasetData } = useDatasetData();
  const { validationResult, validateRubric, clearValidation } = useRubricValidation();
  const { notifications, addNotification, removeNotification } = useNotifications();
  const { 
    isRunning, 
    currentExecution, 
    analysisResults, 
    error: analysisError,
    executeAnalysis, 
    resetExecution 
  } = useAnalysisExecution();

  // Local state
  const [selectedRubric, setSelectedRubric] = useState<string | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [analysisName, setAnalysisName] = useState<string>('');
  const [isEditingName, setIsEditingName] = useState(false);

  // Generate default analysis name
  React.useEffect(() => {
    if (project && !analysisName) {
      const timestamp = new Date().toLocaleString();
      setAnalysisName(`${project.name} analysis ${timestamp}`);
    }
  }, [project, analysisName]);

  // Event handlers

  const handleAnalysisNameChange = useCallback((newName: string) => {
    setAnalysisName(newName);
  }, []);

  const handleAnalysisNameEdit = useCallback(() => {
    setIsEditingName(true);
  }, []);

  const handleAnalysisNameSave = useCallback(() => {
    setIsEditingName(false);
  }, []);

  const handleAnalysisNameKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAnalysisNameSave();
    }
  }, [handleAnalysisNameSave]);

  const handleRubricSelect = useCallback((rubricId: string) => {
    setSelectedRubric(rubricId);
    clearValidation();
    loadRubricRules(rubricId);
    
    // Auto-validate if dataset is also selected
    if (selectedDataset) {
      validateRubric(rubricId, selectedDataset);
    }
  }, [selectedDataset, clearValidation, loadRubricRules, validateRubric]);

  const handleDatasetSelect = useCallback((datasetId: string) => {
    setSelectedDataset(datasetId);
    clearValidation();
    loadDatasetData(datasetId);
    
    // Auto-validate if rubric is also selected
    if (selectedRubric) {
      validateRubric(selectedRubric, datasetId);
    }
  }, [selectedRubric, clearValidation, loadDatasetData, validateRubric]);

  const handleRefreshRubric = useCallback(async () => {
    if (!selectedRubric) return;
    
    try {
      await refreshRubric(selectedRubric);
      if (selectedDataset) {
        validateRubric(selectedRubric, selectedDataset);
      }
      notify.operationCompleted('Rubric data refresh');
    } catch (err) {
      console.error('Failed to refresh rubric:', err);
      notify.operationFailed('Rubric data refresh', err instanceof Error ? err.message : 'Unknown error');
    }
  }, [selectedRubric, selectedDataset, refreshRubric, validateRubric]);

  const handleValidateRubric = useCallback(async () => {
    if (!selectedRubric || !selectedDataset) {
      notify.validationError('Please select both a rubric and a dataset first');
      return;
    }

    try {
      const validation = await validateRubric(selectedRubric, selectedDataset);
      if (validation) {
        if (validation.is_valid) {
          notify.info('Validation passed! All rules are compatible with the dataset.');
          addNotification('success', 'Validation Passed', `${validation.valid_rules}/${validation.total_rules} rules are compatible with the dataset columns.`);
        } else {
          notify.warning(`Validation failed: ${validation.invalid_rules} rules have missing columns.`);
          addNotification('warning', 'Validation Issues', `Missing columns: ${validation.missing_columns.join(', ')}`);
        }
      }
    } catch (err) {
      notify.operationFailed('Validation', err instanceof Error ? err.message : 'Unknown error');
      addNotification('error', 'Validation Error', 'Failed to validate rubric against dataset.');
    }
  }, [selectedRubric, selectedDataset, validateRubric, addNotification]);

  const handleRunAnalysis = useCallback(async () => {
    if (!selectedRubric || !selectedDataset) {
      notify.validationError('Please select both a rubric and a dataset');
      return;
    }

    if (!validationResult?.is_valid) {
      notify.validationError('Please validate the rubric against the dataset first');
      return;
    }

    try {
      await executeAnalysis(
        projectId,
        selectedRubric,
        selectedDataset,
        (execution) => {
          notify.analysisStarted(project?.name);
          addNotification('info', 'Analysis Started', `Execution ID: ${execution.id}`);
        },
        () => {
          setShowResults(true);
          notify.analysisCompleted(project?.name);
          if (analysisResults) {
            addNotification('success', 'Analysis Complete', `Processed ${analysisResults.total_genes.toLocaleString()} genes successfully.`);
          }
        }
      );
    } catch (err) {
      console.error(err);
      notify.analysisFailed(project?.name, 'Failed to start analysis');
    }
  }, [selectedRubric, selectedDataset, validationResult, projectId, executeAnalysis, addNotification, analysisResults]);

  const handleExportConfig = useCallback(() => {
    if (!project || !selectedRubric || !selectedDataset || !validationResult || !datasetStats || !rubricRules?.rules?.length) {
      notify.validationError('Cannot export configuration: missing required data');
      return;
    }

    try {
      // Find the selected rubric and dataset objects
      const selectedRubricObj = rubrics.find(r => r.id === selectedRubric);
      const selectedDatasetObj = datasets.find(d => d.id === selectedDataset);
      
      if (!selectedRubricObj || !selectedDatasetObj) {
        notify.validationError('Cannot export configuration: selected rubric or dataset not found');
        return;
      }

      const config = generateAnalysisConfig(
        project,
        selectedRubricObj,
        selectedDatasetObj,
        datasetStats,
        validationResult,
        rubricRules.rules,
        selectedRubric,
        selectedDataset
      );

      downloadYAMLConfig(config);
      notify.created('Configuration', 'exported successfully');
    } catch (err) {
      console.error('Export error:', err);
      notify.operationFailed('Export', 'Failed to export configuration');
    }
  }, [project, selectedRubric, selectedDataset, validationResult, datasetStats, rubricRules, rubrics, datasets]);

  // Show analysis error in notifications
  React.useEffect(() => {
    if (analysisError) {
      addNotification('error', 'Analysis Failed', analysisError);
      notify.analysisFailed(project?.name, analysisError);
    }
  }, [analysisError, addNotification, project?.name]);

  // Computed values
  const canRunAnalysis = selectedRubric && selectedDataset && validationResult?.is_valid;
  const canExportConfig = selectedRubric && selectedDataset && validationResult?.is_valid && project && datasetStats && rubricRules?.rules && rubricRules.rules.length > 0;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">Loading analysis data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-600">Project not found</div>
      </div>
    );
  }

  return (
    <div className="w-full px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analysis Configuration</h1>
            <p className="text-gray-600 mt-2">Project: {project?.name}</p>
          </div>
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg"
          >
            Back to Project
          </button>
        </div>
      </div>

      {/* Analysis Name */}
      <div className="mb-6">
        <div className="bg-white rounded-lg shadow-md p-6 border-2 border-gray-200">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Analysis Name:</label>
            {isEditingName ? (
              <input
                type="text"
                value={analysisName}
                onChange={(e) => handleAnalysisNameChange(e.target.value)}
                onBlur={handleAnalysisNameSave}
                onKeyPress={handleAnalysisNameKeyPress}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            ) : (
              <div
                onClick={handleAnalysisNameEdit}
                className="flex-1 px-3 py-2 border border-transparent rounded-lg hover:border-gray-300 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                {analysisName || 'Click to set analysis name'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-16 gap-6 mb-6">
        {/* Left Panel - Rubric Selection */}
        <div className="xl:col-span-3">
          <RubricSelectionPanel
            rubrics={rubrics}
            selectedRubric={selectedRubric}
            onRubricSelect={handleRubricSelect}
            onRefreshRubric={handleRefreshRubric}
          />
        </div>

        {/* Middle Panel - Rules Display */}
        <div className="xl:col-span-4">
          <RulesDisplayPanel
            rubricRules={rubricRules}
            loading={rulesLoading}
          />
        </div>

        {/* Right Panel - Dataset Selection and Stats */}
        <div className="xl:col-span-5">
          <DatasetSelectionPanel
            datasets={datasets}
            selectedDataset={selectedDataset}
            onDatasetSelect={handleDatasetSelect}
            datasetStats={datasetStats}
            validationResult={validationResult}
            onValidateRubric={handleValidateRubric}
            onRunAnalysis={handleRunAnalysis}
            isRunning={isRunning}
            canRunAnalysis={!!canRunAnalysis}
          />
        </div>

        {/* Numeric Columns Panel */}
        <div className="xl:col-span-4">
          <ColumnsPanel
            columns={datasetColumns}
            selectedDataset={selectedDataset}
          />
        </div>
      </div>

      {/* Notifications Panel */}
      <div className="mb-6">
        <NotificationsPanel
          notifications={notifications}
          onRemoveNotification={removeNotification}
          validationResult={validationResult}
        />
      </div>

      {/* Analysis Controls */}
      <AnalysisControls
        currentExecution={currentExecution}
        analysisResults={analysisResults}
        showResults={showResults}
        onHideResults={() => setShowResults(false)}
        onExportConfig={handleExportConfig}
        canExportConfig={!!canExportConfig}
        projectId={projectId}
      />
    </div>
  );
}