'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiService } from '@/services/api';
import { AnalysisResultWithDetails, AnalysisResultsResponse, AnalysisSummaryResponse, Project, Rubric, Dataset } from '@/types';
import { notify } from '@/lib/notifications';
import { ArrowLeft, Download, BarChart3, TrendingUp, Clock, CheckCircle, XCircle, AlertCircle, Users, Database, FileText, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { ScoreHistogramGrid } from '@/components/analysis';

export default function AnalysisDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const analysisId = params.id as string;

  const [analysis, setAnalysis] = useState<AnalysisResultWithDetails | null>(null);
  const [summary, setSummary] = useState<AnalysisSummaryResponse | null>(null);
  const [results, setResults] = useState<AnalysisResultsResponse | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [rubric, setRubric] = useState<Rubric | null>(null);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Loading analysis data...');
  const [error, setError] = useState('');
  const [usingCache, setUsingCache] = useState<boolean | null>(null);
  const [cacheStatus, setCacheStatus] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'results' | 'summary' | 'histograms'>('overview');
  const [resultsPage, setResultsPage] = useState(0);
  const [resultsLimit] = useState(50);
  const [sortBy, setSortBy] = useState<'total_score' | 'gene_symbol'>('total_score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [geneSearch, setGeneSearch] = useState('');
  const [showOnlyPositive, setShowOnlyPositive] = useState(true);
  const [isHistogramsExpanded, setIsHistogramsExpanded] = useState(true);
  const [isScoreDistributionExpanded, setIsScoreDistributionExpanded] = useState(true);

  useEffect(() => {
    if (analysisId) {
      loadAnalysisData();
    }
  }, [analysisId]);

  const loadAnalysisData = async () => {
    try {
      setLoading(true);
      setLoadingProgress(0);
      setLoadingMessage('Loading analysis data...');
      
      // Step 1: Load basic analysis data
      setLoadingProgress(20);
      setLoadingMessage('Loading analysis metadata...');
      const analysisData = await apiService.getAnalysisResult(analysisId);
      setAnalysis(analysisData);
      
      // Step 2: Try to load cached summary first, fallback to regular summary
      setLoadingProgress(40);
      setLoadingMessage('Loading score statistics...');
      try {
        const cachedSummary = await fetch(`/api/result-cache/${analysisId}/summary`).then(r => r.json());
        if (cachedSummary && !cachedSummary.error) {
          console.log('Using cached summary data');
          setSummary(cachedSummary);
          setUsingCache(true);
        } else {
          throw new Error('No cached summary available');
        }
      } catch (cacheError) {
        console.log('Cache not found, falling back to Excel file processing');
        setLoadingMessage('Processing Excel file (this may take a moment)...');
        const summaryData = await apiService.getAnalysisResultSummary(analysisId);
        setSummary(summaryData);
        setUsingCache(false);
      }
      
      // Step 3: Load results data (try cache first, fallback to Excel)
      setLoadingProgress(60);
      setLoadingMessage('Loading analysis results...');
      
      // First check if cache exists
      try {
        const cacheExists = await fetch(`/api/result-cache/${analysisId}/exists`).then(r => r.json());
        console.log('Cache exists check:', cacheExists);
        
        if (cacheExists.cache_exists && cacheExists.pickle_exists) {
          // Try to load cached results
          const cachedResults = await fetch(`/api/result-cache/${analysisId}/cached-results?limit=${resultsLimit}&offset=0`).then(r => r.json());
          console.log('Cached results response:', cachedResults);
          
          if (cachedResults && !cachedResults.error && cachedResults.results && cachedResults.results.length > 0) {
            console.log('Using cached results data:', cachedResults);
            setResults(cachedResults);
            setCacheStatus('Cache loaded successfully');
          } else {
            throw new Error('Cached results are empty or invalid');
          }
        } else {
          setCacheStatus('Cache not found - using Excel fallback');
          throw new Error('Cache does not exist');
        }
      } catch (cacheError) {
        console.log('Cache not available, falling back to Excel file processing for results:', cacheError);
        setLoadingMessage('Processing Excel file for results (this may take a moment)...');
        const resultsData = await apiService.getAnalysisResultResults(analysisId, resultsLimit, 0);
        console.log('Excel fallback results:', resultsData);
        setResults(resultsData);
        setCacheStatus('Using Excel file processing');
      }

      // Step 4: Load related data
      setLoadingProgress(80);
      setLoadingMessage('Loading project details...');
      const [projectData, rubricData, datasetData] = await Promise.all([
        apiService.getProject(analysisData.project_id),
        apiService.getRubric(analysisData.rubric_id),
        apiService.getDataset(analysisData.dataset_id)
      ]);

      setProject(projectData);
      setRubric(rubricData);
      setDataset(datasetData);
      
      setLoadingProgress(100);
      setLoadingMessage('Complete!');
    } catch (err) {
      setError('Failed to load analysis details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreResults = async () => {
    if (!analysis) return;
    
    try {
      const offset = (resultsPage + 1) * resultsLimit;
      
      // Try cached results first, fallback to Excel
      try {
        const cacheExists = await fetch(`/api/result-cache/${analysisId}/exists`).then(r => r.json());
        if (cacheExists.cache_exists && cacheExists.pickle_exists) {
          const cachedResults = await fetch(`/api/result-cache/${analysisId}/cached-results?limit=${resultsLimit}&offset=${offset}`).then(r => r.json());
          if (cachedResults && !cachedResults.error && cachedResults.results && cachedResults.results.length > 0) {
            console.log('Using cached results for pagination');
            setResults(prev => prev ? {
              ...prev,
              results: [...(prev.results || []), ...cachedResults.results],
              pagination: cachedResults.pagination
            } : cachedResults);
            setResultsPage(prev => prev + 1);
            return;
          }
        }
        throw new Error('Cache not available for pagination');
      } catch (cacheError) {
        console.log('Cache not available for pagination, using Excel fallback');
      }
      
      // Fallback to Excel processing
      const moreResults = await apiService.getAnalysisResultResults(analysisId, resultsLimit, offset);
      
      setResults(prev => prev ? {
        ...prev,
        results: [...(prev.results || []), ...moreResults.results],
        pagination: moreResults.pagination
      } : moreResults);
      setResultsPage(prev => prev + 1);
    } catch (err) {
      console.error('Failed to load more results:', err);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'running':
        return <Clock className="h-5 w-5 text-blue-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
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

  const formatExecutionTime = (seconds?: number) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
  };

  const formatScore = (score?: number) => {
    if (score === undefined || score === null) return 'N/A';
    return score.toFixed(3);
  };

  // Filter and sort results
  const getFilteredAndSortedResults = () => {
    // Handle both cached results (direct array) and regular results (results.results array)
    const resultsArray = results?.results || results || [];
    console.log('getFilteredAndSortedResults - results:', results);
    console.log('getFilteredAndSortedResults - resultsArray:', resultsArray);
    if (!resultsArray || !Array.isArray(resultsArray)) return [];
    
    let filtered = [...resultsArray]; // Create a copy to avoid mutating the original
    
    // Filter by positive scores if enabled
    if (showOnlyPositive) {
      filtered = filtered.filter(result => (result.total_score || 0) > 0);
    }
    
    // Filter by gene search
    if (geneSearch.trim()) {
      const searchTerm = geneSearch.toLowerCase().trim();
      filtered = filtered.filter(result => 
        result.gene_symbol.toLowerCase().includes(searchTerm)
      );
    }
    
    // Sort results
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      if (sortBy === 'total_score') {
        aValue = a.total_score || 0;
        bValue = b.total_score || 0;
      } else {
        aValue = a.gene_symbol.toLowerCase();
        bValue = b.gene_symbol.toLowerCase();
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    return filtered;
  };

  const handleSort = (column: 'total_score' | 'gene_symbol') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder(column === 'total_score' ? 'desc' : 'asc');
    }
  };

  const getSortIcon = (column: 'total_score' | 'gene_symbol') => {
    if (sortBy !== column) return <ArrowUpDown className="h-4 w-4" />;
    return sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-6">
              <div className="text-lg font-semibold text-gray-900 mb-2">
                {loadingMessage}
              </div>
              <div className="text-sm text-gray-600">
                {loadingProgress}% complete
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
              <div 
                className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>
            
            {/* Loading Animation */}
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-600">{error || 'Analysis not found'}</div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-red-600 bg-clip-text text-transparent">
            Analysis Details
          </h1>
          <p className="text-gray-600 mt-1">
            {project?.name} - {rubric?.name} - {dataset?.name}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {usingCache !== null && (
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              usingCache 
                ? 'bg-green-100 text-green-800' 
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {usingCache ? '⚡ Cached Data' : '📄 Excel Fallback'}
            </div>
          )}
          {cacheStatus && (
            <div className="text-xs text-gray-500">
              {cacheStatus}
            </div>
          )}
          <div className="flex items-center gap-2">
            {getStatusIcon(analysis.status)}
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(analysis.status)}`}>
              {getStatusText(analysis.status)}
            </span>
          </div>
        </div>
      </div>

      {/* Analysis Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Genes Processed</p>
              <p className="text-2xl font-bold text-gray-900">
                {analysis.total_genes_processed.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <FileText className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Rules Executed</p>
              <p className="text-2xl font-bold text-gray-900">
                {analysis.total_rules_executed}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Clock className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Execution Time</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatExecutionTime(analysis.execution_time_seconds)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Database className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Created</p>
              <p className="text-lg font-bold text-gray-900">
                {new Date(analysis.created_date).toLocaleString('en-US', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false
                })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Score Distribution */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BarChart3 className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Score Distribution</h2>
          </div>
          <button
            onClick={() => setIsScoreDistributionExpanded(!isScoreDistributionExpanded)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <span className="text-sm font-medium">
              {isScoreDistributionExpanded ? 'Collapse' : 'Expand'}
            </span>
            {isScoreDistributionExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
        
        {isScoreDistributionExpanded && (
          <>
            {summary?.score_distribution && Object.keys(summary.score_distribution).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(summary.score_distribution).map(([scoreName, stats]) => {
                  const scoreStats = stats as { min?: number; max?: number; mean?: number; median?: number; std?: number; count?: number; valid_percentage?: number };
                  return (
                  <div key={scoreName} className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 text-sm mb-3 truncate" title={scoreName}>
                      {scoreName}
                    </h3>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Count:</span>
                        <span className="font-medium">{scoreStats.count || summary?.total_genes || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Valid %:</span>
                        <span className="font-medium">
                          {scoreStats.valid_percentage !== undefined && scoreStats.valid_percentage !== null
                            ? scoreStats.valid_percentage.toFixed(1) + '%'
                            : 'N/A'
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Mean:</span>
                        <span className="font-medium">{formatScore(scoreStats.mean)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Range:</span>
                        <span className="font-medium">
                          {formatScore(scoreStats.min)} - {formatScore(scoreStats.max)}
                        </span>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No score distribution data available</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'results', label: 'Results', icon: TrendingUp },
            { id: 'summary', label: 'Summary', icon: FileText },
            { id: 'histograms', label: 'Histograms', icon: BarChart3 }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Project Information */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Project Information</h3>
              {project && (
                <Link 
                  href={`/projects/${project.id}`}
                  className="inline-flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  View Project
                </Link>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Project Name</p>
                <p className="font-medium">{project?.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Project Owner</p>
                <p className="font-medium">{project?.owner_name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Organization</p>
                <p className="font-medium">{project?.organization || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Created</p>
                <p className="font-medium">{project ? new Date(project.created_date).toLocaleDateString() : 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Rubric Information */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Rubric Information</h3>
              {rubric && (
                <Link 
                  href={`/rubrics/${rubric.id}`}
                  className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  View Rubric
                </Link>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Rubric Name</p>
                <p className="font-medium">{rubric?.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Owner</p>
                <p className="font-medium">{rubric?.owner_name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Organization</p>
                <p className="font-medium">{rubric?.organization || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Disease Area</p>
                <p className="font-medium">{rubric?.disease_area_study || 'N/A'}</p>
              </div>
            </div>
            {rubric?.description && (
              <div className="mt-4">
                <p className="text-sm text-gray-600">Description</p>
                <p className="font-medium">{rubric.description}</p>
              </div>
            )}
          </div>

          {/* Dataset Information */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Dataset Information</h3>
              {dataset && (
                <Link 
                  href={`/datasets/${dataset.id}`}
                  className="inline-flex items-center px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  View Dataset
                </Link>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Dataset Name</p>
                <p className="font-medium">{dataset?.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Original Filename</p>
                <p className="font-medium">{dataset?.original_filename || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Rows</p>
                <p className="font-medium">{dataset?.num_rows.toLocaleString() || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Columns</p>
                <p className="font-medium">{dataset?.num_columns || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Error Information */}
          {analysis.error_message && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-red-900 mb-2">Error Details</h3>
              <p className="text-red-800">{analysis.error_message}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'results' && results && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Analysis Results</h3>
              <div className="flex items-center gap-3">
                <Link
                  href={`/omicsview/${analysisId}`}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Omics View
                </Link>
                {analysis?.results_file && (
                  <a
                    href={`http://localhost:8000/api/analysis-results/${analysisId}/download`}
                    download
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Excel
                  </a>
                )}
              </div>
            </div>
            
            {/* Search and Filter Controls */}
            <div className="mb-6 space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Gene Search */}
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search genes..."
                      value={geneSearch}
                      onChange={(e) => setGeneSearch(e.target.value)}
                      className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                
                {/* Filter Toggle */}
                <div className="flex items-center">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={showOnlyPositive}
                      onChange={(e) => setShowOnlyPositive(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Show only positive scores</span>
                  </label>
                </div>
              </div>
              
              {/* Results Count */}
              <div className="text-sm text-gray-600">
                Showing {getFilteredAndSortedResults().length} of {results?.results?.length || results?.pagination?.total_count || 0} genes
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('gene_symbol')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Gene Symbol</span>
                        {getSortIcon('gene_symbol')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('total_score')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Total Score</span>
                        {getSortIcon('total_score')}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rule Scores
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {getFilteredAndSortedResults().map((result, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {result.gene_symbol}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatScore(result.total_score)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="space-y-1">
                          {result.rule_scores.map((ruleScore, ruleIndex) => (
                            <div key={ruleIndex} className="flex justify-between items-center">
                              <span className="text-xs text-gray-600">{ruleScore.rule_name}</span>
                              <span className="text-xs font-medium">
                                {formatScore(ruleScore.rule_score)} 
                                {ruleScore.rule_weight && ruleScore.rule_weight !== 1 && (
                                  <span className="text-gray-500 ml-1">(×{ruleScore.rule_weight})</span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Load More Button */}
            {results?.pagination?.total_count > (results?.results?.length || 0) && (
              <div className="mt-6 text-center">
                <button
                  onClick={loadMoreResults}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg"
                >
                  Load More Results
                </button>
                <p className="text-sm text-gray-600 mt-2">
                  Showing {results?.results?.length || 0} of {results?.pagination?.total_count || 0} results
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'summary' && summary && (
        <div className="space-y-6">
          {/* Score Statistics */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Score Statistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Minimum Score</p>
                <p className="text-2xl font-bold text-gray-900">{formatScore(summary.score_statistics?.min || (summary as any).score_distribution?.total_score?.min)}</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Maximum Score</p>
                <p className="text-2xl font-bold text-gray-900">{formatScore(summary.score_statistics?.max || (summary as any).score_distribution?.total_score?.max)}</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Mean Score</p>
                <p className="text-2xl font-bold text-gray-900">{formatScore(summary.score_statistics?.mean || (summary as any).score_distribution?.total_score?.mean)}</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Median Score</p>
                <p className="text-2xl font-bold text-gray-900">{formatScore(summary.score_statistics?.median || (summary as any).score_distribution?.total_score?.median)}</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Standard Deviation</p>
                <p className="text-2xl font-bold text-gray-900">{formatScore(summary.score_statistics?.std || (summary as any).score_distribution?.total_score?.std)}</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Total Count</p>
                <p className="text-2xl font-bold text-gray-900">{(summary.score_statistics?.count || (summary as any).score_distribution?.total_score?.count || summary.total_genes)?.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Top Genes */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Scoring Genes</h3>
            {summary.top_genes && summary.top_genes.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rank
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Gene Symbol
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Score
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {summary.top_genes.map((gene, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        #{index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {gene.gene_symbol}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatScore(gene.total_score)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No top genes data available</p>
              </div>
            )}
          </div>

          {/* Rule Statistics */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rule Statistics</h3>
            {summary.rule_statistics && summary.rule_statistics.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rule Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Weight
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Min Score
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Max Score
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Mean Score
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Std Dev
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {summary.rule_statistics.map((rule, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {rule.rule_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {rule.weight}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatScore(rule.score_stats?.min)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatScore(rule.score_stats?.max)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatScore(rule.score_stats?.mean)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatScore(rule.score_stats?.std)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No rule statistics available</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'histograms' && summary && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Score Distribution Histograms</h3>
              <button
                onClick={() => setIsHistogramsExpanded(!isHistogramsExpanded)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <span className="text-sm font-medium">
                  {isHistogramsExpanded ? 'Collapse' : 'Expand'}
                </span>
                {isHistogramsExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            </div>
            
            {isHistogramsExpanded && (
              <>
                <p className="text-gray-600 mb-6">
                  Visual distribution of scores across all rules and the final rubric score. 
                  These histograms help understand the distribution patterns of your analysis results.
                </p>
                
                {summary.score_distribution && Object.keys(summary.score_distribution).length > 0 ? (
                  <ScoreHistogramGrid 
                    analysisId={analysisId}
                    scoreColumns={Object.keys(summary.score_distribution)}
                  />
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>No score distribution data available</p>
                    <p className="text-sm mt-2">Histograms will be available once the analysis cache is generated.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
