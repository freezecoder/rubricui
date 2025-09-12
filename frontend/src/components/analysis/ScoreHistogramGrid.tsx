'use client';

import { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { 
  BarChart3, 
  Loader2, 
  AlertCircle, 
  TrendingUp,
  Minus,
  Plus
} from 'lucide-react';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface ScoreHistogram {
  bins: number[];
  counts: number[];
  bin_edges: number[];
  valid_count: number;
  total_count: number;
  bin_width: number;
  error?: string;
}

interface ScoreHistogramData {
  [scoreName: string]: ScoreHistogram;
}

interface ScoreHistogramGridProps {
  analysisId: string;
  scoreColumns: string[];
}

export default function ScoreHistogramGrid({ analysisId, scoreColumns }: ScoreHistogramGridProps) {
  const [histograms, setHistograms] = useState<ScoreHistogramData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedHistograms, setExpandedHistograms] = useState<Set<string>>(new Set());

  const loadHistograms = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`/api/result-cache/${analysisId}/histograms`);
      if (!response.ok) {
        throw new Error('Failed to fetch histograms');
      }
      
      const data = await response.json();
      setHistograms(data.histograms || {});
    } catch (err) {
      setError('Failed to load histograms');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (analysisId && scoreColumns.length > 0) {
      loadHistograms();
    }
  }, [analysisId, scoreColumns.length]);

  const toggleHistogramExpansion = (scoreName: string) => {
    const newExpanded = new Set(expandedHistograms);
    if (newExpanded.has(scoreName)) {
      newExpanded.delete(scoreName);
    } else {
      newExpanded.add(scoreName);
    }
    setExpandedHistograms(newExpanded);
  };

  const createChartData = (scoreName: string, histogram: ScoreHistogram) => {
    if (!histogram || histogram.bins.length === 0 || histogram.counts.length === 0) {
      return null;
    }

    // Create labels for bins (using bin centers)
    const labels = histogram.bins.map((bin, index) => {
      if (index < histogram.bin_edges.length - 1) {
        const binStart = histogram.bin_edges[index];
        const binEnd = histogram.bin_edges[index + 1];
        const binCenter = (binStart + binEnd) / 2;
        return binCenter.toFixed(2);
      }
      return bin.toFixed(2);
    });

    return {
      labels,
      datasets: [
        {
          label: scoreName,
          data: histogram.counts,
          backgroundColor: 'rgba(59, 130, 246, 0.6)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1,
          borderRadius: 2,
        },
      ],
    };
  };

  const createChartOptions = (scoreName: string, histogram: ScoreHistogram) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      tooltip: {
        callbacks: {
          title: (context: { dataIndex: number }[]) => {
            const dataIndex = context[0].dataIndex;
            if (dataIndex < histogram.bin_edges.length - 1) {
              const binStart = histogram.bin_edges[dataIndex];
              const binEnd = histogram.bin_edges[dataIndex + 1];
              return `Range: ${binStart.toFixed(3)} - ${binEnd.toFixed(3)}`;
            }
            return `Bin ${dataIndex + 1}`;
          },
          label: (context: { parsed: { y: number } }) => {
            return `Count: ${context.parsed.y}`;
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Score Value',
          font: {
            size: 10,
          },
        },
        ticks: {
          font: {
            size: 8,
          },
          maxTicksLimit: 5,
        },
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Count',
          font: {
            size: 10,
          },
        },
        ticks: {
          font: {
            size: 8,
          },
        },
        beginAtZero: true,
      },
    },
  });

  const getScoreTypeColor = (scoreName: string) => {
    if (scoreName.includes('_RUBRIC_SCORE')) {
      return 'bg-purple-100 text-purple-800 border-purple-200';
    } else if (scoreName.includes('_SCORE')) {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    } else {
      return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatScoreName = (scoreName: string) => {
    // Remove _SCORE suffix and replace underscores with spaces
    return scoreName.replace('_SCORE', '').replace(/_/g, ' ');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Loading score histograms...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <AlertCircle className="h-6 w-6 text-red-600" />
          <h3 className="text-lg font-semibold text-red-800">Error Loading Histograms</h3>
        </div>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={loadHistograms}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const availableHistograms = Object.keys(histograms).filter(scoreName => 
    histograms[scoreName] && !histograms[scoreName].error
  );

  if (availableHistograms.length === 0) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Histograms Available</h3>
        <p className="text-gray-600">
          Histograms haven&apos;t been generated for the score columns in this analysis yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <BarChart3 className="h-6 w-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Score Distribution Histograms</h3>
          <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded-full">
            {availableHistograms.length} of {scoreColumns.length}
          </span>
        </div>
      </div>

      {/* Histogram Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {availableHistograms.map((scoreName) => {
          const histogram = histograms[scoreName];
          const chartData = createChartData(scoreName, histogram);
          const isExpanded = expandedHistograms.has(scoreName);
          
          return (
            <div
              key={scoreName}
              className={`bg-white rounded-lg border border-gray-200 shadow-sm transition-all duration-200 hover:shadow-md ${
                isExpanded ? 'col-span-2 row-span-2' : ''
              }`}
            >
              {/* Header */}
              <div className="p-3 border-b border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getScoreTypeColor(scoreName)}`}>
                      {scoreName.includes('_RUBRIC_SCORE') ? 'Rubric' : 'Rule'}
                    </span>
                    <button
                      onClick={() => toggleHistogramExpansion(scoreName)}
                      className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      {isExpanded ? (
                        <Minus className="h-3 w-3" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>
                <h4 className="font-medium text-gray-900 text-sm truncate" title={formatScoreName(scoreName)}>
                  {formatScoreName(scoreName)}
                </h4>
                <p className="text-xs text-gray-500 truncate">
                  {histogram.valid_count.toLocaleString()} valid values
                  {histogram.total_count - histogram.valid_count > 0 && (
                    <span className="text-orange-600 ml-1">
                      ({histogram.total_count - histogram.valid_count} nulls)
                    </span>
                  )}
                </p>
              </div>

              {/* Stats */}
              {chartData && (
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                  <div className="grid grid-cols-3 gap-1 text-xs">
                    <div className="text-center">
                      <p className="text-gray-500 font-medium">Bins</p>
                      <p className="font-semibold text-gray-900">
                        {histogram.bins.length}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500 font-medium">Width</p>
                      <p className="font-semibold text-gray-900">
                        {histogram.bin_width.toFixed(3)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500 font-medium">Valid</p>
                      <p className="font-semibold text-gray-900">
                        {histogram.valid_count.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs mt-1">
                    <div className="text-center">
                      <p className="text-gray-500 font-medium">Min</p>
                      <p className="font-semibold text-gray-900">
                        {histogram.bin_edges[0]?.toFixed(3) || 'N/A'}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500 font-medium">Max</p>
                      <p className="font-semibold text-gray-900">
                        {histogram.bin_edges[histogram.bin_edges.length - 1]?.toFixed(3) || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Chart */}
              <div className={`p-3 ${isExpanded ? 'h-80' : 'h-32'}`}>
                {chartData ? (
                  <Bar data={chartData} options={createChartOptions(scoreName, histogram)} />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <div className="text-center">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">No data</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Missing Histograms Notice */}
      {scoreColumns.length > availableHistograms.length && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <div>
              <h4 className="font-medium text-yellow-800">Missing Histograms</h4>
              <p className="text-yellow-700 text-sm">
                {scoreColumns.length - availableHistograms.length} score columns don&apos;t have histograms yet. 
                This may be because the cache needs to be regenerated.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
