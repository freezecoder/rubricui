'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiService } from '@/services/api';
import { AnalysisResult, Project, Rubric, Dataset } from '@/types';
import { notify } from '@/lib/notifications';
import { Eye, Trash2, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function AnalysisPage() {
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [sortBy, setSortBy] = useState<'created' | 'status' | 'project' | 'execution_time'>('created');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'running' | 'failed'>('all');
  const [filterProject, setFilterProject] = useState<string>('all');
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [analysesData, projectsData, rubricsData, datasetsData] = await Promise.all([
        apiService.getAnalysisResults(),
        apiService.getProjects(),
        apiService.getRubrics(),
        apiService.getDatasets()
      ]);
      
      setAnalyses(analysesData);
      setProjects(projectsData);
      setRubrics(rubricsData);
      setDatasets(datasetsData);
    } catch (err) {
      setError('Failed to load analysis data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAnalysis = async (id: string, analysisName?: string) => {
    const confirmed = await notify.confirmDelete('analysis', analysisName);
    if (confirmed) {
      try {
        await apiService.deleteAnalysisResultWithNotification(id, analysisName);
        loadData();
      } catch (err) {
        console.error(err);
        // Error notification is handled by the API service
      }
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'running':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'running': return 'Running';
      case 'failed': return 'Failed';
      case 'pending': return 'Pending';
      default: return status;
    }
  };

  const getProjectName = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    return project?.name || 'Unknown Project';
  };

  const getProjectOwner = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    return project?.owner_name || 'Unknown';
  };

  const getRubricName = (rubricId: string) => {
    const rubric = rubrics.find(r => r.id === rubricId);
    return rubric?.name || 'Unknown Rubric';
  };

  const getDatasetName = (datasetId: string) => {
    const dataset = datasets.find(d => d.id === datasetId);
    return dataset?.name || 'Unknown Dataset';
  };

  const formatExecutionTime = (seconds?: number) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
  };

  const filteredAndSortedAnalyses = analyses
    .filter(analysis => {
      if (filterStatus !== 'all' && analysis.status !== filterStatus) return false;
      if (filterProject !== 'all' && analysis.project_id !== filterProject) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'created':
          return new Date(b.created_date).getTime() - new Date(a.created_date).getTime();
        case 'status':
          return a.status.localeCompare(b.status);
        case 'project':
          return getProjectName(a.project_id).localeCompare(getProjectName(b.project_id));
        case 'execution_time':
          return (b.execution_time_seconds || 0) - (a.execution_time_seconds || 0);
        default:
          return 0;
      }
    });

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">Loading analyses...</div>
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
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-red-600 bg-clip-text text-transparent">Analysis Results</h1>
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
        </div>
      </div>

      {/* Filters and Sorting */}
      <div className="flex gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'completed' | 'running' | 'failed')}
            className="border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="running">Running</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Project</label>
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="all">All Projects</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sort by</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'created' | 'status' | 'project' | 'execution_time')}
            className="border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="created">Created Date</option>
            <option value="status">Status</option>
            <option value="project">Project</option>
            <option value="execution_time">Execution Time</option>
          </select>
        </div>
      </div>

      {filteredAndSortedAnalyses.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">No analysis results found.</p>
          <Link
            href="/projects"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg"
          >
            Go to Projects
          </Link>
        </div>
      ) : (
        <div>
          {viewMode === 'cards' ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredAndSortedAnalyses.map((analysis) => (
                <div key={analysis.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {getProjectName(analysis.project_id)}
                        </h3>
                        <p className="text-sm text-gray-600 mb-1">
                          Rubric: {getRubricName(analysis.rubric_id)}
                        </p>
                        <p className="text-sm text-gray-600">
                          Dataset: {getDatasetName(analysis.dataset_id)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(analysis.status)}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(analysis.status)}`}>
                          {getStatusText(analysis.status)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Project Owner:</span>
                        <span className="text-gray-900">{getProjectOwner(analysis.project_id)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Genes Processed:</span>
                        <span className="text-gray-900">{analysis.total_genes_processed.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Rules Executed:</span>
                        <span className="text-gray-900">{analysis.total_rules_executed}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Execution Time:</span>
                        <span className="text-gray-900">{formatExecutionTime(analysis.execution_time_seconds)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Created:</span>
                        <span className="text-gray-900">{new Date(analysis.created_date).toLocaleString('en-US', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: false
                        })}</span>
                      </div>
                    </div>

                    {analysis.error_message && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-800">
                          <strong>Error:</strong> {analysis.error_message}
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Link
                        href={`/analysis/${analysis.id}/details`}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-3 rounded-lg text-sm transition-colors text-center flex items-center justify-center gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        View Details
                      </Link>
                      <button
                        onClick={() => handleDeleteAnalysis(analysis.id, `${getProjectName(analysis.project_id)} Analysis`)}
                        className="px-3 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                        title="Delete Analysis"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rubric</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dataset</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Genes</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rules</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAndSortedAnalyses.map((analysis) => (
                    <tr key={analysis.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {getProjectName(analysis.project_id)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getProjectOwner(analysis.project_id)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getRubricName(analysis.rubric_id)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getDatasetName(analysis.dataset_id)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(analysis.status)}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(analysis.status)}`}>
                            {getStatusText(analysis.status)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {analysis.total_genes_processed.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {analysis.total_rules_executed}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatExecutionTime(analysis.execution_time_seconds)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(analysis.created_date).toLocaleString('en-US', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: false
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <Link
                            href={`/analysis/${analysis.id}/details`}
                            className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Link>
                          <button
                            onClick={() => handleDeleteAnalysis(analysis.id, `${getProjectName(analysis.project_id)} Analysis`)}
                            className="text-red-600 hover:text-red-900 flex items-center gap-1"
                            title="Delete Analysis"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
