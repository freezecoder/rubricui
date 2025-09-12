'use client';

import { Search, Database } from 'lucide-react';
import { DatasetColumn } from '@/types';
import { useColumnFilters } from '@/hooks/useFilters';

interface ColumnsPanelProps {
  columns: DatasetColumn[];
  selectedDataset: string | null;
}

export const ColumnsPanel = ({ columns, selectedDataset }: ColumnsPanelProps) => {
  const {
    searchTerm,
    setSearchTerm,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    filteredAndSortedColumns
  } = useColumnFilters(columns);

  if (!selectedDataset) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 h-[800px] flex flex-col border-2 border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Numeric Columns</h2>
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <Database className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <div>Select a dataset to view numeric columns</div>
          </div>
        </div>
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 h-[800px] flex flex-col border-2 border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Numeric Columns</h2>
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <Database className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <div>No numeric columns found</div>
            <div className="text-sm">This dataset may not contain numeric data</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 h-[800px] flex flex-col border-2 border-gray-200">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Numeric Columns</h2>
      
      {/* Search and Sort Controls */}
      <div className="space-y-3 mb-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search columns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
        
        {/* Sort Controls */}
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500"
          >
            <option value="name">Sort by Name</option>
            <option value="mean">Sort by Mean</option>
            <option value="median">Sort by Median</option>
            <option value="std_dev">Sort by Std Dev</option>
            <option value="null_count">Sort by Null Count</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 focus:ring-1 focus:ring-blue-500"
            title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>
      
      {/* Columns List */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-3">
          {filteredAndSortedColumns.map((column) => (
            <div key={column.id} className="p-4 border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <div className="font-medium text-gray-900 truncate" title={column.original_name}>
                  {column.original_name}
                </div>
                <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded border border-gray-200">
                  #{column.column_index}
                </div>
              </div>
              
              <div className="text-sm text-gray-600 mb-2">
                <div className="font-mono text-xs bg-gray-100 px-2 py-1 rounded border border-gray-200">
                  {column.sanitized_name}
                </div>
              </div>
              
              {column.column_type === 'numeric' && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Mean:</span>
                    <span className="font-medium">{column.mean_value?.toFixed(3) || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Median:</span>
                    <span className="font-medium">{column.median_value?.toFixed(3) || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Min:</span>
                    <span className="font-medium">{column.min_value?.toFixed(3) || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Max:</span>
                    <span className="font-medium">{column.max_value?.toFixed(3) || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Std Dev:</span>
                    <span className="font-medium">{column.std_deviation?.toFixed(3) || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Nulls:</span>
                    <span className="font-medium">{column.null_count || 0}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Results Summary */}
      {filteredAndSortedColumns.length !== columns.length && (
        <div className="mt-3 p-3 bg-yellow-50 rounded-lg border-2 border-yellow-200">
          <div className="text-xs text-yellow-800">
            Showing {filteredAndSortedColumns.length} of {columns.length} columns
          </div>
        </div>
      )}
      
      {selectedDataset && columns.length > 0 && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
          <div className="text-sm text-blue-800">
            <strong>Total Numeric Columns:</strong> {columns.length}
            {searchTerm && (
              <span className="ml-2 text-blue-600">
                (Filtered: {filteredAndSortedColumns.length})
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
