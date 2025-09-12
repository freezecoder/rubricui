'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiService } from '@/services/api';
import { DatasetSummary, DatasetType } from '@/types';
import { notify } from '@/lib/notifications';
import { 
  Search, 
  Plus, 
  Grid3x3, 
  List, 
  Calendar, 
  Users, 
  Building2, 
  MoreVertical, 
  Trash2, 
  Eye, 
  Database,
  FileText,
  BarChart3,
  Hash,
  Type,
  Target,
  Edit,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { DatasetUploadModal } from '@/components/ui/dataset-upload-modal';
import { EditModal } from '@/components/ui/edit-modal';

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingDataset, setEditingDataset] = useState<DatasetSummary | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedType, setSelectedType] = useState<DatasetType | 'all'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'created_date' | 'dataset_type' | 'num_rows'>('created_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadDatasets();
  }, []);

  const loadDatasets = async () => {
    try {
      setLoading(true);
      const data = await apiService.getDatasets();
      setDatasets(data);
    } catch (err) {
      setError('Failed to load datasets');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDataset = async (id: string, datasetName?: string) => {
    const confirmed = await notify.confirmDelete('dataset', datasetName);
    if (confirmed) {
      try {
        await apiService.deleteDatasetWithNotification(id, datasetName);
        loadDatasets();
      } catch (err) {
        console.error(err);
        // Error notification is handled by the API service
      }
    }
  };

  const handleEditDataset = (dataset: DatasetSummary) => {
    setEditingDataset(dataset);
    setShowEditModal(true);
  };

  const handleSaveDataset = async (updatedData: any) => {
    if (!editingDataset) return;
    
    try {
      await apiService.updateDatasetWithNotification(editingDataset.id, updatedData);
      loadDatasets();
      setShowEditModal(false);
      setEditingDataset(null);
    } catch (err) {
      console.error(err);
      // Error notification is handled by the API service
    }
  };

  // Filter and sort datasets
  const filteredAndSortedDatasets = datasets
    .filter(dataset => {
      // Type filter
      if (selectedType !== 'all' && dataset.dataset_type !== selectedType) {
        return false;
      }
      
      // Search filter
      return dataset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dataset.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dataset.organization?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dataset.owner_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dataset.disease_area_study?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dataset.tags?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dataset.original_filename.toLowerCase().includes(searchTerm.toLowerCase());
    })
    .sort((a, b) => {
      let aValue: string | number, bValue: string | number;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'created_date':
          aValue = new Date(a.created_date).getTime();
          bValue = new Date(b.created_date).getTime();
          break;
        case 'dataset_type':
          aValue = a.dataset_type;
          bValue = b.dataset_type;
          break;
        case 'num_rows':
          aValue = a.num_rows;
          bValue = b.num_rows;
          break;
        default:
          aValue = new Date(a.created_date).getTime();
          bValue = new Date(b.created_date).getTime();
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading datasets...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error</h3>
          <p className="text-red-600">{error}</p>
          <button 
            onClick={loadDatasets} 
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-red-50">
      <div className="w-full px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-red-600 bg-clip-text text-transparent">
                Datasets
              </h1>
              <p className="text-gray-600 mt-2">Manage and organize your genomic datasets</p>
            </div>
            <button 
              onClick={() => setShowUploadModal(true)}
              className="bg-gradient-to-r from-blue-600 to-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-red-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center space-x-2"
            >
              <Plus className="h-5 w-5" />
              <span>Upload Dataset</span>
            </button>
          </div>

          {/* Search and Controls */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex flex-col gap-4">
              {/* Top Row: Search and View Mode */}
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search datasets by name, description, organization, or filename..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setViewMode('cards')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      viewMode === 'cards'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Grid3x3 className="h-4 w-4 mr-1 inline" />
                    Cards
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      viewMode === 'list'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <List className="h-4 w-4 mr-1 inline" />
                    List
                  </button>
                </div>
              </div>

              {/* Bottom Row: Filters and Sorting */}
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Dataset Type Filter */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600 font-medium">Type:</span>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value as DatasetType | 'all')}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="all">All Types</option>
                    <option value="input">Input</option>
                    <option value="output">Output</option>
                    <option value="annotations">Annotations</option>
                    <option value="rubric">Rubric</option>
                  </select>
                </div>

                {/* Sort By */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600 font-medium">Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'name' | 'created_date' | 'dataset_type' | 'num_rows')}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="created_date">Date Created</option>
                    <option value="name">Name</option>
                    <option value="dataset_type">Type</option>
                    <option value="num_rows">Rows</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                  >
                    {sortOrder === 'asc' ? (
                      <ArrowUp className="h-4 w-4 text-gray-600" />
                    ) : (
                      <ArrowDown className="h-4 w-4 text-gray-600" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mb-6">
          <p className="text-gray-600">
            Showing {filteredAndSortedDatasets.length} of {datasets.length} datasets
            {selectedType !== 'all' && ` (filtered by ${selectedType} type)`}
          </p>
        </div>

        {/* Datasets Display */}
        {viewMode === 'cards' ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredAndSortedDatasets.map((dataset) => (
              <div key={dataset.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02] group">
                <div className="p-6">
                  {/* Card Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center space-x-2">
                      <Database className="h-5 w-5 text-blue-600" />
                      <h3 className="text-lg font-semibold text-gray-900 leading-tight group-hover:text-blue-600 transition-colors">
                        {dataset.name.length > 30 ? `${dataset.name.substring(0, 30)}...` : dataset.name}
                      </h3>
                    </div>
                    <div className="relative">
                      <button className="p-1 rounded-full hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4 text-gray-400" />
                      </button>
                    </div>
                  </div>

                  {/* Dataset Type Badge */}
                  <div className="mb-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      dataset.dataset_type === 'input' ? 'bg-blue-100 text-blue-800' :
                      dataset.dataset_type === 'output' ? 'bg-green-100 text-green-800' :
                      dataset.dataset_type === 'annotations' ? 'bg-purple-100 text-purple-800' :
                      dataset.dataset_type === 'rubric' ? 'bg-orange-100 text-orange-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {dataset.dataset_type.charAt(0).toUpperCase() + dataset.dataset_type.slice(1)}
                    </span>
                  </div>

                  {/* Description */}
                  {dataset.description && (
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                      {dataset.description.length > 100 ? `${dataset.description.substring(0, 100)}...` : dataset.description}
                    </p>
                  )}

                  {/* File Info */}
                  <div className="flex items-center text-sm text-gray-500 mb-4">
                    <FileText className="h-4 w-4 mr-2" />
                    <span className="truncate">{dataset.original_filename}</span>
                  </div>

                  {/* Dataset Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="flex items-center space-x-2">
                        <BarChart3 className="h-4 w-4 text-blue-600" />
                        <div>
                          <p className="text-xs text-blue-600 font-medium">Rows</p>
                          <p className="text-sm font-semibold text-blue-800">{dataset.num_rows.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="flex items-center space-x-2">
                        <Hash className="h-4 w-4 text-green-600" />
                        <div>
                          <p className="text-xs text-green-600 font-medium">Columns</p>
                          <p className="text-sm font-semibold text-green-800">{dataset.num_columns}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Column Types */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {dataset.num_numeric_columns > 0 && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <Hash className="h-3 w-3 mr-1" />
                        {dataset.num_numeric_columns} numeric
                      </span>
                    )}
                    {dataset.num_string_columns > 0 && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <Type className="h-3 w-3 mr-1" />
                        {dataset.num_string_columns} string
                      </span>
                    )}
                    {dataset.num_score_columns > 0 && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        <Target className="h-3 w-3 mr-1" />
                        {dataset.num_score_columns} score
                      </span>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex items-center">
                      <Building2 className="h-4 w-4 mr-2" />
                      <span>{dataset.organization || 'No organization'}</span>
                    </div>
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-2" />
                      <span>{dataset.owner_name || 'Unknown owner'}</span>
                    </div>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2" />
                      <span>{new Date(dataset.created_date).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t border-gray-100">
                    <Link href={`/datasets/${dataset.id}`} className="flex-1">
                      <button className="w-full px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center">
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </button>
                    </Link>
                    <button
                      onClick={() => handleEditDataset(dataset)}
                      className="px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteDataset(dataset.id, dataset.name)}
                      className="px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dataset
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      File
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Columns
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Organization
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAndSortedDatasets.map((dataset) => (
                    <tr key={dataset.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Database className="h-5 w-5 text-blue-600 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{dataset.name}</div>
                            {dataset.description && (
                              <div className="text-sm text-gray-500 max-w-xs truncate">
                                {dataset.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          dataset.dataset_type === 'input' ? 'bg-blue-100 text-blue-800' :
                          dataset.dataset_type === 'output' ? 'bg-green-100 text-green-800' :
                          dataset.dataset_type === 'annotations' ? 'bg-purple-100 text-purple-800' :
                          dataset.dataset_type === 'rubric' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {dataset.dataset_type.charAt(0).toUpperCase() + dataset.dataset_type.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          <FileText className="h-4 w-4 mr-2 text-gray-400" />
                          <span className="truncate max-w-xs">{dataset.original_filename}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {dataset.num_rows.toLocaleString()} rows
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {dataset.num_numeric_columns > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {dataset.num_numeric_columns}N
                            </span>
                          )}
                          {dataset.num_string_columns > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {dataset.num_string_columns}S
                            </span>
                          )}
                          {dataset.num_score_columns > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              {dataset.num_score_columns}SC
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {dataset.organization || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(dataset.created_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <Link href={`/datasets/${dataset.id}`}>
                            <button className="text-blue-600 hover:text-blue-900 p-1 rounded">
                              <Eye className="h-4 w-4" />
                            </button>
                          </Link>
                          <button
                            onClick={() => handleEditDataset(dataset)}
                            className="text-gray-600 hover:text-gray-900 p-1 rounded"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteDataset(dataset.id, dataset.name)}
                            className="text-red-600 hover:text-red-900 p-1 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredAndSortedDatasets.length === 0 && (
          <div className="text-center py-12">
            <div className="bg-white/50 backdrop-blur-sm rounded-xl border border-gray-200 p-8 max-w-md mx-auto">
              <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No datasets found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm
                  ? "Try adjusting your search criteria"
                  : "Get started by uploading your first dataset"}
              </p>
              <button 
                onClick={() => setShowUploadModal(true)}
                className="bg-gradient-to-r from-blue-600 to-red-600 text-white px-6 py-2 rounded-lg font-semibold hover:from-blue-700 hover:to-red-700 transition-all duration-200"
              >
                Upload Dataset
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <DatasetUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={loadDatasets}
      />

      {/* Edit Modal */}
      {editingDataset && (
        <EditModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingDataset(null);
          }}
          onSave={handleSaveDataset}
          title={`Edit Dataset: ${editingDataset.name}`}
          entityType="dataset"
          initialData={{
            name: editingDataset.name,
            description: editingDataset.description || '',
            owner_name: editingDataset.owner_name || '',
            organization: editingDataset.organization || '',
            disease_area_study: editingDataset.disease_area_study || '',
            tags: editingDataset.tags || '',
            dataset_type: editingDataset.dataset_type
          }}
        />
      )}
    </div>
  );
}
