'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiService } from '@/services/api';
import { Rubric } from '@/types';
import { notify } from '@/lib/notifications';
import { Search, Filter, Plus, Grid3x3, List, Calendar, Users, Building2, Tags, MoreVertical, Trash2, Edit, Eye, Copy } from 'lucide-react';

export default function RubricsPage() {
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [cloneRubricId, setCloneRubricId] = useState<string>('');
  const [cloneRubricName, setCloneRubricName] = useState<string>('');
  const [newRubricName, setNewRubricName] = useState<string>('');
  const [copyRules, setCopyRules] = useState<boolean>(true);

  useEffect(() => {
    loadRubrics();
  }, []);

  const loadRubrics = async () => {
    try {
      setLoading(true);
      const data = await apiService.getRubrics();
      setRubrics(data);
    } catch (err) {
      setError('Failed to load rubrics');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRubric = async (id: string, rubricName?: string) => {
    const confirmed = await notify.confirmDelete('rubric', rubricName);
    if (confirmed) {
      try {
        await apiService.deleteRubricWithNotification(id, rubricName);
        loadRubrics();
      } catch (err) {
        console.error(err);
        // Error notification is handled by the API service
      }
    }
  };

  const handleCloneRubric = (rubricId: string, rubricName: string) => {
    setCloneRubricId(rubricId);
    setCloneRubricName(rubricName);
    setNewRubricName(`${rubricName} (Copy)`);
    setCloneModalOpen(true);
  };

  const handleCloneSubmit = async () => {
    if (!newRubricName.trim()) {
      notify.validationError('Please enter a name for the cloned rubric');
      return;
    }

    try {
      await apiService.cloneRubricWithNotification(cloneRubricId, newRubricName.trim(), copyRules, cloneRubricName);
      setCloneModalOpen(false);
      setCloneRubricId('');
      setCloneRubricName('');
      setNewRubricName('');
      setCopyRules(true); // Reset to default
      loadRubrics();
    } catch (err) {
      console.error(err);
      // Error notification is handled by the API service
    }
  };

  const handleCloneCancel = () => {
    setCloneModalOpen(false);
    setCloneRubricId('');
    setCloneRubricName('');
    setNewRubricName('');
  };

  // Filter rubrics based on search term
  const filteredRubrics = rubrics.filter(rubric => 
    rubric.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rubric.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rubric.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading rubrics...</p>
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
            onClick={loadRubrics} 
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
                Rubrics
              </h1>
              <p className="text-gray-600 mt-2">Manage and organize your genomic analysis rubrics</p>
            </div>
            <Link href="/rubrics/create">
              <button className="bg-gradient-to-r from-blue-600 to-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-red-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center space-x-2">
                <Plus className="h-5 w-5" />
                <span>Create Rubric</span>
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
                  placeholder="Search rubrics by name, description, or tags..."
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
          </div>
        </div>

        {/* Results Summary */}
        <div className="mb-6">
          <p className="text-gray-600">
            Showing {filteredRubrics.length} of {rubrics.length} rubrics
          </p>
        </div>

        {/* Rubrics Display */}
        {viewMode === 'cards' ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredRubrics.map((rubric) => (
              <div key={rubric.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02] group">
                <div className="p-6">
                  {/* Card Header */}
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 leading-tight group-hover:text-blue-600 transition-colors">
                      {rubric.name.length > 40 ? `${rubric.name.substring(0, 40)}...` : rubric.name}
                    </h3>
                    <div className="relative">
                      <button className="p-1 rounded-full hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4 text-gray-400" />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  {rubric.description && (
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                      {rubric.description.length > 100 ? `${rubric.description.substring(0, 100)}...` : rubric.description}
                    </p>
                  )}

                  {/* Tags */}
                  {rubric.tags && rubric.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {rubric.tags.slice(0, 3).map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                        >
                          {tag}
                        </span>
                      ))}
                      {rubric.tags.length > 3 && (
                        <span className="text-xs text-gray-500">+{rubric.tags.length - 3}</span>
                      )}
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex items-center">
                      <Building2 className="h-4 w-4 mr-2" />
                      <span>{rubric.organization || 'No organization'}</span>
                    </div>
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-2" />
                      <span>{rubric.owner_name || 'Unknown owner'}</span>
                    </div>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2" />
                      <span>{new Date(rubric.created_date).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t border-gray-100">
                    <Link href={`/rubrics/${rubric.id}`} className="flex-1">
                      <button className="w-full px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center">
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </button>
                    </Link>
                    <Link href={`/rubrics/${rubric.id}/edit`} className="flex-1">
                      <button className="w-full px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center">
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </button>
                    </Link>
                    <button
                      onClick={() => handleCloneRubric(rubric.id, rubric.name)}
                      className="px-3 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                      title="Clone rubric"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteRubric(rubric.id, rubric.name)}
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
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Organization
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tags
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
                  {filteredRubrics.map((rubric) => (
                    <tr key={rubric.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{rubric.name}</div>
                          {rubric.description && (
                            <div className="text-sm text-gray-500 max-w-xs truncate">
                              {rubric.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {rubric.organization || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {rubric.tags?.slice(0, 2).map((tag, index) => (
                            <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              {tag}
                            </span>
                          ))}
                          {rubric.tags && rubric.tags.length > 2 && (
                            <span className="text-xs text-gray-500">+{rubric.tags.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(rubric.created_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <Link href={`/rubrics/${rubric.id}`}>
                            <button className="text-blue-600 hover:text-blue-900 p-1 rounded" title="View rubric">
                              <Eye className="h-4 w-4" />
                            </button>
                          </Link>
                          <Link href={`/rubrics/${rubric.id}/edit`}>
                            <button className="text-green-600 hover:text-green-900 p-1 rounded" title="Edit rubric">
                              <Edit className="h-4 w-4" />
                            </button>
                          </Link>
                          <button
                            onClick={() => handleCloneRubric(rubric.id, rubric.name)}
                            className="text-purple-600 hover:text-purple-900 p-1 rounded"
                            title="Clone rubric"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRubric(rubric.id, rubric.name)}
                            className="text-red-600 hover:text-red-900 p-1 rounded"
                            title="Delete rubric"
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
        {filteredRubrics.length === 0 && (
          <div className="text-center py-12">
            <div className="bg-white/50 backdrop-blur-sm rounded-xl border border-gray-200 p-8 max-w-md mx-auto">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No rubrics found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm
                  ? "Try adjusting your search criteria"
                  : "Get started by creating your first rubric"}
              </p>
              <Link href="/rubrics/create">
                <button className="bg-gradient-to-r from-blue-600 to-red-600 text-white px-6 py-2 rounded-lg font-semibold hover:from-blue-700 hover:to-red-700 transition-all duration-200">
                  Create Rubric
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* Clone Modal */}
        {cloneModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Clone Rubric</h3>
              <p className="text-gray-600 mb-4">
                Create a copy of "{cloneRubricName}" with a new name.
              </p>
              <div className="mb-4">
                <label htmlFor="newRubricName" className="block text-sm font-medium text-gray-700 mb-2">
                  New Rubric Name
                </label>
                <input
                  type="text"
                  id="newRubricName"
                  value={newRubricName}
                  onChange={(e) => setNewRubricName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter new rubric name"
                  autoFocus
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rule Cloning Mode
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="copyRules"
                      value="true"
                      checked={copyRules === true}
                      onChange={() => setCopyRules(true)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">
                      Copy all rules (creates new rule instances)
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="copyRules"
                      value="false"
                      checked={copyRules === false}
                      onChange={() => setCopyRules(false)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">
                      Share rules (both rubrics use the same rules)
                    </span>
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {copyRules 
                    ? "Changes to rules in one rubric won't affect the other."
                    : "Changes to rules will affect both rubrics."
                  }
                </p>
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
                  Clone Rubric
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}