'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiService } from '@/services/api';
import { Dataset, DatasetColumn, DatasetStats, DatasetType } from '@/types';
import { notify } from '@/lib/notifications';
import HistogramGrid from '@/components/datasets/HistogramGrid';
import { 
  ArrowLeft,
  Database,
  FileText,
  BarChart3,
  Hash,
  Type,
  Target,
  Calendar,
  Users,
  Building2,
  Tags,
  Edit,
  Trash2,
  Eye,
  TrendingUp,
  Minus,
  Plus,
  AlertCircle,
  CheckCircle,
  Info,
  Search,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { EditModal } from '@/components/ui/edit-modal';

export default function DatasetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const datasetId = params.id as string;
  
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [columns, setColumns] = useState<DatasetColumn[]>([]);
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'columns' | 'stats' | 'histograms'>('overview');
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(new Set());
  
  // Search and sort state
  const [columnsSearchTerm, setColumnsSearchTerm] = useState('');
  const [columnsSortBy, setColumnsSortBy] = useState<'name' | 'type' | 'index' | 'null_count'>('index');
  const [columnsSortOrder, setColumnsSortOrder] = useState<'asc' | 'desc'>('asc');
  const [histogramsSearchTerm, setHistogramsSearchTerm] = useState('');
  const [histogramsSortBy, setHistogramsSortBy] = useState<'name' | 'type' | 'total_count' | 'null_count'>('name');
  const [histogramsSortOrder, setHistogramsSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showEditModal, setShowEditModal] = useState(false);

  const loadDatasetDetails = useCallback(async () => {
    try {
      setLoading(true);
      const [datasetData, columnsData, statsData] = await Promise.all([
        apiService.getDataset(datasetId),
        apiService.getDatasetColumns(datasetId),
        apiService.getDatasetStats(datasetId)
      ]);
      
      setDataset(datasetData);
      setColumns(columnsData);
      setStats(statsData);
    } catch (err) {
      setError('Failed to load dataset details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [datasetId]);

  useEffect(() => {
    if (datasetId) {
      loadDatasetDetails();
    }
  }, [datasetId, loadDatasetDetails]);

  const handleDeleteDataset = async () => {
    const confirmed = await notify.confirmDelete('dataset', dataset?.name);
    if (confirmed) {
      try {
        await apiService.deleteDataset(datasetId);
        router.push('/datasets');
      } catch (err) {
        notify.error('Failed to delete dataset');
        console.error(err);
      }
    }
  };

  const handleSaveDataset = async (updatedData: any) => {
    if (!dataset) return;
    
    try {
      await apiService.updateDatasetWithNotification(dataset.id, updatedData);
      await loadDatasetDetails(); // Reload the dataset details
      setShowEditModal(false);
    } catch (err) {
      console.error(err);
      // Error notification is handled by the API service
    }
  };

  const toggleColumnExpansion = (columnId: string) => {
    const newExpanded = new Set(expandedColumns);
    if (newExpanded.has(columnId)) {
      newExpanded.delete(columnId);
    } else {
      newExpanded.add(columnId);
    }
    setExpandedColumns(newExpanded);
  };

  // Filter and sort functions
  const getFilteredAndSortedColumns = () => {
    const filtered = columns.filter(column => 
      column.original_name.toLowerCase().includes(columnsSearchTerm.toLowerCase()) ||
      column.sanitized_name.toLowerCase().includes(columnsSearchTerm.toLowerCase()) ||
      column.column_type.toLowerCase().includes(columnsSearchTerm.toLowerCase())
    );

    filtered.sort((a, b) => {
      let aValue: string | number, bValue: string | number;
      
      switch (columnsSortBy) {
        case 'name':
          aValue = a.original_name.toLowerCase();
          bValue = b.original_name.toLowerCase();
          break;
        case 'type':
          aValue = a.column_type;
          bValue = b.column_type;
          break;
        case 'index':
          aValue = a.column_index;
          bValue = b.column_index;
          break;
        case 'null_count':
          aValue = a.null_count || 0;
          bValue = b.null_count || 0;
          break;
        default:
          aValue = a.column_index;
          bValue = b.column_index;
      }

      if (aValue < bValue) return columnsSortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return columnsSortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  };

  const getFilteredAndSortedHistogramColumns = () => {
    const numericColumns = columns.filter(col => col.column_type === 'numeric' || col.column_type === 'score');
    
    const filtered = numericColumns.filter(column => 
      column.original_name.toLowerCase().includes(histogramsSearchTerm.toLowerCase()) ||
      column.sanitized_name.toLowerCase().includes(histogramsSearchTerm.toLowerCase()) ||
      column.column_type.toLowerCase().includes(histogramsSearchTerm.toLowerCase())
    );

    filtered.sort((a, b) => {
      let aValue: string | number, bValue: string | number;
      
      switch (histogramsSortBy) {
        case 'name':
          aValue = a.original_name.toLowerCase();
          bValue = b.original_name.toLowerCase();
          break;
        case 'type':
          aValue = a.column_type;
          bValue = b.column_type;
          break;
        case 'total_count':
          aValue = (a.null_count || 0) + (a.unique_count || 0);
          bValue = (b.null_count || 0) + (b.unique_count || 0);
          break;
        case 'null_count':
          aValue = a.null_count || 0;
          bValue = b.null_count || 0;
          break;
        default:
          aValue = a.original_name.toLowerCase();
          bValue = b.original_name.toLowerCase();
      }

      if (aValue < bValue) return histogramsSortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return histogramsSortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  };


  const getColumnTypeIcon = (type: string) => {
    switch (type) {
      case 'numeric':
        return <Hash className="h-4 w-4 text-blue-600" />;
      case 'string':
        return <Type className="h-4 w-4 text-green-600" />;
      case 'score':
        return <Target className="h-4 w-4 text-purple-600" />;
      default:
        return <Info className="h-4 w-4 text-gray-600" />;
    }
  };

  const getColumnTypeColor = (type: string) => {
    switch (type) {
      case 'numeric':
        return 'bg-blue-100 text-blue-800';
      case 'string':
        return 'bg-green-100 text-green-800';
      case 'score':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading dataset details...</p>
        </div>
      </div>
    );
  }

  if (error || !dataset) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error</h3>
          <p className="text-red-600">{error || 'Dataset not found'}</p>
          <div className="mt-4 flex gap-2">
            <button 
              onClick={loadDatasetDetails} 
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
            <Link href="/datasets">
              <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
                Back to Datasets
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100">
      <div className="w-full px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-6">
            <Link href="/datasets">
              <button className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors">
                <ArrowLeft className="h-5 w-5" />
              </button>
            </Link>
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <Database className="h-8 w-8 text-blue-600" />
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    {dataset.name}
                  </h1>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    dataset.dataset_type === 'input' ? 'bg-blue-100 text-blue-800' :
                    dataset.dataset_type === 'output' ? 'bg-green-100 text-green-800' :
                    dataset.dataset_type === 'annotations' ? 'bg-purple-100 text-purple-800' :
                    dataset.dataset_type === 'rubric' ? 'bg-orange-100 text-orange-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {dataset.dataset_type.charAt(0).toUpperCase() + dataset.dataset_type.slice(1)}
                  </span>
                </div>
                {dataset.description && (
                  <p className="text-gray-600 text-lg">{dataset.description}</p>
                )}
              </div>
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setShowEditModal(true)}
                className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                <Edit className="h-5 w-5" />
              </button>
              <button 
                onClick={handleDeleteDataset}
                className="p-2 rounded-lg text-red-600 hover:text-red-900 hover:bg-red-100 transition-colors"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Rows</p>
                  <p className="text-2xl font-bold text-gray-900">{dataset.num_rows.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Hash className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Columns</p>
                  <p className="text-2xl font-bold text-gray-900">{dataset.num_columns}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Target className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Score Columns</p>
                  <p className="text-2xl font-bold text-gray-900">{dataset.num_score_columns}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <FileText className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">File Size</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {Math.round(dataset.num_rows * dataset.num_columns / 1000)}K cells
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6">
                {[
                  { id: 'overview', label: 'Overview', icon: Eye },
                  { id: 'columns', label: 'Columns', icon: Hash },
                  { id: 'stats', label: 'Statistics', icon: TrendingUp },
                  { id: 'histograms', label: 'Histograms', icon: BarChart3 }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as 'overview' | 'columns' | 'stats' | 'histograms')}
                    className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-6">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Dataset Information */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Dataset Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center space-x-3">
                          <FileText className="h-5 w-5 text-gray-400" />
                          <div>
                            <p className="text-sm text-gray-600">Original File</p>
                            <p className="font-medium text-gray-900">{dataset.original_filename}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Building2 className="h-5 w-5 text-gray-400" />
                          <div>
                            <p className="text-sm text-gray-600">Organization</p>
                            <p className="font-medium text-gray-900">{dataset.organization || 'Not specified'}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Users className="h-5 w-5 text-gray-400" />
                          <div>
                            <p className="text-sm text-gray-600">Owner</p>
                            <p className="font-medium text-gray-900">{dataset.owner_name || 'Not specified'}</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center space-x-3">
                          <Calendar className="h-5 w-5 text-gray-400" />
                          <div>
                            <p className="text-sm text-gray-600">Created</p>
                            <p className="font-medium text-gray-900">
                              {new Date(dataset.created_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Calendar className="h-5 w-5 text-gray-400" />
                          <div>
                            <p className="text-sm text-gray-600">Modified</p>
                            <p className="font-medium text-gray-900">
                              {new Date(dataset.modified_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                        {dataset.disease_area_study && (
                          <div className="flex items-center space-x-3">
                            <Tags className="h-5 w-5 text-gray-400" />
                            <div>
                              <p className="text-sm text-gray-600">Disease Area</p>
                              <p className="font-medium text-gray-900">{dataset.disease_area_study}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Column Summary */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Column Summary</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-blue-50 rounded-lg p-4">
                        <div className="flex items-center space-x-3">
                          <Hash className="h-6 w-6 text-blue-600" />
                          <div>
                            <p className="text-sm text-blue-600 font-medium">Numeric Columns</p>
                            <p className="text-2xl font-bold text-blue-800">{dataset.num_numeric_columns}</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4">
                        <div className="flex items-center space-x-3">
                          <Type className="h-6 w-6 text-green-600" />
                          <div>
                            <p className="text-sm text-green-600 font-medium">String Columns</p>
                            <p className="text-2xl font-bold text-green-800">{dataset.num_string_columns}</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-4">
                        <div className="flex items-center space-x-3">
                          <Target className="h-6 w-6 text-purple-600" />
                          <div>
                            <p className="text-sm text-purple-600 font-medium">Score Columns</p>
                            <p className="text-2xl font-bold text-purple-800">{dataset.num_score_columns}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tags */}
                  {dataset.tags && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Tags</h3>
                      <div className="flex flex-wrap gap-2">
                        {dataset.tags.split(',').map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800"
                          >
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'columns' && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900">Dataset Columns</h3>
                    <div className="flex items-center space-x-4">
                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search columns..."
                          value={columnsSearchTerm}
                          onChange={(e) => setColumnsSearchTerm(e.target.value)}
                          className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      
                      {/* Sort */}
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">Sort by:</span>
                        <select
                          value={columnsSortBy}
                          onChange={(e) => setColumnsSortBy(e.target.value as 'name' | 'type' | 'index' | 'null_count')}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="index">Index</option>
                          <option value="name">Name</option>
                          <option value="type">Type</option>
                          <option value="null_count">Null Count</option>
                        </select>
                        <button
                          onClick={() => setColumnsSortOrder(columnsSortOrder === 'asc' ? 'desc' : 'asc')}
                          className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          {columnsSortOrder === 'asc' ? (
                            <ArrowUp className="h-4 w-4 text-gray-600" />
                          ) : (
                            <ArrowDown className="h-4 w-4 text-gray-600" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {getFilteredAndSortedColumns().map((column) => (
                      <div key={column.id} className="bg-gray-50 rounded-lg border border-gray-200">
                        <div 
                          className="p-4 cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => toggleColumnExpansion(column.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              {expandedColumns.has(column.id) ? (
                                <Minus className="h-4 w-4 text-gray-400" />
                              ) : (
                                <Plus className="h-4 w-4 text-gray-400" />
                              )}
                              {getColumnTypeIcon(column.column_type)}
                              <div>
                                <p className="font-medium text-gray-900">{column.original_name}</p>
                                <p className="text-sm text-gray-500">Sanitized: {column.sanitized_name}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getColumnTypeColor(column.column_type)}`}>
                                {column.column_type}
                              </span>
                              <span className="text-sm text-gray-500">Index: {column.column_index}</span>
                            </div>
                          </div>
                        </div>
                        
                        {expandedColumns.has(column.id) && (
                          <div className="px-4 pb-4 border-t border-gray-200">
                            <div className="pt-4">
                              {column.column_type === 'numeric' && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                  <div>
                                    <p className="text-sm text-gray-600">Mean</p>
                                    <p className="font-medium text-gray-900">{column.mean_value?.toFixed(4) || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-600">Median</p>
                                    <p className="font-medium text-gray-900">{column.median_value?.toFixed(4) || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-600">Min</p>
                                    <p className="font-medium text-gray-900">{column.min_value?.toFixed(4) || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-600">Max</p>
                                    <p className="font-medium text-gray-900">{column.max_value?.toFixed(4) || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-600">Std Dev</p>
                                    <p className="font-medium text-gray-900">{column.std_deviation?.toFixed(4) || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-600">Null Count</p>
                                    <p className="font-medium text-gray-900">{column.null_count || 0}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-600">Unique Values</p>
                                    <p className="font-medium text-gray-900">{column.unique_count || 'N/A'}</p>
                                  </div>
                                </div>
                              )}
                              
                              {column.column_type === 'string' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-sm text-gray-600">Most Common Value</p>
                                    <p className="font-medium text-gray-900">{column.most_common_value || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-600">Most Common Count</p>
                                    <p className="font-medium text-gray-900">{column.most_common_count || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-600">Null Count</p>
                                    <p className="font-medium text-gray-900">{column.null_count || 0}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-600">Unique Values</p>
                                    <p className="font-medium text-gray-900">{column.unique_count || 'N/A'}</p>
                                  </div>
                                </div>
                              )}
                              
                              {column.column_type === 'score' && (
                                <div className="flex items-center space-x-2 text-sm text-gray-600">
                                  <AlertCircle className="h-4 w-4" />
                                  <span>Score columns are not analyzed for statistics</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'stats' && stats && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Dataset Statistics</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="flex items-center space-x-3 mb-2">
                        <BarChart3 className="h-6 w-6 text-blue-600" />
                        <h4 className="font-semibold text-blue-800">Data Overview</h4>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-blue-600">Total Rows:</span>
                          <span className="font-medium text-blue-800">{stats.total_rows.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-600">Total Columns:</span>
                          <span className="font-medium text-blue-800">{stats.total_columns}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-600">Data Cells:</span>
                          <span className="font-medium text-blue-800">{(stats.total_rows * stats.total_columns).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="flex items-center space-x-3 mb-2">
                        <Hash className="h-6 w-6 text-green-600" />
                        <h4 className="font-semibold text-green-800">Column Types</h4>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-green-600">Numeric:</span>
                          <span className="font-medium text-green-800">{stats.numeric_columns}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-600">String:</span>
                          <span className="font-medium text-green-800">{stats.string_columns}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-600">Score:</span>
                          <span className="font-medium text-green-800">{stats.score_columns}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-purple-50 rounded-lg p-4">
                      <div className="flex items-center space-x-3 mb-2">
                        <TrendingUp className="h-6 w-6 text-purple-600" />
                        <h4 className="font-semibold text-purple-800">Analysis Ready</h4>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-purple-600">Ready for rubrics</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-purple-600">Column mapping available</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-purple-600">Statistics computed</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'histograms' && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900">Column Histograms</h3>
                    <div className="flex items-center space-x-4">
                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search histograms..."
                          value={histogramsSearchTerm}
                          onChange={(e) => setHistogramsSearchTerm(e.target.value)}
                          className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      
                      {/* Sort */}
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">Sort by:</span>
                        <select
                          value={histogramsSortBy}
                          onChange={(e) => setHistogramsSortBy(e.target.value as 'name' | 'type' | 'total_count' | 'null_count')}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="name">Name</option>
                          <option value="type">Type</option>
                          <option value="total_count">Total Count</option>
                          <option value="null_count">Null Count</option>
                        </select>
                        <button
                          onClick={() => setHistogramsSortOrder(histogramsSortOrder === 'asc' ? 'desc' : 'asc')}
                          className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          {histogramsSortOrder === 'asc' ? (
                            <ArrowUp className="h-4 w-4 text-gray-600" />
                          ) : (
                            <ArrowDown className="h-4 w-4 text-gray-600" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <HistogramGrid 
                    datasetId={datasetId} 
                    numericColumns={getFilteredAndSortedHistogramColumns()}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {dataset && (
        <EditModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSave={handleSaveDataset}
          title={`Edit Dataset: ${dataset.name}`}
          entityType="dataset"
          initialData={{
            name: dataset.name,
            description: dataset.description || '',
            owner_name: dataset.owner_name || '',
            organization: dataset.organization || '',
            disease_area_study: dataset.disease_area_study || '',
            tags: dataset.tags || '',
            dataset_type: dataset.dataset_type
          }}
        />
      )}
    </div>
  );
}
