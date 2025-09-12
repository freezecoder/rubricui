'use client';

import { Search } from 'lucide-react';
import { RubricRulesResponse } from '@/types';
import { useRuleFilters } from '@/hooks/useFilters';

interface RulesDisplayPanelProps {
  rubricRules: RubricRulesResponse | null;
  loading: boolean;
}

export const RulesDisplayPanel = ({ rubricRules, loading }: RulesDisplayPanelProps) => {
  const {
    searchTerm,
    setSearchTerm,
    filterOrg,
    setFilterOrg,
    filterDAS,
    setFilterDAS,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    filteredAndSortedRules,
    organizations,
    diseaseAreas
  } = useRuleFilters(rubricRules?.rules || []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 h-[800px] flex flex-col border-2 border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Rubric Rules</h2>
        <div className="flex-1 flex items-center justify-center text-gray-500">Loading rules...</div>
      </div>
    );
  }

  if (!rubricRules) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 h-[800px] flex flex-col border-2 border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Rubric Rules</h2>
        <div className="flex-1 flex items-center justify-center text-gray-500">Select a rubric to view rules</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 h-[800px] flex flex-col border-2 border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Rubric Rules</h2>
        <div className="text-sm text-gray-500">
          {filteredAndSortedRules.length} of {rubricRules.total_rules}
        </div>
      </div>
      
      {/* Search and Filter Controls */}
      <div className="space-y-3 mb-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search rules..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
          />
        </div>
        
        {/* Filters */}
        <div className="grid grid-cols-2 gap-2">
          <select
            value={filterOrg}
            onChange={(e) => setFilterOrg(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-purple-500"
          >
            <option value="">All Orgs</option>
            {organizations.map(org => (
              <option key={org} value={org}>{org}</option>
            ))}
          </select>
          
          <select
            value={filterDAS}
            onChange={(e) => setFilterDAS(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-purple-500"
          >
            <option value="">All DAS</option>
            {diseaseAreas.map(das => (
              <option key={das} value={das}>{das}</option>
            ))}
          </select>
        </div>
        
        {/* Sort Controls */}
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-purple-500"
          >
            <option value="order_index">Sort by Order</option>
            <option value="name">Sort by Name</option>
            <option value="weight">Sort by Weight</option>
            <option value="organization">Sort by Organization</option>
            <option value="created_date">Sort by Created Date</option>
            <option value="modified_date">Sort by Modified Date</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 focus:ring-1 focus:ring-purple-500"
            title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>
      
      {/* Rules List */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {filteredAndSortedRules.map((rule) => {
          // Check if this is a "bad rule" (only has TRUE ~ 0 conditions)
          const isBadRule = rule.ruleset_conditions && 
            rule.ruleset_conditions.length === 1 && 
            rule.ruleset_conditions[0] === 'TRUE ~ 0';
          
          return (
            <div 
              key={rule.id} 
              className={`p-4 border-2 rounded-lg hover:bg-gray-50 transition-colors ${
                isBadRule 
                  ? 'border-red-300 bg-red-50 hover:border-red-400' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`font-medium ${isBadRule ? 'text-red-900' : 'text-gray-900'}`}>
                      {rule.name}
                    </div>
                    <div className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                      #{rule.order_index}
                    </div>
                    {isBadRule && (
                      <div className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-medium">
                        Bad Rule
                      </div>
                    )}
                  </div>
                {rule.description && (
                  <div className="text-sm text-gray-600 mb-2 line-clamp-2">{rule.description}</div>
                )}
                
                {/* Rule Metadata */}
                <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-2">
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Weight:</span>
                    <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{rule.weight}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Conditions:</span>
                    <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{rule.ruleset_conditions.length}</span>
                  </div>
                  {rule.organization && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Org:</span>
                      <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">{rule.organization}</span>
                    </div>
                  )}
                </div>
                
                {/* Tags */}
                {rule.tags && rule.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {rule.tags.slice(0, 3).map((tag, index) => (
                      <span key={index} className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                        {tag}
                      </span>
                    ))}
                    {rule.tags.length > 3 && (
                      <span className="text-xs text-gray-500">+{rule.tags.length - 3} more</span>
                    )}
                  </div>
                )}
                
                {/* Column Mapping */}
                {rule.column_mapping && Object.keys(rule.column_mapping).length > 0 && (
                  <div className="text-xs text-gray-500 mb-2">
                    <span className="font-medium">Columns:</span> {Object.values(rule.column_mapping).join(', ')}
                  </div>
                )}
              </div>
            </div>
            
            {/* Rule Conditions */}
            {rule.ruleset_conditions.length > 0 && (
              <div className="mt-3 pt-3 border-t-2 border-gray-200">
                <div className="text-xs font-medium text-gray-700 mb-2">Rule Conditions:</div>
                <div className="space-y-1">
                  {rule.ruleset_conditions.slice(0, 3).map((condition, index) => (
                    <div key={index} className="text-xs text-gray-800 bg-gray-50 px-2 py-1 rounded font-mono border border-gray-200">
                      {condition}
                    </div>
                  ))}
                  {rule.ruleset_conditions.length > 3 && (
                    <div className="text-xs text-gray-500 italic">
                      ...and {rule.ruleset_conditions.length - 3} more conditions
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          );
        })}
      </div>
      
      {/* Rules Summary */}
      <div className="mt-4 p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
        <div className="text-sm text-purple-800">
          <div className="flex justify-between items-center">
            <span><strong>Total Rules:</strong> {rubricRules.total_rules}</span>
            {(searchTerm || filterOrg || filterDAS) && (
              <span className="text-purple-600">
                (Filtered: {filteredAndSortedRules.length})
              </span>
            )}
          </div>
          {filteredAndSortedRules.length > 0 && (
            <div className="mt-1 text-xs text-purple-600">
              Sorted by: {sortBy.replace('_', ' ')} ({sortOrder})
            </div>
          )}
          {(() => {
            const badRulesCount = filteredAndSortedRules.filter(rule => 
              rule.ruleset_conditions && 
              rule.ruleset_conditions.length === 1 && 
              rule.ruleset_conditions[0] === 'TRUE ~ 0'
            ).length;
            
            if (badRulesCount > 0) {
              return (
                <div className="mt-2 text-xs text-red-600 font-medium">
                  ⚠️ {badRulesCount} bad rule{badRulesCount > 1 ? 's' : ''} detected (only TRUE ~ 0 conditions)
                </div>
              );
            }
            return null;
          })()}
        </div>
      </div>
    </div>
  );
};
