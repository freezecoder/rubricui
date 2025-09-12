'use client';

import { XCircle, BarChart3, Download, ExternalLink, Database, Zap, AlertCircle } from 'lucide-react';
import { AnalysisExecution, AnalysisResults } from '@/types';
import { useState, useEffect } from 'react';
import { notify } from '@/lib/notifications';

interface AnalysisControlsProps {
  currentExecution: AnalysisExecution | null;
  analysisResults: AnalysisResults | null;
  showResults: boolean;
  onHideResults: () => void;
  onExportConfig?: () => void;
  canExportConfig?: boolean;
  projectId?: string;
}

export const AnalysisControls = ({
  currentExecution,
  analysisResults,
  showResults,
  onHideResults,
  onExportConfig,
  canExportConfig = false,
  projectId
}: AnalysisControlsProps) => {
  const [cacheStatus, setCacheStatus] = useState<{
    exists: boolean;
    pickle_exists: boolean;
    stats_exists: boolean;
    loading: boolean;
    error?: string;
  }>({
    exists: false,
    pickle_exists: false,
    stats_exists: false,
    loading: false
  });

  const [creatingCache, setCreatingCache] = useState(false);

  // Check cache status when execution completes
  useEffect(() => {
    if (currentExecution?.status === 'completed') {
      // Use analysis result ID if available, otherwise fall back to execution ID
      const analysisId = (analysisResults as any)?.analysis_result_id || currentExecution.id;
      if (analysisId) {
        checkCacheStatus(analysisId);
      }
    }
  }, [currentExecution?.status, currentExecution?.id, analysisResults]);

  const checkCacheStatus = async (analysisId: string) => {
    setCacheStatus(prev => ({ ...prev, loading: true }));
    try {
      const response = await fetch(`/api/result-cache/${analysisId}/exists`);
      const data = await response.json();
      setCacheStatus({
        exists: data.cache_exists,
        pickle_exists: data.pickle_exists,
        stats_exists: data.stats_exists,
        loading: false,
        error: data.error
      });
    } catch (error) {
      setCacheStatus(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to check cache status'
      }));
    }
  };

  const createCache = async (analysisId: string) => {
    setCreatingCache(true);
    try {
      const response = await fetch(`/api/result-cache/${analysisId}/create-cache`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        notify.operationCompleted(`Cache created successfully: ${data.message}`);
        // Refresh cache status
        await checkCacheStatus(analysisId);
      } else {
        notify.operationFailed('Cache creation', 'Failed to create cache');
      }
    } catch (error) {
      notify.operationFailed('Cache creation', 'Failed to create cache');
    } finally {
      setCreatingCache(false);
    }
  };
  return (
    <>
      {/* Action Buttons */}
      {onExportConfig && (
        <div className="mb-6 flex justify-center gap-4">
          <button
            onClick={onExportConfig}
            disabled={!canExportConfig}
            className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
            title="Export analysis configuration as YAML"
          >
            <Download className="h-5 w-5" />
            Export Config
          </button>
        </div>
      )}

      {/* Analysis Status */}
      {currentExecution && (
        <div className="mb-6 bg-white rounded-lg shadow-md p-6 border-2 border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Status</h3>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm text-gray-600">Execution ID: {currentExecution.id}</div>
              <div className="text-sm text-gray-600">Status: <span className="font-medium">{currentExecution.status}</span></div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Progress: {currentExecution.progress}%</div>
              <div className="text-sm text-gray-600">{currentExecution.message}</div>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${currentExecution.progress}%` }}
            ></div>
          </div>

          {/* Cache Status */}
          {currentExecution.status === 'completed' && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-md font-medium text-gray-900 flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Cache Status
                </h4>
                {!cacheStatus.exists && (
                  <button
                    onClick={() => {
                      // Use analysis result ID if available, otherwise fall back to execution ID
                      const analysisId = (analysisResults as any)?.analysis_result_id || currentExecution.id;
                      if (analysisId) {
                        createCache(analysisId);
                      }
                    }}
                    disabled={creatingCache}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Zap className="h-4 w-4" />
                    {creatingCache ? 'Creating...' : 'Create Cache'}
                  </button>
                )}
              </div>
              
              <div className="flex items-center gap-4 text-sm">
                {cacheStatus.loading ? (
                  <div className="flex items-center gap-2 text-gray-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    Checking cache status...
                  </div>
                ) : (
                  <>
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                      cacheStatus.exists 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {cacheStatus.exists ? (
                        <>
                          <Zap className="h-3 w-3" />
                          Cache Available
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3 w-3" />
                          No Cache
                        </>
                      )}
                    </div>
                    
                    {cacheStatus.exists && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span className={cacheStatus.pickle_exists ? 'text-green-600' : 'text-red-600'}>
                          • Pickle: {cacheStatus.pickle_exists ? '✓' : '✗'}
                        </span>
                        <span className={cacheStatus.stats_exists ? 'text-green-600' : 'text-red-600'}>
                          • Stats: {cacheStatus.stats_exists ? '✓' : '✗'}
                        </span>
                      </div>
                    )}
                    
                    {cacheStatus.error && (
                      <div className="text-xs text-red-600">
                        Error: {cacheStatus.error}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results Panel */}
      {showResults && analysisResults && (
        <div className="bg-white rounded-lg shadow-md p-6 border-2 border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Analysis Results
            </h3>
            <div className="flex items-center gap-3">
              {projectId && analysisResults && (
                <a
                  href={`/analysis/${analysisResults.analysis_result_id || analysisResults.execution_id}/details`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
                >
                  <ExternalLink className="h-4 w-4" />
                  View Full Results
                </a>
              )}
              <button
                onClick={onHideResults}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          {/* Score Distribution */}
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-900 mb-3">Score Distribution</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(analysisResults.score_distribution).map(([scoreName, stats]) => {
                // Calculate count of genes with this score (non-null, non-undefined, non-NaN)
                const genesWithScore = analysisResults.gene_scores.filter(gene => {
                  const score = gene.scores[scoreName];
                  return score !== undefined && score !== null && !isNaN(score);
                }).length;
                
                // Use valid_percentage from stats if available, otherwise calculate it
                const validPercentage = stats.valid_percentage !== undefined && stats.valid_percentage !== null
                  ? stats.valid_percentage.toFixed(1)
                  : (analysisResults.total_genes > 0 
                      ? (genesWithScore / analysisResults.total_genes * 100).toFixed(1)
                      : '0.0');
                
                return (
                  <div key={scoreName} className="p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
                    <div className="text-sm font-medium text-gray-900 mb-2">{scoreName}</div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <div className="flex justify-between">
                        <span>Count:</span>
                        <span className="font-medium">{genesWithScore.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Valid %:</span>
                        <span className="font-medium">{validPercentage}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Mean:</span>
                        <span>{stats.mean && !isNaN(stats.mean) ? stats.mean.toFixed(2) : 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Range:</span>
                        <span>
                          {stats.min && !isNaN(stats.min) ? stats.min.toFixed(2) : 'N/A'} - 
                          {stats.max && !isNaN(stats.max) ? stats.max.toFixed(2) : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Results Summary */}
          <div className="mb-4">
            <div className="text-sm text-gray-600">
              <strong>Total Genes Analyzed:</strong> {analysisResults.total_genes.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">
              <strong>Results File:</strong> {analysisResults.results_file}
            </div>
            <div className="text-sm text-gray-600">
              <strong>Completed:</strong> {new Date(analysisResults.completed_at).toLocaleString()}
            </div>
          </div>

          {/* Sample Results */}
          <div className="max-h-64 overflow-y-auto">
            <h4 className="text-md font-medium text-gray-900 mb-2">Sample Results</h4>
            <div className="text-xs">
              {analysisResults.gene_scores.slice(0, 10).map((gene, index) => (
                <div key={index} className="py-2 border-b-2 border-gray-200">
                  <span className="font-medium">{gene.gene_name}</span>
                  <span className="ml-2 text-gray-500">
                    Total Score: {gene.total_score && !isNaN(gene.total_score) ? gene.total_score.toFixed(2) : 'N/A'}
                  </span>
                </div>
              ))}
              {analysisResults.gene_scores.length > 10 && (
                <div className="text-gray-500 py-1">
                  ...and {analysisResults.gene_scores.length - 10} more genes
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
