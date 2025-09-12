'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { apiService } from '@/services/api';
import { Rubric } from '@/types';
import { notify } from '@/lib/notifications';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card-enhanced';
import { Button } from '@/components/ui/button-enhanced';
import { Search, Filter, SortAsc, Grid3x3, List, Plus, Tags, Building2, Calendar, Users, MoreVertical, Trash2, Edit, Eye, X } from 'lucide-react';
import { formatDate, truncateText, statusColors } from '@/lib/utils';

export default function RubricsPageEnhanced() {
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [sortBy, setSortBy] = useState<'name' | 'created' | 'organization'>('created');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>([]);

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
        await apiService.deleteRubric(id);
        loadRubrics();
      } catch (err) {
        notify.error('Failed to delete rubric');
        console.error(err);
      }
    }
  };

  // Extract unique tags and organizations
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    rubrics.forEach(rubric => {
      rubric.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [rubrics]);

  const allOrganizations = useMemo(() => {
    const orgs = new Set<string>();
    rubrics.forEach(rubric => {
      if (rubric.organization) orgs.add(rubric.organization);
    });
    return Array.from(orgs).sort();
  }, [rubrics]);

  // Filter and sort rubrics
  const filteredAndSortedRubrics = useMemo(() => {
    const filtered = rubrics.filter(rubric => {
      const matchesSearch = rubric.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           rubric.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesTags = selectedTags.length === 0 || 
                         selectedTags.some(tag => rubric.tags?.includes(tag));
      
      const matchesOrganization = selectedOrganizations.length === 0 || 
                                 selectedOrganizations.includes(rubric.organization || '');
      
      return matchesSearch && matchesTags && matchesOrganization;
    });

    // Sort rubrics
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'created':
          comparison = new Date(a.created_date).getTime() - new Date(b.created_date).getTime();
          break;
        case 'organization':
          comparison = (a.organization || '').localeCompare(b.organization || '');
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [rubrics, searchTerm, selectedTags, selectedOrganizations, sortBy, sortDirection]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const toggleOrganization = (org: string) => {
    setSelectedOrganizations(prev => 
      prev.includes(org) ? prev.filter(o => o !== org) : [...prev, org]
    );
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedTags([]);
    setSelectedOrganizations([]);
  };

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
          <Button variant="outline" size="sm" onClick={loadRubrics} className="mt-4">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Rubrics
              </h1>
              <p className="text-gray-600 mt-2">Manage and organize your genomic analysis rubrics</p>
            </div>
            <Link href="/rubrics/create">
              <Button variant="premium" size="lg">
                <Plus className="mr-2 h-4 w-4" />
                Create Rubric
              </Button>
            </Link>
          </div>

          {/* Search and Filters */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row gap-4 mb-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search rubrics by name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center space-x-2">
                <Button
                  variant={viewMode === 'cards' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('cards')}
                >
                  <Grid3x3 className="h-4 w-4 mr-1" />
                  Cards
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4 mr-1" />
                  List
                </Button>
              </div>

              {/* Sort Controls */}
              <div className="flex items-center space-x-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'name' | 'created' | 'organization')}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="created">Created Date</option>
                  <option value="name">Name</option>
                  <option value="organization">Organization</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                >
                  <SortAsc className={`h-4 w-4 transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                </Button>
              </div>
            </div>

            {/* Filter Tags */}
            {(selectedTags.length > 0 || selectedOrganizations.length > 0) && (
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedTags.map(tag => (
                  <span key={tag} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                    {tag}
                    <button onClick={() => toggleTag(tag)} className="ml-2 text-blue-600 hover:text-blue-800">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {selectedOrganizations.map(org => (
                  <span key={org} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                    {org}
                    <button onClick={() => toggleOrganization(org)} className="ml-2 text-green-600 hover:text-green-800">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear all
                </Button>
              </div>
            )}

            {/* Filter Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tags Filter */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <Tags className="h-4 w-4 mr-1" />
                  Filter by Tags
                </h4>
                <div className="flex flex-wrap gap-2">
                  {allTags.slice(0, 8).map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1 rounded-full text-sm transition-all ${
                        selectedTags.includes(tag)
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                  {allTags.length > 8 && (
                    <span className="text-sm text-gray-500 px-2 py-1">
                      +{allTags.length - 8} more
                    </span>
                  )}
                </div>
              </div>

              {/* Organization Filter */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <Building2 className="h-4 w-4 mr-1" />
                  Filter by Organization
                </h4>
                <div className="flex flex-wrap gap-2">
                  {allOrganizations.map(org => (
                    <button
                      key={org}
                      onClick={() => toggleOrganization(org)}
                      className={`px-3 py-1 rounded-full text-sm transition-all ${
                        selectedOrganizations.includes(org)
                          ? 'bg-green-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {org}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mb-6">
          <p className="text-gray-600">
            Showing {filteredAndSortedRubrics.length} of {rubrics.length} rubrics
          </p>
        </div>

        {/* Rubrics Display */}
        {viewMode === 'cards' ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredAndSortedRubrics.map((rubric) => (
              <Card key={rubric.id} variant="elevated" interactive className="h-full flex flex-col">
                <CardHeader className="flex-1">
                  <div className="flex justify-between items-start mb-3">
                    <CardTitle className="text-lg leading-tight">
                      {truncateText(rubric.name, 50)}
                    </CardTitle>
                    <div className="relative group">
                      <button className="p-1 rounded-full hover:bg-gray-100">
                        <MoreVertical className="h-4 w-4 text-gray-400" />
                      </button>
                      <div className="absolute right-0 top-8 w-48 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                        <Link href={`/rubrics/${rubric.id}`} className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Link>
                        <Link href={`/rubrics/${rubric.id}/edit`} className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDeleteRubric(rubric.id)}
                          className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {rubric.description && (
                    <CardDescription className="mb-3">
                      {truncateText(rubric.description, 120)}
                    </CardDescription>
                  )}

                  <div className="flex flex-wrap gap-1 mb-3">
                    {rubric.tags?.slice(0, 3).map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                      >
                        {tag}
                      </span>
                    ))}
                    {rubric.tags && rubric.tags.length > 3 && (
                      <span className="text-xs text-gray-500">+{rubric.tags.length - 3}</span>
                    )}
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-gray-600">
                      <Building2 className="h-4 w-4 mr-2" />
                      <span>{rubric.organization || 'No organization'}</span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <Users className="h-4 w-4 mr-2" />
                      <span>{rubric.owner_name || 'Unknown owner'}</span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <Calendar className="h-4 w-4 mr-2" />
                      <span>{formatDate(rubric.created_date)}</span>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="pt-0">
                  <div className="flex gap-2 w-full">
                    <Link href={`/rubrics/${rubric.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </Link>
                    <Link href={`/rubrics/${rubric.id}/edit`} className="flex-1">
                      <Button variant="secondary" size="sm" className="w-full">
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </Link>
                  </div>
                </CardFooter>
              </Card>
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
                  {filteredAndSortedRubrics.map((rubric) => (
                    <tr key={rubric.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{rubric.name}</div>
                          {rubric.description && (
                            <div className="text-sm text-gray-500">{truncateText(rubric.description, 60)}</div>
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
                        {formatDate(rubric.created_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <Link href={`/rubrics/${rubric.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Link href={`/rubrics/${rubric.id}/edit`}>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDeleteRubric(rubric.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
        {filteredAndSortedRubrics.length === 0 && (
          <div className="text-center py-12">
            <div className="bg-white/50 backdrop-blur-sm rounded-xl border border-gray-200 p-8 max-w-md mx-auto">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No rubrics found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || selectedTags.length > 0 || selectedOrganizations.length > 0
                  ? "Try adjusting your search or filter criteria"
                  : "Get started by creating your first rubric"}
              </p>
              <Link href="/rubrics/create">
                <Button variant="premium">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Rubric
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}