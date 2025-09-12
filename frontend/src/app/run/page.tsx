'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { notify } from '@/lib/notifications';
import { generateAnalysisConfigSimple, downloadYAMLConfig } from '@/lib/yamlExport';

// Custom hooks
import { 
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
  DatasetUploadPanel,
  ColumnsPanel,
  NotificationsPanel,
  AnalysisControls
} from '@/components/analysis';
import { CreateRubricModal } from '@/components/modals';

// API service
import { apiService } from '@/services/api';

// Types
import { Project, Rubric, Dataset } from '@/types';

export default function RunAnalysisPage() {
  const router = useRouter();

  // State management
  const [project, setProject] = useState<Project | null>(null);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Custom hooks for data management
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
  const [uploadingDataset, setUploadingDataset] = useState(false);
  const [isCreateRubricModalOpen, setIsCreateRubricModalOpen] = useState(false);

  // Initialize default project and load data
  useEffect(() => {
    initializePage();
  }, []);

  const initializePage = async () => {
    try {
      setLoading(true);
      
      // Create default project
      const defaultProject = await createDefaultProject();
      setProject(defaultProject);
      
      // Load rubrics and datasets
      const [rubricsData, datasetsData] = await Promise.all([
        apiService.getRubrics(),
        apiService.getDatasets()
      ]);
      
      setRubrics(rubricsData);
      setDatasets(datasetsData);
      
      // Generate default analysis name
      const timestamp = new Date().toLocaleString();
      setAnalysisName(`Quick Analysis ${timestamp}`);
      
    } catch (err) {
      setError('Failed to initialize analysis page');
      console.error(err);
      notify.error('Failed to initialize analysis page');
    } finally {
      setLoading(false);
    }
  };

  const createDefaultProject = async (): Promise<Project> => {
    const defaultProjectData = {
      name: `Quick Analysis ${new Date().toISOString().split('T')[0]}`,
      description: 'Auto-generated project for quick analysis',
      owner_name: 'System',
      organization: 'Quick Analysis',
      disease_area_study: 'General',
      tags: ['quick-analysis', 'auto-generated']
    };
    
    return await apiService.createProject(defaultProjectData);
  };

  // Event handlers
  const handleAnalysisNameChange = useCallback((newName: string) => {
    setAnalysisName(newName);
  }, []);

  const handleRubricSelect = useCallback(async (rubricId: string) => {
    setSelectedRubric(rubricId);
    clearValidation();
    
    // Load rubric rules
    await loadRubricRules(rubricId);
    
    // Auto-validate if dataset is selected
    if (selectedDataset) {
      await validateRubric(rubricId, selectedDataset);
    }
  }, [selectedDataset, loadRubricRules, validateRubric, clearValidation]);

  const handleRefreshRubric = useCallback(async (rubricId: string) => {
    try {
      await refreshRubric(rubricId);
      await loadRubricRules(rubricId);
      notify.success('Rubric refreshed successfully');
    } catch (err) {
      notify.error('Failed to refresh rubric');
    }
  }, [refreshRubric, loadRubricRules]);

  const handleDatasetSelect = useCallback(async (datasetId: string) => {
    setSelectedDataset(datasetId);
    clearValidation();
    
    // Load dataset data
    await loadDatasetData(datasetId);
    
    // Auto-validate if rubric is selected
    if (selectedRubric) {
      await validateRubric(selectedRubric, datasetId);
    }
  }, [selectedRubric, loadDatasetData, validateRubric, clearValidation]);

  const handleDatasetUpload = useCallback(async (file: File, metadata: {
    name: string;
    description?: string;
    owner_name?: string;
    organization?: string;
    disease_area_study?: string;
    tags?: string;
  }) => {
    try {
      setUploadingDataset(true);
      
      // Upload dataset
      const newDataset = await apiService.createDataset(
        metadata.name,
        metadata.description,
        metadata.owner_name,
        metadata.organization,
        metadata.disease_area_study,
        metadata.tags,
        file
      );
      
      // Add to local datasets list
      setDatasets(prev => [newDataset, ...prev]);
      
      // Auto-select the new dataset
      setSelectedDataset(newDataset.id);
      await loadDatasetData(newDataset.id);
      
      // Auto-validate if rubric is selected
      if (selectedRubric) {
        await validateRubric(selectedRubric, newDataset.id);
      }
      
      notify.success(`Dataset "${metadata.name}" uploaded successfully`);
      
    } catch (err) {
      console.error('Dataset upload failed:', err);
      notify.error('Failed to upload dataset');
    } finally {
      setUploadingDataset(false);
    }
  }, [selectedRubric, loadDatasetData, validateRubric]);

  const handleValidateRubric = useCallback(async () => {
    if (!selectedRubric || !selectedDataset) {
      notify.error('Please select both a rubric and dataset');
      return;
    }
    
    try {
      await validateRubric(selectedRubric, selectedDataset);
    } catch (err) {
      notify.error('Validation failed');
    }
  }, [selectedRubric, selectedDataset, validateRubric]);

  const handleRunAnalysis = useCallback(async () => {
    if (!project || !selectedRubric || !selectedDataset) {
      notify.error('Please select a rubric and dataset');
      return;
    }
    
    try {
      // Execute analysis
      const execution = await executeAnalysis(project.id, selectedRubric, selectedDataset);
      
      if (execution) {
        setShowResults(true);
        notify.success('Analysis started successfully');
      }
    } catch (err) {
      console.error('Analysis execution failed:', err);
      notify.error('Failed to start analysis');
    }
  }, [project, selectedRubric, selectedDataset, executeAnalysis]);

  const handleExportConfig = useCallback(async () => {
    if (!project || !selectedRubric || !selectedDataset) {
      notify.error('Please select a rubric and dataset');
      return;
    }
    
    try {
      const config = generateAnalysisConfigSimple(
        project,
        selectedRubric,
        selectedDataset,
        analysisName
      );
      
      downloadYAMLConfig(config, analysisName);
      notify.success('Configuration exported successfully');
    } catch (err) {
      console.error('Export failed:', err);
      notify.error('Failed to export configuration');
    }
  }, [project, selectedRubric, selectedDataset, analysisName]);

  const handleCreateRubric = useCallback(() => {
    setIsCreateRubricModalOpen(true);
  }, []);

  const handleRubricCreated = useCallback(async (newRubric: any) => {
    // Add the new rubric to the local list
    setRubrics(prev => [newRubric, ...prev]);
    
    // Auto-select the new rubric
    setSelectedRubric(newRubric.id);
    await loadRubricRules(newRubric.id);
    
    // Auto-validate if dataset is selected
    if (selectedDataset) {
      await validateRubric(newRubric.id, selectedDataset);
    }
    
    notify.success(`Rubric "${newRubric.name}" created and selected`);
  }, [selectedDataset, loadRubricRules, validateRubric]);

  // Computed values
  const canRunAnalysis = !!(selectedRubric && selectedDataset && validationResult?.is_valid && !isRunning);
  const canExportConfig = !!(selectedRubric && selectedDataset && validationResult?.is_valid);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing quick analysis...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Initialization Failed</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={initializePage}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Quick Analysis</h1>
              <p className="text-gray-600 mt-2">
                Upload a dataset and run analysis with any rubric - no project setup required
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/projects')}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                View All Projects
              </button>
            </div>
          </div>
          
          {/* Analysis Name */}
          <div className="mt-4">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={analysisName}
                  onChange={(e) => handleAnalysisNameChange(e.target.value)}
                  className="text-lg font-medium text-gray-900 bg-transparent border-b-2 border-blue-600 focus:outline-none"
                  onBlur={() => setIsEditingName(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setIsEditingName(false);
                    }
                  }}
                  autoFocus
                />
              </div>
            ) : (
              <button
                onClick={() => setIsEditingName(true)}
                className="text-lg font-medium text-gray-900 hover:text-blue-600 transition-colors"
              >
                {analysisName}
              </button>
            )}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
          {/* Left Panel - Rubric Selection */}
          <div className="lg:col-span-1 xl:col-span-1">
            <RubricSelectionPanel
              rubrics={rubrics}
              selectedRubric={selectedRubric}
              onRubricSelect={handleRubricSelect}
              onRefreshRubric={handleRefreshRubric}
              onCreateRubric={handleCreateRubric}
            />
          </div>

          {/* Middle Panel - Rules Display */}
          <div className="lg:col-span-1 xl:col-span-1">
            <RulesDisplayPanel
              rubricRules={rubricRules}
              loading={rulesLoading}
            />
          </div>

          {/* Right Panel - Dataset Upload and Selection */}
          <div className="lg:col-span-1 xl:col-span-1">
            <DatasetUploadPanel
              datasets={datasets}
              selectedDataset={selectedDataset}
              onDatasetSelect={handleDatasetSelect}
              onDatasetUpload={handleDatasetUpload}
              datasetStats={datasetStats}
              validationResult={validationResult}
              onValidateRubric={handleValidateRubric}
              onRunAnalysis={handleRunAnalysis}
              isRunning={isRunning}
              canRunAnalysis={!!canRunAnalysis}
              uploadingDataset={uploadingDataset}
            />
          </div>

          {/* Numeric Columns Panel */}
          <div className="lg:col-span-1 xl:col-span-1">
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
          projectId={project?.id}
        />
      </div>

      {/* Create Rubric Modal */}
      <CreateRubricModal
        isOpen={isCreateRubricModalOpen}
        onClose={() => setIsCreateRubricModalOpen(false)}
        onRubricCreated={handleRubricCreated}
      />
    </div>
  );
}
