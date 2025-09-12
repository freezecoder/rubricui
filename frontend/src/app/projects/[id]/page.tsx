'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiService } from '@/services/api';
import { Project, Rubric, Rule, AnalysisResult } from '@/types';
import { notify } from '@/lib/notifications';
import Link from 'next/link';
import { EditModal } from '@/components/ui/edit-modal';
import { DatasetUploadModal } from '@/components/ui/dataset-upload-modal';
import { Edit, ExternalLink, Calendar, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface Dataset {
  id: string;
  name: string;
  filename: string;
  uploadDate: string;
  size: string;
  status: 'uploaded' | 'processing' | 'ready' | 'error';
}

// Using AnalysisResult from types instead of local interface

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDatasetUploadModal, setShowDatasetUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);

  const loadProjectData = useCallback(async () => {
    try {
      setLoading(true);
      const [projectData, rubricsData, rulesData, datasetsData, historyData] = await Promise.all([
        apiService.getProject(projectId),
        apiService.getRubrics(),
        apiService.getRules(),
        apiService.getProjectDatasets(projectId),
        apiService.getAnalysisHistory(projectId)
      ]);
      
      setProject(projectData);
      setRubrics(rubricsData);
      setRules(rulesData);
      setAnalysisHistory(historyData.execution_history || []);
      
      // Convert datasets data
      const convertedDatasets: Dataset[] = datasetsData.map(dataset => ({
        id: dataset.id,
        name: dataset.name,
        filename: dataset.filename,
        uploadDate: dataset.upload_date,
        size: dataset.size,
        status: dataset.status as Dataset['status']
      }));
      setDatasets(convertedDatasets);
    } catch (err) {
      setError('Failed to load project data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProjectData();
  }, [loadProjectData]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('Please upload an Excel file (.xlsx or .xls)');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      await apiService.uploadProjectDataWithNotification(projectId, file);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      // Add new dataset to the list
      const newDataset: Dataset = {
        id: Date.now().toString(),
        name: file.name.replace(/\.(xlsx|xls)$/i, ''),
        filename: file.name,
        uploadDate: new Date().toISOString(),
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        status: 'ready'
      };
      
      setDatasets(prev => [newDataset, ...prev]);
      setShowUploadModal(false);
      
      // Reload project data to get updated file path
      await loadProjectData();
    } catch (err) {
      setError('Failed to upload file');
      console.error(err);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteDataset = async (datasetId: string, datasetName?: string) => {
    const confirmed = await notify.confirmDelete('dataset', datasetName);
    if (!confirmed) return;
    
    try {
      await apiService.deleteProjectDatasetWithNotification(projectId, datasetId, datasetName);
      setDatasets(prev => prev.filter(d => d.id !== datasetId));
    } catch (err) {
      console.error(err);
      // Error notification is handled by the API service
    }
  };

  const handleSaveProject = async (updatedData: any) => {
    if (!project) return;
    
    try {
      await apiService.updateProjectWithNotification(project.id, updatedData);
      await loadProjectData(); // Reload the project data
      setShowEditModal(false);
    } catch (err) {
      console.error(err);
      // Error notification is handled by the API service
    }
  };

  const getStatusColor = (status: Dataset['status']) => {
    switch (status) {
      case 'ready': return 'text-green-600 bg-green-100';
      case 'processing': return 'text-yellow-600 bg-yellow-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: Dataset['status']) => {
    switch (status) {
      case 'ready': return '✓';
      case 'processing': return '⏳';
      case 'error': return '✗';
      default: return '📁';
    }
  };

  const getAnalysisStatusColor = (status: AnalysisResult['status']) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'running': return 'text-blue-600 bg-blue-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getAnalysisStatusIcon = (status: AnalysisResult['status']) => {
    switch (status) {
      case 'completed': return '✓';
      case 'running': return '⏳';
      case 'failed': return '✗';
      default: return '⏸';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Loading project details...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="text-red-600 text-lg mb-4">{error}</div>
          <button
            onClick={() => router.push('/projects')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="text-gray-600 text-lg mb-4">Project not found</div>
          <button
            onClick={() => router.push('/projects')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-auto" style={{ width: '600%', minWidth: '600%' }}>
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="w-full px-4 sm:px-6 lg:px-8" style={{ width: '600%', minWidth: '600%' }}>
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/projects')}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
                <p className="text-gray-600 mt-1">{project.description || 'No description provided'}</p>
                <p className="text-xs text-blue-600 mt-1">📏 Page width: 600% of screen width</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-500">
                Created {new Date(project.created_date).toLocaleDateString()}
              </span>
              <div className="h-8 w-px bg-gray-300"></div>
              <span className="text-sm text-gray-500">
                {project.owner_name || 'Unknown Owner'}
              </span>
              <div className="h-8 w-px bg-gray-300"></div>
              <button
                onClick={() => setShowEditModal(true)}
                className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                <Edit className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-8" style={{ width: '600%', minWidth: '600%' }}>
        {/* Project Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Datasets</p>
                <p className="text-2xl font-bold text-gray-900">{datasets.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Rubrics</p>
                <p className="text-2xl font-bold text-gray-900">{rubrics.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Rules</p>
                <p className="text-2xl font-bold text-gray-900">{rules.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 rounded-lg">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Analyses</p>
                <p className="text-2xl font-bold text-gray-900">{analysisHistory.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => setShowDatasetUploadModal(true)}
              className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload Dataset
            </button>
            
            <Link
              href={`/projects/${projectId}/analysis`}
              className="flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Start Analysis
            </Link>
            
            <Link
              href="/rubrics"
              className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create Rubric
            </Link>
            
            {project.results && (
              <Link
                href={`/projects/${projectId}/results`}
                className="flex items-center px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                View Results
              </Link>
            )}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Datasets Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Datasets</h2>
                <button
                  onClick={() => setShowDatasetUploadModal(true)}
                  className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg transition-colors"
                >
                  Add Dataset
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {datasets.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No datasets uploaded</h3>
                  <p className="text-gray-600 mb-4">Upload your first dataset to get started with analysis.</p>
                  <button
                    onClick={() => setShowDatasetUploadModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Upload Dataset
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {datasets.map((dataset) => (
                    <div key={dataset.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">{dataset.name}</h3>
                            <p className="text-sm text-gray-600">{dataset.filename}</p>
                            <div className="flex items-center space-x-4 mt-1">
                              <span className="text-xs text-gray-500">{dataset.size}</span>
                              <span className="text-xs text-gray-500">
                                {new Date(dataset.uploadDate).toLocaleDateString()}
                              </span>
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(dataset.status)}`}>
                                <span className="mr-1">{getStatusIcon(dataset.status)}</span>
                                {dataset.status}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteDataset(dataset.id, dataset.name)}
                          className="text-red-600 hover:text-red-800 p-1"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Rubrics Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Available Rubrics</h2>
                <Link
                  href="/rubrics"
                  className="text-sm bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg transition-colors"
                >
                  View All
                </Link>
              </div>
            </div>
            
            <div className="p-6">
              {rubrics.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No rubrics available</h3>
                  <p className="text-gray-600 mb-4">Create your first rubric to start analyzing data.</p>
                  <Link
                    href="/rubrics"
                    className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Create Rubric
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {rubrics.slice(0, 3).map((rubric) => (
                    <div key={rubric.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">{rubric.name}</h3>
                            <p className="text-sm text-gray-600">{rubric.description || 'No description'}</p>
                            <div className="flex items-center space-x-4 mt-1">
                              <span className="text-xs text-gray-500">Rubric</span>
                              <span className="text-xs text-gray-500">
                                {new Date(rubric.created_date).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Link
                          href={`/rubrics/${rubric.id}`}
                          className="text-purple-600 hover:text-purple-800 p-1"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </div>
                    </div>
                  ))}
                  {rubrics.length > 3 && (
                    <div className="text-center pt-4">
                      <Link
                        href="/rubrics"
                        className="text-purple-600 hover:text-purple-800 font-medium"
                      >
                        View {rubrics.length - 3} more rubrics →
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Analysis History */}
        {analysisHistory.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 mt-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Analysis History</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {analysisHistory.slice(0, 5).map((analysis, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className={`p-2 rounded-lg ${
                        analysis.status === 'completed' ? 'bg-green-100' :
                        analysis.status === 'running' ? 'bg-blue-100' :
                        analysis.status === 'failed' ? 'bg-red-100' :
                        'bg-gray-100'
                      }`}>
                        <svg className={`w-5 h-5 ${
                          analysis.status === 'completed' ? 'text-green-600' :
                          analysis.status === 'running' ? 'text-blue-600' :
                          analysis.status === 'failed' ? 'text-red-600' :
                          'text-gray-600'
                        }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Analysis #{index + 1}</p>
                        <p className="text-sm text-gray-600">{analysis.message}</p>
                        <p className="text-xs text-gray-500">
                          Job ID: {analysis.job_id}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getAnalysisStatusColor(analysis.status)}`}>
                        <span className="mr-1">{getAnalysisStatusIcon(analysis.status)}</span>
                        {analysis.status}
                      </span>
                      {analysis.status === 'running' && analysis.progress && (
                        <div className="mt-2 w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${analysis.progress}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Project Analyses */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mt-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Project Analyses</h2>
              <Link
                href={`/projects/${projectId}/analysis`}
                className="text-sm bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg transition-colors"
              >
                Start New Analysis
              </Link>
            </div>
          </div>
          <div className="p-6">
            {analysisHistory.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No analyses yet</h3>
                <p className="text-gray-600 mb-4">Start your first analysis to see results here.</p>
                <Link
                  href={`/projects/${projectId}/analysis`}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Start Analysis
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Analysis
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Progress
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Started
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Genes
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {analysisHistory.map((analysis, index) => (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className={`p-2 rounded-lg mr-3 ${
                              analysis.status === 'completed' ? 'bg-green-100' :
                              analysis.status === 'running' ? 'bg-blue-100' :
                              analysis.status === 'failed' ? 'bg-red-100' :
                              'bg-gray-100'
                            }`}>
                              {analysis.status === 'completed' ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : analysis.status === 'running' ? (
                                <Clock className="h-4 w-4 text-blue-600" />
                              ) : analysis.status === 'failed' ? (
                                <XCircle className="h-4 w-4 text-red-600" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-gray-600" />
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                Analysis #{index + 1}
                              </div>
                              <div className="text-sm text-gray-500">
                                {analysis.message}
                              </div>
                              <div className="text-xs text-gray-400">
                                ID: {analysis.job_id}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getAnalysisStatusColor(analysis.status)}`}>
                            <span className="mr-1">{getAnalysisStatusIcon(analysis.status)}</span>
                            {analysis.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {analysis.status === 'running' ? (
                            <div className="flex items-center">
                              <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${analysis.progress}%` }}
                                ></div>
                              </div>
                              <span className="text-sm text-gray-600">{analysis.progress}%</span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                            {new Date().toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {analysis.total_genes ? `${analysis.total_genes.toLocaleString()} genes` : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            {analysis.status === 'completed' && (
                              <Link href={`/analysis/${analysis.job_id}/details`}>
                                <button className="text-blue-600 hover:text-blue-900 p-1 rounded">
                                  <ExternalLink className="h-4 w-4" />
                                </button>
                              </Link>
                            )}
                            {analysis.status === 'running' && (
                              <button 
                                onClick={() => window.location.reload()}
                                className="text-gray-600 hover:text-gray-900 p-1 rounded"
                                title="Refresh to check status"
                              >
                                <Clock className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Upload Dataset</h3>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Excel file (.xlsx or .xls)
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              
              {uploading && (
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
              
              <div className="text-sm text-gray-600 mb-4">
                <p>Supported formats: Excel (.xlsx, .xls)</p>
                <p>Maximum file size: 50MB</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowUploadModal(false)}
                disabled={uploading}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dataset Upload Modal */}
      <DatasetUploadModal
        isOpen={showDatasetUploadModal}
        onClose={() => setShowDatasetUploadModal(false)}
        onSuccess={loadProjectData}
      />

      {/* Edit Modal */}
      {project && (
        <EditModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSave={handleSaveProject}
          title={`Edit Project: ${project.name}`}
          entityType="project"
          initialData={{
            name: project.name,
            description: project.description || '',
            owner_name: project.owner_name || '',
            organization: project.organization || ''
          }}
        />
      )}
    </div>
  );
}