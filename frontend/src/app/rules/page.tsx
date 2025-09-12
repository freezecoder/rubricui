'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiService } from '@/services/api';
import { Rule } from '@/types';
import { parseCondition } from '@/lib/ruleUtils';
import { notify } from '@/lib/notifications';
import { Search, Filter, Plus, Grid3x3, List, Calendar, Users, Building2, Tags, MoreVertical, Trash2, Edit, Eye, ArrowUpDown, ArrowUp, ArrowDown, CheckSquare, Square, Copy } from 'lucide-react';

type SortField = 'name' | 'created_date' | 'modified_date';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'cards' | 'list';

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [sortBy, setSortBy] = useState<SortField>('created_date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedRules, setSelectedRules] = useState<Set<string>>(new Set());
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [cloneRuleId, setCloneRuleId] = useState<string>('');
  const [cloneRuleName, setCloneRuleName] = useState<string>('');
  const [newRuleName, setNewRuleName] = useState<string>('');

  useEffect(() => {
    loadRules();
  }, [sortBy, sortOrder]);

  const loadRules = async () => {
    try {
      setLoading(true);
      const data = await apiService.getRules(sortBy, sortOrder);
      setRules(data);
    } catch (err) {
      setError('Failed to load rules');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRule = async (id: string, ruleName?: string) => {
    const confirmed = await notify.confirmDelete('rule', ruleName);
    if (confirmed) {
      try {
        await apiService.deleteRuleWithNotification(id, ruleName);
        loadRules();
      } catch (err) {
        console.error(err);
        // Error notification is handled by the API service
      }
    }
  };

  const handleSelectRule = (ruleId: string) => {
    setSelectedRules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ruleId)) {
        newSet.delete(ruleId);
      } else {
        newSet.add(ruleId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedRules.size === filteredRules.length) {
      setSelectedRules(new Set());
    } else {
      setSelectedRules(new Set(filteredRules.map(rule => rule.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRules.size === 0) return;
    
    const selectedRuleNames = filteredRules
      .filter(rule => selectedRules.has(rule.id))
      .map(rule => rule.name);
    
    const confirmed = await notify.confirmDestructiveAction(
      'delete',
      `${selectedRules.size} rules`,
      `This will permanently delete ${selectedRules.size} rules: ${selectedRuleNames.slice(0, 3).join(', ')}${selectedRuleNames.length > 3 ? ' and more...' : ''}`
    );
    
    if (confirmed) {
      try {
        await apiService.bulkDeleteRulesWithNotification(Array.from(selectedRules), selectedRuleNames);
        setSelectedRules(new Set());
        loadRules();
      } catch (err) {
        console.error(err);
        // Error notification is handled by the API service
      }
    }
  };

  const handleCloneRule = (ruleId: string, ruleName: string) => {
    setCloneRuleId(ruleId);
    setCloneRuleName(ruleName);
    setNewRuleName(`${ruleName} (Copy)`);
    setCloneModalOpen(true);
  };

  const handleCloneSubmit = async () => {
    if (!newRuleName.trim()) {
      notify.validationError('Please enter a name for the cloned rule');
      return;
    }

    try {
      await apiService.cloneRuleWithNotification(cloneRuleId, newRuleName.trim(), cloneRuleName);
      setCloneModalOpen(false);
      setCloneRuleId('');
      setCloneRuleName('');
      setNewRuleName('');
      loadRules();
    } catch (err) {
      console.error(err);
      // Error notification is handled by the API service
    }
  };

  const handleCloneCancel = () => {
    setCloneModalOpen(false);
    setCloneRuleId('');
    setCloneRuleName('');
    setNewRuleName('');
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortBy !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  // Filter rules based on search term
  const filteredRules = rules.filter(rule => 
    rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
    rule.organization?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule.disease_area_study?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading rules...</p>
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
            onClick={loadRules} 
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
                Rules
              </h1>
              <p className="text-gray-600 mt-2">Manage and organize your genomic analysis rules</p>
            </div>
            <Link href="/rules/create">
              <button className="bg-gradient-to-r from-blue-600 to-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-red-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center space-x-2">
                <Plus className="h-5 w-5" />
                <span>Create Rule</span>
              </button>
            </Link>
          </div>

          {/* Search and Controls */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search rules by name, description, tags, organization, or disease area..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Sort Controls */}
              <div className="flex items-center space-x-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortField)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="created_date">Created Date</option>
                  <option value="modified_date">Modified Date</option>
                  <option value="name">Name</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors flex items-center space-x-1"
                >
                  {sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                  <span className="capitalize">{sortOrder}</span>
                </button>
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
          </div>
        </div>

        {/* Bulk Actions Toolbar */}
        {selectedRules.size > 0 && (
          <div className="mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span className="text-blue-800 font-medium">
                    {selectedRules.size} rule{selectedRules.size !== 1 ? 's' : ''} selected
                  </span>
                  <button
                    onClick={() => setSelectedRules(new Set())}
                    className="text-blue-600 hover:text-blue-800 text-sm underline"
                  >
                    Clear selection
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleBulkDelete}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete Selected</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results Summary */}
        <div className="mb-6">
          <p className="text-gray-600">
            Showing {filteredRules.length} of {rules.length} rules
            {selectedRules.size > 0 && (
              <span className="ml-2 text-blue-600 font-medium">
                ({selectedRules.size} selected)
              </span>
            )}
          </p>
        </div>

        {/* Rules Display */}
        {viewMode === 'cards' ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredRules.map((rule) => (
              <div key={rule.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02] group">
                <div className="p-6">
                  {/* Card Header */}
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 leading-tight group-hover:text-blue-600 transition-colors">
                      {rule.name.length > 40 ? `${rule.name.substring(0, 40)}...` : rule.name}
                    </h3>
                    <div className="relative">
                      <button className="p-1 rounded-full hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4 text-gray-400" />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  {rule.description && (
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                      {rule.description.length > 100 ? `${rule.description.substring(0, 100)}...` : rule.description}
                    </p>
                  )}

                  {/* Tags */}
                  {rule.tags && rule.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {rule.tags.slice(0, 3).map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {tag}
                        </span>
                      ))}
                      {rule.tags.length > 3 && (
                        <span className="text-xs text-gray-500">+{rule.tags.length - 3}</span>
                      )}
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex items-center">
                      <Building2 className="h-4 w-4 mr-2" />
                      <span>{rule.organization || 'No organization'}</span>
                    </div>
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-2" />
                      <span>{rule.owner_name || 'Unknown owner'}</span>
                    </div>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2" />
                      <span>{new Date(rule.created_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium">Weight: {rule.weight}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t border-gray-100">
                    <Link href={`/rules/${rule.id}`} className="flex-1">
                      <button className="w-full px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center">
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </button>
                    </Link>
                    <Link href={`/rules/${rule.id}/edit`} className="flex-1">
                      <button className="w-full px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center">
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </button>
                    </Link>
                    <button
                      onClick={() => handleCloneRule(rule.id, rule.name)}
                      className="px-3 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                      title="Clone rule"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.id, rule.name)}
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                      <button
                        onClick={handleSelectAll}
                        className="flex items-center justify-center hover:text-gray-700 transition-colors"
                        title={selectedRules.size === filteredRules.length ? "Deselect all" : "Select all"}
                      >
                        {selectedRules.size === filteredRules.length && filteredRules.length > 0 ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('name')}
                        className="flex items-center space-x-1 hover:text-gray-700 transition-colors"
                      >
                        <span>Name</span>
                        {getSortIcon('name')}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Organization
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Disease Area
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tags
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('created_date')}
                        className="flex items-center space-x-1 hover:text-gray-700 transition-colors"
                      >
                        <span>Created</span>
                        {getSortIcon('created_date')}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('modified_date')}
                        className="flex items-center space-x-1 hover:text-gray-700 transition-colors"
                      >
                        <span>Modified</span>
                        {getSortIcon('modified_date')}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap w-12">
                        <button
                          onClick={() => handleSelectRule(rule.id)}
                          className="flex items-center justify-center hover:text-gray-700 transition-colors"
                          title={selectedRules.has(rule.id) ? "Deselect" : "Select"}
                        >
                          {selectedRules.has(rule.id) ? (
                            <CheckSquare className="h-4 w-4 text-blue-600" />
                          ) : (
                            <Square className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{rule.name}</div>
                          {rule.description && (
                            <div className="text-sm text-gray-500 max-w-xs truncate">
                              {rule.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {rule.organization || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {rule.disease_area_study || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {rule.tags?.slice(0, 2).map((tag, index) => (
                            <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {tag}
                            </span>
                          ))}
                          {rule.tags && rule.tags.length > 2 && (
                            <span className="text-xs text-gray-500">+{rule.tags.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(rule.created_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(rule.modified_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <Link href={`/rules/${rule.id}`}>
                            <button className="text-blue-600 hover:text-blue-900 p-1 rounded" title="View rule">
                              <Eye className="h-4 w-4" />
                            </button>
                          </Link>
                          <Link href={`/rules/${rule.id}/edit`}>
                            <button className="text-green-600 hover:text-green-900 p-1 rounded" title="Edit rule">
                              <Edit className="h-4 w-4" />
                            </button>
                          </Link>
                          <button
                            onClick={() => handleCloneRule(rule.id, rule.name)}
                            className="text-purple-600 hover:text-purple-900 p-1 rounded"
                            title="Clone rule"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule.id, rule.name)}
                            className="text-red-600 hover:text-red-900 p-1 rounded"
                            title="Delete rule"
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
        {filteredRules.length === 0 && (
          <div className="text-center py-12">
            <div className="bg-white/50 backdrop-blur-sm rounded-xl border border-gray-200 p-8 max-w-md mx-auto">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No rules found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm
                  ? "Try adjusting your search criteria"
                  : "Get started by creating your first rule"}
              </p>
              <Link href="/rules/create">
                <button className="bg-gradient-to-r from-blue-600 to-red-600 text-white px-6 py-2 rounded-lg font-semibold hover:from-blue-700 hover:to-red-700 transition-all duration-200">
                  Create Rule
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* Clone Modal */}
        {cloneModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Clone Rule</h3>
              <p className="text-gray-600 mb-4">
                Create a copy of "{cloneRuleName}" with a new name.
              </p>
              <div className="mb-4">
                <label htmlFor="newRuleName" className="block text-sm font-medium text-gray-700 mb-2">
                  New Rule Name
                </label>
                <input
                  type="text"
                  id="newRuleName"
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter new rule name"
                  autoFocus
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleCloneCancel}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCloneSubmit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Clone Rule
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}