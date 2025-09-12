'use client';

import { useState, useRef } from 'react';
import { Search, CheckCircle, Play, Upload, FileText, AlertCircle, X, Loader2 } from 'lucide-react';
import { Dataset, DatasetStats, RubricValidationResult } from '@/types';
import { useDatasetFilters } from '@/hooks/useFilters';
import { notify } from '@/lib/notifications';

interface DatasetUploadPanelProps {
  datasets: Dataset[];
  selectedDataset: string | null;
  onDatasetSelect: (datasetId: string) => void;
  onDatasetUpload: (file: File, metadata: {
    name: string;
    description?: string;
    owner_name?: string;
    organization?: string;
    disease_area_study?: string;
    tags?: string;
  }) => Promise<void>;
  datasetStats: DatasetStats | null;
  validationResult: RubricValidationResult | null;
  onValidateRubric: () => void;
  onRunAnalysis?: () => void;
  isRunning?: boolean;
  canRunAnalysis?: boolean;
  uploadingDataset?: boolean;
}

export const DatasetUploadPanel = ({
  datasets,
  selectedDataset,
  onDatasetSelect,
  onDatasetUpload,
  datasetStats,
  validationResult,
  onValidateRubric,
  onRunAnalysis,
  isRunning = false,
  canRunAnalysis = false,
  uploadingDataset = false
}: DatasetUploadPanelProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    name: '',
    description: '',
    owner_name: '',
    organization: '',
    disease_area_study: '',
    tags: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { filteredDatasets } = useDatasetFilters(datasets, searchTerm);

  const handleFileSelect = (file: File) => {
    // Validate file type
    const validTypes = ['.xlsx', '.xls', '.csv'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!validTypes.includes(fileExtension)) {
      notify.error('Please select an Excel (.xlsx, .xls) or CSV file');
      return;
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      notify.error('File size must be less than 50MB');
      return;
    }

    setSelectedFile(file);
    
    // Auto-fill name if empty
    if (!uploadForm.name) {
      const fileName = file.name.substring(0, file.name.lastIndexOf('.'));
      setUploadForm(prev => ({ ...prev, name: fileName }));
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      notify.error('Please select a file to upload');
      return;
    }

    if (!uploadForm.name.trim()) {
      notify.error('Please enter a dataset name');
      return;
    }

    try {
      await onDatasetUpload(selectedFile, {
        name: uploadForm.name.trim(),
        description: uploadForm.description.trim() || undefined,
        owner_name: uploadForm.owner_name.trim() || undefined,
        organization: uploadForm.organization.trim() || undefined,
        disease_area_study: uploadForm.disease_area_study.trim() || undefined,
        tags: uploadForm.tags.trim() || undefined
      });

      // Reset form
      setUploadForm({
        name: '',
        description: '',
        owner_name: '',
        organization: '',
        disease_area_study: '',
        tags: ''
      });
      setSelectedFile(null);
      setShowUploadForm(false);
      
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const cancelUpload = () => {
    setUploadForm({
      name: '',
      description: '',
      owner_name: '',
      organization: '',
      disease_area_study: '',
      tags: ''
    });
    setSelectedFile(null);
    setShowUploadForm(false);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border-2 border-gray-200 h-[800px] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Dataset
        </h3>
        {!showUploadForm && (
          <button
            onClick={() => setShowUploadForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Upload New
          </button>
        )}
      </div>

      {/* Upload Form */}
      {showUploadForm && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-md font-medium text-blue-900">Upload Dataset</h4>
            <button
              onClick={cancelUpload}
              className="text-blue-600 hover:text-blue-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* File Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragActive 
                ? 'border-blue-500 bg-blue-100' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {selectedFile ? (
              <div className="text-green-600">
                <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-sm text-gray-600">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="text-red-600 hover:text-red-800 text-sm mt-2"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div>
                <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-gray-600 mb-2">
                  Drag and drop your file here, or click to browse
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  Choose file
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Upload Form Fields */}
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dataset Name *
              </label>
              <input
                type="text"
                value={uploadForm.name}
                onChange={(e) => setUploadForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter dataset name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={uploadForm.description}
                onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional description"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Owner
                </label>
                <input
                  type="text"
                  value={uploadForm.owner_name}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, owner_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization
                </label>
                <input
                  type="text"
                  value={uploadForm.organization}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, organization: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Organization"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Disease Area / Study
              </label>
              <input
                type="text"
                value={uploadForm.disease_area_study}
                onChange={(e) => setUploadForm(prev => ({ ...prev, disease_area_study: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., LUSC, Breast Cancer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tags
              </label>
              <input
                type="text"
                value={uploadForm.tags}
                onChange={(e) => setUploadForm(prev => ({ ...prev, tags: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Comma-separated tags"
              />
            </div>
          </div>

          {/* Upload Actions */}
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleUpload}
              disabled={!selectedFile || !uploadForm.name.trim() || uploadingDataset}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {uploadingDataset ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload Dataset
                </>
              )}
            </button>
            <button
              onClick={cancelUpload}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Dataset Selection */}
      {!showUploadForm && (
        <>
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search datasets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Dataset List */}
          <div className="flex-1 overflow-y-auto space-y-2 mb-4">
            {filteredDatasets.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No datasets found</p>
                <p className="text-sm">Upload a dataset to get started</p>
              </div>
            ) : (
              filteredDatasets.map((dataset) => (
                <div
                  key={dataset.id}
                  onClick={() => onDatasetSelect(dataset.id)}
                  className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    selectedDataset === dataset.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{dataset.name}</h4>
                      {dataset.description && (
                        <p className="text-sm text-gray-600 mt-1">{dataset.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        {dataset.organization && (
                          <span>Org: {dataset.organization}</span>
                        )}
                        {dataset.disease_area_study && (
                          <span>Study: {dataset.disease_area_study}</span>
                        )}
                      </div>
                    </div>
                    {selectedDataset === dataset.id && (
                      <CheckCircle className="h-5 w-5 text-blue-600" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Dataset Stats */}
      {selectedDataset && datasetStats && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
          <h4 className="text-md font-medium text-gray-900 mb-3">Dataset Statistics</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Rows:</span>
              <span className="ml-2 font-medium">{datasetStats.total_rows.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-gray-600">Columns:</span>
              <span className="ml-2 font-medium">{datasetStats.total_columns}</span>
            </div>
            <div>
              <span className="text-gray-600">Numeric:</span>
              <span className="ml-2 font-medium">{datasetStats.numeric_columns}</span>
            </div>
            <div>
              <span className="text-gray-600">Score:</span>
              <span className="ml-2 font-medium">{datasetStats.score_columns}</span>
            </div>
          </div>
        </div>
      )}

      {/* Validation Status */}
      {validationResult && (
        <div className="mt-4 p-4 rounded-lg border-2 border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            {validationResult.is_valid ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            <h4 className="text-md font-medium text-gray-900">
              Validation {validationResult.is_valid ? 'Passed' : 'Failed'}
            </h4>
          </div>
          
          {validationResult.missing_columns && validationResult.missing_columns.length > 0 && (
            <div className="text-sm text-red-600 mb-2">
              <p className="font-medium">Missing columns:</p>
              <ul className="list-disc list-inside ml-2">
                {validationResult.missing_columns.map((col, index) => (
                  <li key={index}>{col}</li>
                ))}
              </ul>
            </div>
          )}
          
          {validationResult.extra_columns && validationResult.extra_columns.length > 0 && (
            <div className="text-sm text-yellow-600 mb-2">
              <p className="font-medium">Extra columns (will be ignored):</p>
              <ul className="list-disc list-inside ml-2">
                {validationResult.extra_columns.map((col, index) => (
                  <li key={index}>{col}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4 flex gap-3">
        <button
          onClick={onValidateRubric}
          disabled={!selectedDataset || !validationResult}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Validate
        </button>
        {onRunAnalysis && (
          <button
            onClick={onRunAnalysis}
            disabled={!canRunAnalysis}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Run Analysis
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
