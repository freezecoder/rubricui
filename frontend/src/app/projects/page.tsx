'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiService } from '@/services/api';
import { Project } from '@/types';
import { EditModal } from '@/components/ui/edit-modal';
import { notify } from '@/lib/notifications';
import { Edit, Trash2, Check, X } from 'lucide-react';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [sortBy, setSortBy] = useState<'name' | 'created' | 'status'>('created');
  const [filterStatus, setFilterStatus] = useState<'all' | 'ready' | 'analyzed'>('all');
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    setShowBulkActions(selectedProjects.size > 0);
  }, [selectedProjects]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await apiService.getProjects();
      setProjects(data);
    } catch (err) {
      setError('Failed to load projects');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (id: string, projectName?: string) => {
    const confirmed = await notify.confirmDelete('project', projectName);
    if (confirmed) {
      try {
        await apiService.deleteProject(id);
        notify.deleted('Project', projectName);
        loadProjects();
        // Remove from selected projects if it was selected
        setSelectedProjects(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      } catch (err) {
        notify.operationFailed('Project deletion', err instanceof Error ? err.message : 'Unknown error');
        console.error(err);
      }
    }
  };

  const handleRunAnalysis = (projectId: string) => {
    router.push(`/projects/${projectId}/analysis`);
  };

  const handleViewResults = (projectId: string) => {
    router.push(`/projects/${projectId}/results`);
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setShowEditModal(true);
  };

  const handleSaveProject = async (updatedData: any) => {
    if (!editingProject) return;
    
    try {
      await apiService.updateProjectWithNotification(editingProject.id, updatedData);
      loadProjects();
      setShowEditModal(false);
      setEditingProject(null);
    } catch (err) {
      console.error(err);
      // Error notification is handled by the API service
    }
  };

  // Multi-select functionality
  const handleSelectProject = (projectId: string) => {
    setSelectedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedProjects.size === filteredAndSortedProjects.length) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(filteredAndSortedProjects.map(p => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProjects.size === 0) return;
    
    const projectNames = filteredAndSortedProjects
      .filter(p => selectedProjects.has(p.id))
      .map(p => p.name);
    
    const confirmed = await notify.confirmDestructiveAction(
      'delete',
      `${selectedProjects.size} project${selectedProjects.size > 1 ? 's' : ''}`,
      `This will permanently delete: ${projectNames.join(', ')}`
    );
    
    if (confirmed) {
      try {
        const deletePromises = Array.from(selectedProjects).map(id => 
          apiService.deleteProject(id)
        );
        await Promise.all(deletePromises);
        notify.deleted('Projects', `${selectedProjects.size} project${selectedProjects.size > 1 ? 's' : ''}`);
        loadProjects();
        setSelectedProjects(new Set());
        setShowBulkActions(false);
      } catch (err) {
        notify.operationFailed('Bulk project deletion', err instanceof Error ? err.message : 'Unknown error');
        console.error(err);
      }
    }
  };

  const clearSelection = () => {
    setSelectedProjects(new Set());
    setShowBulkActions(false);
  };


  const getProjectStatus = (project: Project) => {
    if (!project.input_data_file) return 'no-data';
    if (project.results) return 'completed';
    if (project.applied_rules.length > 0 || project.applied_rubrics.length > 0) return 'ready';
    return 'data-uploaded';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'ready': return 'bg-blue-100 text-blue-800';
      case 'data-uploaded': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Analysis Complete';
      case 'ready': return 'Ready for Analysis';
      case 'data-uploaded': return 'Data Uploaded';
      default: return 'No Data';
    }
  };

  const filteredAndSortedProjects = projects
    .filter(project => {
      if (filterStatus === 'all') return true;
      const status = getProjectStatus(project);
      if (filterStatus === 'ready') return status === 'ready' || status === 'data-uploaded';
      if (filterStatus === 'analyzed') return status === 'completed';
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'created':
          return new Date(b.created_date).getTime() - new Date(a.created_date).getTime();
        case 'status':
          return getProjectStatus(a).localeCompare(getProjectStatus(b));
        default:
          return 0;
      }
    });

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">Loading projects...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-red-600 bg-clip-text text-transparent">Projects</h1>
        <div className="flex gap-4 items-center">
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-2 rounded-lg ${viewMode === 'cards' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-2 rounded-lg ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              Table
            </button>
          </div>
          <Link
            href="/projects/create"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg"
          >
            Create New Project
          </Link>
        </div>
      </div>

      {/* Filters and Sorting */}
      <div className="flex gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'ready' | 'analyzed')}
            className="border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="all">All Projects</option>
            <option value="ready">Ready for Analysis</option>
            <option value="analyzed">Analysis Complete</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sort by</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'created' | 'status')}
            className="border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="created">Created Date</option>
            <option value="name">Name</option>
            <option value="status">Status</option>
          </select>
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {showBulkActions && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-blue-900">
                {selectedProjects.size} project{selectedProjects.size > 1 ? 's' : ''} selected
              </span>
              <button
                onClick={clearSelection}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Clear selection
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Delete Selected
              </button>
            </div>
          </div>
        </div>
      )}

      {filteredAndSortedProjects.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">No projects found.</p>
          <Link
            href="/projects/create"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg"
          >
            Create Your First Project
          </Link>
        </div>
      ) : (
        <div>
          {viewMode === 'cards' ? (
            <div>
              {filteredAndSortedProjects.length > 0 && (
                <div className="mb-4 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedProjects.size === filteredAndSortedProjects.length && filteredAndSortedProjects.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label className="text-sm font-medium text-gray-700">
                    Select all projects
                  </label>
                </div>
              )}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredAndSortedProjects.map((project) => {
                const status = getProjectStatus(project);
                return (
                  <div key={project.id} className={`bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow ${selectedProjects.has(project.id) ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}>
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="checkbox"
                              checked={selectedProjects.has(project.id)}
                              onChange={() => handleSelectProject(project.id)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <h3 className="text-xl font-semibold text-gray-900">{project.name}</h3>
                          </div>
                          {project.description && (
                            <p className="text-gray-600 text-sm line-clamp-2">{project.description}</p>
                          )}
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                          {getStatusText(status)}
                        </span>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Owner:</span>
                          <span className="text-gray-900">{project.owner_name || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Created:</span>
                          <span className="text-gray-900">{new Date(project.created_date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Data:</span>
                          <span className="text-gray-900">{project.input_data_file ? 'Uploaded' : 'None'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Rules/Rubrics:</span>
                          <span className="text-gray-900">{project.applied_rules.length + project.applied_rubrics.length}</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Link
                          href={`/projects/${project.id}`}
                          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-3 rounded-lg text-sm transition-colors text-center"
                        >
                          View Details
                        </Link>
                        <button
                          onClick={() => handleEditProject(project)}
                          className="px-3 py-2 text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProject(project.id, project.name)}
                          className="px-3 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        {status === 'ready' && (
                          <button
                            onClick={() => handleRunAnalysis(project.id)}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-3 rounded-lg text-sm transition-colors"
                          >
                            Run Analysis
                          </button>
                        )}
                        {status === 'completed' && (
                          <button
                            onClick={() => handleViewResults(project.id)}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-3 rounded-lg text-sm transition-colors"
                          >
                            View Results
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={selectedProjects.size === filteredAndSortedProjects.length && filteredAndSortedProjects.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rules/Rubrics</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAndSortedProjects.map((project) => {
                    const status = getProjectStatus(project);
                    return (
                      <tr key={project.id} className={`hover:bg-gray-50 ${selectedProjects.has(project.id) ? 'bg-blue-50' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedProjects.has(project.id)}
                            onChange={() => handleSelectProject(project.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{project.name}</div>
                            {project.description && (
                              <div className="text-sm text-gray-500">{project.description}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                            {getStatusText(status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {project.input_data_file ? 'Uploaded' : 'None'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {project.applied_rules.length + project.applied_rubrics.length}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(project.created_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            <Link
                              href={`/projects/${project.id}`}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              View
                            </Link>
                            <button
                              onClick={() => handleEditProject(project)}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProject(project.id, project.name)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                            {status === 'ready' && (
                              <button
                                onClick={() => handleRunAnalysis(project.id)}
                                className="text-green-600 hover:text-green-900"
                              >
                                Run
                              </button>
                            )}
                            {status === 'completed' && (
                              <button
                                onClick={() => handleViewResults(project.id)}
                                className="text-green-600 hover:text-green-900"
                              >
                                Results
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editingProject && (
        <EditModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingProject(null);
          }}
          onSave={handleSaveProject}
          title={`Edit Project: ${editingProject.name}`}
          entityType="project"
          initialData={{
            name: editingProject.name,
            description: editingProject.description || '',
            owner_name: editingProject.owner_name || '',
            organization: editingProject.organization || ''
          }}
        />
      )}
    </div>
  );
}