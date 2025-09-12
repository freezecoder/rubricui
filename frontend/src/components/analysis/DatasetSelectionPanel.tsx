'use client';

import { Search, CheckCircle, Play } from 'lucide-react';
import { ProjectDataset, DatasetStats, RubricValidationResult } from '@/types';
import { useDatasetFilters } from '@/hooks/useFilters';

interface DatasetSelectionPanelProps {
  datasets: ProjectDataset[];
  selectedDataset: string | null;
  onDatasetSelect: (datasetId: string) => void;
  datasetStats: DatasetStats | null;
  validationResult: RubricValidationResult | null;
  onValidateRubric: () => void;
  onRunAnalysis?: () => void;
  isRunning?: boolean;
  canRunAnalysis?: boolean;
}

export const DatasetSelectionPanel = ({
  datasets,
  selectedDataset,
  onDatasetSelect,
  datasetStats,
  validationResult,
  onValidateRubric,
  onRunAnalysis,
  isRunning = false,
  canRunAnalysis = false
}: DatasetSelectionPanelProps) => {
  const {
    searchTerm,
    setSearchTerm,
    filteredDatasets
  } = useDatasetFilters(datasets);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 h-[800px] flex flex-col border-2 border-gray-200">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Dataset</h2>
      
      {/* Dataset Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search datasets..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>
      
      {/* Dataset Selection */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {filteredDatasets.map((dataset) => (
          <div 
            key={dataset.id} 
            className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
              selectedDataset === dataset.id 
                ? 'border-green-500 bg-green-50' 
                : 'border-gray-300 hover:bg-gray-50 hover:border-gray-400'
            }`}
            onClick={() => onDatasetSelect(dataset.id)}
          >
            <div className="font-medium text-gray-900">{dataset.name}</div>
            <div className="text-sm text-gray-600 mt-1">
              {dataset.filename}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Size: {dataset.size} | Uploaded: {new Date(dataset.upload_date).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>

      {/* Dataset Stats */}
      {datasetStats && (
        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Dataset Statistics</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
              <div className="text-xl font-bold text-blue-600">{datasetStats.total_rows.toLocaleString()}</div>
              <div className="text-xs text-blue-800">Total Rows</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg border-2 border-green-200">
              <div className="text-xl font-bold text-green-600">{datasetStats.total_columns}</div>
              <div className="text-xs text-green-800">Total Columns</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
              <div className="text-xl font-bold text-purple-600">{datasetStats.numeric_columns}</div>
              <div className="text-xs text-purple-800">Numeric</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg border-2 border-orange-200">
              <div className="text-xl font-bold text-orange-600">{datasetStats.score_columns}</div>
              <div className="text-xs text-orange-800">Score</div>
            </div>
          </div>
        </div>
      )}

      {/* Validation Status */}
      {validationResult && (
        <div className={`mb-4 p-4 rounded-lg border-2 ${
          validationResult.is_valid 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <div className={`text-sm font-medium ${
            validationResult.is_valid ? 'text-green-800' : 'text-red-800'
          }`}>
            {validationResult.is_valid ? '✓ Validation Passed' : '✗ Validation Failed'}
          </div>
          <div className={`text-xs mt-1 ${
            validationResult.is_valid ? 'text-green-600' : 'text-red-600'
          }`}>
            {validationResult.valid_rules}/{validationResult.total_rules} rules compatible
            {!validationResult.is_valid && validationResult.missing_columns.length > 0 && (
              <div className="mt-1">
                Missing columns: {validationResult.missing_columns.join(', ')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Validation Button */}
      {selectedDataset && (
        <button
          onClick={onValidateRubric}
          className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 mb-3"
        >
          <CheckCircle className="h-4 w-4" />
          Validate Rubric
        </button>
      )}

      {/* Run Rubric Button */}
      {selectedDataset && onRunAnalysis && (
        <button
          onClick={onRunAnalysis}
          disabled={isRunning || !canRunAnalysis}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Play className="h-4 w-4" />
          {isRunning ? 'Running Analysis...' : 'Run Rubric'}
        </button>
      )}
    </div>
  );
};
