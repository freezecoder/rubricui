'use client';

import { Search, RefreshCw, Plus } from 'lucide-react';
import { Rubric } from '@/types';
import { useRubricFilters } from '@/hooks/useFilters';

interface RubricSelectionPanelProps {
  rubrics: Rubric[];
  selectedRubric: string | null;
  onRubricSelect: (rubricId: string) => void;
  onRefreshRubric: () => void;
  onCreateRubric?: () => void;
}

export const RubricSelectionPanel = ({
  rubrics,
  selectedRubric,
  onRubricSelect,
  onRefreshRubric,
  onCreateRubric
}: RubricSelectionPanelProps) => {
  const {
    searchTerm,
    setSearchTerm,
    filterOrg,
    setFilterOrg,
    filterDAS,
    setFilterDAS,
    filteredRubrics,
    organizations,
    diseaseAreas
  } = useRubricFilters(rubrics);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 h-[800px] flex flex-col border-2 border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Select Rubric</h2>
        <div className="flex gap-2">
          {onCreateRubric && (
            <button
              onClick={onCreateRubric}
              className="text-sm bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1 rounded flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />
              Create New
            </button>
          )}
          {selectedRubric && (
            <button
              onClick={onRefreshRubric}
              className="text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search rubrics..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <select
            value={filterOrg}
            onChange={(e) => setFilterOrg(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Orgs</option>
            {organizations.map(org => (
              <option key={org} value={org}>{org}</option>
            ))}
          </select>
          
          <select
            value={filterDAS}
            onChange={(e) => setFilterDAS(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All DAS</option>
            {diseaseAreas.map(das => (
              <option key={das} value={das}>{das}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Rubric List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {filteredRubrics.map((rubric) => (
          <div 
            key={rubric.id} 
            className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
              selectedRubric === rubric.id 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:bg-gray-50 hover:border-gray-400'
            }`}
            onClick={() => onRubricSelect(rubric.id)}
          >
            <div className="font-medium text-gray-900">{rubric.name}</div>
            {rubric.description && (
              <div className="text-sm text-gray-600 mt-1 line-clamp-2">{rubric.description}</div>
            )}
            <div className="text-xs text-gray-500 mt-1">
              {rubric.organization} | {rubric.disease_area_study}
            </div>
          </div>
        ))}
      </div>
      
      {selectedRubric && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
          <div className="text-sm text-blue-800">
            <strong>Selected:</strong> {rubrics.find(r => r.id === selectedRubric)?.name}
          </div>
        </div>
      )}
    </div>
  );
};
