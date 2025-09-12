'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BarChart3, ArrowLeft, Download } from 'lucide-react';
import { AnalysisResults } from '@/types';

export default function AnalysisResultPage() {
  const params = useParams();
  const router = useRouter();
  const analysisId = params.id as string;
  
  const [analysisResults, setAnalysisResults] = useState<AnalysisResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalysisResults = async () => {
      try {
        setLoading(true);
        // TODO: Replace with actual API call to fetch analysis results by ID
        // const response = await fetch(`/api/analysis/${analysisId}/results`);
        // const data = await response.json();
        // setAnalysisResults(data);
        
        // For now, we'll show a placeholder
        setError('Analysis results not found. This feature is under development.');
      } catch (err) {
        setError('Failed to load analysis results');
        console.error('Error fetching analysis results:', err);
      } finally {
        setLoading(false);
      }
    };

    if (analysisId) {
      fetchAnalysisResults();
    }
  }, [analysisId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">Loading analysis results...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full px-6 py-6">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>
        <div className="flex justify-center items-center min-h-96">
          <div className="text-red-600 text-center">
            <h2 className="text-xl font-semibold mb-2">Error</h2>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!analysisResults) {
    return (
      <div className="w-full px-6 py-6">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>
        <div className="flex justify-center items-center min-h-96">
          <div className="text-gray-600">No analysis results found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="h-8 w-8" />
                Analysis Results
              </h1>
              <p className="text-gray-600 mt-2">Analysis ID: {analysisId}</p>
            </div>
          </div>
          <button
            onClick={() => {
              // TODO: Implement download functionality
              console.log('Download results');
            }}
            className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download Results
          </button>
        </div>
      </div>

      {/* Results Summary */}
      <div className="mb-6 bg-white rounded-lg shadow-md p-6 border-2 border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
            <div className="text-2xl font-bold text-blue-600">{analysisResults.total_genes.toLocaleString()}</div>
            <div className="text-sm text-blue-800">Total Genes Analyzed</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg border-2 border-green-200">
            <div className="text-2xl font-bold text-green-600">{Object.keys(analysisResults.score_distribution).length}</div>
            <div className="text-sm text-green-800">Score Types</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
            <div className="text-2xl font-bold text-purple-600">
              {new Date(analysisResults.completed_at).toLocaleDateString()}
            </div>
            <div className="text-sm text-purple-800">Completed Date</div>
          </div>
        </div>
      </div>

      {/* Score Distribution */}
      <div className="mb-6 bg-white rounded-lg shadow-md p-6 border-2 border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Score Distribution</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(analysisResults.score_distribution).map(([scoreName, stats]) => {
            // Calculate count of genes with this score
            const genesWithScore = analysisResults.gene_scores.filter(gene => 
              gene.scores[scoreName] !== undefined && gene.scores[scoreName] !== null
            ).length;
            
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
                    <span>{stats.mean?.toFixed(2) || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Range:</span>
                    <span>{stats.min?.toFixed(2) || 'N/A'} - {stats.max?.toFixed(2) || 'N/A'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Results */}
      <div className="bg-white rounded-lg shadow-md p-6 border-2 border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Results</h3>
        <div className="text-sm text-gray-600 mb-4">
          <div><strong>Results File:</strong> {analysisResults.results_file}</div>
          <div><strong>Completed:</strong> {new Date(analysisResults.completed_at).toLocaleString()}</div>
        </div>

        {/* Sample Results */}
        <div className="max-h-96 overflow-y-auto">
          <h4 className="text-md font-medium text-gray-900 mb-2">Sample Results</h4>
          <div className="text-xs">
            {analysisResults.gene_scores.slice(0, 20).map((gene, index) => (
              <div key={index} className="py-2 border-b border-gray-200">
                <span className="font-medium">{gene.gene_name}</span>
                <span className="ml-2 text-gray-500">
                  Total Score: {gene.total_score?.toFixed(2) || 'N/A'}
                </span>
                <div className="ml-4 text-gray-400">
                  {Object.entries(gene.scores).map(([scoreName, score]) => (
                    <span key={scoreName} className="mr-3">
                      {scoreName}: {score?.toFixed(2) || 'N/A'}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {analysisResults.gene_scores.length > 20 && (
              <div className="text-gray-500 py-2">
                ...and {analysisResults.gene_scores.length - 20} more genes
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
